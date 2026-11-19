#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{io::{self, BufRead, BufReader, Write}, mem, os::windows::{io::{AsRawHandle, FromRawHandle, OwnedHandle},process::CommandExt}, path::Path, process::{Child, Command, Stdio}, ptr, sync::{mpsc,Mutex}, time::Duration};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use windows_sys::Win32::System::JobObjects::*;

struct Backend { _job: OwnedHandle, _child: Child }
#[derive(serde::Deserialize)]
struct Ready { port: u16, token: String }

fn start(payload: &Path, data: &Path, lan: bool) -> io::Result<(Backend, Ready)> {
    let mut command = Command::new(payload.join("node.exe"));
    command.current_dir(payload).arg(payload.join("backend.cjs")).env("ROAMDOCK_DATA_ROOT", data)
        .env_remove("NODE_OPTIONS").env_remove("NODE_PATH")
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).creation_flags(0x08000000);
    if lan { command.arg("--lan"); }
    // Closing the shell's job also releases its serial workers on a crash.
    let job = unsafe {
        let h = CreateJobObjectW(ptr::null(), ptr::null());
        if h.is_null() { return Err(io::Error::last_os_error()); }
        let owned = OwnedHandle::from_raw_handle(h);
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if SetInformationJobObject(h, JobObjectExtendedLimitInformation, &info as *const _ as _, mem::size_of_val(&info) as u32) == 0 {return Err(io::Error::last_os_error());}
        owned
    };
    let mut child = command.spawn()?;
    if unsafe { AssignProcessToJobObject(job.as_raw_handle(), child.as_raw_handle()) } == 0 {
        let error=io::Error::last_os_error(); let _=child.kill(); let _=child.wait(); return Err(error);
    }
    let stdout=child.stdout.take().unwrap();
    child.stdin.as_mut().unwrap().write_all(b"START\n")?;
    let (tx,rx)=mpsc::channel();
    std::thread::spawn(move || {
        let mut reader=BufReader::new(stdout); let mut line=String::new();
        if reader.read_line(&mut line).is_ok() { let _=tx.send(serde_json::from_str::<Ready>(&line).ok()); }
        drop(tx); let _=io::copy(&mut reader,&mut io::sink());
    });
    let ready=rx.recv_timeout(Duration::from_secs(25)).ok().flatten()
        .filter(|v|v.port>0 && (32..=128).contains(&v.token.len()) && v.token.bytes().all(|b|b.is_ascii_alphanumeric() || b==b'-' || b==b'_'))
        .ok_or_else(||io::Error::other("Private backend did not become ready"))?;
    Ok((Backend{_job:job,_child:child},ready))
}
fn backend_smoke() -> Result<(),Box<dyn std::error::Error>> {
    use std::{net::{TcpStream,Shutdown},io::Read};
    let payload=std::env::current_exe()?.parent().unwrap().join("payload");
    let data=std::env::temp_dir().join(format!("dji-tauri-smoke-{}",std::process::id()));
    let (backend,r)=start(&payload,&data,false)?;
    let mut connection=TcpStream::connect(("127.0.0.1",r.port))?;
    connection.set_read_timeout(Some(Duration::from_secs(5)))?;
    write!(connection,"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nX-Console-Token: {}\r\nConnection: close\r\n\r\n",r.port,r.token)?;
    let mut response=String::new();connection.read_to_string(&mut response)?;
    if !response.starts_with("HTTP/1.1 200") || !response.contains("\"smsDeleteEnabled\":false") {return Err("Health probe failed".into());}
    let _=connection.shutdown(Shutdown::Both);
    let Backend{_job:job,_child:mut child}=backend;
    drop(job);
    child.wait()?;
    if TcpStream::connect(("127.0.0.1",r.port)).is_ok(){return Err("Listener survived job close".into());}
    std::fs::remove_dir_all(&data)?;
    std::fs::write("backend-smoke-result.txt","PASS: bundled Rust/Node handshake, health, disabled writes, job cleanup. No modem access.")?;
    Ok(())
}
fn main(){
    if std::env::args().any(|a|a=="--backend-smoke") {
        if backend_smoke().is_err(){std::process::exit(2);}
        return;
    }
    tauri::Builder::default().setup(|app|{
        let (backend,r)=start(&app.path().resource_dir()?.join("payload"),&app.path().app_local_data_dir()?,std::env::args().any(|a|a=="--lan"))?;
        app.manage(Mutex::new(backend));
        let url=tauri::Url::parse(&format!("http://127.0.0.1:{}/?token={}",r.port,r.token))?;
        let origin=url.origin();
        WebviewWindowBuilder::new(app,"main",WebviewUrl::External(url))
            .title("DJI 4G Tauri Lab").inner_size(1280.,860.).min_inner_size(880.,620.)
            .on_navigation(move |u| u.origin()==origin && (u.path()=="/" || u.path()=="/index.html"))
            .build()?;
        Ok(())
    }).run(tauri::generate_context!()).expect("Tauri lab startup failed");
}

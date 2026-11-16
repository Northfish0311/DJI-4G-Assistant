const test = require("node:test");
const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
const {createHash} = require("node:crypto");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const {createNoticeGate} = require("../web/sms-notices");
const {createSerialQueue} = require("../web/serial-queue");

test("one watch yields its handle before a serial owner starts and never interrupts a write", async () => {
  let finish, stopped = 0, starts = 0;
  const gate = createNoticeGate(createSerialQueue(), () => {
    starts++; return {done:new Promise(r=>{finish=r}), stop:()=>{stopped++}};
  });
  const watch = gate.watch("COM3"); assert.equal(gate.watch("COM3"),watch);
  let release, running = false;
  const task = gate.serial(async () => {running=true;return new Promise(r=>{release=r});});
  await new Promise(r=>setImmediate(r)); assert.equal(running,false); assert.equal(stopped,1);
  finish({ok:true,text:""}); await watch; await new Promise(r=>setImmediate(r));
  assert.equal(running,true); assert.equal((await gate.watch("COM3")).text,""); assert.equal(starts,1);
  release();await task;
});

test("C# reader validates notices, storage, text mode and SIM identity before and after read", {skip:process.platform!=="win32"}, () => {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"dji-sms-cs-")), exe=path.join(tmp,"reader.exe");
  try {
    const csc=path.join(process.env.SystemRoot,"Microsoft.NET","Framework64","v4.0.30319","csc.exe");
    const build=spawnSync(csc,["/nologo","/out:"+exe,path.resolve(__dirname,"../native/SmsReader.cs")],{encoding:"utf8"});
    assert.equal(build.status,0,build.stdout);
    const run=(args,input)=>spawnSync(exe,args,{input,encoding:"utf8",timeout:6000,windowsHide:true});
    assert.equal(run(["--parse-notice",'+CMTI: "SM",3']).stdout.trim(),"SM:3");
    assert.equal(run(["--parse-notice",'+CMTI: "MT",3;ATH']).status,2);
    const id="8900000000000000001", sig=createHash("sha256").update(id).digest("hex");
    function read(store,mode,last=id) {
      const rows=[["AT+QCCID","+QCCID: "+id],["AT+CPMS?",'+CPMS: "'+store+'",1,23'],["AT+CMGF?","+CMGF: "+mode],
        ["AT+CMGR=3",'+CMGR: "REC UNREAD","10086","","26/11/15,12:34:01+32"\n11'],["AT+QCCID","+QCCID: "+last]];
      return run(["--fixture","MT","3",sig],rows.map(([c,r])=>c+"\n"+Buffer.from(r).toString("base64")).join("\n")+"\n");
    }
    const success=read("MT",1); assert.equal(success.status,0);assert.match(success.stdout,/^\+CMGL: 3,"REC UNREAD"/);assert.match(success.stdout,/\n11$/);
    for(const bad of [read("SM",1),read("MT",0),read("MT",1,"8900000000000000002")]) {assert.equal(bad.status,2);assert.equal(bad.stdout,"");}
  } finally { if(fs.existsSync(exe)) fs.unlinkSync(exe); fs.rmdirSync(tmp); }
});

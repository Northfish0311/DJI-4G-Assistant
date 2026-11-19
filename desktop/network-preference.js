const path = require("node:path");
const {execFile} = require("node:child_process");
const guidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

function runPreference(mode, guid) {
  const lock = ["CheckLock","Block","Unblock"].includes(mode);
  const script = path.join(process.env.ROAMDOCK_RESOURCE_ROOT, "scripts", "windows", lock ? "dongle-data-lock.ps1" : "wifi-preference.ps1");
  const exe = path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Mode", mode];
  if (mode === "CheckLock") args[args.length - 1] = "Check";
  if (guid) args.push(lock ? "-ExpectedId" : "-ExpectedGuid", guid);
  // A wedged WMI or adapter query must not leave the promise unresolved: the caller
  // latches a running flag that would then refuse every later attempt until restart.
  return new Promise(resolve => execFile(exe, args, {windowsHide:true, maxBuffer:16384, timeout:20000},
    (error, stdout) => {
      resolve({code:error ? (typeof error.code === "number" && error.code >= 10 && error.code <= 21 ? error.code : 21) : 0,
        guid:["Check","CheckLock"].includes(mode) && !error ? stdout.trim() : ""});
    }));
}

function preferenceHandler({windowFor, origin, confirm, changed = () => {}, run = runPreference}) {
  let running = false;
  return async (event, mode, language) => {
    const trusted = () => {
      const win = windowFor();
      if (!win || win.isDestroyed() || !event.senderFrame || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) return false;
      try {
        const url = new URL(event.senderFrame.url);
        return url.origin === origin && ["/", "/index.html"].includes(url.pathname);
      } catch { return false; }
    };
    const lock = ["Block","Unblock"].includes(mode);
    if (!trusted() || !(lock || ["Prefer","Restore"].includes(mode))) return 21;
    if (running) return 19;
    running = true;
    try {
      const check = await run(lock ? "CheckLock" : "Check");
      if (check.code) return check.code;
      const idPattern = lock ? /^USB\\VID_2C7C&PID_0125&MI_04\\[a-z\d&._-]+$/i : guidPattern;
      if (!idPattern.test(check.guid) || !trusted()) return 21;
      if (!await confirm(windowFor(), mode, language === "zh") || !trusted()) return 15;
      const {code} = await run(mode, check.guid);
      if (code === 0) await changed();
      return code;
    } catch { return 21; }
    finally { running = false; }
  };
}
module.exports = {preferenceHandler, runPreference};

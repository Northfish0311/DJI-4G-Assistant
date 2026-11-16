const path = require("node:path");
const {execFile} = require("node:child_process");
const guidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

function runPreference(mode, guid) {
  const script = path.join(process.env.ROAMDOCK_RESOURCE_ROOT, "scripts", "windows", "wifi-preference.ps1");
  const exe = path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Mode", mode];
  if (guid) args.push("-ExpectedGuid", guid);
  return new Promise(resolve => execFile(exe, args, {windowsHide:true, maxBuffer:4096}, (error, stdout) => {
    resolve({code:error ? (typeof error.code === "number" && error.code >= 10 && error.code <= 21 ? error.code : 21) : 0,
      guid:mode === "Check" && !error ? stdout.trim() : ""});
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
    if (!trusted() || !["Prefer","Restore"].includes(mode)) return 21;
    if (running) return 19;
    running = true;
    try {
      const check = await run("Check");
      if (check.code) return check.code;
      if (!guidPattern.test(check.guid) || !trusted()) return 21;
      if (!await confirm(windowFor(), mode, language === "zh") || !trusted()) return 15;
      const {code} = await run(mode, check.guid);
      if (code === 0) await changed();
      return code;
    } catch { return 21; }
    finally { running = false; }
  };
}
module.exports = {preferenceHandler};

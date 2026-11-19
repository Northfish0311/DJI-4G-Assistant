const fs = require("fs");
const net = require("net");
const path = require("path");
const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require("electron");
const { preferenceHandler } = require("./network-preference");
const { loadOrCreateConsoleToken } = require("../web/pairing");

let mainWindow = null;
let localServer = null;
const smokeTest = process.env.ROAMDOCK_SMOKE_TEST === "1";
if (smokeTest) app.disableHardwareAcceleration();

function writeSmokeResult(value) {
  const output = process.env.ROAMDOCK_SMOKE_OUTPUT;
  if (!output) return;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(value, null, 2), "utf8");
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "0.0.0.0");
  });
}

async function choosePort(start = 8787, attempts = 20) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = start + offset;
    if (await portAvailable(candidate)) return candidate;
  }
  throw new Error("No free local port was found between 8787 and 8806.");
}

function configureRuntime(port) {
  process.env.HOST = "0.0.0.0";
  process.env.PORT = String(port);
  process.env.ROAMDOCK_RESOURCE_ROOT = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
  process.env.ROAMDOCK_DATA_ROOT = app.getPath("userData");
  process.env.CONSOLE_TOKEN = loadOrCreateConsoleToken(process.env.ROAMDOCK_DATA_ROOT);
  process.env.ALLOW_PROFILE_ACTIONS = "1";
  process.env.ALLOW_PROFILE_DOWNLOAD = "1";
  process.env.ALLOW_PROFILE_NICKNAME = "1";
  process.env.ALLOW_PROFILE_NOTIFICATIONS = "1";
  process.env.ALLOW_PROFILE_DELETE = "1";
  process.env.ALLOW_SMS_SEND = "1";
  process.env.ALLOW_SMS_DELETE = "1";
  process.env.ALLOW_CALL_ACTIONS = "1";
  process.env.ALLOW_USSD = "1";
  process.env.ALLOW_USB_MODE = "1";
  process.env.ALLOW_STOCK_BOOTSTRAP = "1";
  process.env.ALLOW_DRIVER_INSTALL = "1";
  process.env.ALLOW_VOICE_RUNTIME = "1";
}

function isLocalUrl(rawUrl, port) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === String(port);
  } catch {
    return false;
  }
}

function createWindow(port) {
  const audioPermission = (permission, details = {}) => {
    const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
    return permission === "media" && (!mediaTypes.length || mediaTypes.every((type) => type === "audio"));
  };
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => (
    audioPermission(permission, details) && isLocalUrl(requestingOrigin, port)
  ));
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(audioPermission(permission, details) && isLocalUrl(webContents.getURL(), port));
  });

  mainWindow = new BrowserWindow({
    width: Number(process.env.ROAMDOCK_SMOKE_WIDTH) || 1280,
    height: Number(process.env.ROAMDOCK_SMOKE_HEIGHT) || 860,
    minWidth: smokeTest ? 320 : 880,
    minHeight: smokeTest ? 480 : 620,
    show: false,
    backgroundColor: "#f4f6f7",
    title: "DJI 4G Assistant",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocalUrl(url, port)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isLocalUrl(url, port)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  mainWindow.once("ready-to-show", () => { if (!smokeTest) mainWindow.show(); });
  mainWindow.webContents.once("did-finish-load", async () => {
    if (!smokeTest) return;
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (process.env.ROAMDOCK_SMOKE_PAIRING === "1") {
      await mainWindow.webContents.executeJavaScript("openPairingDialog()");
      await mainWindow.webContents.executeJavaScript(`(async () => {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          const qr = document.querySelector("#pairingQr");
          const host = document.querySelector("#pairingUrl")?.textContent?.trim();
          const copy = document.querySelector("#copyPairingBtn");
          if (qr && !qr.hidden && qr.src.startsWith("data:image/") && host && host !== "--" && copy && !copy.disabled) {
            await qr.decode().catch(() => {});
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error("Pairing dialog did not become ready within 15 seconds.");
      })()`);
    }
    const snapshot = await mainWindow.webContents.executeJavaScript('({ title: document.title, views: document.querySelectorAll(".view").length, profiles: Boolean(document.querySelector("#profilesList")), sms: Boolean(document.querySelector("#smsList")), calls: Boolean(document.querySelector("#callStatus")), pairingOpen: document.querySelector("#pairingDialog")?.open === true, pairingReady: !document.querySelector("#pairingQr")?.hidden && document.querySelector("#pairingQr")?.src?.startsWith("data:image/") && document.querySelector("#pairingUrl")?.textContent?.trim() !== "--" && document.querySelector("#copyPairingBtn")?.disabled === false })');
    if (process.env.ROAMDOCK_CAPTURE_OUTPUT) {
      const image = await mainWindow.webContents.capturePage();
      fs.writeFileSync(process.env.ROAMDOCK_CAPTURE_OUTPUT, image.toPNG());
    }
    writeSmokeResult({ ok: true, snapshot });
    console.log("DESKTOP_SMOKE_OK " + JSON.stringify(snapshot));
    app.quit();
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  const token = encodeURIComponent(process.env.CONSOLE_TOKEN);
  const smokeHash = smokeTest && process.env.ROAMDOCK_SMOKE_HASH ? `#${process.env.ROAMDOCK_SMOKE_HASH.replace(/^#/, "")}` : "";
  mainWindow.loadURL(`http://127.0.0.1:${port}/?token=${token}${smokeHash}`);
}

async function startDesktop() {
  const port = await choosePort();
  configureRuntime(port);
  if (!smokeTest) ipcMain.handle("dongle:route-preference", preferenceHandler({
    windowFor: () => mainWindow, origin: "http://127.0.0.1:" + port,
    changed: () => require("../web/server").invalidateDefaultRoute(),
    confirm: async (win, mode, zh) => {
      const restore = mode === "Restore";
      const lock = mode === "Block" || mode === "Unblock";
      const lockMessage = mode === "Block"
        ? (zh ? "禁止电脑使用大疆流量？" : "Block this PC from using dongle data?")
        : (zh ? "重新允许电脑使用大疆流量？" : "Allow this PC to use dongle data again?");
      const message = zh ? (restore ? "恢复这块大疆网卡原来的优先级？" : "让 Windows 优先用 Wi-Fi 上网？")
        : (restore ? "Restore this dongle's original interface metrics?" : "Prefer Wi-Fi to this dongle?");
      const result = await dialog.showMessageBox(win, {type:"question", message:lock ? lockMessage : message,
        detail: lock ? (zh ? "只停用或启用大疆 USB 网卡。停用期间模块网页也不可达；不修改短信串口、SIM 或 Wi-Fi。Windows 可能需要管理员批准。" : "Only the dongle network adapter changes. Its USB web page is unavailable while blocked. The SMS port, SIM and Wi-Fi are untouched. Windows may ask for administrator approval.") : zh ? "只调整已识别的大疆 USB 网卡，不禁用网卡，不修改 SIM 或 APN。Windows 可能需要管理员批准。"
          : "Only the identified USB adapter's metrics will change. The adapter stays enabled. SIM and APN settings are untouched. Windows may request administrator approval.",
        buttons: zh ? ["取消","继续"] : ["Cancel","Continue"], defaultId:0, cancelId:0});
      return result.response === 1;
    },
  }));
  const { startServer } = require("../web/server");
  localServer = await startServer();
  Menu.setApplicationMenu(null);
  createWindow(port);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  // A second launch has nothing to clean up; exit immediately instead of going through
  // app.quit(), which can leave the process alive before the app is ready.
  app.exit(0);
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(startDesktop).catch((error) => {
    writeSmokeResult({ ok: false, error: error.stack || error.message });
    console.error("DESKTOP_START_ERROR", error.stack || error.message);
    if (!smokeTest) dialog.showErrorBox("DJI 4G Assistant could not start", error.stack || error.message);
    quitEveryProcess();
  });
}

// Closing the window must end every process this app started. Electron's quit can stall on
// an open keep-alive connection or a child PowerShell host, which used to leave the whole
// process group running in the background with no window to close again.
let quitting = false;
function quitEveryProcess(code = 0) {
  if (quitting) return;
  quitting = true;
  try { if (localServer?.listening) localServer.close(); } catch {}
  try { require("../web/server").stopBonjour(); } catch {}
  // Escape hatch: whatever is still holding the loop gets 1.5 s, then the process ends.
  setTimeout(() => app.exit(code), 1500);
  app.quit();
}

app.on("window-all-closed", () => quitEveryProcess());
app.on("before-quit", () => {
  quitting = true;
  try { if (localServer?.listening) localServer.close(); } catch {}
  try { require("../web/server").stopBonjour(); } catch {}
});
process.on("SIGINT", () => quitEveryProcess());
process.on("SIGTERM", () => quitEveryProcess());

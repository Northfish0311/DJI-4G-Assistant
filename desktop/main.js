const fs = require("fs");
const net = require("net");
const path = require("path");
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");

let mainWindow = null;
let localServer = null;
const smokeTest = process.env.ROAMDOCK_SMOKE_TEST === "1";

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
  process.env.CONSOLE_TOKEN = require("crypto").randomBytes(18).toString("base64url");
  process.env.PORT = String(port);
  process.env.ROAMDOCK_RESOURCE_ROOT = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
  process.env.ROAMDOCK_DATA_ROOT = app.getPath("userData");
  process.env.ALLOW_PROFILE_ACTIONS = "1";
  process.env.ALLOW_PROFILE_DOWNLOAD = "1";
  process.env.ALLOW_PROFILE_NICKNAME = "1";
  process.env.ALLOW_PROFILE_NOTIFICATIONS = "1";
  process.env.ALLOW_PROFILE_DELETE = "1";
  process.env.ALLOW_SMS_SEND = "1";
  process.env.ALLOW_USSD = "1";
  process.env.ALLOW_USB_MODE = "1";
  process.env.ALLOW_STOCK_BOOTSTRAP = "1";
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 880,
    minHeight: 620,
    show: false,
    backgroundColor: "#f4f6f7",
    title: "DJI RoamDock",
    autoHideMenuBar: true,
    webPreferences: {
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
    const snapshot = await mainWindow.webContents.executeJavaScript('({ title: document.title, views: document.querySelectorAll(".view").length, profiles: Boolean(document.querySelector("#profilesList")), sms: Boolean(document.querySelector("#smsList")) })');
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
  mainWindow.loadURL(`http://127.0.0.1:${port}/?token=${token}`);
}

async function startDesktop() {
  const port = await choosePort();
  configureRuntime(port);
  const { startServer } = require("../web/server");
  localServer = await startServer();
  Menu.setApplicationMenu(null);
  createWindow(port);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(startDesktop).catch((error) => {
    writeSmokeResult({ ok: false, error: error.stack || error.message });
    console.error("DESKTOP_START_ERROR", error.stack || error.message);
    if (!smokeTest) dialog.showErrorBox("DJI RoamDock could not start", error.stack || error.message);
    app.quit();
  });
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (localServer?.listening) localServer.close();
});

const {contextBridge, ipcRenderer} = require("electron");
contextBridge.exposeInMainWorld("dongleRouting", {
  preferWifi: language => ipcRenderer.invoke("dongle:route-preference", "Prefer", language),
  restore: language => ipcRenderer.invoke("dongle:route-preference", "Restore", language),
});

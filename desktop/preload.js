const {contextBridge, ipcRenderer} = require("electron");
contextBridge.exposeInMainWorld("dongleRouting", {
  block: language => ipcRenderer.invoke("dongle:route-preference", "Block", language),
  unblock: language => ipcRenderer.invoke("dongle:route-preference", "Unblock", language),
  preferWifi: language => ipcRenderer.invoke("dongle:route-preference", "Prefer", language),
  restore: language => ipcRenderer.invoke("dongle:route-preference", "Restore", language),
});

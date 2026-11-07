const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", Object.freeze({
  isDesktopApp: true,
  getVersion: () => ipcRenderer.invoke("desktop:get-version"),
}));

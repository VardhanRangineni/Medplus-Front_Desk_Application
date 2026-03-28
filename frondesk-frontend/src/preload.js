const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
});

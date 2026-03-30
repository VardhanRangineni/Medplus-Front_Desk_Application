const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getNetworkInfo:   ()             => ipcRenderer.invoke('get-network-info'),
  apiPost:          (path, body)   => ipcRenderer.invoke('api-post', { path, body }),
  storeAuthSession: (session)      => ipcRenderer.invoke('store-auth-session', session),
  getAuthSession:   ()             => ipcRenderer.invoke('get-auth-session'),
  clearAuthSession: ()             => ipcRenderer.invoke('clear-auth-session'),
});

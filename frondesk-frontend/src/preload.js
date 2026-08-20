const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getNetworkInfo:   ()                      => ipcRenderer.invoke('get-network-info'),
  getApiBaseUrl:    ()                      => ipcRenderer.invoke('get-api-base-url'),
  /** Authenticated generic request — JWT token is injected by the main process. */
  apiRequest:       (method, path, body)    => ipcRenderer.invoke('api-request', { method, path, body }),
  /** Legacy unauthenticated POST — used only by the login flow. */
  apiPost:          (path, body)            => ipcRenderer.invoke('api-post', { path, body }),
  storeAuthSession: (session)               => ipcRenderer.invoke('store-auth-session', session),
  getAuthSession:   ()                      => ipcRenderer.invoke('get-auth-session'),
  clearAuthSession: ()                      => ipcRenderer.invoke('clear-auth-session'),
  saveFileBytes:    (opts)                  => ipcRenderer.invoke('save-file-bytes', opts),
  beginTempExport:  ()                      => ipcRenderer.invoke('begin-temp-export'),
  appendTempExport: (tempPath, chunk)       => ipcRenderer.invoke('append-temp-export', tempPath, chunk),
  cancelTempExport: (tempPath)              => ipcRenderer.invoke('cancel-temp-export', tempPath),
  finishTempExport: (opts)                  => ipcRenderer.invoke('finish-temp-export', opts),

  /** ── Auto-Update APIs ──────────────────────────────────────────── */
  checkForUpdates:  ()                      => ipcRenderer.invoke('check-for-updates'),
  getUpdateState:   ()                      => ipcRenderer.invoke('get-update-state'),
  restartToUpdate:  ()                      => ipcRenderer.invoke('restart-to-update'),
  onUpdateStateChange: (callback) => {
    const subscription = (_event, state) => callback(state);
    ipcRenderer.on('update-state-change', subscription);
    // Return cleanup function
    return () => ipcRenderer.removeListener('update-state-change', subscription);
  },
});

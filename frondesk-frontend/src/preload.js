const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getNetworkInfo:   ()                      => ipcRenderer.invoke('get-network-info'),
  /** Authenticated generic request — JWT token is injected by the main process. */
  apiRequest:       (method, path, body)    => ipcRenderer.invoke('api-request', { method, path, body }),
  /** Legacy unauthenticated POST — used only by the login flow. */
  apiPost:          (path, body)            => ipcRenderer.invoke('api-post', { path, body }),
  storeAuthSession: (session)               => ipcRenderer.invoke('store-auth-session', session),
  getAuthSession:   ()                      => ipcRenderer.invoke('get-auth-session'),
  clearAuthSession: ()                      => ipcRenderer.invoke('clear-auth-session'),
  /**
   * Fetches an image by URL through the main process and returns a base64 data URI.
   * Works for both local server URLs and future cloud storage URLs.
   * Returns null if the URL is missing or the fetch fails.
   */
  getImage:         (url)                   => ipcRenderer.invoke('get-image', url),
});

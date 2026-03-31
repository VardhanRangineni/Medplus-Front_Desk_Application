const { app, BrowserWindow, ipcMain, net } = require('electron');
const path = require('node:path');
const os = require('os');

if (require('electron-squirrel-startup')) {
  app.quit();
}

function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const [name, iface] of Object.entries(interfaces)) {
    if (!iface) continue;
    for (const config of iface) {
      if (config.internal) continue;
      results.push({
        interface: name,
        ip: config.address,
        mac: config.mac,
        family: config.family,
      });
    }
  }

  return results;
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    icon: path.join(app.getAppPath(), 'src/Assets/images/logo.ico'),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Allow camera/microphone access for visitor selfie capture
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === 'media');
    }
  );

  mainWindow.webContents.session.setPermissionCheckHandler(
    (_webContents, permission) => permission === 'media'
  );

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

/* ── Auth session — stored in main process memory, cleared on app quit ── */
let authSession = null;

/* ── API proxy — all HTTP calls go through main process (no renderer CSP) ── */
const API_BASE_URL = 'http://localhost:8080';

/**
 * Shared helper: makes an HTTP request through Electron's net module.
 * Automatically attaches the stored JWT Bearer token when available.
 *
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} url     - Full URL including query string if any
 * @param {*}      [body]  - Request body (will be JSON-serialised); omit for GET
 * @returns {Promise<{ ok: boolean, status: number, body: *, error?: string }>}
 */
function makeApiRequest(method, url, body) {
  return new Promise((resolve) => {
    const req = net.request({ method: method.toUpperCase(), url });

    req.setHeader('Content-Type', 'application/json');
    if (authSession?.token) {
      req.setHeader('Authorization', `${authSession.tokenType ?? 'Bearer'} ${authSession.token}`);
    }

    let raw = '';
    req.on('response', (response) => {
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        try {
          resolve({
            ok:     response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            body:   JSON.parse(raw),
          });
        } catch {
          resolve({ ok: false, status: response.statusCode, body: null });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));

    if (body !== undefined && body !== null) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/* ── IPC handlers — removeHandler guards against HMR double-registration ── */

/**
 * Generic authenticated request handler.
 * Renderer calls: window.electronAPI.apiRequest(method, path, body?)
 *
 * path may include a query string, e.g. '/api/managed-users/search?q=foo'
 */
ipcMain.removeHandler('api-request');
ipcMain.handle('api-request', (_, { method, path, body }) =>
  makeApiRequest(method, `${API_BASE_URL}${path}`, body)
);

/**
 * Legacy unauthenticated POST handler — kept for backward compatibility
 * with the login flow which must work before a session exists.
 */
ipcMain.removeHandler('api-post');
ipcMain.handle('api-post', (_, { path, body }) =>
  makeApiRequest('POST', `${API_BASE_URL}${path}`, body)
);

ipcMain.removeHandler('get-network-info');
ipcMain.handle('get-network-info', () => getNetworkInfo());

ipcMain.removeHandler('store-auth-session');
ipcMain.handle('store-auth-session', (_, session) => {
  authSession = session;
  return true;
});

ipcMain.removeHandler('get-auth-session');
ipcMain.handle('get-auth-session', () => authSession);

ipcMain.removeHandler('clear-auth-session');
ipcMain.handle('clear-auth-session', () => {
  authSession = null;
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

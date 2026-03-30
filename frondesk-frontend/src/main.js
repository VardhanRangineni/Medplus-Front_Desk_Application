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

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

/* ── API proxy — all HTTP calls go through main process (no renderer CSP) ── */
const API_BASE_URL = 'http://localhost:8080';

ipcMain.handle('api-post', (_, { path, body }) => {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'POST',
      url: `${API_BASE_URL}${path}`,
    });
    request.setHeader('Content-Type', 'application/json');

    let raw = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        try {
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ ok: false, status: response.statusCode, body: {} });
        }
      });
    });
    request.on('error', (err) => {
      resolve({ ok: false, status: 0, error: err.message });
    });

    request.write(JSON.stringify(body));
    request.end();
  });
});

/* ── Auth session — stored in main process memory, cleared on app quit ── */
let authSession = null;

ipcMain.handle('get-network-info', () => getNetworkInfo());

ipcMain.handle('store-auth-session', (_, session) => {
  authSession = session;
  return true;
});

ipcMain.handle('get-auth-session', () => authSession);

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

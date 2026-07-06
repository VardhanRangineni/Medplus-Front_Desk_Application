const { app, BrowserWindow, ipcMain, net, dialog, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('os');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const isPackaged = app.isPackaged;
const isDev = !isPackaged;

function logDebug(...args) {
  if (isDev) {
    console.log(...args);
  }
}

function isIPv4Family(family) {
  return family === 'IPv4' || family === 4;
}

/** Workstation adapters for login MAC/IP binding (Node may report family as 4 or 'IPv4'). */
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const [name, iface] of Object.entries(interfaces)) {
    if (!iface) continue;
    for (const config of iface) {
      if (!isIPv4Family(config.family)) continue;
      if (config.address === '127.0.0.1') continue;

      results.push({
        interface: name,
        ip: config.address,
        mac: config.mac && config.mac !== '00:00:00:00:00:00' ? config.mac : '',
        family: 'IPv4',
        internal: Boolean(config.internal),
      });
    }
  }

  results.sort((a, b) => Number(a.internal) - Number(b.internal));
  return results;
}

function getPrimaryWorkstationMac() {
  const primary = getNetworkInfo()[0];
  return primary?.mac ?? '';
}

function getAppIconPath() {
  if (isPackaged) {
    return path.join(process.resourcesPath, 'icon.ico');
  }

  const candidates = [
    path.join(__dirname, '..', '..', 'src', 'Assets', 'images', 'icon.ico'),
    path.join(app.getAppPath(), 'src', 'Assets', 'images', 'icon.ico'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function getAppIconImage() {
  const iconPath = getAppIconPath();
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    logDebug('[MVMS] App icon missing or unreadable:', iconPath);
    return null;
  }
  return image;
}

/** Resolved at runtime — forge's MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY breaks on paths with `'`. */
function getPreloadPath() {
  return path.join(__dirname, '..', 'renderer', 'main_window', 'preload.js');
}

function resolveApiBaseUrl() {
  const fromBuild = process.env.FRONTDESK_API_URL?.trim();
  if (fromBuild) return fromBuild.replace(/\/$/, '');
  // if (isDev) return 'http://localhost:9090';
 if (isDev) return 'https://tapping-overhang-gigabyte.ngrok-free.dev/';
 return '';
}

const API_BASE_URL = resolveApiBaseUrl();

function ensureProductionConfig() {
  if (API_BASE_URL) return true;

  dialog.showErrorBox(
    'MedPlus Visitor Management System (MVMS) — configuration error',
    'This installer was built without a production API URL.\n\n'
      + 'Rebuild with FRONTDESK_API_URL in .env.production (see DEPLOY.md), '
      + 'then run npm run dist:win again.',
  );
  return false;
}

// Single-instance lock breaks forge `rs` restarts in dev (second process exits with no new window).
if (isPackaged) {
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      const [win] = BrowserWindow.getAllWindows();
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    });
  }
}

if (process.platform === 'win32') {
  // Dev uses a separate ID so Windows does not reuse the cached production/pinned taskbar icon.
  app.setAppUserModelId(isDev ? 'com.medplus.mvms.dev' : 'com.medplus.mvms');
}

const createWindow = () => {
  const appIcon = getAppIconImage();

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    show: false,
    backgroundColor: '#f0f2f7',
    icon: appIcon ?? undefined,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const verifyPreloadBridge = () => {
    if (!isDev || mainWindow.isDestroyed()) return;
    mainWindow.webContents
      .executeJavaScript('Boolean(window.electronAPI && window.electronAPI.apiPost)')
      .then((ok) => {
        logDebug('[MVMS] Preload bridge in renderer:', ok ? 'OK' : 'MISSING');
      })
      .catch(() => {});
  };

  mainWindow.webContents.on('dom-ready', verifyPreloadBridge);

  mainWindow.once('ready-to-show', () => {
    if (appIcon) {
      mainWindow.setIcon(appIcon);
    }
    mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (isDev) {
      logDebug('[MVMS] Renderer loaded:', MAIN_WINDOW_WEBPACK_ENTRY);
    }
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (process.env.ELECTRON_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

let authSession = null;

function makeApiRequest(method, url, body) {
  return new Promise((resolve) => {
    const req = net.request({ method: method.toUpperCase(), url });

    req.setHeader('Content-Type', 'application/json');
    if (/ngrok/i.test(url)) {
      req.setHeader('ngrok-skip-browser-warning', 'true');
    }
    if (authSession?.token) {
      req.setHeader('Authorization', `${authSession.tokenType ?? 'Bearer'} ${authSession.token}`);
      const workstationMac = getPrimaryWorkstationMac();
      if (workstationMac) {
        req.setHeader('X-Workstation-Mac', workstationMac);
      }
    }

    let raw = '';
    req.on('response', (response) => {
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        try {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            body: JSON.parse(raw),
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

ipcMain.removeHandler('api-request');
ipcMain.handle('api-request', (_, { method, path: apiPath, body }) =>
  makeApiRequest(method, `${API_BASE_URL}${apiPath}`, body),
);

ipcMain.removeHandler('api-post');
ipcMain.handle('api-post', (_, { path: apiPath, body }) =>
  makeApiRequest('POST', `${API_BASE_URL}${apiPath}`, body),
);

ipcMain.removeHandler('get-network-info');
ipcMain.handle('get-network-info', () => getNetworkInfo());

ipcMain.removeHandler('get-api-base-url');
ipcMain.handle('get-api-base-url', () => API_BASE_URL);

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
  if (!ensureProductionConfig()) {
    app.quit();
    return;
  }

  logDebug('[MVMS] API base URL:', API_BASE_URL);
  logDebug('[MVMS] IPv4 adapters:', getNetworkInfo().length);
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

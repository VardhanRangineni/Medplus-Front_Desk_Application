const { app, BrowserWindow, ipcMain, net, dialog, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('os');
const { autoUpdater } = require('electron-updater');

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
  if (isDev) return 'http://localhost:9090';
//  if (isDev) return 'https://tapping-overhang-gigabyte.ngrok-free.dev/';
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

ipcMain.removeHandler('save-file-bytes');
ipcMain.handle('save-file-bytes', async (_, { defaultPath, data, filters }) => {
  try {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      defaultPath: defaultPath || 'export',
      filters: filters?.length ? filters : [{ name: 'All Files', extensions: ['*'] }],
    });
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }
    fs.writeFileSync(filePath, Buffer.from(data));
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message || 'Save failed.' };
  }
});

/** Chunked export: write temp under os.tmpdir(), then move after save dialog. */
function assertExportTempPath(tempPath) {
  const resolved = path.resolve(tempPath);
  const tmpRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(tmpRoot + path.sep) && resolved !== tmpRoot) {
    throw new Error('Invalid export temp path.');
  }
  if (!path.basename(resolved).startsWith('mvms-export-')) {
    throw new Error('Invalid export temp file.');
  }
  return resolved;
}

ipcMain.removeHandler('begin-temp-export');
ipcMain.handle('begin-temp-export', () => {
  const tempPath = path.join(
    os.tmpdir(),
    `mvms-export-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`,
  );
  fs.writeFileSync(tempPath, Buffer.alloc(0));
  return { tempPath };
});

ipcMain.removeHandler('append-temp-export');
ipcMain.handle('append-temp-export', (_, tempPath, chunk) => {
  const resolved = assertExportTempPath(tempPath);
  fs.appendFileSync(resolved, Buffer.from(chunk));
  return { ok: true };
});

ipcMain.removeHandler('cancel-temp-export');
ipcMain.handle('cancel-temp-export', (_, tempPath) => {
  try {
    const resolved = assertExportTempPath(tempPath);
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
  } catch {
    /* ignore */
  }
  return { ok: true };
});

ipcMain.removeHandler('finish-temp-export');
ipcMain.handle('finish-temp-export', async (_, { tempPath, defaultPath, filters }) => {
  const resolved = assertExportTempPath(tempPath);
  try {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      defaultPath: defaultPath || 'export',
      filters: filters?.length ? filters : [{ name: 'All Files', extensions: ['*'] }],
    });
    if (canceled || !filePath) {
      try { fs.unlinkSync(resolved); } catch { /* ignore */ }
      return { ok: false, canceled: true };
    }
    fs.copyFileSync(resolved, filePath);
    try { fs.unlinkSync(resolved); } catch { /* ignore */ }
    return { ok: true, filePath };
  } catch (err) {
    try { fs.unlinkSync(resolved); } catch { /* ignore */ }
    return { ok: false, error: err.message || 'Save failed.' };
  }
});

/* ── Auto-Update (electron-updater + GitHub Releases) ─────────────────────── */

// State shared with renderer via IPC
let updateState = {
  checking: false,
  available: false,
  version: '',
  downloadProgress: null,     // { percent, bytesPerSecond, transferred, total }
  downloaded: false,
  error: null,
};

// Only enable in production builds
if (isPackaged) {
  // Explicitly set GitHub update feed URL so electron-updater doesn't look for local app-update.yml
  const pkg = require('../package.json');
  const publishCfg = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : pkg.build.publish;
  if (publishCfg && publishCfg.provider === 'github') {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: publishCfg.owner,
      repo: publishCfg.repo,
    });
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.requestAdminRights = true;

  autoUpdater.on('checking-for-update', () => {
    logDebug('[MVMS-Update] Checking for updates…');
    updateState = { ...updateState, checking: true, error: null };
    broadcastUpdateState();
  });

  autoUpdater.on('update-available', (info) => {
    logDebug('[MVMS-Update] Update available:', info.version);
    updateState = { ...updateState, checking: false, available: true, version: info.version ?? '' };
    broadcastUpdateState();
  });

  autoUpdater.on('update-not-available', (info) => {
    logDebug('[MVMS-Update] No update available (current:', info?.version, ')');
    updateState = { ...updateState, checking: false, available: false, version: '' };
    broadcastUpdateState();
  });

  autoUpdater.on('download-progress', (progress) => {
    const pg = {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    };
    logDebug(`[MVMS-Update] Download progress: ${progress.percent.toFixed(1)}%`);
    updateState = { ...updateState, downloadProgress: pg };
    broadcastUpdateState();
  });

  autoUpdater.on('update-downloaded', (info) => {
    logDebug('[MVMS-Update] Update downloaded:', info.version);
    updateState = {
      ...updateState,
      checking: false,
      available: false,
      downloadProgress: null,
      downloaded: true,
      version: info.version ?? '',
    };
    broadcastUpdateState();
  });

  autoUpdater.on('error', (err) => {
    logDebug('[MVMS-Update] Error:', err?.message ?? err);
    updateState = {
      ...updateState,
      checking: false,
      error: err?.message ?? 'Update failed',
    };
    broadcastUpdateState();
  });

  // Check for updates on startup (after window is ready)
  app.whenReady().then(() => {
    // Small delay so the GitHub API call doesn't race with window creation
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        logDebug('[MVMS-Update] Startup check failed:', err?.message);
      });
    }, 5000);
  });
}

function broadcastUpdateState() {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    win.webContents.send('update-state-change', updateState);
  }
}

// IPC: renderer asks main to check for updates
ipcMain.removeHandler('check-for-updates');
ipcMain.handle('check-for-updates', async () => {
  if (!isPackaged) {
    return { ok: false, error: 'Updates are only available in production builds.' };
  }
  try {
    console.log('[MVMS-Update] Renderer triggered check-for-updates');
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    console.error('[MVMS-Update] checkForUpdates error:', err, err?.stack);
    return { ok: false, error: err?.message ?? JSON.stringify(err) ?? 'Check failed' };
  }
});

// IPC: renderer asks current state
ipcMain.removeHandler('get-update-state');
ipcMain.handle('get-update-state', () => updateState);

// IPC: renderer requests install & restart
ipcMain.removeHandler('restart-to-update');
ipcMain.handle('restart-to-update', () => {
  if (!isPackaged || !updateState.downloaded) {
    return;
  }
  autoUpdater.quitAndInstall();
});

/* ── App Lifecycle ───────────────────────────────────────────────────────── */

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

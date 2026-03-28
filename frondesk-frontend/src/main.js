const { app, BrowserWindow, ipcMain } = require('electron');
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

ipcMain.handle('get-network-info', () => {
  return getNetworkInfo();
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

/**
 * Windows dev: taskbar uses electron.exe embedded icon, not BrowserWindow.icon alone.
 * Patch node_modules/electron/dist/electron.exe so npm start shows the MVMS icon.
 */
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  if (process.platform !== 'win32') return;

  const iconPath = path.resolve(__dirname, '../src/Assets/images/icon.ico');
  if (!fs.existsSync(iconPath)) {
    console.warn('[dev-icon] icon.ico not found — skipping electron.exe patch');
    return;
  }

  let rcedit;
  try {
    rcedit = require('rcedit');
  } catch {
    console.warn('[dev-icon] Install rcedit (npm install) to update the dev taskbar icon');
    return;
  }

  const electronDist = path.dirname(require('electron'));
  const exePath = path.join(electronDist, process.platform === 'win32' ? 'electron.exe' : 'Electron.app');

  if (!fs.existsSync(exePath)) {
    console.warn('[dev-icon] electron executable not found — skipping patch');
    return;
  }

  await rcedit(exePath, {
    icon: iconPath,
    'product-name': 'MedPlus MVMS (Dev)',
    'file-description': 'MedPlus Visitor Management System (Dev)',
  });

  console.log('[dev-icon] Patched electron.exe with', path.basename(iconPath));
}

main().catch((err) => {
  console.warn('[dev-icon] Patch failed:', err.message);
});

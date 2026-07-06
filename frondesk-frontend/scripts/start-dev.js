/**
 * Dev launcher — Electron's SUID chrome-sandbox is a Linux-only concern.
 * Windows builds are unaffected; on Linux we disable the sandbox for local dev.
 */
const { spawnSync } = require('node:child_process');

const env = { ...process.env };
if (process.platform === 'linux') {
  env.ELECTRON_DISABLE_SANDBOX = '1';
}

const result = spawnSync('npx', ['electron-forge', 'start'], {
  stdio: 'inherit',
  env,
  shell: true,
});

process.exit(result.status ?? 1);

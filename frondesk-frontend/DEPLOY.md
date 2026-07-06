# MedPlus Visitor Management System (MVMS) — Windows deployment

## Before you build

1. Copy `.env.production.example` → `.env.production`
2. Set `FRONTDESK_API_URL` to your production API (HTTPS, no trailing slash), e.g. `https://mvms-api.medplus.in`
3. Ensure backend is reachable from reception PCs on that URL

## Build outputs (do not ship the unpacked folder alone)

| Command | Output | Use |
|---------|--------|-----|
| `npm run make` | `out/make/squirrel.windows/x64/MedPlusMVMS-Setup.exe` | Squirrel installer (updates-friendly) |
| `npm run dist:win` | `dist-installer/MedPlus Visitor Management System Setup *.exe` | **Recommended** — NSIS wizard (install path, shortcuts, uninstaller) |

Both require **Node 18+** on the build machine. Run from `frondesk-frontend/`.

### Recommended for rollout

```bash
npm install
npm run dist:win
```

Distribute **`dist-installer/MedPlus Visitor Management System Setup *.exe`** to IT or each site. Staff run the wizard — not the raw `MedPlusMVMS.exe` inside `out/medplus-mvms-win32-x64/` (unpacked test build only).

### Development

```bash
npm start
```

Uses `http://localhost:9090` unless `.env` sets `FRONTDESK_API_URL`.

## Code signing (optional, recommended)

Unsigned installers may trigger SmartScreen. Sign with your org certificate:

- Squirrel: `certificateFile` / `certificatePassword` in `forge.config.js`
- NSIS: `sign` in `package.json` → `build.win` (electron-builder)

## Workstation requirements

- Windows 10/11 x64
- Network access to `FRONTDESK_API_URL`
- Login binds to workstation MAC (same as testing)

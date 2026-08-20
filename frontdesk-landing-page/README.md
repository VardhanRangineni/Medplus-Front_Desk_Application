# MedPlus Visitor Management System — Landing Page

Marketing / download page for the MVMS Windows desktop app.

## Sections

- Product name & logo
- Key features & benefits
- App screenshots from `src/assets/` (Dashboard, Check In-out, Reports, etc.)
- System requirements
- **Download** — serves `MedPlus Visitor Management System Setup 1.0.0.exe` from `src/assets/`

## Development

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

Output is in `dist/`. Deploy that folder to Netlify, IIS, or any static host.

## Installer asset

Place the Windows installer at:

`src/assets/MedPlus Visitor Management System Setup 1.0.0.exe`

When users click **Download for Windows**, the browser downloads this file. After building, it is copied into `dist/assets/`.

To ship a new version, replace the `.exe` and update `APP_VERSION` / `INSTALLER_FILENAME` in `src/App.jsx`.

## Logo

Replace `src/assets/logo.png` (PNG; transparent background works best on the red hero).

## Screenshots

Screenshot PNGs live in **`src/assets/`**:

- `Dashboard.png`
- `Check In-out.png`
- `Reports.png`
- `Cards.png`
- `Staff Activity.png`
- `User Management.png`

To add or change screens, replace the files and update the `SCREENSHOTS` array in `src/App.jsx`.

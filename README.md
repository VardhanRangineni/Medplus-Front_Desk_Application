# MedPlus Visitor Management System (MVMS)

Production repo: **Electron desktop app (MVMS)** + **Spring Boot API** + **Netlify visitor pre-reg** (QR self check-in).

## Structure

| Folder | Role |
|--------|------|
| `frondesk-frontend/` | Electron + React MVMS UI (staff scan QR at check-in) |
| `frontdesk-backend/` | REST API, MySQL, JWT auth |
| `netlify-form/` | Static walk-in pre-registration page (visitor gets `PREREG:` QR) |

Removed from this repo (not required for MVMS production):

- `appointment-booking-web/` — public booking SPA (APIs remain on backend if needed)
- `medplus-mail/` — separate mail UI experiment

## Prerequisites

- Node.js 18+
- Java 17+
- MySQL 8+

## Backend

```bash
cd frontdesk-backend
./mvnw spring-boot:run
```

Default: `http://localhost:9090`

Configure DB and secrets in `frontdesk-backend/src/main/resources/application.properties` (use env-specific overrides for production; do not commit real passwords).

## Electron app (MVMS)

```bash
cd frondesk-frontend
npm install
npm start
```

Production build (embed API URL, then create Windows installer):

```bash
cd frondesk-frontend
cp .env.production.example .env.production   # edit FRONTDESK_API_URL
npm run dist:win
```

Ship **`dist-installer/MedPlus Visitor Management System Setup *.exe`** (NSIS wizard — not the raw `MedPlusMVMS.exe`).

See `frondesk-frontend/DEPLOY.md` for Squirrel vs NSIS and code signing.

## Visitor QR flow (Netlify + MVMS)

1. Visitor opens Netlify URL (from lobby QR poster): `netlify-form/index.html?api=https://YOUR-BACKEND:9090`
2. Form posts to `POST /api/pre-register/public/walk-in` → visitor receives QR with payload `PREREG:{token}`
3. At reception, staff use **Check In/Out → Scan QR** in MVMS → `GET /preview/{token}` → `POST /checkin/{token}`

Deploy `netlify-form/` to Netlify (or any static host). The `?api=` query param must point at your running backend.

`frontdesk-backend/src/main/resources/static/register.html` is the same form served from the backend for local/testing.

## Other public backend endpoints

- `/api/pre-register/public/**` — pre-registration API (used by Netlify form)

Reception staff use the MVMS desktop app against authenticated `/api/**` routes.

**Removed:** public appointment booking UI, Appointments screen, `/api/appointments/**`, Report Settings screen, `/api/report-schedule/**`, scheduled Zimbra email reports, User Master / Location Master **admin screens**, `/api/users/**`, `/api/sync/**`, and HR/ERP sync (`ExternalApiClient`). On startup the backend no longer creates `appointmentslog`, `busy_slots`, `report_schedule`, or `zimbra_sessions` (existing DBs drop them via migration).

**Still in MySQL (required):** `locations` (sites) and `usermanagement` (logins + employee directory for person-to-meet). Old `usermaster` / `locationmaster` tables are migrated away on startup and dropped.

**Kept for dropdowns:** `GET /api/locations/active`, `GET /api/locations/search` (shared `frondesk-frontend/src/services/locationService.js`).

# Key Management — Host arrival SMS & approval

When a visitor or employee is checked in at the desk (manual or QR), MVMS:

1. Resolves person-to-meet phone (local user / HRMS)
2. Stores `personToMeetPhone` on `visitorlog`
3. If that mobile is an **active** Key Management contact:
   - Sets visit status to `PENDING_APPROVAL` (otherwise `CHECKED_IN`)
   - After DB commit: builds `{app.host-notify.public-base-url}{portal_token}`, shortens via mdpls.in, SMS the host
4. Host opens the portal link → Approve (`CHECKED_IN`) or Reject (`REJECTED`)

## Visit statuses

| Status | Meaning |
|--------|---------|
| `PENDING_APPROVAL` | Desk check-in done; waiting for KM host |
| `CHECKED_IN` | Approved (or no KM host needed) |
| `REJECTED` | Host rejected |
| `CHECKED_OUT` | Left |

Electron “Checked-in” tab includes both `CHECKED_IN` and `PENDING_APPROVAL`.

## SMS template

Target copy:

```text
Dear {#alp#}, a visitor is here to meet you. View details: {#urg#} - MedPlus
```

Until that template is registered, config reuses `MVMS_QR` with **URL only**:

```properties
medplus.sms.host-notify-template=MVMS_QR
medplus.sms.host-notify-include-name=false
```

When the new template is ready (params: name, then URL):

```properties
medplus.sms.host-notify-template=MVMS_HOST_NOTIFY
medplus.sms.host-notify-include-name=true
```

## Portal security

Each Key Management contact has a permanent `portal_token` used in SMS links.

Admins/Supervisors can **Regenerate approval link** from the Key Management screen.
That burns the old token immediately (old SMS links stop working) and issues a new one
for future check-in SMS. The portal URL / token is never shown in the Electron UI.

## Portal app (`managemet_approval`)

- Public URL: `{base}/{portal_token}` (no login)
- APIs:
  - `GET /api/key-management/public/portal/{portalToken}` — today’s visits for that host
  - `POST .../visits/{visitorId}/approve`
  - `POST .../visits/{visitorId}/reject` body `{ "remarks": "..." }`
  - Admin: `POST /api/key-management/contacts/{id}/regenerate-token`

```bash
cd managemet_approval
npm run dev   # http://localhost:5175
```

Set backend:

```properties
app.host-notify.enabled=true
app.host-notify.public-base-url=http://localhost:5175/
```

For phone SMS, expose the approval app (ngrok) and set `public-base-url` to that HTTPS origin.

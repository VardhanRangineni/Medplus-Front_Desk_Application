# MVMS Visit Pass — Desk Walk-in Pipeline

When a receptionist checks in a **visitor** with a valid mobile, MVMS:

1. Creates a `preregistrations` row (`status=CHECKED_IN`, linked `visitorId`)
2. Renders visit-card PNG (same layout as web self-reg, QR = `PREREG:{token}`)
3. Uploads to MedPlus image server (marigold interim) — public URL = step-2 `imageServerUrl` + step-3 `imagePath`
4. Shortens that image URL via `https://mdpls.in`
5. Sends SMS via `MVMS_QR` template on `tpa.medplusindia.com`

Check-in **always succeeds**; pass delivery runs **async**. Failures are logged on `preregistrations.visitCardSmsStatus`.

## Config (`application.properties`)

- `app.visit-pass.enabled=true`
- Image: `medplus.image.*` (meditimes_client, origin=MVMS; OAuth `:6728`, transit `:6426`)
- Shortener: `medplus.shortener.*`
- SMS: `medplus.sms.*` (reuses Iris OAuth credentials)

## API

- `POST /api/visitors` — response includes `visitPassToken`, `visitPassSmsStatus`, `visitPassMessage`
- `POST /api/visitors/{id}/resend-visit-pass` — manual resend

## DB columns (`preregistrations`)

`visitCardImageUrl`, `visitCardShortUrl`, `visitCardSentAt`, `visitCardSmsStatus`, `visitCardSmsError`

Desk walk-in also copies `visitCardImageUrl` → `visitorlog.imageUrl` after upload.

Existing DBs are patched on startup by `VisitPassSchemaMigration`.

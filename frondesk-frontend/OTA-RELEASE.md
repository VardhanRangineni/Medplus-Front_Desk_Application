# OTA Release Workflow

## Prerequisites
- `GH_TOKEN` environment variable set (GitHub personal access token with `repo` scope)
- Node.js 18+, npm installed

## Steps to release version X.Y.Z

1. Update `package.json` version to `X.Y.Z`
2. Copy `.env.production.example` to `.env.production` and set `FRONTDESK_API_URL` to your production API
3. Run: `npm run dist:win:publish` (requires `GH_TOKEN` env var)
   - This packages the app, builds the NSIS installer, and publishes to GitHub Releases
   - electron-builder automatically uploads: installer, latest.yml, and blockmap
4. Verify the release at: https://github.com/VardhanRangineni/Medplus-Front_Desk_Application/releases

## How OTA works for end users

1. User starts the app -> auto-checks GitHub for updates (5s delay)
2. If newer release exists -> downloads automatically
3. Download complete -> "Restart and Install" appears in About page
4. User clicks restart -> app installs new version

## Testing OTA locally

1. Build version 1.0.7 with `npm run dist:win:publish`
2. Install the resulting .exe on a test machine
3. Build version 1.0.8 and publish again
4. Launch the 1.0.7 install — it should detect 1.0.8 as available
5. Open About page (header -> About) -> "Check for Updates" -> download -> restart

## Environment variables

| Variable | Required for | Value |
|---|---|---|
| `GH_TOKEN` | Publishing to GitHub | Personal access token with `repo` scope |
| `FRONTDESK_API_URL` | Build-time config | Your production API URL |

# Cursor Prompt — Electron GitHub OTA Auto-Update

Implement **OTA auto-updates for the existing Electron application using GitHub Releases and `electron-updater`**.

Before making any changes, inspect the existing Electron project structure, `package.json`, Electron main process, preload configuration, and current `electron-builder` packaging configuration. Do not replace or restructure the existing architecture unnecessarily.

## Requirements

### 1. Use `electron-updater`

- Add `electron-updater` if it is not already installed.
- Use the existing Electron main process.
- Do not implement a custom file-replacement/update mechanism.

### 2. Use GitHub Releases as the update provider

- Configure `electron-builder` to publish updates through GitHub Releases.
- Do not hardcode GitHub credentials or tokens in source code.
- Use environment variables or the existing secure build/release mechanism for credentials.

### 3. Automatic update checking

- When the Electron application starts, check GitHub for a newer release.
- Do not check repeatedly in a tight loop.
- Also provide a reasonable way to check for updates manually if the application already has a Settings/About section.

### 4. Update lifecycle

Implement handling for:

- `checking-for-update`
- `update-available`
- `update-not-available`
- `download-progress`
- `update-downloaded`
- `error`

### 5. User experience

Add a clean update flow:

- If no update exists, continue normally.
- If an update is available, notify the user.
- Show download progress while the update is downloading.
- Once downloaded, show:
  **"Update ready. Restart the application to install the latest version."**
- Allow the user to restart and install the update.
- Do not force-close the application unexpectedly.

### 6. React ↔ Electron communication

If the renderer needs update status/progress:

- Use the existing preload architecture.
- Expose only the required update APIs through `contextBridge`.
- Do NOT enable `nodeIntegration` just to make the update functionality work.
- Keep `contextIsolation` enabled.

### 7. Version handling

- Use the application's existing `package.json` version as the source of truth.
- Explain how changing the version from, for example:
  `1.0.0 → 1.0.1`
  causes the next release to be detected as an update.

### 8. GitHub Release configuration

Configure the project so that a release build can generate the required update artifacts, such as:

- Windows installer
- `latest.yml`
- blockmap files where applicable

The GitHub repository should be configured using placeholders if the repository information is not already present.

### 9. Do not automatically publish during normal development builds

Keep local development builds separate from production release publishing.

### 10. Production safety

- Do not expose GitHub tokens in the renderer.
- Do not commit secrets.
- Do not weaken Electron security settings.
- Do not break the existing authentication, API, WebSocket, React routing, or application startup behavior.

## Release workflow

Make the project support this workflow:

```text
Developer changes version
        ↓
npm run build / existing production build
        ↓
electron-builder
        ↓
GitHub Release
        ↓
Upload installer + update metadata
        ↓
Existing users start the application
        ↓
electron-updater checks GitHub
        ↓
New version detected
        ↓
Download update
        ↓
User chooses Restart
        ↓
New version installed
```

## Important

First inspect the current project and determine:

- Electron entry point
- preload file
- current electron-builder configuration
- current build scripts
- operating systems currently supported
- whether the app already has an About/Settings page
- whether IPC/contextBridge is already implemented

Then implement the feature using the existing architecture.

Do not blindly create duplicate Electron main/preload files or duplicate IPC handlers.

## Completion requirements

After implementation:

1. List every file changed.
2. Explain what was changed in each file.
3. Show the exact commands required to create a GitHub Release.
4. Explain what environment variables/secrets are required.
5. Explain how to test OTA updates locally.
6. Explain how to release version `1.0.1` after the current version is `1.0.0`.
7. Verify that the project still builds successfully.
8. Fix any build/type/lint errors introduced by the implementation.

Do not consider the task complete until the existing application builds successfully with the OTA update implementation.

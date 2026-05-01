# FocusPad

A test monorepo that proves a downloadable Electron Mac app with auto-update works end-to-end.

- `apps/web` — Next.js 15 + Tailwind landing page with a "Download for Mac" button
- `apps/desktop` — Electron 33 + React 19 + TypeScript desktop app (timer + notes, tray, native notifications, auto-update via GitHub Releases)
- `.github/workflows/release.yml` — builds the Mac DMG and publishes a GitHub Release on `v*.*.*` tags

> Product: **FocusPad** — a tiny menu-bar focus timer with quick notes.

---

## Prerequisites

- macOS (Apple Silicon — the build targets arm64 by default)
- Node.js 20+
- npm 10+
- A GitHub repo to host releases

---

## 1. Install

```bash
npm install
```

This installs both workspaces (`apps/web`, `apps/desktop`).

---

## 2. Run the landing page locally

```bash
npm run web:dev
```

Open <http://localhost:3000>.

The Download button currently points at:

```
https://github.com/OWNER/REPO/releases/latest/download/FocusPad.dmg
```

Replace `OWNER/REPO` in `apps/web/src/app/page.tsx` with your real repo. The same applies to the publish provider in `apps/desktop/package.json` and `apps/desktop/dev-app-update.yml`.

---

## 3. Run the Electron app locally

```bash
npm run desktop:dev
```

This starts Vite, waits for it, compiles the Electron main process, and launches Electron pointing at `http://localhost:5173`. You'll see:

- A 25:00 timer with Start / Pause / Reset
- A persistent notes textarea (saved to `localStorage`)
- App version in the header
- A tray icon with "Show FocusPad" / "Check for Updates" / "Quit"
- A native macOS notification when the timer hits 0

> Auto-updates are disabled in dev (electron-updater requires a packaged build). Use the production DMG to test updates.

---

## 4. Build the Mac DMG locally

```bash
npm run desktop:dist
```

Output: `apps/desktop/release/FocusPad.dmg` plus the `latest-mac.yml` manifest used by electron-updater.

Install: open the DMG and drag **FocusPad** into **Applications**.

### macOS security warning workaround (unsigned build)

Because the build is unsigned, macOS will refuse to open it on first launch ("FocusPad can't be opened because Apple cannot check it for malicious software").

Workaround:

1. Open Finder → **Applications**
2. **Right-click** FocusPad → **Open**
3. In the dialog, click **Open** (only needed the first time)

If that dialog doesn't appear, use:

```bash
xattr -dr com.apple.quarantine /Applications/FocusPad.app
```

This is fine for local testing only. For real distribution, see "Code signing & notarization" below.

---

## 5. Create the first GitHub Release

The desktop app's auto-updater reads from GitHub Releases. To publish:

1. Push this repo to GitHub.
2. Replace every `OWNER/REPO` placeholder:
   - `apps/web/src/app/page.tsx`
   - `apps/desktop/package.json` → `build.publish[0]`
   - `apps/desktop/dev-app-update.yml`
3. Commit and push.
4. Tag and push:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

5. GitHub Actions runs `release.yml`:
   - Installs deps on `macos-14` (arm64)
   - Builds the renderer, compiles the main process
   - Runs `electron-builder --mac --publish=always`
   - Uploads `FocusPad.dmg`, `FocusPad-1.0.0-arm64.zip`, and `latest-mac.yml` to the GitHub Release as a draft
6. Open the GitHub Releases page, edit the draft, and **Publish**.

Once published, the landing page download link works:
`https://github.com/OWNER/REPO/releases/latest/download/FocusPad.dmg`

---

## 6. Test auto-updates

1. Install the v1.0.0 DMG locally (drag into Applications, right-click → Open).
2. Bump the version:

   ```bash
   npm version patch --workspace apps/desktop      # 1.0.0 -> 1.0.1
   git add apps/desktop/package.json package-lock.json
   git commit -m "chore: bump desktop to v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```

3. Wait for the GitHub Actions run to finish and publish the new release.
4. With the **installed** v1.0.0 app open:
   - The app checks for updates 3 seconds after launch.
   - You'll see a native "FocusPad update available" notification.
   - The new build downloads in the background.
   - When ready, the footer shows **Restart to install v1.0.1**.
   - Click it → the app quits, swaps in the new version, relaunches.
5. Confirm the version in the header is now `v1.0.1`.

You can also force a check from the **Check for Updates** button or the tray menu.

---

## Project layout

```
.
├── apps
│   ├── web                  # Next.js 15 landing page
│   └── desktop
│       ├── src
│       │   ├── main         # Electron main process (window, tray, autoUpdater)
│       │   ├── preload      # contextBridge API exposed to renderer
│       │   └── renderer     # React UI (timer + notes)
│       └── scripts/dev.js   # local dev launcher
├── .github/workflows/release.yml
├── package.json             # npm workspaces root
└── README.md
```

---

## Code signing & notarization (later)

The current build is unsigned (`identity: null`, `hardenedRuntime: false`). Once you have an Apple Developer ID:

1. In `apps/desktop/package.json` → `build.mac`:
   - Remove `"identity": null`
   - Set `"hardenedRuntime": true`
   - Add `"notarize": true`
2. Add an `entitlements.mac.plist` and reference it in `build.mac.entitlements`.
3. In CI, expose:
   - `CSC_LINK` — base64 of your `.p12` certificate
   - `CSC_KEY_PASSWORD` — its password
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — for notarization
4. Remove `CSC_IDENTITY_AUTO_DISCOVERY: false` from the workflow.

After that, the macOS quarantine warning on first launch goes away.

---

## Common scripts

| Command                    | What it does                             |
| -------------------------- | ---------------------------------------- |
| `npm run web:dev`          | Run the landing page on :3000            |
| `npm run web:build`        | Build the landing page                   |
| `npm run desktop:dev`      | Run the Electron app in dev mode         |
| `npm run desktop:dist`     | Build a local DMG (no upload)            |
| `npm run desktop:publish`  | Build + upload to GitHub Releases (CI)   |

---

## Troubleshooting

- **`electron-updater` "ENOENT dev-app-update.yml"** — only happens in dev. Update checks are disabled in dev by design. Test against a packaged build.
- **App won't open after install** — see "macOS security warning workaround" above.
- **CI release didn't publish** — check the Actions log; ensure the tag matches `v*.*.*`. The default `GITHUB_TOKEN` is sufficient for releases in the same repo.
- **Download link 404** — you haven't published a release yet, or `OWNER/REPO` placeholders weren't replaced.



Other command for pushing smth
# bump version (1.0.0 -> 1.0.1)
npm version patch --workspace apps/desktop

# commit everything
git add .
git commit -m "feat: light/dark theme toggle, prominent update button"


# tag and push
git tag v1.0.1
git push origin main --tags
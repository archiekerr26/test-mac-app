# MeetCommand

A tiny macOS menu bar **audio control surface**. Mute the mic, swap your
input or output device, push the system volume around — without opening
System Settings. Pairs with a small Next.js landing page that links to the
latest GitHub Release DMG.

- `apps/web` — Next.js 15 + Tailwind landing page
- `apps/desktop` — Electron + React + TypeScript menu bar app
- `apps/desktop/native/audio_helper.swift` — tiny CoreAudio CLI compiled at
  install time and bundled inside the .app for device switching
- `.github/workflows/release.yml` — builds the Mac DMG and publishes a GitHub
  Release on every `v*.*.*` tag push

---

## What you get

- Lives in the **macOS menu bar** — no Dock icon, no window on launch.
- Click the menu bar entry → small frameless popover panel.
- Panel shows:
  - Frontmost app (informational)
  - **Microphone** card: mute toggle + volume slider + input device picker
  - **Output** card: mute toggle + volume slider + output device picker
  - Quick links: Camera Settings, Sound Settings
  - Autosaved notes
  - App version + Check for Updates
- Tray label changes to `🎙×` when mic is muted, `🔇` when output is muted.
- Auto-updates via GitHub Releases (`electron-updater`).

### How the audio control works

| Concern              | Mechanism                                                |
| -------------------- | -------------------------------------------------------- |
| Output volume + mute | `osascript -e "set volume output volume / muted ..."`     |
| Input volume         | `osascript -e "set volume input volume ..."`              |
| Input mute           | Volume → 0 (macOS has no system-wide input-mute flag);   |
|                      | unmute restores the last non-zero level                  |
| Device enumeration   | `audio_helper list-input` / `list-output` (CoreAudio)    |
| Device switching     | `audio_helper set-default-input/-output <name>`          |

The Swift helper is compiled in `postinstall` so you get it the first time
you run `npm install`. CI builds it on `macos-14`. Source: ~120 lines.

---

## Prerequisites

- macOS (Apple Silicon — the build targets arm64)
- Xcode Command Line Tools (`xcode-select --install`) — needed to compile
  the Swift helper
- Node.js 20+
- npm 10+

---

## 1. Install

```bash
npm install
```

This compiles `native/audio_helper.swift` → `apps/desktop/resources/audio_helper`
in a `postinstall` hook (Mac only).

---

## 2. Run the landing page locally

```bash
npm run web:dev
```

Open <http://localhost:3000>.

---

## 3. Run the Electron app locally

```bash
npm run desktop:dev
```

No window pops up — look at the **macOS menu bar**. You'll see a small `◯`
glyph. Click it to open the panel.

---

## 4. Build the Mac DMG locally

```bash
npm run desktop:dist
```

Output: `apps/desktop/release/MeetCommand.dmg`. Install: open the DMG, drag
**MeetCommand** into **Applications**.

### Unsigned-build workaround

```bash
xattr -dr com.apple.quarantine /Applications/MeetCommand.app
```

Open MeetCommand from Applications. The "damaged" / "can't verify developer"
warning goes away.

---

## 5. Publish a GitHub Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions (`release.yml`) on `macos-14`:

1. `npm ci`
2. `swiftc` compiles the audio helper (it's part of `npm run build:native`,
   which runs as part of `npm run publish`)
3. electron-builder packages the .app, including the helper as
   `Resources/audio_helper`
4. Uploads `MeetCommand.dmg`, `MeetCommand-X.Y.Z.zip`, `latest-mac.yml` to
   the Release

Once published the landing page download link works:
`https://github.com/<owner>/<repo>/releases/latest/download/MeetCommand.dmg`

---

## 6. Test auto-updates

```bash
npm version patch --workspace apps/desktop
git add .
git commit -m "chore: bump"
git tag v1.0.X
git push origin main --tags
```

With v1.0.0 still running, click the panel's **Check for updates**. You'll
see `Checking…` → `Found vX.Y.Z` → `Downloading X%` → green
**Restart to install vX.Y.Z**.

> Unsigned-build limit: install fails the macOS code-signature check. Fix is
> a real Apple Developer ID + notarization. Detection + download work end to
> end without that.

---

## Project layout

```
.
├── apps
│   ├── web                    # Next.js 15 landing page
│   └── desktop
│       ├── native             # audio_helper.swift (CoreAudio)
│       ├── resources          # build output (.gitignored)
│       ├── src
│       │   ├── main           # Electron main: tray, panel, IPC, audio bridge
│       │   ├── preload        # contextBridge API
│       │   └── renderer       # React popover UI
│       └── scripts/dev.js
├── .github/workflows/release.yml
├── package.json               # npm workspaces root
└── README.md
```

---

## Known limitations

- **Camera off** isn't togglable from a third-party app on macOS. Each app
  manages its own camera session. The panel offers a deep link into
  *System Settings → Privacy → Camera* as a quick jump.
- **Per-app mic mute** doesn't exist at OS level either. The mic mute here
  is system-wide (input volume → 0), which is what most apps respect.
- **Bluetooth output devices** sometimes report stale names if just connected.
  The panel re-polls every 1.5s, so a refresh is at most that delay.

---

## Future upgrade path

- Per-app volume control via CoreAudio process taps (macOS 14+).
- Hotkey to toggle mic mute from anywhere.
- Menu bar mini-controls (volume scroll on the tray icon).
- Optional output device "favorites" with one-tap switching.

---

## Code signing & notarization (later)

Same approach as before:

1. In `apps/desktop/package.json` → `build.mac`:
   - Remove `"identity": null`
   - Set `"hardenedRuntime": true`
   - Add `"notarize": true`
2. Add an `entitlements.mac.plist` and reference it in `build.mac.entitlements`.
3. CI secrets: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
   `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
4. Remove `CSC_IDENTITY_AUTO_DISCOVERY: false` from the workflow.

After that, the macOS quarantine warning goes away and auto-update install
works end-to-end.

---

## Common scripts

| Command                    | What it does                              |
| -------------------------- | ----------------------------------------- |
| `npm run web:dev`          | Run the landing page on :3000             |
| `npm run web:build`        | Build the landing page                    |
| `npm run desktop:dev`      | Run the menu bar app in dev mode          |
| `npm run desktop:dist`     | Build a local DMG (no upload)             |
| `npm run desktop:publish`  | Build + upload to GitHub Releases (CI)    |

---

## Troubleshooting

- **`swiftc: command not found`** during `npm install` — install Xcode CLT
  with `xcode-select --install`.
- **Device dropdowns are empty** — make sure `apps/desktop/resources/audio_helper`
  exists. Re-run `npm install` or `npm --workspace apps/desktop run build:native`.
- **App won't open after install** — see the `xattr` workaround above.
- **Volume slider snaps back** — known race when polling and dragging
  collide; release the slider, the next poll syncs.
- **Bluetooth device disappears momentarily** — macOS sometimes drops it
  during reconnection; the panel updates within ~2s.

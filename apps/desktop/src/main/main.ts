import { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } from "electron";
import path from "node:path";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

// ----------------------------------------------------------------------------
// Logging: electron-log writes to ~/Library/Logs/FocusPad/main.log on macOS.
// We pipe autoUpdater logs through it so update issues are easy to debug.
// ----------------------------------------------------------------------------
log.transports.file.level = "info";
autoUpdater.logger = log;

// We control the prompt timing manually so we can show our own UI.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 560,
    resizable: true,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0b0b0c",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  // Empty 16x16 image; replace with a real template icon later.
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("FocusPad");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show FocusPad",
      click: () => {
        if (!mainWindow) createWindow();
        else mainWindow.show();
      },
    },
    { type: "separator" },
    {
      label: "Check for Updates",
      click: () => {
        autoUpdater.checkForUpdates().catch((err) => log.error("checkForUpdates failed", err));
      },
    },
    { type: "separator" },
    { role: "quit" },
  ]);
  tray.setContextMenu(contextMenu);
}

// ----------------------------------------------------------------------------
// Auto-update wiring
// electron-updater talks to the GitHub `publish` config in package.json. On
// startup we ask GitHub for the latest release; if its version is newer than
// the running app, the update is downloaded in the background and applied
// the next time the app quits (or immediately when the user clicks Restart).
// ----------------------------------------------------------------------------
function broadcast(channel: string, payload?: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function wireAutoUpdater() {
  autoUpdater.on("checking-for-update", () => broadcast("update:status", { state: "checking" }));
  autoUpdater.on("update-available", (info) => {
    broadcast("update:status", { state: "available", version: info.version });
    new Notification({
      title: "FocusPad update available",
      body: `Downloading v${info.version} in the background...`,
    }).show();
  });
  autoUpdater.on("update-not-available", (info) => {
    broadcast("update:status", { state: "none", version: info.version });
  });
  autoUpdater.on("download-progress", (p) => {
    broadcast("update:status", { state: "downloading", percent: Math.round(p.percent) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    broadcast("update:status", { state: "downloaded", version: info.version });
    new Notification({
      title: "FocusPad ready to update",
      body: `Restart to install v${info.version}.`,
    }).show();
  });
  autoUpdater.on("error", (err) => {
    broadcast("update:status", { state: "error", message: err.message });
    log.error("autoUpdater error", err);
  });
}

// ----------------------------------------------------------------------------
// IPC bridge: the renderer asks for the version + triggers update checks +
// fires native notifications when a focus session ends.
// ----------------------------------------------------------------------------
ipcMain.handle("app:getVersion", () => app.getVersion());

ipcMain.handle("update:check", async () => {
  if (isDev) {
    // electron-updater refuses to run in dev unless dev-app-update.yml exists.
    // For local testing we surface a clear no-op response instead of crashing.
    return { ok: false, reason: "Update checks are disabled in development." };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, version: result?.updateInfo?.version ?? null };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
});

ipcMain.handle("update:installNow", () => {
  // Quits and re-launches into the new version.
  autoUpdater.quitAndInstall();
});

ipcMain.handle("notify:show", (_evt, payload: { title: string; body: string }) => {
  new Notification({ title: payload.title, body: payload.body }).show();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  wireAutoUpdater();

  // Kick off a background check 3s after launch so the window has time to mount.
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => log.error("initial update check failed", err));
    }, 3000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Keep running in the tray on macOS even when the window is closed.
  if (process.platform !== "darwin") app.quit();
});

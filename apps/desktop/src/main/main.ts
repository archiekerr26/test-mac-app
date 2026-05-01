import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  nativeImage,
  screen,
  shell,
} from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

// ----------------------------------------------------------------------------
// Logging + auto-update setup. Logs land in ~/Library/Logs/MeetCommand/main.log
// ----------------------------------------------------------------------------
log.transports.file.level = "info";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const isDev = !app.isPackaged;
const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 600;
const POLL_MS = 1500;

let panelWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let recentlyHiddenAt = 0;

const execFileP = promisify(execFile);

// In dev the helper sits next to the source; in prod it's bundled under
// Resources/ inside the .app via electron-builder's `extraResources`.
function audioHelperPath(): string {
  if (isDev) return path.join(__dirname, "..", "..", "resources", "audio_helper");
  return path.join(process.resourcesPath, "audio_helper");
}

async function runHelper(args: string[]): Promise<string> {
  const { stdout } = await execFileP(audioHelperPath(), args, { timeout: 4000 });
  return stdout.trim();
}

// ----------------------------------------------------------------------------
// Persisted state — notes only. Audio state is read live from CoreAudio,
// not cached, so flipping a device in System Settings is reflected instantly.
// ----------------------------------------------------------------------------
type Store = { notes: string };
const defaultStore: Store = { notes: "" };
let store: Store = { ...defaultStore };

function storePath() {
  return path.join(app.getPath("userData"), "meetcommand-store.json");
}
async function loadStore() {
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    store = { ...defaultStore, ...(JSON.parse(raw) as Partial<Store>) };
  } catch {
    /* first launch */
  }
}
async function saveStore() {
  try {
    await fs.mkdir(path.dirname(storePath()), { recursive: true });
    await fs.writeFile(storePath(), JSON.stringify(store, null, 2));
  } catch (err) {
    log.error("saveStore failed", err);
  }
}

// ----------------------------------------------------------------------------
// Audio control surface.
//
// Volume + mute go through `osascript` because AppleScript exposes them
// directly and there's no permission prompt:
//   - Output: `output volume` (0-100), `output muted` (true/false)
//   - Input:  `input volume`  (0-100). macOS doesn't have a system-wide
//             "input muted" flag, so we treat input volume == 0 as muted.
//             Toggling restores the last non-zero value (defaulting to 75).
//
// Device listing + switching go through the Swift `audio_helper` binary
// because AppleScript can't enumerate or switch CoreAudio devices.
// ----------------------------------------------------------------------------
const VOLUME_SCRIPT = `set v to get volume settings
return "" & (output volume of v) & "|" & (output muted of v) & "|" & (input volume of v)`;

type VolumeState = {
  outputVolume: number;
  outputMuted: boolean;
  inputVolume: number;
};

async function readVolumes(): Promise<VolumeState> {
  try {
    const { stdout } = await execFileP("osascript", ["-e", VOLUME_SCRIPT], { timeout: 1500 });
    const [outVol, outMuted, inVol] = stdout.trim().split("|");
    return {
      outputVolume: Math.max(0, Math.min(100, parseInt(outVol ?? "0", 10) || 0)),
      outputMuted: (outMuted ?? "false").toLowerCase() === "true",
      inputVolume: Math.max(0, Math.min(100, parseInt(inVol ?? "0", 10) || 0)),
    };
  } catch (err) {
    log.warn("readVolumes failed", err);
    return { outputVolume: 0, outputMuted: false, inputVolume: 0 };
  }
}

async function setOutputVolume(v: number) {
  await execFileP("osascript", [
    "-e",
    `set volume output volume ${Math.max(0, Math.min(100, Math.round(v)))}`,
  ]);
}
async function setOutputMuted(muted: boolean) {
  await execFileP("osascript", ["-e", `set volume output muted ${muted ? "true" : "false"}`]);
}
async function setInputVolume(v: number) {
  await execFileP("osascript", [
    "-e",
    `set volume input volume ${Math.max(0, Math.min(100, Math.round(v)))}`,
  ]);
}

// Remember the last non-zero input volume so unmute restores a sensible level.
let lastInputVolume = 75;

type AudioDevice = { id: string; name: string };
type DevicesSnapshot = {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  defaultInput: string;
  defaultOutput: string;
};

async function readDevices(): Promise<DevicesSnapshot> {
  try {
    const [inputsJson, outputsJson, defIn, defOut] = await Promise.all([
      runHelper(["list-input"]),
      runHelper(["list-output"]),
      runHelper(["get-default-input"]),
      runHelper(["get-default-output"]),
    ]);
    return {
      inputs: JSON.parse(inputsJson) as AudioDevice[],
      outputs: JSON.parse(outputsJson) as AudioDevice[],
      defaultInput: defIn,
      defaultOutput: defOut,
    };
  } catch (err) {
    log.warn("readDevices failed", err);
    return { inputs: [], outputs: [], defaultInput: "", defaultOutput: "" };
  }
}

// ----------------------------------------------------------------------------
// Active app/window — small informational header. No call detection logic
// any more; this is just "what's frontmost right now".
// ----------------------------------------------------------------------------
async function osascriptRun(script: string): Promise<string> {
  const { stdout } = await execFileP("osascript", ["-e", script], { timeout: 1500 });
  return stdout.trim();
}

async function getActiveAppName(): Promise<string> {
  try {
    return await osascriptRun(
      'tell application "System Events" to get name of (first process whose frontmost is true)'
    );
  } catch {
    return "";
  }
}

// ----------------------------------------------------------------------------
// Polled state delivered to the renderer.
// ----------------------------------------------------------------------------
type AudioState = {
  outputVolume: number;
  outputMuted: boolean;
  inputVolume: number;
  inputMuted: boolean; // derived from inputVolume === 0
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  defaultInput: string;
  defaultOutput: string;
  activeApp: string;
};

function broadcast(channel: string, payload?: unknown) {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send(channel, payload);
  }
}

function updateTrayLabel(state: AudioState) {
  if (!tray) return;
  // ◯ default, ⊘ when output is muted, 🎙× when mic muted, both icons when both.
  const parts: string[] = [];
  if (state.inputMuted) parts.push("🎙×");
  if (state.outputMuted) parts.push("🔇");
  tray.setTitle(parts.length ? parts.join(" ") : "◯");
}

async function poll() {
  const [vols, devices, activeApp] = await Promise.all([
    readVolumes(),
    readDevices(),
    getActiveAppName(),
  ]);
  if (vols.inputVolume > 0) lastInputVolume = vols.inputVolume;

  const state: AudioState = {
    outputVolume: vols.outputVolume,
    outputMuted: vols.outputMuted,
    inputVolume: vols.inputVolume,
    inputMuted: vols.inputVolume === 0,
    inputs: devices.inputs,
    outputs: devices.outputs,
    defaultInput: devices.defaultInput,
    defaultOutput: devices.defaultOutput,
    activeApp,
  };

  updateTrayLabel(state);
  broadcast("audio:state", state);
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, POLL_MS);
  void poll();
}

// ----------------------------------------------------------------------------
// Menu bar popover window.
// ----------------------------------------------------------------------------
function createPanel() {
  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    transparent: true,
    backgroundColor: "#00000000",
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) panelWindow.loadURL("http://localhost:5173");
  else panelWindow.loadFile(path.join(__dirname, "../../dist/index.html"));

  panelWindow.on("blur", () => {
    if (panelWindow?.webContents.isDevToolsOpened()) return;
    panelWindow?.hide();
    recentlyHiddenAt = Date.now();
  });
}

function positionPanel(trayBounds: Electron.Rectangle) {
  if (!panelWindow) return;
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - PANEL_WIDTH / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);
  const minX = display.workArea.x + 4;
  const maxX = display.workArea.x + display.workArea.width - PANEL_WIDTH - 4;
  panelWindow.setPosition(Math.max(minX, Math.min(x, maxX)), y, false);
}

function togglePanel() {
  if (!panelWindow || !tray) return;
  if (Date.now() - recentlyHiddenAt < 200) {
    recentlyHiddenAt = 0;
    return;
  }
  if (panelWindow.isVisible()) {
    panelWindow.hide();
    return;
  }
  positionPanel(tray.getBounds());
  panelWindow.show();
  panelWindow.focus();
  void poll();
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("◯");
  tray.setToolTip("MeetCommand");
  tray.on("click", () => togglePanel());
  tray.on("right-click", () => {
    const menu = Menu.buildFromTemplate([
      { label: "Open MeetCommand", click: () => togglePanel() },
      {
        label: "Check for Updates",
        click: () => {
          if (isDev) return;
          autoUpdater.checkForUpdates().catch((err) => log.error(err));
        },
      },
      { type: "separator" },
      { label: "Quit MeetCommand", role: "quit" },
    ]);
    tray?.popUpContextMenu(menu);
  });
}

// ----------------------------------------------------------------------------
// IPC: renderer asks main to mutate system audio. Each handler updates the
// system, then triggers an immediate poll so the UI reflects reality fast.
// ----------------------------------------------------------------------------
ipcMain.handle("app:getVersion", () => app.getVersion());
ipcMain.handle("panel:hide", () => panelWindow?.hide());

ipcMain.handle("audio:setOutputVolume", async (_e, v: number) => {
  await setOutputVolume(v);
  // If the user nudges volume above zero, unmute too — matches the macOS UI.
  if (v > 0) await setOutputMuted(false);
  void poll();
});
ipcMain.handle("audio:toggleOutputMute", async () => {
  const cur = await readVolumes();
  await setOutputMuted(!cur.outputMuted);
  void poll();
});
ipcMain.handle("audio:toggleInputMute", async () => {
  const cur = await readVolumes();
  if (cur.inputVolume === 0) {
    await setInputVolume(lastInputVolume || 75);
  } else {
    lastInputVolume = cur.inputVolume;
    await setInputVolume(0);
  }
  void poll();
});
ipcMain.handle("audio:setInputVolume", async (_e, v: number) => {
  await setInputVolume(v);
  if (v > 0) lastInputVolume = v;
  void poll();
});
ipcMain.handle("audio:setDefaultInput", async (_e, name: string) => {
  try {
    await runHelper(["set-default-input", name]);
  } catch (err) {
    log.error("set-default-input failed", err);
  }
  void poll();
});
ipcMain.handle("audio:setDefaultOutput", async (_e, name: string) => {
  try {
    await runHelper(["set-default-output", name]);
  } catch (err) {
    log.error("set-default-output failed", err);
  }
  void poll();
});

ipcMain.handle("notes:save", async (_e, notes: string) => {
  store.notes = notes;
  await saveStore();
});
ipcMain.handle("notes:load", () => store.notes);

ipcMain.handle("system:openCameraSettings", () =>
  shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Camera")
);
ipcMain.handle("system:openSoundSettings", () =>
  shell.openExternal("x-apple.systempreferences:com.apple.preference.sound")
);

ipcMain.handle("update:check", async () => {
  if (isDev) return { ok: false, reason: "Update checks are disabled in development." };
  try {
    const r = await autoUpdater.checkForUpdates();
    return { ok: true, version: r?.updateInfo?.version ?? null };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
});
ipcMain.handle("update:installNow", () => autoUpdater.quitAndInstall());

// ----------------------------------------------------------------------------
// Auto-update wiring.
// ----------------------------------------------------------------------------
function wireAutoUpdater() {
  autoUpdater.on("checking-for-update", () => broadcast("update:status", { state: "checking" }));
  autoUpdater.on("update-available", (info) => {
    broadcast("update:status", { state: "available", version: info.version });
    new Notification({
      title: "MeetCommand update available",
      body: `Downloading v${info.version} in the background...`,
    }).show();
  });
  autoUpdater.on("update-not-available", (info) =>
    broadcast("update:status", { state: "none", version: info.version })
  );
  autoUpdater.on("download-progress", (p) =>
    broadcast("update:status", { state: "downloading", percent: Math.round(p.percent) })
  );
  autoUpdater.on("update-downloaded", (info) => {
    broadcast("update:status", { state: "downloaded", version: info.version });
    new Notification({
      title: "MeetCommand ready to update",
      body: `Restart to install v${info.version}.`,
    }).show();
  });
  autoUpdater.on("error", (err) => {
    broadcast("update:status", { state: "error", message: err.message });
    log.error("autoUpdater error", err);
  });
}

app.whenReady().then(async () => {
  if (process.platform === "darwin" && app.dock) app.dock.hide();
  await loadStore();
  createPanel();
  createTray();
  wireAutoUpdater();
  startPolling();

  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => log.error("initial update check failed", err));
    }, 3000);
  }
});

app.on("window-all-closed", () => {
  /* tray-only — stay alive */
});

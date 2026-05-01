import { contextBridge, ipcRenderer } from "electron";

export type AudioDevice = { id: string; name: string };

export type AudioState = {
  outputVolume: number;
  outputMuted: boolean;
  inputVolume: number;
  inputMuted: boolean;
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  defaultInput: string;
  defaultOutput: string;
  activeApp: string;
};

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "none"; version?: string }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  hidePanel: (): Promise<void> => ipcRenderer.invoke("panel:hide"),

  setOutputVolume: (v: number): Promise<void> =>
    ipcRenderer.invoke("audio:setOutputVolume", v),
  toggleOutputMute: (): Promise<void> => ipcRenderer.invoke("audio:toggleOutputMute"),
  setInputVolume: (v: number): Promise<void> => ipcRenderer.invoke("audio:setInputVolume", v),
  toggleInputMute: (): Promise<void> => ipcRenderer.invoke("audio:toggleInputMute"),
  setDefaultInput: (name: string): Promise<void> =>
    ipcRenderer.invoke("audio:setDefaultInput", name),
  setDefaultOutput: (name: string): Promise<void> =>
    ipcRenderer.invoke("audio:setDefaultOutput", name),

  saveNotes: (notes: string): Promise<void> => ipcRenderer.invoke("notes:save", notes),
  loadNotes: (): Promise<string> => ipcRenderer.invoke("notes:load"),

  openCameraSettings: (): Promise<void> =>
    ipcRenderer.invoke("system:openCameraSettings"),
  openSoundSettings: (): Promise<void> => ipcRenderer.invoke("system:openSoundSettings"),

  checkForUpdates: (): Promise<{ ok: boolean; reason?: string; version?: string | null }> =>
    ipcRenderer.invoke("update:check"),
  installNow: (): Promise<void> => ipcRenderer.invoke("update:installNow"),

  onAudioState: (cb: (s: AudioState) => void) => {
    const listener = (_e: unknown, s: AudioState) => cb(s);
    ipcRenderer.on("audio:state", listener);
    return () => ipcRenderer.removeListener("audio:state", listener);
  },
  onUpdateStatus: (cb: (s: UpdateStatus) => void) => {
    const listener = (_e: unknown, s: UpdateStatus) => cb(s);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
};

contextBridge.exposeInMainWorld("mc", api);
export type MeetCommandAPI = typeof api;

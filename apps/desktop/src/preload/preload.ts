import { contextBridge, ipcRenderer } from "electron";

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
  checkForUpdates: (): Promise<{ ok: boolean; reason?: string; version?: string | null }> =>
    ipcRenderer.invoke("update:check"),
  installNow: (): Promise<void> => ipcRenderer.invoke("update:installNow"),
  showNotification: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke("notify:show", { title, body }),
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => {
    const listener = (_e: unknown, status: UpdateStatus) => cb(status);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
};

contextBridge.exposeInMainWorld("focuspad", api);

export type FocusPadAPI = typeof api;

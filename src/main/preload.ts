import { contextBridge, ipcRenderer } from 'electron';

// Safely-scoped bridge: the renderer only ever sees the `nayose` namespace
// below, never the raw ipcRenderer/electron APIs. Node integration stays off
// and context isolation stays on (set in main.ts's BrowserWindow config).
const nayoseApi = {
  ping: (payload: string): Promise<string> => ipcRenderer.invoke('nayose:ping', payload),
};

export type NayoseApi = typeof nayoseApi;

contextBridge.exposeInMainWorld('nayose', nayoseApi);

import { contextBridge, ipcRenderer } from 'electron';
import type { VaultCloseResult, VaultCreateResult, VaultOpenResult } from '../shared/types/vault.ts';

// Safely-scoped bridge: the renderer only ever sees the `nayose` namespace
// below, never the raw ipcRenderer/electron APIs. Node integration stays off
// and context isolation stays on (set in main.ts's BrowserWindow config).
const nayoseApi = {
  ping: (payload: string): Promise<string> => ipcRenderer.invoke('nayose:ping', payload),
  vault: {
    create: (): Promise<VaultCreateResult> => ipcRenderer.invoke('vault:create'),
    open: (): Promise<VaultOpenResult> => ipcRenderer.invoke('vault:open'),
    close: (): Promise<VaultCloseResult> => ipcRenderer.invoke('vault:close'),
  },
};

export type NayoseApi = typeof nayoseApi;

contextBridge.exposeInMainWorld('nayose', nayoseApi);

// Registers the vault lifecycle IPC channels used by the renderer via
// window.nayose.vault. Owns the Electron-specific bits (file dialogs); the
// actual file format logic lives in ../vault/vault-file.ts.

import { dialog, ipcMain } from 'electron';
import type {
  VaultCloseResult,
  VaultCreateResult,
  VaultExportTriggerResult,
  VaultOpenResult,
} from '../../shared/types/vault.ts';
import { createVaultFile, readVaultFile } from '../vault/vault-file.ts';
// Task 8 addition: keep the in-memory "currently open vault" session (see
// ../vault/vault-session.ts) in sync with lifecycle events, so entity
// creation handlers have a live AssertionLog to write into.
// Feature 2 Task 3 addition: exportSession (Task 2's serialization boundary,
// wrapped for the currently-open session) backs the new vault:export
// channel below.
import { clearSession, exportSession, openSession } from '../vault/vault-session.ts';

const VAULT_DIALOG_FILTERS = [{ name: 'Nayose Vault', extensions: ['nayose', 'json'] }];

export function registerVaultHandlers(): void {
  ipcMain.handle('vault:create', async (): Promise<VaultCreateResult> => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Create Nayose Vault',
      buttonLabel: 'Create',
      filters: VAULT_DIALOG_FILTERS,
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      const vault = await createVaultFile(filePath);
      openSession(filePath, vault);
      return { ok: true, path: filePath, vault };
    } catch (err) {
      return {
        ok: false,
        canceled: false,
        error: {
          reason: 'write-error',
          message: `Could not create vault at ${filePath}: ${(err as Error).message}`,
        },
      };
    }
  });

  ipcMain.handle('vault:open', async (): Promise<VaultOpenResult> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open Nayose Vault',
      buttonLabel: 'Open',
      properties: ['openFile'],
      filters: VAULT_DIALOG_FILTERS,
    });

    if (canceled || filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const filePath = filePaths[0];
    const result = await readVaultFile(filePath);
    if (!result.ok) {
      return { ok: false, canceled: false, error: result.error };
    }

    openSession(filePath, result.vault);
    return { ok: true, path: filePath, vault: result.vault };
  });

  ipcMain.handle('vault:close', async (): Promise<VaultCloseResult> => {
    // Task 8 addition: drop the in-memory session so entity-creation
    // handlers no longer see a stale open vault after close.
    clearSession();
    return { ok: true };
  });

  // Feature 2 Task 3: lets a user with an open vault choose a destination
  // via a save dialog and write a complete export through exportSession
  // (which in turn goes through vault-file.ts's exportVault, never a raw
  // file copy). No payment, account, or network access is involved anywhere
  // in this path.
  ipcMain.handle('vault:export', async (): Promise<VaultExportTriggerResult> => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Nayose Vault',
      buttonLabel: 'Export',
      filters: VAULT_DIALOG_FILTERS,
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      const result = await exportSession(filePath);
      if (!result.ok) {
        return { ok: false, canceled: false, error: result.error };
      }
      return { ok: true, path: filePath };
    } catch (err) {
      return {
        ok: false,
        canceled: false,
        error: {
          reason: 'write-error',
          message: `Could not export vault to ${filePath}: ${(err as Error).message}`,
        },
      };
    }
  });
}

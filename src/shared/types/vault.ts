// On-disk shape of a Nayose vault file, plus the IPC result/error types the
// main process returns to the renderer for vault lifecycle operations.
//
// This format is PROVISIONAL: a later feature will publish a formal storage
// format spec and may force revision. This task only owns the envelope
// (marker + version) and lifecycle (create/open/close/persist); the body is
// an empty placeholder that Task 4 (assertion log) will populate.

export const VAULT_FORMAT_MARKER = 'nayose-vault' as const;
export const VAULT_FORMAT_VERSION = 1 as const;

/**
 * Placeholder for the vault's actual contents. Task 4 (assertion log) and
 * Task 5 (entity model) will define and populate this; Task 3 only needs a
 * body slot to exist so the envelope round-trips.
 */
export type VaultBody = Record<string, never>;

export interface VaultFile {
  nayoseVault: typeof VAULT_FORMAT_MARKER;
  formatVersion: typeof VAULT_FORMAT_VERSION;
  body: VaultBody;
}

export type VaultOpenErrorReason =
  | 'not-found'
  | 'read-error'
  | 'write-error'
  | 'invalid-json'
  | 'not-a-vault'
  | 'unsupported-version';

export interface VaultOpenError {
  reason: VaultOpenErrorReason;
  message: string;
}

export interface VaultCreateSuccess {
  ok: true;
  path: string;
  vault: VaultFile;
}

export interface VaultCreateCanceled {
  ok: false;
  canceled: true;
}

export interface VaultCreateFailure {
  ok: false;
  canceled: false;
  error: VaultOpenError;
}

export type VaultCreateResult = VaultCreateSuccess | VaultCreateCanceled | VaultCreateFailure;

export interface VaultOpenSuccess {
  ok: true;
  path: string;
  vault: VaultFile;
}

export interface VaultOpenCanceled {
  ok: false;
  canceled: true;
}

export interface VaultOpenFailure {
  ok: false;
  canceled: false;
  error: VaultOpenError;
}

export type VaultOpenResult = VaultOpenSuccess | VaultOpenCanceled | VaultOpenFailure;

export interface VaultCloseResult {
  ok: true;
}

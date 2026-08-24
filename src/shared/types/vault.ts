// On-disk shape of a Nayose vault file, plus the IPC result/error types the
// main process returns to the renderer for vault lifecycle operations.
//
// This format is PROVISIONAL: a later feature will publish a formal storage
// format spec and may force revision. This task only owns the envelope
// (marker + version) and lifecycle (create/open/close/persist); the body is
// an empty placeholder that Task 4 (assertion log) will populate.

import type { Assertion } from './assertion.ts';

export const VAULT_FORMAT_MARKER = 'nayose-vault' as const;
export const VAULT_FORMAT_VERSION = 1 as const;

/**
 * The vault's actual contents. Task 3 only needed a body slot to exist so
 * the envelope round-trips; Task 4 (assertion log) adds the `assertions`
 * array. `assertions` is optional so a freshly-created empty vault body
 * (`{}`) remains a valid `VaultBody`. Task 5 (entity model) may extend this
 * further.
 */
export type VaultBody = {
  assertions?: Assertion[];
};

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
  | 'unsupported-version'
  | 'no-vault-open';

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

export interface VaultExportSuccess {
  ok: true;
}

export interface VaultExportFailure {
  ok: false;
  error: VaultOpenError;
}

/**
 * Result of exporting the currently open vault to a user-chosen path.
 * `no-vault-open` (see `VaultOpenErrorReason`) is the distinguishing failure
 * mode here: exporting requires an in-memory session, unlike `writeVaultFile`
 * which operates on a caller-supplied envelope directly.
 */
export type VaultExportResult = VaultExportSuccess | VaultExportFailure;

export interface VaultExportTriggerSuccess {
  ok: true;
  path: string;
}

export interface VaultExportTriggerCanceled {
  ok: false;
  canceled: true;
}

export interface VaultExportTriggerFailure {
  ok: false;
  canceled: false;
  error: VaultOpenError;
}

/**
 * Result of the renderer-facing `vault:export` IPC channel: wraps
 * `VaultExportResult` (Task 2) with the canceled-dialog case, following the
 * same three-shape union as `VaultCreateResult`/`VaultOpenResult`.
 * `VaultExportResult` itself has no canceled case since it assumes a
 * destination path was already chosen.
 */
export type VaultExportTriggerResult =
  | VaultExportTriggerSuccess
  | VaultExportTriggerCanceled
  | VaultExportTriggerFailure;

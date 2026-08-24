// Pure decision logic for the vault open/create/close view (Task 1 of
// Feature 2). Kept separate from vault-lifecycle.tsx (no JSX) so it can be
// unit-tested directly under `node --test`'s native TypeScript
// type-stripping, following contradiction-warning-logic.ts /
// share-list-format.test.ts's precedent.
//
// The one rule this module exists to get right (done_when clause 3): a
// canceled dialog (`{ ok: false, canceled: true }`) must never be reported
// to the user as an error — only the failure case
// (`{ ok: false, canceled: false, error }`) should surface a message.

import type { VaultCreateResult, VaultExportTriggerResult, VaultOpenResult } from '../../shared/types/vault.ts';

export interface VaultStatus {
  /** User-facing message, or empty string if there is nothing to show. */
  message: string;
  /** Whether `message` describes an error (affects styling only). */
  isError: boolean;
}

const NO_STATUS: VaultStatus = { message: '', isError: false };

/**
 * Resolves a `VaultCreateResult` into a status to display. A canceled
 * dialog resolves to `NO_STATUS` (nothing shown), not an error.
 */
export function resolveCreateStatus(result: VaultCreateResult): VaultStatus {
  if (result.ok) {
    return { message: `Created vault at ${result.path}`, isError: false };
  }
  if (result.canceled) {
    return NO_STATUS;
  }
  return { message: result.error.message, isError: true };
}

/**
 * Resolves a `VaultOpenResult` into a status to display. Same
 * canceled-vs-failure distinction as `resolveCreateStatus`.
 */
export function resolveOpenStatus(result: VaultOpenResult): VaultStatus {
  if (result.ok) {
    return { message: `Opened vault at ${result.path}`, isError: false };
  }
  if (result.canceled) {
    return NO_STATUS;
  }
  return { message: result.error.message, isError: true };
}

/**
 * Resolves a `VaultExportTriggerResult` into a status to display (Task 3 of
 * Feature 2 / export-format). Same canceled-vs-failure distinction as
 * `resolveCreateStatus`/`resolveOpenStatus`.
 */
export function resolveExportStatus(result: VaultExportTriggerResult): VaultStatus {
  if (result.ok) {
    return { message: `Exported vault to ${result.path}`, isError: false };
  }
  if (result.canceled) {
    return NO_STATUS;
  }
  return { message: result.error.message, isError: true };
}

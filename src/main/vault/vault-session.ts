// Main-process "currently open vault" session state.
//
// Task 3's vault-handlers.ts only ever created or read a vault file once and
// handed its contents to the renderer; nothing kept a vault open in
// main-process memory across subsequent IPC calls. Task 8 (manual entity
// creation) needs exactly that: a place for entity-creation IPC handlers to
// read/append assertions into, and to persist back to disk after each write.
//
// This is a NEW module rather than an addition to vault-handlers.ts (a
// Task-3-owned file) specifically to avoid touching that file's logic; only
// a minimal, additive call from vault-handlers.ts into this module's
// `openSession`/`clearSession` is needed (see that file's diff).
//
// Also owns the "exactly one Account per vault" rule (done_when clause 2):
// `ensureAccount` creates the vault's single Account entity on first use if
// one does not already exist yet, and returns the existing one otherwise.
// This is deliberately lazy (created on first entity-creation call, not at
// vault-create/open time) so opening a vault never needs an actor identity
// before one is actually asserting anything.

import { loadAssertionLog, type AssertionLog } from './assertion-log.ts';
import { createAccount, getEntityKind } from './entities.ts';
import { exportVault as exportVaultFile, writeVaultFile } from './vault-file.ts';
import type { AccountId } from '../../shared/types/entities.ts';
import {
  VAULT_FORMAT_MARKER,
  VAULT_FORMAT_VERSION,
  type VaultExportResult,
  type VaultFile,
} from '../../shared/types/vault.ts';

export interface VaultSession {
  path: string;
  log: AssertionLog;
}

let session: VaultSession | null = null;

/** Begin a new in-memory session for a just-created or just-opened vault file. */
export function openSession(path: string, vault: VaultFile): VaultSession {
  session = { path, log: loadAssertionLog(vault.body.assertions ?? []) };
  return session;
}

/** Return the currently open session, or `undefined` if no vault is open. */
export function getSession(): VaultSession | undefined {
  return session ?? undefined;
}

/** Clear the currently open session (e.g. on `vault:close`). */
export function clearSession(): void {
  session = null;
}

/**
 * Persist the session's in-memory assertion log back to its vault file on
 * disk, overwriting the file's `body.assertions` with the log's full,
 * current contents.
 */
export async function persistSession(activeSession: VaultSession): Promise<void> {
  const vault: VaultFile = {
    nayoseVault: VAULT_FORMAT_MARKER,
    formatVersion: VAULT_FORMAT_VERSION,
    body: { assertions: activeSession.log.assertions },
  };
  await writeVaultFile(activeSession.path, vault);
}

/**
 * Export the currently open session's vault to a user-chosen path, via
 * vault-file.ts's `exportVault` (which builds the envelope and writes it
 * through `writeVaultFile` — never a file copy). Returns a typed
 * `no-vault-open` error rather than throwing when no vault is open.
 */
export async function exportSession(exportPath: string): Promise<VaultExportResult> {
  if (!session) {
    return {
      ok: false,
      error: {
        reason: 'no-vault-open',
        message: 'Cannot export: no vault is currently open.',
      },
    };
  }

  const vault: VaultFile = {
    nayoseVault: VAULT_FORMAT_MARKER,
    formatVersion: VAULT_FORMAT_VERSION,
    body: { assertions: session.log.assertions },
  };
  await exportVaultFile(exportPath, vault);
  return { ok: true };
}

/**
 * Return the vault's single Account id, creating it (and appending its
 * founding assertion to the log) if one does not exist yet. Never creates a
 * second Account once one exists — every entity-creation call that needs an
 * actor id should go through this rather than calling `createAccount`
 * directly.
 */
export function ensureAccount(log: AssertionLog): AccountId {
  const existing = findExistingAccountId(log);
  if (existing) {
    return existing;
  }

  return createAccount(log, {
    actor: 'system',
    timestamp: new Date().toISOString(),
    source: 'nayose-app',
    sourceClass: 'user-asserted',
  });
}

function findExistingAccountId(log: AssertionLog): AccountId | undefined {
  const seen = new Set<string>();
  for (const assertion of log.assertions) {
    if (seen.has(assertion.entityId)) {
      continue;
    }
    seen.add(assertion.entityId);
    if (getEntityKind(log, assertion.entityId) === 'Account') {
      return assertion.entityId as AccountId;
    }
  }
  return undefined;
}

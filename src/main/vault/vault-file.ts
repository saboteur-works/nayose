// Pure vault-file lifecycle logic: create, read/validate, and persist a
// single vault file on disk. No Electron APIs (dialogs, IPC) are used here
// so this module can be exercised directly in unit tests. Electron-specific
// wiring (file dialogs, ipcMain channels) lives in ../ipc/vault-handlers.ts.

import { promises as fs } from 'node:fs';
import {
  VAULT_FORMAT_MARKER,
  VAULT_FORMAT_VERSION,
  type VaultFile,
  type VaultOpenError,
} from '../../shared/types/vault.ts';

export type VaultReadResult = { ok: true; vault: VaultFile } | { ok: false; error: VaultOpenError };

/** Build a fresh, empty vault envelope. */
export function createEmptyVault(): VaultFile {
  return {
    nayoseVault: VAULT_FORMAT_MARKER,
    formatVersion: VAULT_FORMAT_VERSION,
    body: {},
  };
}

/** Write a vault structure to disk exactly as given (used to persist changes). */
export async function writeVaultFile(filePath: string, vault: VaultFile): Promise<void> {
  const contents = JSON.stringify(vault, null, 2);
  await fs.writeFile(filePath, contents, 'utf-8');
}

/** Create a brand-new vault file at the given path and return the envelope written. */
export async function createVaultFile(filePath: string): Promise<VaultFile> {
  const vault = createEmptyVault();
  await writeVaultFile(filePath, vault);
  return vault;
}

/**
 * Validate that a parsed JSON value is a recognizable Nayose vault envelope.
 * Returns a typed error rather than throwing, so callers can surface a clear
 * message instead of crashing on malformed or unrelated files.
 */
export function validateVaultEnvelope(value: unknown): VaultReadResult {
  if (typeof value !== 'object' || value === null) {
    return {
      ok: false,
      error: { reason: 'not-a-vault', message: 'File does not contain a Nayose vault object.' },
    };
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.nayoseVault !== VAULT_FORMAT_MARKER) {
    return {
      ok: false,
      error: {
        reason: 'not-a-vault',
        message: 'File is missing the Nayose vault marker; this is not a Nayose vault file.',
      },
    };
  }

  if (candidate.formatVersion !== VAULT_FORMAT_VERSION) {
    return {
      ok: false,
      error: {
        reason: 'unsupported-version',
        message: `File declares vault format version ${String(candidate.formatVersion)}, but this app supports version ${VAULT_FORMAT_VERSION}.`,
      },
    };
  }

  if (typeof candidate.body !== 'object' || candidate.body === null) {
    return {
      ok: false,
      error: { reason: 'not-a-vault', message: 'Vault file is missing its body.' },
    };
  }

  return {
    ok: true,
    vault: {
      nayoseVault: VAULT_FORMAT_MARKER,
      formatVersion: VAULT_FORMAT_VERSION,
      body: candidate.body as VaultFile['body'],
    },
  };
}

/**
 * Read and validate a vault file from disk. Never throws for expected
 * failure modes (missing file, unreadable file, invalid JSON, or a file
 * that isn't a vault) — those are all reported as a typed VaultOpenError.
 */
export async function readVaultFile(filePath: string): Promise<VaultReadResult> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {
        ok: false,
        error: { reason: 'not-found', message: `No file exists at ${filePath}.` },
      };
    }
    return {
      ok: false,
      error: {
        reason: 'read-error',
        message: `Could not read file at ${filePath}: ${(err as Error).message}`,
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: { reason: 'invalid-json', message: `File at ${filePath} is not valid JSON.` },
    };
  }

  return validateVaultEnvelope(parsed);
}

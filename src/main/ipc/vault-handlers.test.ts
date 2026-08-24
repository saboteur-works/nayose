// Tests for the vault:export IPC handler's logic (Feature 2, Task 3).
// Follows entity-handlers.test.ts's precedent: rather than spinning up a
// live Electron renderer or mocking `dialog.showSaveDialog`, this exercises
// exactly what the ipcMain.handle('vault:export', ...) callback does once a
// destination path has been chosen — open a session, create entities via
// entities.ts (mirroring what entity-handlers.ts's IPC handlers do), call
// exportSession (Task 2's session-aware wrapper around vault-file.ts's
// exportVault), then reopen the exported file via readVaultFile /
// validateVaultEnvelope, the same path vault:open uses.
//
// This is the round-trip proof for Task 3's done_when clause 3: "the
// exported file, reopened via the existing vault:open path, validates
// successfully and contains the complete vault including full assertion
// history."

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createVaultFile, readVaultFile, validateVaultEnvelope } from '../vault/vault-file.ts';
import { createParty, createWork } from '../vault/entities.ts';
import { clearSession, ensureAccount, exportSession, getSession, openSession } from '../vault/vault-session.ts';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nayose-vault-handlers-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test.afterEach(() => {
  clearSession();
});

test('vault:export writes a complete export that reopens and validates via the vault:open path, with full assertion history intact', async () => {
  await withTempDir(async (dir) => {
    const sourcePath = path.join(dir, 'source.nayose');
    const exportPath = path.join(dir, 'exported.nayose');

    // Set up an open vault with several assertions spanning entity types,
    // exactly as entity:create* IPC handlers would produce.
    const vault = await createVaultFile(sourcePath);
    openSession(sourcePath, vault);
    const session = getSession();
    assert.ok(session);
    if (!session) return;

    const accountId = ensureAccount(session.log);
    const provenance = {
      actor: accountId,
      timestamp: new Date().toISOString(),
      source: 'nayose-app',
      sourceClass: 'user-asserted' as const,
    };
    createParty(session.log, { ...provenance, displayName: 'Alice' });
    createWork(session.log, { ...provenance, title: 'A Song' });

    const assertionsBeforeExport = [...session.log.assertions];
    assert.ok(assertionsBeforeExport.length > 0, 'sanity: session has assertions to export');

    // This is exactly what the vault:export IPC handler calls once
    // dialog.showSaveDialog has produced a destination path.
    const exportResult = await exportSession(exportPath);
    assert.equal(exportResult.ok, true);

    // Reopen via the same primitives vault:open uses.
    const reopened = await readVaultFile(exportPath);
    assert.equal(reopened.ok, true);
    if (!reopened.ok) return;

    // Independently re-validate the envelope, as vault:open does.
    const revalidated = validateVaultEnvelope(reopened.vault);
    assert.equal(revalidated.ok, true);

    assert.deepEqual(reopened.vault.body.assertions, assertionsBeforeExport);
  });
});

test('vault:export surfaces a typed no-vault-open error when no vault is open (no payment/account/network involved)', async () => {
  await withTempDir(async (dir) => {
    const exportPath = path.join(dir, 'exported.nayose');
    const result = await exportSession(exportPath);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.reason, 'no-vault-open');
    }
  });
});

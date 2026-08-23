// Tests for the entity-creation IPC logic (Task 8), exercised headlessly
// against real temp-file vaults, following vault-file.test.ts's
// os.tmpdir() pattern. Rather than spinning up a live Electron renderer,
// this simulates exactly what entity-handlers.ts's ipcMain.handle callbacks
// do: read/create a vault file, open a vault-session, ensure the vault's
// Account, call an entities.ts constructor with user-asserted provenance,
// persist the session, and (for the reopen scenarios) read the file back
// from disk via vault-file.ts + assertion-log.ts directly.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createVaultFile, readVaultFile } from '../vault/vault-file.ts';
import { loadAssertionLog } from '../vault/assertion-log.ts';
import { createParty, createRecording, createRelease, createWork, getEntityKind, getMostRecentFieldValue } from '../vault/entities.ts';
import {
  clearSession,
  ensureAccount,
  getSession,
  openSession,
  persistSession,
} from '../vault/vault-session.ts';
import { FIELD_DISPLAY_NAME, FIELD_TITLE, FIELD_TYPE } from '../../shared/types/entities.ts';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nayose-entity-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test.afterEach(() => {
  clearSession();
});

test('opening a vault and creating several entities establishes exactly one Account', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);
    openSession(filePath, vault);

    const session = getSession();
    assert.ok(session);
    if (!session) return;

    const accountId1 = ensureAccount(session.log);
    createParty(session.log, {
      actor: accountId1,
      timestamp: new Date().toISOString(),
      source: 'nayose-app',
      sourceClass: 'user-asserted',
      displayName: 'Alice',
    });
    const accountId2 = ensureAccount(session.log);
    createWork(session.log, {
      actor: accountId2,
      timestamp: new Date().toISOString(),
      source: 'nayose-app',
      sourceClass: 'user-asserted',
      title: 'A Song',
    });
    const accountId3 = ensureAccount(session.log);

    assert.equal(accountId1, accountId2);
    assert.equal(accountId2, accountId3);

    const accountAssertions = session.log.assertions.filter(
      (a) => a.fieldName === FIELD_TYPE && a.value === 'Account',
    );
    assert.equal(accountAssertions.length, 1, 'exactly one Account entity should exist');
  });
});

test('creating a Party, Work, Recording, and Release each records user-asserted assertions actored by the Account', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);
    openSession(filePath, vault);

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

    const partyId = createParty(session.log, { ...provenance, displayName: 'Alice' });
    const workId = createWork(session.log, { ...provenance, title: 'A Song' });
    const recordingId = createRecording(session.log, { ...provenance, title: 'A Song (Master)', workId });
    const releaseId = createRelease(session.log, {
      ...provenance,
      title: 'The Album',
      recordingIds: [recordingId],
    });

    const createdIds = [partyId, workId, recordingId, releaseId];
    for (const entityId of createdIds) {
      const assertionsForEntity = session.log.assertions.filter((a) => a.entityId === entityId);
      assert.ok(assertionsForEntity.length > 0);
      for (const assertion of assertionsForEntity) {
        assert.equal(assertion.sourceClass, 'user-asserted');
        assert.equal(assertion.actor, accountId);
      }
    }

    assert.equal(getEntityKind(session.log, partyId), 'Party');
    assert.equal(getEntityKind(session.log, workId), 'Work');
    assert.equal(getEntityKind(session.log, recordingId), 'Recording');
    assert.equal(getEntityKind(session.log, releaseId), 'Release');
  });
});

test('created entities and their fields survive persisting, closing, and reopening the vault file', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);
    openSession(filePath, vault);

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

    const partyId = createParty(session.log, { ...provenance, displayName: 'Alice' });
    const workId = createWork(session.log, { ...provenance, title: 'A Song' });
    const recordingId = createRecording(session.log, { ...provenance, title: 'A Song (Master)', workId });
    const releaseId = createRelease(session.log, {
      ...provenance,
      title: 'The Album',
      recordingIds: [recordingId],
    });

    await persistSession(session);

    // Simulate a fresh main-process session: close, then reopen from disk.
    clearSession();
    const reopened = await readVaultFile(filePath);
    assert.equal(reopened.ok, true);
    if (!reopened.ok) return;

    const reopenedSession = openSession(filePath, reopened.vault);
    const log = loadAssertionLog(reopened.vault.body.assertions ?? []);

    // Exactly one Account persisted across the reopen.
    const accountAssertions = log.assertions.filter((a) => a.fieldName === FIELD_TYPE && a.value === 'Account');
    assert.equal(accountAssertions.length, 1);
    assert.equal(reopenedSession.log.assertions.length, log.assertions.length);

    assert.equal(getEntityKind(log, partyId), 'Party');
    assert.equal(getMostRecentFieldValue(log, partyId, FIELD_DISPLAY_NAME), 'Alice');

    assert.equal(getEntityKind(log, workId), 'Work');
    assert.equal(getMostRecentFieldValue(log, workId, FIELD_TITLE), 'A Song');

    assert.equal(getEntityKind(log, recordingId), 'Recording');
    assert.equal(getMostRecentFieldValue(log, recordingId, FIELD_TITLE), 'A Song (Master)');

    assert.equal(getEntityKind(log, releaseId), 'Release');
    assert.equal(getMostRecentFieldValue(log, releaseId, FIELD_TITLE), 'The Album');
  });
});

test('ensureAccount does not create a second Account when reloaded from a persisted log that already has one', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);
    const session = openSession(filePath, vault);

    const firstAccountId = ensureAccount(session.log);
    await persistSession(session);

    const reopened = await readVaultFile(filePath);
    assert.equal(reopened.ok, true);
    if (!reopened.ok) return;

    const log = loadAssertionLog(reopened.vault.body.assertions ?? []);
    const secondAccountId = ensureAccount(log);

    assert.equal(firstAccountId, secondAccountId);
    const accountAssertions = log.assertions.filter((a) => a.fieldName === FIELD_TYPE && a.value === 'Account');
    assert.equal(accountAssertions.length, 1);
  });
});

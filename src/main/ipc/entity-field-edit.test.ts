// Tests for the additive field-editing IPC logic (Task 10), added as a
// separate file (rather than growing Task 8's entity-handlers.test.ts) per
// this task's own guidance. Follows the same headless pattern as
// entity-handlers.test.ts: real temp-file vaults, exercising exactly what
// entity-handlers.ts's `entity:editField` ipcMain.handle callback does
// (get session, ensure Account, appendAssertion with user provenance,
// persist), without spinning up a live Electron renderer.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createVaultFile, readVaultFile } from '../vault/vault-file.ts';
import { appendAssertion, getAssertions, loadAssertionLog } from '../vault/assertion-log.ts';
import { createWork } from '../vault/entities.ts';
import { getFieldHistory, projectField } from '../vault/projection.ts';
import { clearSession, ensureAccount, getSession, openSession, persistSession } from '../vault/vault-session.ts';
import { FIELD_TITLE } from '../../shared/types/entities.ts';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nayose-field-edit-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Exercises exactly what entity-handlers.ts's `entity:editField` handler
 * does, against an already-open session: ensure the Account, append a new
 * user-asserted assertion for (entityId, fieldName), persist.
 */
async function editFieldLikeHandler(
  session: { log: ReturnType<typeof loadAssertionLog>; path: string },
  entityId: string,
  fieldName: string,
  value: unknown,
) {
  const accountId = ensureAccount(session.log);
  const assertion = appendAssertion(session.log, {
    entityId,
    fieldName,
    value,
    actor: accountId,
    timestamp: new Date().toISOString(),
    source: 'nayose-app',
    sourceClass: 'user-asserted',
  });
  await persistSession(session as never);
  return assertion;
}

test.afterEach(() => {
  clearSession();
});

test('editing a field appends a new user-asserted assertion', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);
    openSession(filePath, vault);

    const session = getSession();
    assert.ok(session);
    if (!session) return;

    const accountId = ensureAccount(session.log);
    const workId = createWork(session.log, {
      actor: accountId,
      timestamp: new Date().toISOString(),
      source: 'nayose-app',
      sourceClass: 'user-asserted',
      title: 'Original Title',
    });

    const newAssertion = await editFieldLikeHandler(session, workId, FIELD_TITLE, 'Edited Title');

    assert.equal(newAssertion.sourceClass, 'user-asserted');
    assert.equal(newAssertion.actor, accountId);
    assert.equal(newAssertion.value, 'Edited Title');

    const projected = projectField<string>(session.log, workId, FIELD_TITLE);
    assert.equal(projected?.value, 'Edited Title');
  });
});

test('the prior assertion remains retrievable after an edit', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);
    openSession(filePath, vault);

    const session = getSession();
    assert.ok(session);
    if (!session) return;

    const accountId = ensureAccount(session.log);
    const workId = createWork(session.log, {
      actor: accountId,
      timestamp: new Date().toISOString(),
      source: 'nayose-app',
      sourceClass: 'user-asserted',
      title: 'Original Title',
    });

    await editFieldLikeHandler(session, workId, FIELD_TITLE, 'Edited Title');

    const history = getFieldHistory(session.log, workId, FIELD_TITLE);
    assert.equal(history.length, 2, 'both the original and the edited assertion should be present');
    assert.equal(history[0].value, 'Original Title');
    assert.equal(history[1].value, 'Edited Title');
  });
});

test('no existing assertion is altered or deleted by an edit', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);
    openSession(filePath, vault);

    const session = getSession();
    assert.ok(session);
    if (!session) return;

    const accountId = ensureAccount(session.log);
    const workId = createWork(session.log, {
      actor: accountId,
      timestamp: new Date().toISOString(),
      source: 'nayose-app',
      sourceClass: 'user-asserted',
      title: 'Original Title',
    });

    const beforeEdit = getAssertions(session.log);

    await editFieldLikeHandler(session, workId, FIELD_TITLE, 'Edited Title');

    const afterEdit = getAssertions(session.log);

    assert.equal(afterEdit.length, beforeEdit.length + 1, 'log should grow by exactly one assertion');
    beforeEdit.forEach((original, index) => {
      assert.deepEqual(afterEdit[index], original, `assertion at index ${index} must be unchanged`);
    });
  });
});

test('an edited field survives persisting, closing, and reopening the vault file', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);
    openSession(filePath, vault);

    const session = getSession();
    assert.ok(session);
    if (!session) return;

    const accountId = ensureAccount(session.log);
    const workId = createWork(session.log, {
      actor: accountId,
      timestamp: new Date().toISOString(),
      source: 'nayose-app',
      sourceClass: 'user-asserted',
      title: 'Original Title',
    });

    await editFieldLikeHandler(session, workId, FIELD_TITLE, 'Edited Title');

    clearSession();
    const reopened = await readVaultFile(filePath);
    assert.equal(reopened.ok, true);
    if (!reopened.ok) return;

    const log = loadAssertionLog(reopened.vault.body.assertions ?? []);
    const history = getFieldHistory(log, workId, FIELD_TITLE);

    assert.equal(history.length, 2);
    assert.equal(history[0].value, 'Original Title');
    assert.equal(history[1].value, 'Edited Title');

    const projected = projectField<string>(log, workId, FIELD_TITLE);
    assert.equal(projected?.value, 'Edited Title');
  });
});

// Unit tests for vault-session.ts's session-aware export wrapper (Task 2 of
// the export/publish feature). Follows entity-handlers.test.ts's temp-file
// pattern: real files under os.tmpdir(), no Electron dialog/IPC involved.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createVaultFile, readVaultFile } from './vault-file.ts';
import { clearSession, exportSession, openSession } from './vault-session.ts';
import type { Assertion } from '../../shared/types/assertion.ts';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nayose-vault-session-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test.afterEach(() => {
  clearSession();
});

test('exportSession returns a typed no-vault-open error when no vault is open', async () => {
  await withTempDir(async (dir) => {
    const exportPath = path.join(dir, 'export.nayose');
    const result = await exportSession(exportPath);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.reason, 'no-vault-open');
    }
  });
});

test('exportSession writes the open session\'s assertions to the given path via the envelope-building path', async () => {
  await withTempDir(async (dir) => {
    const sourcePath = path.join(dir, 'source.nayose');
    const exportPath = path.join(dir, 'exported.nayose');

    const sourceVault = await createVaultFile(sourcePath);
    const session = openSession(sourcePath, sourceVault);
    const assertion: Assertion = {
      id: 'a1',
      entityId: 'e1',
      fieldName: 'displayName',
      value: 'Example Party',
      actor: 'system',
      timestamp: '2026-01-01T00:00:00.000Z',
      source: 'nayose-app',
      sourceClass: 'user-asserted',
    };
    session.log.assertions.push(assertion);

    const result = await exportSession(exportPath);
    assert.equal(result.ok, true);

    const reopened = await readVaultFile(exportPath);
    assert.equal(reopened.ok, true);
    if (reopened.ok) {
      assert.deepEqual(reopened.vault.body.assertions, [assertion]);
    }
  });
});

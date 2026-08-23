// Unit tests for vault-file.ts's pure create/read/write/validate logic.
// Run with Node's built-in test runner: `npm test`.
//
// These import relative modules with an explicit `.ts` extension so Node's
// native TypeScript support (type-stripping, no build step) can resolve
// them directly; this file is excluded from the tsc `build:main` output
// (see tsconfig.main.json) so the `.ts`-extension imports never reach tsc.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  createEmptyVault,
  createVaultFile,
  readVaultFile,
  validateVaultEnvelope,
  writeVaultFile,
} from './vault-file.ts';
import { VAULT_FORMAT_MARKER, VAULT_FORMAT_VERSION } from '../../shared/types/vault.ts';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nayose-vault-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('createVaultFile writes an envelope with the expected marker and version', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);

    assert.equal(vault.nayoseVault, VAULT_FORMAT_MARKER);
    assert.equal(vault.formatVersion, VAULT_FORMAT_VERSION);
    assert.deepEqual(vault.body, {});

    const raw = await readFile(filePath, 'utf-8');
    const onDisk = JSON.parse(raw) as unknown;
    assert.deepEqual(onDisk, vault);
  });
});

test('opening a just-created vault returns identical parsed contents', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const created = await createVaultFile(filePath);

    const result = await readVaultFile(filePath);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.vault, created);
    }
  });
});

test('save then reopen round-trips to an identical structure', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = createEmptyVault();

    await writeVaultFile(filePath, vault);
    const first = await readVaultFile(filePath);
    assert.equal(first.ok, true);

    if (!first.ok) {
      return;
    }

    await writeVaultFile(filePath, first.vault);
    const second = await readVaultFile(filePath);

    assert.equal(second.ok, true);
    if (second.ok) {
      assert.deepEqual(second.vault, first.vault);
    }
  });
});

test('opening a file that does not exist returns a typed not-found error', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'missing.nayose');
    const result = await readVaultFile(filePath);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.reason, 'not-found');
    }
  });
});

test('opening a plain-text file returns a typed error, not a throw', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'notes.txt');
    await writeFile(filePath, 'just some plain text, not JSON at all', 'utf-8');

    const result = await readVaultFile(filePath);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.reason, 'invalid-json');
      assert.match(result.error.message, /not valid JSON/);
    }
  });
});

test('opening unrelated JSON returns a typed not-a-vault error', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'random.json');
    await writeFile(filePath, JSON.stringify({ hello: 'world' }), 'utf-8');

    const result = await readVaultFile(filePath);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.reason, 'not-a-vault');
    }
  });
});

test('opening a vault with an unsupported format version returns a typed error', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'future.nayose');
    await writeFile(
      filePath,
      JSON.stringify({ nayoseVault: VAULT_FORMAT_MARKER, formatVersion: 999, body: {} }),
      'utf-8',
    );

    const result = await readVaultFile(filePath);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.reason, 'unsupported-version');
    }
  });
});

test('validateVaultEnvelope rejects non-object values without throwing', () => {
  const result = validateVaultEnvelope('not an object');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.reason, 'not-a-vault');
  }
});

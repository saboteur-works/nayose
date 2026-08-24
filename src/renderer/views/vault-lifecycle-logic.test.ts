// Unit tests for vault-lifecycle-logic.ts's pure status-resolution logic.
// Follows contradiction-warning-logic.test.ts's precedent: a plain `.ts`
// module (no JSX) imported directly under `node --test`.

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCreateStatus, resolveExportStatus, resolveOpenStatus } from './vault-lifecycle-logic.ts';
import { VAULT_FORMAT_MARKER, VAULT_FORMAT_VERSION } from '../../shared/types/vault.ts';
import type {
  VaultCreateResult,
  VaultExportTriggerResult,
  VaultFile,
  VaultOpenResult,
} from '../../shared/types/vault.ts';

function emptyVault(): VaultFile {
  return { nayoseVault: VAULT_FORMAT_MARKER, formatVersion: VAULT_FORMAT_VERSION, body: {} };
}

test('resolveCreateStatus: success reports the created path, not an error', () => {
  const result: VaultCreateResult = { ok: true, path: '/tmp/my.nayose', vault: emptyVault() };
  const status = resolveCreateStatus(result);
  assert.equal(status.isError, false);
  assert.match(status.message, /\/tmp\/my\.nayose/);
});

// done_when clause 3: a canceled dialog must not be reported as an error.
test('resolveCreateStatus: canceled produces no message at all', () => {
  const result: VaultCreateResult = { ok: false, canceled: true };
  const status = resolveCreateStatus(result);
  assert.equal(status.message, '');
  assert.equal(status.isError, false);
});

test('resolveCreateStatus: failure surfaces the returned error message', () => {
  const result: VaultCreateResult = {
    ok: false,
    canceled: false,
    error: { reason: 'write-error', message: 'Could not write vault file' },
  };
  const status = resolveCreateStatus(result);
  assert.equal(status.isError, true);
  assert.equal(status.message, 'Could not write vault file');
});

test('resolveOpenStatus: success reports the opened path, not an error', () => {
  const result: VaultOpenResult = { ok: true, path: '/tmp/existing.nayose', vault: emptyVault() };
  const status = resolveOpenStatus(result);
  assert.equal(status.isError, false);
  assert.match(status.message, /\/tmp\/existing\.nayose/);
});

// done_when clause 3, open-side counterpart.
test('resolveOpenStatus: canceled produces no message at all', () => {
  const result: VaultOpenResult = { ok: false, canceled: true };
  const status = resolveOpenStatus(result);
  assert.equal(status.message, '');
  assert.equal(status.isError, false);
});

// done_when clause 2: opening a non-vault file surfaces the returned error.
test('resolveOpenStatus: failure surfaces the returned error message (e.g. not-a-vault)', () => {
  const result: VaultOpenResult = {
    ok: false,
    canceled: false,
    error: { reason: 'not-a-vault', message: 'This file is not a Nayose vault' },
  };
  const status = resolveOpenStatus(result);
  assert.equal(status.isError, true);
  assert.equal(status.message, 'This file is not a Nayose vault');
});

test('resolveExportStatus: success reports the exported path, not an error', () => {
  const result: VaultExportTriggerResult = { ok: true, path: '/tmp/exported.nayose' };
  const status = resolveExportStatus(result);
  assert.equal(status.isError, false);
  assert.match(status.message, /\/tmp\/exported\.nayose/);
});

test('resolveExportStatus: canceled produces no message at all', () => {
  const result: VaultExportTriggerResult = { ok: false, canceled: true };
  const status = resolveExportStatus(result);
  assert.equal(status.message, '');
  assert.equal(status.isError, false);
});

test('resolveExportStatus: failure surfaces the returned error message (e.g. no-vault-open)', () => {
  const result: VaultExportTriggerResult = {
    ok: false,
    canceled: false,
    error: { reason: 'no-vault-open', message: 'Cannot export: no vault is currently open.' },
  };
  const status = resolveExportStatus(result);
  assert.equal(status.isError, true);
  assert.equal(status.message, 'Cannot export: no vault is currently open.');
});

// Feature 2, Task 8 (FR-5, FR-8): an unsupported-version refusal is a
// failure like any other, and resolveOpenStatus's generic failure branch
// must surface its exact message -- including the declared version -- to
// the user rather than a generic placeholder like "an error occurred".
test('resolveOpenStatus: surfaces the unsupported-version message verbatim, including the declared version', () => {
  const result: VaultOpenResult = {
    ok: false,
    canceled: false,
    error: {
      reason: 'unsupported-version',
      message: 'File declares vault format version 2, but this app supports version 1.',
    },
  };
  const status = resolveOpenStatus(result);
  assert.equal(status.isError, true);
  assert.equal(
    status.message,
    'File declares vault format version 2, but this app supports version 1.',
  );
});

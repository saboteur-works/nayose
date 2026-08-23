// Tests for the provenance-lookup query logic (Task 11), which backs
// ../ipc/provenance-handlers.ts's IPC channel. Follows catalog-queries.test.ts's
// style: node:test, node:assert/strict, exercising the exported pure
// function directly against an in-memory AssertionLog built with
// assertion-log.ts's `appendAssertion`, skipping the vault-file/session
// layer entirely (none of this module's logic depends on it).

import test from 'node:test';
import assert from 'node:assert/strict';

import { appendAssertion, createAssertionLog } from './assertion-log.ts';
import { getFieldProvenance } from './provenance-queries.ts';

const REGISTRY_PROVENANCE = {
  actor: 'registry-mlc',
  source: 'mlc-registry-feed',
  sourceClass: 'registry-issued' as const,
};

const USER_PROVENANCE = {
  actor: 'account-1',
  source: 'nayose-app',
  sourceClass: 'user-asserted' as const,
};

test('a field with only registry-issued history: current value, isOverride false, full history, all in one call', () => {
  const log = createAssertionLog();
  const entityId = 'work-1';
  const fieldName = 'title';

  const a1 = appendAssertion(log, {
    ...REGISTRY_PROVENANCE,
    entityId,
    fieldName,
    value: 'A Song',
    timestamp: '2026-01-01T00:00:00.000Z',
  });
  const a2 = appendAssertion(log, {
    ...REGISTRY_PROVENANCE,
    entityId,
    fieldName,
    value: 'A Song (Remastered)',
    timestamp: '2026-01-02T00:00:00.000Z',
  });

  const result = getFieldProvenance<string>(log, entityId, fieldName);

  assert.equal(result.entityId, entityId);
  assert.equal(result.fieldName, fieldName);
  assert.ok(result.current);
  assert.equal(result.current?.value, 'A Song (Remastered)');
  assert.equal(result.current?.sourceClass, 'registry-issued');
  assert.equal(result.current?.isOverride, false);
  assert.equal(result.current?.overriddenRegistryValue, undefined);
  assert.deepEqual(
    result.history.map((a) => a.id),
    [a1.id, a2.id],
  );
});

test('a field with a user override: current value, isOverride true, overridden registry value/source, full history, all in one call', () => {
  const log = createAssertionLog();
  const entityId = 'work-2';
  const fieldName = 'title';

  const registryAssertion = appendAssertion(log, {
    ...REGISTRY_PROVENANCE,
    entityId,
    fieldName,
    value: 'Registry Title',
    timestamp: '2026-01-01T00:00:00.000Z',
  });
  const userAssertion = appendAssertion(log, {
    ...USER_PROVENANCE,
    entityId,
    fieldName,
    value: 'User-Corrected Title',
    timestamp: '2026-01-02T00:00:00.000Z',
  });

  const result = getFieldProvenance<string>(log, entityId, fieldName);

  assert.ok(result.current);
  assert.equal(result.current?.value, 'User-Corrected Title');
  assert.equal(result.current?.sourceClass, 'user-asserted');
  assert.equal(result.current?.sourceAssertionId, userAssertion.id);
  assert.equal(result.current?.isOverride, true);
  assert.equal(result.current?.overriddenRegistryValue, 'Registry Title');
  assert.equal(result.current?.overriddenRegistrySource, REGISTRY_PROVENANCE.source);
  assert.equal(result.current?.overriddenRegistryAssertionId, registryAssertion.id);
  assert.deepEqual(
    result.history.map((a) => a.id),
    [registryAssertion.id, userAssertion.id],
  );
});

test('a field with no assertions at all returns undefined current and an empty history, in one call', () => {
  const log = createAssertionLog();

  const result = getFieldProvenance(log, 'work-3', 'title');

  assert.equal(result.current, undefined);
  assert.deepEqual(result.history, []);
});

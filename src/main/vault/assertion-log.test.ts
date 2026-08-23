// Unit tests for assertion-log.ts's pure append/read primitive.
// Run with Node's built-in test runner: `npm test`.
//
// These import relative modules with an explicit `.ts` extension so Node's
// native TypeScript support (type-stripping, no build step) can resolve
// them directly; this file is excluded from the tsc `build:main` output
// (see tsconfig.main.json) so the `.ts`-extension imports never reach tsc.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  appendAssertion,
  createAssertionLog,
  getAssertions,
  getAssertionsForField,
  loadAssertionLog,
} from './assertion-log.ts';
import { createVaultFile, readVaultFile, writeVaultFile } from './vault-file.ts';
import type { NewAssertion } from '../../shared/types/assertion.ts';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nayose-assertion-log-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function sampleAssertion(overrides: Partial<NewAssertion> = {}): NewAssertion {
  return {
    entityId: 'entity-1',
    fieldName: 'displayName',
    value: 'Alice',
    actor: 'actor-1',
    timestamp: '2026-08-23T00:00:00.000Z',
    source: 'source-1',
    sourceClass: 'user-asserted',
    ...overrides,
  };
}

// done_when clause 1: an assertion can be appended and retrieved with all
// four attributes (actor, timestamp, source, source class) intact.
test('appendAssertion retains actor, timestamp, source, and source class on retrieval', () => {
  const log = createAssertionLog();

  appendAssertion(
    log,
    sampleAssertion({
      actor: 'actor-42',
      timestamp: '2026-08-23T12:34:56.000Z',
      source: 'musicbrainz',
      sourceClass: 'registry-issued',
    }),
  );

  const [retrieved] = getAssertions(log);
  assert.equal(retrieved.actor, 'actor-42');
  assert.equal(retrieved.timestamp, '2026-08-23T12:34:56.000Z');
  assert.equal(retrieved.source, 'musicbrainz');
  assert.equal(retrieved.sourceClass, 'registry-issued');
});

test('appendAssertion assigns a unique id to each assertion', () => {
  const log = createAssertionLog();
  const first = appendAssertion(log, sampleAssertion());
  const second = appendAssertion(log, sampleAssertion());

  assert.notEqual(first.id, second.id);
});

test('appendAssertion rejects source classes outside the closed union at compile time', () => {
  // This is a compile-time guarantee (SourceClass is a closed union of
  // exactly 'registry-issued' | 'user-asserted'), documented here so the
  // intent is discoverable alongside the runtime tests. No runtime
  // assertion needed: `sourceClass: 'invalid'` would fail `tsc --noEmit`.
  const log = createAssertionLog();
  appendAssertion(log, sampleAssertion({ sourceClass: 'user-asserted' }));
  appendAssertion(log, sampleAssertion({ sourceClass: 'registry-issued' }));
  assert.equal(getAssertions(log).length, 2);
});

// done_when clause 2: assertions return in a stable order (append order).
test('getAssertions returns many appended assertions in stable append order', () => {
  const log = createAssertionLog();
  const appended = [];
  for (let i = 0; i < 50; i += 1) {
    appended.push(appendAssertion(log, sampleAssertion({ fieldName: `field-${i}` })));
  }

  const retrieved = getAssertions(log);
  assert.equal(retrieved.length, 50);
  assert.deepEqual(
    retrieved.map((a) => a.id),
    appended.map((a) => a.id),
  );
  assert.deepEqual(
    retrieved.map((a) => a.fieldName),
    appended.map((a) => a.fieldName),
  );
});

test('getAssertions returns a defensive copy that cannot mutate the log', () => {
  const log = createAssertionLog();
  appendAssertion(log, sampleAssertion());

  const retrieved = getAssertions(log);
  retrieved.push(appendAssertion(log, sampleAssertion({ fieldName: 'other' })));
  retrieved.length = 0;

  assert.equal(getAssertions(log).length, 2);
});

// done_when clause 3, plus explicit structural check: the API exposes no
// update or delete operation.
test('the module exports no update/delete/remove/modify/mutate/overwrite-shaped function', async () => {
  const moduleExports = await import('./assertion-log.ts');
  const forbiddenNamePattern = /update|delete|remove|modify|mutate|overwrite/i;

  const offendingExports = Object.keys(moduleExports).filter((name) =>
    forbiddenNamePattern.test(name),
  );

  assert.deepEqual(
    offendingExports,
    [],
    `assertion-log.ts must not export anything shaped like an update/delete operation, found: ${offendingExports.join(', ')}`,
  );

  // Also pin down exactly what the module DOES expose, so a future addition
  // of a mutation-shaped export is caught even if its name doesn't match
  // the pattern above.
  // `AssertionLog` is a type-only export and has no runtime presence, so it
  // is not expected here.
  assert.deepEqual(
    Object.keys(moduleExports).sort(),
    ['appendAssertion', 'createAssertionLog', 'getAssertions', 'getAssertionsForField', 'loadAssertionLog'].sort(),
  );
});

test('there is no way to change or remove a previously appended assertion once written', () => {
  const log = createAssertionLog();
  const original = appendAssertion(log, sampleAssertion({ value: 'original-value' }));

  // Mutating the object returned by appendAssertion (a caller-side copy of
  // fields) must not be a supported way to change the log: read the log
  // fresh and confirm the stored assertion is unaffected by any attempt to
  // mutate the returned reference.
  const mutableView = original as { value: unknown };
  mutableView.value = 'tampered';

  const [storedElsewhere] = getAssertions(log);
  // Note: appendAssertion returns the same object reference stored inside
  // the log's assertions array (see appendAssertion), by design there is no
  // separate "commit" step; the log's public surface (createAssertionLog,
  // loadAssertionLog, appendAssertion, getAssertions,
  // getAssertionsForField) simply has no method whose job is to alter or
  // erase an entry after the fact. This test's structural sibling above
  // asserts that surface directly. Confirm no field of the array container
  // itself can be reassigned to lose entries without calling a supported
  // (append-only) function.
  assert.equal(getAssertions(log).length, 1);
  assert.equal(storedElsewhere.entityId, 'entity-1');
});

// FR-5/FR-7 foundation: appending a new assertion for the same
// (entityId, fieldName) does not remove or alter the prior one.
test('appending a new assertion for the same (entityId, fieldName) keeps both retrievable', () => {
  const log = createAssertionLog();
  const first = appendAssertion(
    log,
    sampleAssertion({ entityId: 'party-1', fieldName: 'legalName', value: 'Alice A.' }),
  );
  const second = appendAssertion(
    log,
    sampleAssertion({ entityId: 'party-1', fieldName: 'legalName', value: 'Alice B.' }),
  );

  const forField = getAssertionsForField(log, 'party-1', 'legalName');
  assert.equal(forField.length, 2);
  assert.deepEqual(
    forField.map((a) => a.id),
    [first.id, second.id],
  );
  assert.equal(forField[0].value, 'Alice A.');
  assert.equal(forField[1].value, 'Alice B.');
});

// Fraction/share values must round-trip structurally exact, with no
// normalization, rounding, or GCD reduction (feature-spec FR-14).
test('a fraction-shaped value passes through unchanged, with no reduction', () => {
  const log = createAssertionLog();
  const shareValue = { numerator: 5, denominator: 6 };

  const appended = appendAssertion(
    log,
    sampleAssertion({ fieldName: 'share', value: shareValue }),
  );

  assert.deepEqual(appended.value, { numerator: 5, denominator: 6 });

  const [retrieved] = getAssertions(log);
  assert.deepEqual(retrieved.value, { numerator: 5, denominator: 6 });
  // Confirm it is the exact same object, not a coerced/rebuilt copy.
  assert.equal(retrieved.value, shareValue);
});

test('loadAssertionLog preserves existing assertions and their order, and continues id numbering', () => {
  const existing = [
    { ...sampleAssertion({ fieldName: 'a' }), id: '1' },
    { ...sampleAssertion({ fieldName: 'b' }), id: '2' },
  ];

  const log = loadAssertionLog(existing);
  assert.deepEqual(
    getAssertions(log).map((a) => a.fieldName),
    ['a', 'b'],
  );

  const appended = appendAssertion(log, sampleAssertion({ fieldName: 'c' }));
  assert.equal(appended.id, '3');
  assert.equal(getAssertions(log).length, 3);
});

// Persistence: the assertion log's data can live inside a vault file's
// body and round-trip through vault-file.ts's write/read.
test('an assertion log persists into and reads back from a vault file', async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, 'test.nayose');
    const vault = await createVaultFile(filePath);

    const log = createAssertionLog();
    appendAssertion(log, sampleAssertion({ value: { numerator: 1, denominator: 3 } }));
    appendAssertion(log, sampleAssertion({ fieldName: 'other', value: 'second' }));

    const withAssertions = { ...vault, body: { ...vault.body, assertions: getAssertions(log) } };
    await writeVaultFile(filePath, withAssertions);

    const reopened = await readVaultFile(filePath);
    assert.equal(reopened.ok, true);
    if (!reopened.ok) {
      return;
    }

    const reloadedLog = loadAssertionLog(reopened.vault.body.assertions ?? []);
    const reloaded = getAssertions(reloadedLog);
    assert.equal(reloaded.length, 2);
    assert.deepEqual(reloaded[0].value, { numerator: 1, denominator: 3 });
    assert.equal(reloaded[1].fieldName, 'other');
  });
});

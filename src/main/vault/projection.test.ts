// Unit tests for projection.ts's read-only conflict-resolution and
// fraction-normalization primitives.
// Run with Node's built-in test runner: `npm test`.

import test from 'node:test';
import assert from 'node:assert/strict';

import { appendAssertion, createAssertionLog, getAssertions } from './assertion-log.ts';
import { fractionsEqual, getFieldHistory, projectField, reduceFraction, sumFractions } from './projection.ts';
import type { NewAssertion } from '../../shared/types/assertion.ts';

function sampleAssertion(overrides: Partial<NewAssertion> = {}): NewAssertion {
  return {
    entityId: 'work-1',
    fieldName: 'title',
    value: 'Untitled',
    actor: 'actor-1',
    timestamp: '2026-08-23T00:00:00.000Z',
    source: 'source-1',
    sourceClass: 'user-asserted',
    ...overrides,
  };
}

// done_when clause 1: current value resolves deterministically.
test('projectField: user-asserted wins over registry-issued regardless of append order', () => {
  const log = createAssertionLog();
  appendAssertion(
    log,
    sampleAssertion({ value: 'Registry Title', source: 'musicbrainz', sourceClass: 'registry-issued' }),
  );
  appendAssertion(
    log,
    sampleAssertion({ value: 'User Title', source: 'user-1', sourceClass: 'user-asserted' }),
  );

  const projected = projectField(log, 'work-1', 'title');
  assert.equal(projected?.value, 'User Title');
  assert.equal(projected?.sourceClass, 'user-asserted');
});

test('projectField: with multiple assertions of the same class, most recent by append order wins', () => {
  const log = createAssertionLog();
  appendAssertion(log, sampleAssertion({ value: 'User Title 1', sourceClass: 'user-asserted' }));
  appendAssertion(log, sampleAssertion({ value: 'User Title 2', sourceClass: 'user-asserted' }));
  appendAssertion(log, sampleAssertion({ value: 'User Title 3', sourceClass: 'user-asserted' }));

  const projected = projectField(log, 'work-1', 'title');
  assert.equal(projected?.value, 'User Title 3');
});

test('projectField: registry-only field resolves to most recent registry assertion', () => {
  const log = createAssertionLog();
  appendAssertion(
    log,
    sampleAssertion({ value: 'Registry Title 1', source: 'musicbrainz', sourceClass: 'registry-issued' }),
  );
  appendAssertion(
    log,
    sampleAssertion({ value: 'Registry Title 2', source: 'discogs', sourceClass: 'registry-issued' }),
  );

  const projected = projectField(log, 'work-1', 'title');
  assert.equal(projected?.value, 'Registry Title 2');
  assert.equal(projected?.sourceClass, 'registry-issued');
  assert.equal(projected?.isOverride, false);
});

test('projectField: field with no assertions returns undefined', () => {
  const log = createAssertionLog();
  const projected = projectField(log, 'work-1', 'title');
  assert.equal(projected, undefined);
});

// done_when clause 2: both conflicting assertions retrievable after resolution.
test('projectField: resolution does not discard the losing assertion — both retrievable via history', () => {
  const log = createAssertionLog();
  const registryAssertion = appendAssertion(
    log,
    sampleAssertion({ value: 'Registry Title', source: 'musicbrainz', sourceClass: 'registry-issued' }),
  );
  const userAssertion = appendAssertion(
    log,
    sampleAssertion({ value: 'User Title', source: 'user-1', sourceClass: 'user-asserted' }),
  );

  const projected = projectField(log, 'work-1', 'title');
  assert.equal(projected?.value, 'User Title');

  const history = getFieldHistory(log, 'work-1', 'title');
  assert.equal(history.length, 2);
  assert.deepEqual(
    history.map((a) => a.id),
    [registryAssertion.id, userAssertion.id],
  );
  assert.equal(history[0].value, 'Registry Title');
  assert.equal(history[1].value, 'User Title');
});

// done_when clause 3: full history for a field queryable in order.
test('getFieldHistory: returns several sequential assertions in append order', () => {
  const log = createAssertionLog();
  const appended = [];
  for (let i = 0; i < 5; i += 1) {
    appended.push(appendAssertion(log, sampleAssertion({ value: `Title ${i}` })));
  }

  const history = getFieldHistory(log, 'work-1', 'title');
  assert.deepEqual(
    history.map((a) => a.id),
    appended.map((a) => a.id),
  );
  assert.deepEqual(
    history.map((a) => a.value),
    appended.map((a) => a.value),
  );
});

// done_when clause 4: override case, in ONE call.
test('projectField: override case reports current value, isOverride, superseded value and source in one call', () => {
  const log = createAssertionLog();
  appendAssertion(
    log,
    sampleAssertion({ value: 'Registry Title', source: 'musicbrainz', sourceClass: 'registry-issued' }),
  );
  appendAssertion(
    log,
    sampleAssertion({ value: 'User Title', source: 'user-1', sourceClass: 'user-asserted' }),
  );

  const projected = projectField(log, 'work-1', 'title');
  assert.equal(projected?.value, 'User Title');
  assert.equal(projected?.isOverride, true);
  assert.equal(projected?.overriddenRegistryValue, 'Registry Title');
  assert.equal(projected?.overriddenRegistrySource, 'musicbrainz');
});

test('projectField: non-override case — registry-issued only, isOverride is false', () => {
  const log = createAssertionLog();
  appendAssertion(
    log,
    sampleAssertion({ value: 'Registry Title', source: 'musicbrainz', sourceClass: 'registry-issued' }),
  );

  const projected = projectField(log, 'work-1', 'title');
  assert.equal(projected?.value, 'Registry Title');
  assert.equal(projected?.isOverride, false);
  assert.equal(projected?.overriddenRegistryValue, undefined);
});

// Explicit design-choice test: user asserts a value matching the registry's
// value — isOverride is FALSE, since there is nothing to warn about (see
// documented rationale in projection.ts).
test('projectField: user value matching registry value is NOT flagged as an override', () => {
  const log = createAssertionLog();
  appendAssertion(
    log,
    sampleAssertion({ value: 'Same Title', source: 'musicbrainz', sourceClass: 'registry-issued' }),
  );
  appendAssertion(
    log,
    sampleAssertion({ value: 'Same Title', source: 'user-1', sourceClass: 'user-asserted' }),
  );

  const projected = projectField(log, 'work-1', 'title');
  assert.equal(projected?.value, 'Same Title');
  assert.equal(projected?.isOverride, false);
  assert.equal(projected?.overriddenRegistryValue, undefined);
  assert.equal(projected?.overriddenRegistrySource, undefined);
});

// Read-only guarantee.
test('projectField and getFieldHistory never mutate the underlying AssertionLog', () => {
  const log = createAssertionLog();
  appendAssertion(
    log,
    sampleAssertion({ value: 'Registry Title', source: 'musicbrainz', sourceClass: 'registry-issued' }),
  );
  appendAssertion(
    log,
    sampleAssertion({ value: 'User Title', source: 'user-1', sourceClass: 'user-asserted' }),
  );

  const before = getAssertions(log);

  projectField(log, 'work-1', 'title');
  getFieldHistory(log, 'work-1', 'title');

  const after = getAssertions(log);
  assert.deepEqual(after, before);
  assert.equal(after.length, 2);
});

// ---------------------------------------------------------------------------
// Fraction normalization
// ---------------------------------------------------------------------------

test('reduceFraction: reduces 2/6 to 1/3 without mutating the source object', () => {
  const source = { numerator: 2, denominator: 6 };
  const reduced = reduceFraction(source);

  assert.deepEqual(reduced, { numerator: 1, denominator: 3 });
  assert.deepEqual(source, { numerator: 2, denominator: 6 });
});

test('sumFractions: three unreduced thirds sum to a fraction equal to 1', () => {
  const shares = [
    { numerator: 2, denominator: 6 },
    { numerator: 1, denominator: 3 },
    { numerator: 4, denominator: 12 },
  ];

  const total = sumFractions(shares);
  assert.equal(fractionsEqual(total, { numerator: 1, denominator: 1 }), true);
});

test('sumFractions: an incomplete set sums correctly, not silently coerced to 1', () => {
  const shares = [
    { numerator: 1, denominator: 2 },
    { numerator: 1, denominator: 3 },
  ];

  const total = sumFractions(shares);
  assert.equal(fractionsEqual(total, { numerator: 5, denominator: 6 }), true);
  assert.equal(fractionsEqual(total, { numerator: 1, denominator: 1 }), false);
});

test('fractionsEqual: 1/3 and 2/6 compare equal; 1/3 and 1/4 do not', () => {
  assert.equal(fractionsEqual({ numerator: 1, denominator: 3 }, { numerator: 2, denominator: 6 }), true);
  assert.equal(fractionsEqual({ numerator: 1, denominator: 3 }, { numerator: 1, denominator: 4 }), false);
});

// Unit tests for share-integrity.ts's pure, read-only share-integrity
// detection, per Task 7.
// Run with Node's built-in test runner: `npm test`.
//
// Follows entities.test.ts/projection.test.ts's style: node:test,
// node:assert/strict, `.ts`-extension relative imports for Node's native
// TypeScript type-stripping.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createAssertionLog } from './assertion-log.ts';
import { assertShare, createParty, createWork, type Provenance } from './entities.ts';
import { fractionsEqual } from './projection.ts';
import { checkShareIntegrity, checkShareIntegrityFromShares } from './share-integrity.ts';

const provenance: Provenance = {
  actor: 'actor-1',
  timestamp: '2026-08-23T00:00:00.000Z',
  source: 'source-1',
  sourceClass: 'user-asserted',
};

// done_when clause 1 + 2: unreduced shares that sum to exactly unity are
// reported 'complete', after GCD/LCM normalization via projection.ts.
test('checkShareIntegrity: three unreduced 1/3-equivalent shares sum to unity — status complete', () => {
  const log = createAssertionLog();
  const workId = createWork(log, { ...provenance, title: 'A Song' });
  const partyA = createParty(log, { ...provenance, displayName: 'Alice' });
  const partyB = createParty(log, { ...provenance, displayName: 'Bob' });
  const partyC = createParty(log, { ...provenance, displayName: 'Carol' });

  assertShare(log, { ...provenance, workId, partyId: partyA, share: { numerator: 2, denominator: 6 } });
  assertShare(log, { ...provenance, workId, partyId: partyB, share: { numerator: 1, denominator: 3 } });
  assertShare(log, { ...provenance, workId, partyId: partyC, share: { numerator: 4, denominator: 12 } });

  const result = checkShareIntegrity(log, workId);
  assert.equal(result.status, 'complete');
});

// done_when clause 1: shortfall is reported with actual total and correct
// difference, verified via fractionsEqual (not raw number comparison).
test('checkShareIntegrity: shares summing to 5/6 — status incomplete, direction shortfall', () => {
  const log = createAssertionLog();
  const workId = createWork(log, { ...provenance, title: 'A Song' });
  const partyA = createParty(log, { ...provenance, displayName: 'Alice' });
  const partyB = createParty(log, { ...provenance, displayName: 'Bob' });

  assertShare(log, { ...provenance, workId, partyId: partyA, share: { numerator: 1, denominator: 2 } });
  assertShare(log, { ...provenance, workId, partyId: partyB, share: { numerator: 1, denominator: 3 } });

  const result = checkShareIntegrity(log, workId);
  assert.equal(result.status, 'incomplete');
  if (result.status !== 'incomplete') {
    throw new Error('unreachable');
  }
  assert.equal(result.direction, 'shortfall');
  assert.ok(fractionsEqual(result.total, { numerator: 5, denominator: 6 }));
  assert.ok(fractionsEqual(result.difference, { numerator: 1, denominator: 6 }));
});

// done_when clause 1: over-allocation is reported with actual total and
// correct difference.
test('checkShareIntegrity: three 1/2 shares sum to 3/2 — status incomplete, direction over-allocation', () => {
  const log = createAssertionLog();
  const workId = createWork(log, { ...provenance, title: 'A Song' });
  const partyA = createParty(log, { ...provenance, displayName: 'Alice' });
  const partyB = createParty(log, { ...provenance, displayName: 'Bob' });
  const partyC = createParty(log, { ...provenance, displayName: 'Carol' });

  assertShare(log, { ...provenance, workId, partyId: partyA, share: { numerator: 1, denominator: 2 } });
  assertShare(log, { ...provenance, workId, partyId: partyB, share: { numerator: 1, denominator: 2 } });
  assertShare(log, { ...provenance, workId, partyId: partyC, share: { numerator: 1, denominator: 2 } });

  const result = checkShareIntegrity(log, workId);
  assert.equal(result.status, 'incomplete');
  if (result.status !== 'incomplete') {
    throw new Error('unreachable');
  }
  assert.equal(result.direction, 'over-allocation');
  assert.ok(fractionsEqual(result.total, { numerator: 3, denominator: 2 }));
  assert.ok(fractionsEqual(result.difference, { numerator: 1, denominator: 2 }));
});

// done_when clause 3: a Work with no share assertions is 'absent', distinct
// from 'incomplete'.
test('checkShareIntegrity: a Work with no share assertions at all — status absent, not incomplete', () => {
  const log = createAssertionLog();
  const workId = createWork(log, { ...provenance, title: 'A Song With No Shares' });

  const result = checkShareIntegrity(log, workId);
  assert.equal(result.status, 'absent');
  assert.notEqual(result.status, 'incomplete');
});

// Lower-level pure function, decoupled from the assertion log entirely.
test('checkShareIntegrityFromShares: empty array is absent, matching share arrays give matching status', () => {
  assert.equal(checkShareIntegrityFromShares([]).status, 'absent');

  const complete = checkShareIntegrityFromShares([
    { numerator: 1, denominator: 2 },
    { numerator: 1, denominator: 2 },
  ]);
  assert.equal(complete.status, 'complete');
});

// done_when clause 4: this module is a pure read-side check with no
// write-path dependency — verified structurally by confirming the module
// source never references the write-capable `appendAssertion` function (or
// any other assertion-log mutator), and by review: the module imports only
// `getWorkShares` (a reader) from entities.ts and pure fraction helpers from
// projection.ts, and exports no function capable of writing.
test('share-integrity.ts does not import or call any write-capable assertion-log function', () => {
  const moduleSource = readFileSync(fileURLToPath(new URL('./share-integrity.ts', import.meta.url)), 'utf8');
  assert.equal(moduleSource.includes('appendAssertion'), false);
  assert.equal(moduleSource.includes('writeVaultFile'), false);
});

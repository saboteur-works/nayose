// Unit tests for entities.ts's entity-model layer over the assertion log.
// Run with Node's built-in test runner: `npm test`.
//
// Follows assertion-log.test.ts's style: node:test, node:assert/strict,
// deepEqual-heavy, `.ts`-extension relative imports for Node's native
// TypeScript type-stripping (this file is excluded from tsc's build, see
// tsconfig.main.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createAssertionLog, getAssertionsForField } from './assertion-log.ts';
import {
  assertShare,
  createAccount,
  createParty,
  createRecording,
  createRegistration,
  createRelease,
  createWork,
  getEntityKind,
  getMostRecentFieldValue,
  getWorkShares,
  type Provenance,
} from './entities.ts';
import type { AccountId, PartyId } from '../../shared/types/entities.ts';

const provenance: Provenance = {
  actor: 'actor-1',
  timestamp: '2026-08-23T00:00:00.000Z',
  source: 'source-1',
  sourceClass: 'user-asserted',
};

// done_when clause 1: all six entity types are instantiable.
test('all six entity types are instantiable and their kind is reconstructable', () => {
  const log = createAssertionLog();

  const accountId = createAccount(log, { ...provenance, displayName: 'Solo Account' });
  const partyId = createParty(log, { ...provenance, displayName: 'Alice' });
  const workId = createWork(log, { ...provenance, title: 'A Song' });
  const recordingId = createRecording(log, { ...provenance, title: 'A Song (Master)', workId });
  const releaseId = createRelease(log, { ...provenance, title: 'The Album', recordingIds: [recordingId] });
  const registrationId = createRegistration(log, {
    ...provenance,
    workId,
    registryName: 'MLC',
    status: 'registered',
  });

  assert.equal(getEntityKind(log, accountId), 'Account');
  assert.equal(getEntityKind(log, partyId), 'Party');
  assert.equal(getEntityKind(log, workId), 'Work');
  assert.equal(getEntityKind(log, recordingId), 'Recording');
  assert.equal(getEntityKind(log, releaseId), 'Release');
  assert.equal(getEntityKind(log, registrationId), 'Registration');
});

// done_when clause 2: Party and Account are structurally distinct id types
// with no shared identity — compile-time check, documented alongside a
// runtime check that their generated ids don't collide/overlap.
test('PartyId cannot be substituted for AccountId (compile-time), and runtime ids do not overlap', () => {
  const log = createAssertionLog();
  const partyId: PartyId = createParty(log, provenance);
  const accountId: AccountId = createAccount(log, provenance);

  // Compile-time guarantee: PartyId and AccountId are distinct branded
  // string types (see shared/types/entities.ts), so the following would
  // fail `tsc --noEmit` if uncommented:
  //   const notAllowed: AccountId = partyId;
  //   const alsoNotAllowed: PartyId = accountId;
  // No runtime assertion is possible for a compile-time-only guarantee;
  // this test documents the intent the way assertion-log.test.ts did for
  // SourceClass, and backs it with the runtime check below.

  assert.notEqual(partyId, accountId);
  assert.equal(getEntityKind(log, partyId), 'Party');
  assert.equal(getEntityKind(log, accountId), 'Account');
  // Party and Account creation do not share a namespace of any kind: each
  // gets its own freshly generated id, and nothing about a Party's id
  // marks it (or fails to mark it) as an Account's id or vice versa beyond
  // the $type assertion each independently carries.
  assert.notEqual(getEntityKind(log, partyId), getEntityKind(log, accountId));
});

// done_when clause 3 and 5: the three-co-writer worked example. One
// Account, three coexisting Party entities, a Work, and three
// unreduced-1/3 share assertions — one per Party — all independently
// retrievable.
test('one Account with three co-writer Parties each holding an unreduced 1/3 share of a Work', () => {
  const log = createAssertionLog();

  const accountId = createAccount(log, { ...provenance, displayName: 'The Vault Owner' });

  const partyA = createParty(log, { ...provenance, displayName: 'Co-writer A' });
  const partyB = createParty(log, { ...provenance, displayName: 'Co-writer B' });
  const partyC = createParty(log, { ...provenance, displayName: 'Co-writer C' });

  const workId = createWork(log, { ...provenance, title: 'Three-Way Split' });

  assertShare(log, { ...provenance, workId, partyId: partyA, share: { numerator: 1, denominator: 3 } });
  assertShare(log, { ...provenance, workId, partyId: partyB, share: { numerator: 1, denominator: 3 } });
  assertShare(log, { ...provenance, workId, partyId: partyC, share: { numerator: 1, denominator: 3 } });

  // Exactly one Account exists.
  assert.equal(getEntityKind(log, accountId), 'Account');

  // All three Parties coexist and are distinct.
  assert.equal(getEntityKind(log, partyA), 'Party');
  assert.equal(getEntityKind(log, partyB), 'Party');
  assert.equal(getEntityKind(log, partyC), 'Party');
  assert.equal(new Set([partyA, partyB, partyC]).size, 3);

  // Each Party's share is independently retrievable, and none were
  // reduced, normalized, or merged into a single "total" value.
  const shares = getWorkShares(log, workId);
  assert.equal(shares.length, 3);
  assert.deepEqual(
    shares.map((s) => s.share),
    [
      { numerator: 1, denominator: 3 },
      { numerator: 1, denominator: 3 },
      { numerator: 1, denominator: 3 },
    ],
  );
  assert.deepEqual(
    new Set(shares.map((s) => s.partyId)),
    new Set([partyA, partyB, partyC]),
  );
});

// done_when clause 4: relationships between works, recordings, releases are
// representable and retrievable, backed by assertions (not an untracked
// pointer table).
test('a Recording references a Work, and a Release references its Recordings, both retrievable', () => {
  const log = createAssertionLog();

  const workId = createWork(log, { ...provenance, title: 'Referenced Work' });
  const recordingId = createRecording(log, { ...provenance, title: 'Referenced Recording', workId });
  const releaseId = createRelease(log, {
    ...provenance,
    title: 'Referenced Release',
    recordingIds: [recordingId],
  });

  assert.equal(getMostRecentFieldValue(log, recordingId, 'workId'), workId);
  assert.deepEqual(getMostRecentFieldValue(log, releaseId, 'recordingIds'), [recordingId]);

  // The relationship is backed by an actual assertion, not a side pointer
  // table: it shows up in getAssertionsForField like any other fact.
  const workIdAssertions = getAssertionsForField(log, recordingId, 'workId');
  assert.equal(workIdAssertions.length, 1);
  assert.equal(workIdAssertions[0].value, workId);
});

// done_when clause 7 (share half): an incomplete share set (summing to
// 5/6, not 1) persists without error.
test('an incomplete share set (summing to 5/6) persists without throwing', () => {
  const log = createAssertionLog();
  const workId = createWork(log, { ...provenance, title: 'Incomplete Split' });
  const partyA = createParty(log, provenance);
  const partyB = createParty(log, provenance);

  assert.doesNotThrow(() => {
    assertShare(log, { ...provenance, workId, partyId: partyA, share: { numerator: 1, denominator: 2 } });
    assertShare(log, { ...provenance, workId, partyId: partyB, share: { numerator: 1, denominator: 3 } });
  });

  const shares = getWorkShares(log, workId);
  assert.equal(shares.length, 2);
  // No summation, reduction, or validation happened: both raw fractions
  // are exactly as asserted.
  assert.deepEqual(
    shares.map((s) => s.share),
    [
      { numerator: 1, denominator: 2 },
      { numerator: 1, denominator: 3 },
    ],
  );
});

// done_when clause 6 and 7 (registration half): a Work's registration
// state can be unknown, or entirely absent, without error.
test('an unknown registration status persists, and an absent registration is also representable', () => {
  const log = createAssertionLog();
  const workWithUnknownStatus = createWork(log, { ...provenance, title: 'Unknown Status Work' });
  const workWithNoRegistration = createWork(log, { ...provenance, title: 'Unregistered Work' });

  let registrationId: string | undefined;
  assert.doesNotThrow(() => {
    registrationId = createRegistration(log, {
      ...provenance,
      workId: workWithUnknownStatus,
      registryName: 'MLC',
      // status omitted entirely: defaults to 'unknown', not a placeholder
      // error value, and does not block the write.
    });
  });

  assert.ok(registrationId);
  assert.equal(getMostRecentFieldValue(log, registrationId as string, 'status'), 'unknown');

  // A Work with no Registration assertion at all is equally valid: reading
  // its registration state simply finds nothing, rather than erroring.
  assert.equal(getEntityKind(log, workWithNoRegistration), 'Work');
  const anyRegistrationField = getAssertionsForField(log, workWithNoRegistration, 'status');
  assert.equal(anyRegistrationField.length, 0);
});

// done_when clause 5 (fraction passthrough): an unreduced fraction like
// {numerator: 2, denominator: 6} is NOT silently turned into {1, 3}.
test('an unreduced fraction passes through unchanged, with no reduction', () => {
  const log = createAssertionLog();
  const workId = createWork(log, { ...provenance, title: 'Unreduced Fraction Work' });
  const partyId = createParty(log, provenance);

  assertShare(log, { ...provenance, workId, partyId, share: { numerator: 2, denominator: 6 } });

  const [share] = getWorkShares(log, workId);
  assert.deepEqual(share.share, { numerator: 2, denominator: 6 });
  assert.notDeepEqual(share.share, { numerator: 1, denominator: 3 });
});

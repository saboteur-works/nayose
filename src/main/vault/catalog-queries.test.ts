// Tests for the catalog-browsing query logic (Task 9), which backs
// ../ipc/catalog-handlers.ts's IPC channels. These exercise the exported
// pure listing/lookup functions directly against an in-memory
// AssertionLog (built via entities.ts's constructors), matching
// entity-handlers.test.ts's style but skipping the vault-file/session
// layer entirely: none of this module's logic depends on it, so testing
// straight against a log is both sufficient and simpler.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createAssertionLog } from './assertion-log.ts';
import {
  assertShare,
  createParty,
  createRecording,
  createRegistration,
  createRelease,
  createWork,
} from './entities.ts';
import {
  getPartyDetail,
  getRecordingDetail,
  getRegistrationDetail,
  getReleaseDetail,
  getWorkDetail,
  listParties,
  listRecordings,
  listRegistrations,
  listReleases,
  listWorks,
} from './catalog-queries.ts';

const PROVENANCE = {
  actor: 'test-account',
  timestamp: new Date().toISOString(),
  source: 'test',
  sourceClass: 'user-asserted' as const,
};

test('listing each of the five entity types against a populated vault returns them all', () => {
  const log = createAssertionLog();

  const partyA = createParty(log, { ...PROVENANCE, displayName: 'Alice' });
  const partyB = createParty(log, { ...PROVENANCE, displayName: 'Bob' });
  const workId = createWork(log, { ...PROVENANCE, title: 'A Song' });
  const recordingId = createRecording(log, { ...PROVENANCE, title: 'A Song (Master)', workId });
  const releaseId = createRelease(log, { ...PROVENANCE, title: 'A Single', recordingIds: [recordingId] });
  const registrationId = createRegistration(log, { ...PROVENANCE, workId, registryName: 'MLC' });

  assertShare(log, { ...PROVENANCE, workId, partyId: partyA, share: { numerator: 1, denominator: 2 } });
  assertShare(log, { ...PROVENANCE, workId, partyId: partyB, share: { numerator: 1, denominator: 2 } });

  const works = listWorks(log);
  const recordings = listRecordings(log);
  const releases = listReleases(log);
  const parties = listParties(log);
  const registrations = listRegistrations(log);

  assert.equal(works.length, 1);
  assert.equal(works[0].id, workId);
  assert.equal(works[0].title, 'A Song');

  assert.equal(recordings.length, 1);
  assert.equal(recordings[0].id, recordingId);
  assert.equal(recordings[0].workId, workId);

  assert.equal(releases.length, 1);
  assert.equal(releases[0].id, releaseId);
  assert.deepEqual(releases[0].recordingIds, [recordingId]);

  assert.equal(parties.length, 2);
  assert.deepEqual(
    parties.map((p) => p.displayName).sort(),
    ['Alice', 'Bob'],
  );

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, registrationId);
  assert.equal(registrations[0].workId, workId);
  assert.equal(registrations[0].registryName, 'MLC');
});

test('listing against an empty log returns empty arrays for all five types without throwing', () => {
  const log = createAssertionLog();

  assert.deepEqual(listWorks(log), []);
  assert.deepEqual(listRecordings(log), []);
  assert.deepEqual(listReleases(log), []);
  assert.deepEqual(listParties(log), []);
  assert.deepEqual(listRegistrations(log), []);
});

test('a Recording detail surfaces its Work, its containing Release, and (via the Work) contributing Parties; and the Work detail surfaces its Recordings and contributing Parties', () => {
  const log = createAssertionLog();

  const partyA = createParty(log, { ...PROVENANCE, displayName: 'Alice' });
  const partyB = createParty(log, { ...PROVENANCE, displayName: 'Bob' });
  const workId = createWork(log, { ...PROVENANCE, title: 'A Song' });
  const recordingId = createRecording(log, { ...PROVENANCE, title: 'A Song (Master)', workId });
  const releaseId = createRelease(log, { ...PROVENANCE, title: 'A Single', recordingIds: [recordingId] });

  assertShare(log, { ...PROVENANCE, workId, partyId: partyA, share: { numerator: 1, denominator: 3 } });
  assertShare(log, { ...PROVENANCE, workId, partyId: partyB, share: { numerator: 1, denominator: 3 } });

  const recordingDetail = getRecordingDetail(log, recordingId);
  assert.ok(recordingDetail);
  assert.equal(recordingDetail?.work?.id, workId);
  assert.equal(recordingDetail?.release?.id, releaseId);
  assert.equal(recordingDetail?.parties.length, 2);
  assert.deepEqual(
    recordingDetail?.parties.map((p) => p.partyId).sort(),
    [partyA, partyB].sort(),
  );

  const workDetail = getWorkDetail(log, workId);
  assert.ok(workDetail);
  assert.equal(workDetail?.recordings.length, 1);
  assert.equal(workDetail?.recordings[0].id, recordingId);
  assert.equal(workDetail?.parties.length, 2);
});

test('getWorkDetail, getReleaseDetail, and getPartyDetail return undefined for an id of the wrong kind', () => {
  const log = createAssertionLog();
  const partyId = createParty(log, { ...PROVENANCE, displayName: 'Alice' });
  const workId = createWork(log, { ...PROVENANCE, title: 'A Song' });

  assert.equal(getWorkDetail(log, partyId as never), undefined);
  assert.equal(getReleaseDetail(log, partyId as never), undefined);
  assert.equal(getPartyDetail(log, workId as never), undefined);
});

test('a Registration detail surfaces the Work it concerns', () => {
  const log = createAssertionLog();
  const workId = createWork(log, { ...PROVENANCE, title: 'A Song' });
  const registrationId = createRegistration(log, { ...PROVENANCE, workId, registryName: 'MLC', status: 'pending' });

  const detail = getRegistrationDetail(log, registrationId);
  assert.ok(detail);
  assert.equal(detail?.status, 'pending');
  assert.equal(detail?.work?.id, workId);
});

test('a Party detail surfaces every Work it holds a recorded share in', () => {
  const log = createAssertionLog();
  const partyId = createParty(log, { ...PROVENANCE, displayName: 'Alice' });
  const workId = createWork(log, { ...PROVENANCE, title: 'A Song' });
  const otherWorkId = createWork(log, { ...PROVENANCE, title: 'Another Song' });

  assertShare(log, { ...PROVENANCE, workId, partyId, share: { numerator: 1, denominator: 1 } });

  const detail = getPartyDetail(log, partyId);
  assert.ok(detail);
  assert.equal(detail?.works.length, 1);
  assert.equal(detail?.works[0].id, workId);
  assert.notEqual(detail?.works[0].id, otherWorkId);
});

test('a Work with shares summing to non-unity is reported with status !== complete in the LISTING response, not only the detail response', () => {
  const log = createAssertionLog();
  const partyA = createParty(log, { ...PROVENANCE, displayName: 'Alice' });
  const partyB = createParty(log, { ...PROVENANCE, displayName: 'Bob' });
  const incompleteWorkId = createWork(log, { ...PROVENANCE, title: 'Incomplete Splits' });
  const completeWorkId = createWork(log, { ...PROVENANCE, title: 'Complete Splits' });

  // 5/6 total: an incomplete (shortfall) share set.
  assertShare(log, { ...PROVENANCE, workId: incompleteWorkId, partyId: partyA, share: { numerator: 1, denominator: 2 } });
  assertShare(log, { ...PROVENANCE, workId: incompleteWorkId, partyId: partyB, share: { numerator: 1, denominator: 3 } });

  assertShare(log, { ...PROVENANCE, workId: completeWorkId, partyId: partyA, share: { numerator: 1, denominator: 2 } });
  assertShare(log, { ...PROVENANCE, workId: completeWorkId, partyId: partyB, share: { numerator: 1, denominator: 2 } });

  const works = listWorks(log);
  const incompleteListing = works.find((w) => w.id === incompleteWorkId);
  const completeListing = works.find((w) => w.id === completeWorkId);

  assert.ok(incompleteListing);
  assert.notEqual(incompleteListing?.shareIntegrity.status, 'complete');
  assert.equal(incompleteListing?.shareIntegrity.status, 'incomplete');

  assert.ok(completeListing);
  assert.equal(completeListing?.shareIntegrity.status, 'complete');

  // Also present in the detail response, but the listing is the one that
  // matters for a BARE, unexpanded catalog list row (done_when clause 4).
  const detail = getWorkDetail(log, incompleteWorkId);
  assert.equal(detail?.shareIntegrity.status, 'incomplete');
});

test('a Work with no recorded shares is reported as absent, both in listing and detail', () => {
  const log = createAssertionLog();
  const workId = createWork(log, { ...PROVENANCE, title: 'No Shares Yet' });

  const listing = listWorks(log).find((w) => w.id === workId);
  assert.equal(listing?.shareIntegrity.status, 'absent');

  const detail = getWorkDetail(log, workId);
  assert.equal(detail?.shareIntegrity.status, 'absent');
});

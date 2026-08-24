// Offline-guarantee tests for Task 13 (feature-spec FR-13).
//
// This file demonstrates done_when clause 1 ("all functionality from Tasks
// 3-12 works with networking disabled") for the functionality that's
// exercisable headlessly: the pure/main-process modules under
// src/main/vault/** and src/main/ipc/**, plus the pure renderer-logic
// module behind Task 12's contradiction warning. These are the same
// modules already exercised by e.g. src/main/ipc/entity-handlers.test.ts
// and src/main/vault/vault-file.test.ts — this file does not duplicate
// their exhaustive coverage, but strings a realistic end-to-end flow
// through all of them in one pass, with the global `fetch` and Node's
// `http`/`https` modules stubbed to throw if ever invoked, so a network
// call anywhere in the exercised path would fail the test loudly rather
// than silently succeeding against a real network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

import { createVaultFile, readVaultFile } from '../src/main/vault/vault-file.ts';
import { appendAssertion, getAssertions, loadAssertionLog } from '../src/main/vault/assertion-log.ts';
import {
  assertShare,
  createParty,
  createRecording,
  createRelease,
  createWork,
  getEntityKind,
  getMostRecentFieldValue,
} from '../src/main/vault/entities.ts';
import { getFieldHistory, projectField } from '../src/main/vault/projection.ts';
import { checkShareIntegrity } from '../src/main/vault/share-integrity.ts';
import {
  listParties,
  listRecordings,
  listReleases,
  listWorks,
  getWorkDetail,
} from '../src/main/vault/catalog-queries.ts';
import { getFieldProvenance } from '../src/main/vault/provenance-queries.ts';
import { clearSession, ensureAccount, openSession, persistSession } from '../src/main/vault/vault-session.ts';
import { shouldWarnFromProvenance } from '../src/renderer/components/contradiction-warning-logic.ts';
import { FIELD_TITLE } from '../src/shared/types/entities.ts';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nayose-offline-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Stub the global `fetch` and Node's `http`/`https` request functions to
 * throw if ever invoked, run `fn`, then restore the originals — even if
 * `fn` throws. Any of the exercised code calling out to the network would
 * surface as a thrown error here rather than a silent real network call.
 */
async function withNetworkDisabled<T>(fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalHttpGet = http.get;
  const originalHttpsGet = https.get;

  const throwIfCalled = (name: string) => () => {
    throw new Error(`network access attempted via ${name} while networking is disabled`);
  };

  globalThis.fetch = throwIfCalled('global fetch') as typeof fetch;
  http.request = throwIfCalled('http.request') as typeof http.request;
  https.request = throwIfCalled('https.request') as typeof https.request;
  http.get = throwIfCalled('http.get') as typeof http.get;
  https.get = throwIfCalled('https.get') as typeof https.get;

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    http.get = originalHttpGet;
    https.get = originalHttpsGet;
  }
}

test.afterEach(() => {
  clearSession();
});

test('vault-core functionality (Tasks 3-12) works end-to-end with the network stubbed to throw', async () => {
  await withNetworkDisabled(async () => {
    await withTempDir(async (dir) => {
      const filePath = path.join(dir, 'offline-test.nayose');

      // Task 3/4: vault file lifecycle — create, close (persist to disk), reopen.
      const created = await createVaultFile(filePath);
      assert.ok(created);

      const session = openSession(filePath, created);
      const accountId = ensureAccount(session.log);
      assert.ok(accountId);

      // Task 5: entity model — create a Party, a Work, a Recording, a Release.
      const partyId = createParty(session.log, {
        displayName: 'Ada Lovelace',
        actor: accountId,
        timestamp: new Date().toISOString(),
        source: 'nayose-app',
        sourceClass: 'user-asserted',
      });
      const workId = createWork(session.log, {
        title: 'Analytical Engine Suite',
        actor: accountId,
        timestamp: new Date().toISOString(),
        source: 'nayose-app',
        sourceClass: 'user-asserted',
      });
      const recordingId = createRecording(session.log, {
        title: 'Analytical Engine Suite (Live)',
        workId,
        actor: accountId,
        timestamp: new Date().toISOString(),
        source: 'nayose-app',
        sourceClass: 'user-asserted',
      });
      // Title omitted here (deliberately): Task 12's contradiction-warning
      // logic below needs a field with NO user assertion yet, so the first
      // (registry-issued) title assertion is the field's only history.
      const releaseId = createRelease(session.log, {
        recordingIds: [recordingId],
        actor: accountId,
        timestamp: new Date().toISOString(),
        source: 'nayose-app',
        sourceClass: 'user-asserted',
      });

      assert.equal(getEntityKind(session.log, workId), 'Work');
      assert.equal(getMostRecentFieldValue<string>(session.log, workId, FIELD_TITLE), 'Analytical Engine Suite');

      // Task 7: share-integrity — assert a partial share and check status.
      assertShare(session.log, {
        workId,
        partyId,
        share: { numerator: 1, denominator: 2 },
        actor: accountId,
        timestamp: new Date().toISOString(),
        source: 'nayose-app',
        sourceClass: 'user-asserted',
      });
      const integrity = checkShareIntegrity(session.log, workId);
      assert.equal(integrity.status, 'incomplete');

      // Task 4: assertion log append/read directly.
      const rawAssertions = getAssertions(session.log);
      assert.ok(rawAssertions.length > 0);

      // Task 6: projection/conflict resolution — assert a registry value,
      // then a user override, and confirm the override wins.
      appendAssertion(session.log, {
        entityId: workId,
        fieldName: FIELD_TITLE,
        value: 'Analytical Engine Suite (Registry Title)',
        actor: 'test-registry',
        timestamp: new Date().toISOString(),
        source: 'test-registry',
        sourceClass: 'registry-issued',
      });
      const beforeOverride = projectField<string>(session.log, workId, FIELD_TITLE);
      assert.equal(beforeOverride?.sourceClass, 'user-asserted');

      // Task 12: contradiction warning — a field whose current value is
      // registry-issued (no user override yet) should warn before editing.
      const releaseTitleProvenance = getFieldProvenance<string>(session.log, releaseId, FIELD_TITLE);
      assert.equal(shouldWarnFromProvenance(releaseTitleProvenance), false);

      appendAssertion(session.log, {
        entityId: releaseId,
        fieldName: FIELD_TITLE,
        value: 'Live Sessions (Registry Title)',
        actor: 'test-registry',
        timestamp: new Date().toISOString(),
        source: 'test-registry',
        sourceClass: 'registry-issued',
      });
      const releaseTitleAfterRegistry = getFieldProvenance<string>(session.log, releaseId, FIELD_TITLE);
      assert.equal(shouldWarnFromProvenance(releaseTitleAfterRegistry), true);

      // Task 10: additive field editing via a new user-asserted assertion.
      appendAssertion(session.log, {
        entityId: releaseId,
        fieldName: FIELD_TITLE,
        value: 'Live Sessions (User Edit)',
        actor: accountId,
        timestamp: new Date().toISOString(),
        source: 'nayose-app',
        sourceClass: 'user-asserted',
      });
      const releaseTitleAfterEdit = getFieldProvenance<string>(session.log, releaseId, FIELD_TITLE);
      assert.equal(releaseTitleAfterEdit.current?.value, 'Live Sessions (User Edit)');
      assert.equal(shouldWarnFromProvenance(releaseTitleAfterEdit), false);

      // Task 11: provenance display — full history for the edited field.
      const history = getFieldHistory(session.log, releaseId, FIELD_TITLE);
      assert.equal(history.length, 2);

      // Task 3/4: persist (close) the vault, then reopen and re-verify.
      await persistSession(session);
      clearSession();

      const reopened = await readVaultFile(filePath);
      assert.ok(reopened.ok);
      if (!reopened.ok) {
        return;
      }
      const reopenedLog = loadAssertionLog(reopened.vault.body.assertions ?? []);

      // Task 9: catalog browse/navigation queries over the reopened log.
      const works = listWorks(reopenedLog);
      const recordings = listRecordings(reopenedLog);
      const releases = listReleases(reopenedLog);
      const parties = listParties(reopenedLog);
      assert.equal(works.length, 1);
      assert.equal(recordings.length, 1);
      assert.equal(releases.length, 1);
      assert.equal(parties.length, 1);

      const workDetail = getWorkDetail(reopenedLog, workId);
      assert.ok(workDetail);
      assert.equal(workDetail?.recordings.length, 1);
      assert.equal(workDetail?.parties.length, 1);

      // Confirm the reopened log's field values survived the round trip.
      const reopenedReleaseTitle = getMostRecentFieldValue<string>(reopenedLog, releaseId, FIELD_TITLE);
      assert.equal(reopenedReleaseTitle, 'Live Sessions (User Edit)');
    });
  });
});

test('withNetworkDisabled actually throws if fetch is invoked (sanity check on the stub itself)', async () => {
  await assert.rejects(
    () =>
      withNetworkDisabled(async () => {
        await fetch('https://example.invalid/should-never-be-reached');
      }),
    /network access attempted via global fetch/,
  );
});

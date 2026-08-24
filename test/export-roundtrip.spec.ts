// Round-trip re-import test for Task 4 (feature-spec FR-2, product-spec
// FR-21): "An exported vault MUST be re-importable without loss of any
// assertion or its provenance."
//
// This test populates an in-memory AssertionLog spanning multiple entity
// types (Work, Recording, Party) and both source classes (user-asserted and
// registry-issued, the latter via test/fixtures/registry-assertions.ts's
// seedRegistryFixtures — reused rather than rebuilt), including a deliberate
// override case (a user-asserted Work title that disagrees with the
// registry-issued one seedRegistryFixtures already wrote) and an unreduced
// share fraction (reusing seedRegistryFixtures's REGISTRY_WORK_SHARES,
// which are stored unreduced by construction).
//
// It then exports the vault via the real export path (exportVault from
// src/main/vault/vault-file.ts — the same serialization boundary Task 3's
// IPC handler and vault-session.ts's exportSession wrap), reopens it via
// readVaultFile (the same function the real vault:open IPC path uses), and
// asserts:
//   1. Every raw assertion (id, entityId, fieldName, value, actor,
//      timestamp, source, sourceClass), in original order, is present and
//      unchanged in the reopened log.
//   2. Projected current values (via projectField), including the override
//      marking and the unreduced share fraction, match between the
//      pre-export log and the reopened log.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { exportVault, readVaultFile } from '../src/main/vault/vault-file.ts';
import { appendAssertion, getAssertions, loadAssertionLog, type AssertionLog } from '../src/main/vault/assertion-log.ts';
import { projectField } from '../src/main/vault/projection.ts';
import {
  FIELD_DISPLAY_NAME,
  FIELD_TITLE,
  FIELD_TYPE,
  FIELD_WORK_ID,
  shareFieldName,
  type EntityKind,
  type PartyId,
  type RecordingId,
  type Share,
  type WorkId,
} from '../src/shared/types/entities.ts';
import type { Assertion, NewAssertion } from '../src/shared/types/assertion.ts';
import type { VaultFile } from '../src/shared/types/vault.ts';
import { VAULT_FORMAT_MARKER, VAULT_FORMAT_VERSION } from '../src/shared/types/vault.ts';
import { seedRegistryFixtures, REGISTRY_WORK_SHARES } from './fixtures/registry-assertions.ts';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nayose-export-roundtrip-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const USER_ACTOR = 'account-under-test';
const USER_SOURCE = 'nayose-app';

function userAssertion<TValue>(entityId: string, fieldName: string, value: TValue): NewAssertion<TValue> {
  return {
    entityId,
    fieldName,
    value,
    actor: USER_ACTOR,
    timestamp: new Date().toISOString(),
    source: USER_SOURCE,
    sourceClass: 'user-asserted',
  };
}

/** User-asserted title deliberately disagreeing with seedRegistryFixtures's registry-issued Work title, to force an override case. */
const OVERRIDDEN_WORK_TITLE = 'User-Corrected Work Title';

/** A brand-new Work/Recording/Party set, entirely user-asserted (no registry counterpart), to cover a second entity kind cleanly. */
interface UserFixtureIds {
  workId: WorkId;
  recordingId: RecordingId;
  partyId: PartyId;
}

function seedUserFixtures(log: AssertionLog): UserFixtureIds {
  const workId = 'user-work-1' as WorkId;
  const recordingId = 'user-recording-1' as RecordingId;
  const partyId = 'user-party-1' as PartyId;

  appendAssertion(log, userAssertion(workId, FIELD_TYPE, 'Work' satisfies EntityKind));
  appendAssertion(log, userAssertion(workId, FIELD_TITLE, 'A Purely User-Asserted Work'));

  appendAssertion(log, userAssertion(recordingId, FIELD_TYPE, 'Recording' satisfies EntityKind));
  appendAssertion(log, userAssertion(recordingId, FIELD_TITLE, 'A Purely User-Asserted Recording'));
  appendAssertion(log, userAssertion(recordingId, FIELD_WORK_ID, workId));

  appendAssertion(log, userAssertion(partyId, FIELD_TYPE, 'Party' satisfies EntityKind));
  appendAssertion(log, userAssertion(partyId, FIELD_DISPLAY_NAME, 'A Purely User-Asserted Party'));

  return { workId, recordingId, partyId };
}

/** Build a VaultFile envelope from an AssertionLog's current assertions, matching how vault-session.ts's exportSession builds one. */
function vaultFromLog(log: AssertionLog): VaultFile {
  return {
    nayoseVault: VAULT_FORMAT_MARKER,
    formatVersion: VAULT_FORMAT_VERSION,
    body: { assertions: getAssertions(log) },
  };
}

function assertAssertionsEqual(actual: Assertion, expected: Assertion, label: string): void {
  assert.equal(actual.id, expected.id, `${label}: id`);
  assert.equal(actual.entityId, expected.entityId, `${label}: entityId`);
  assert.equal(actual.fieldName, expected.fieldName, `${label}: fieldName`);
  assert.deepEqual(actual.value, expected.value, `${label}: value`);
  assert.equal(actual.actor, expected.actor, `${label}: actor`);
  assert.equal(actual.timestamp, expected.timestamp, `${label}: timestamp`);
  assert.equal(actual.source, expected.source, `${label}: source`);
  assert.equal(actual.sourceClass, expected.sourceClass, `${label}: sourceClass`);
}

test('export-roundtrip: raw assertions and projected values survive exportVault -> readVaultFile unchanged', async () => {
  await withTempDir(async (dir) => {
    // ---------------------------------------------------------------------
    // Populate an in-memory log spanning multiple entity types (Work,
    // Recording, Party) and both source classes.
    // ---------------------------------------------------------------------
    const log = loadAssertionLog();

    // Registry-issued fixtures: seeds a Work, a Recording, three Parties,
    // per-Party shares on the Work (unreduced, per REGISTRY_WORK_SHARES),
    // and a Registration. Reused rather than rebuilt (per task instructions).
    const registryIds = seedRegistryFixtures(log);

    // User-asserted fixtures: a second, independent Work/Recording/Party
    // set, entirely user-asserted, to further cover the "multiple entity
    // types" and "user-asserted source class" requirements.
    const userIds = seedUserFixtures(log);

    // Override case: a user-asserted assertion on the SAME (entityId,
    // fieldName) that seedRegistryFixtures already wrote a registry-issued
    // assertion for (the seeded Work's title), with a different value.
    appendAssertion(log, userAssertion(registryIds.workId, FIELD_TITLE, OVERRIDDEN_WORK_TITLE));

    // Unreduced share fraction: reuse seedRegistryFixtures's already-seeded
    // unreduced shares (REGISTRY_WORK_SHARES), and additionally assert an
    // explicit unreduced user share on the user-asserted Work, to prove the
    // fraction round-trips byte-for-byte regardless of source class.
    const unreducedUserShare: Share = { numerator: 3, denominator: 9 };
    appendAssertion(
      log,
      userAssertion(userIds.workId, shareFieldName(userIds.partyId), unreducedUserShare),
    );

    const originalAssertions = getAssertions(log);
    assert.ok(originalAssertions.length > 10, 'sanity: log has a substantial number of assertions');

    // Sanity: confirm both source classes and multiple entity kinds are present.
    const sourceClasses = new Set(originalAssertions.map((a) => a.sourceClass));
    assert.ok(sourceClasses.has('user-asserted'));
    assert.ok(sourceClasses.has('registry-issued'));

    // ---------------------------------------------------------------------
    // Pre-export projections, to compare against post-reopen projections.
    // ---------------------------------------------------------------------
    const preExportWorkTitle = projectField<string>(log, registryIds.workId, FIELD_TITLE);
    assert.ok(preExportWorkTitle);
    assert.equal(preExportWorkTitle?.value, OVERRIDDEN_WORK_TITLE);
    assert.equal(preExportWorkTitle?.isOverride, true);
    assert.ok(preExportWorkTitle?.overriddenRegistryValue);

    const preExportUserWorkTitle = projectField<string>(log, userIds.workId, FIELD_TITLE);
    const preExportRecordingTitle = projectField<string>(log, registryIds.recordingId, FIELD_TITLE);
    const preExportPartyDisplayName = projectField<string>(
      log,
      registryIds.partyIds[0],
      FIELD_DISPLAY_NAME,
    );
    const preExportRegistryShare = projectField<Share>(
      log,
      registryIds.workId,
      shareFieldName(registryIds.partyIds[0]),
    );
    assert.deepEqual(preExportRegistryShare?.value, REGISTRY_WORK_SHARES[0]);

    const preExportUserShare = projectField<Share>(
      log,
      userIds.workId,
      shareFieldName(userIds.partyId),
    );
    assert.deepEqual(preExportUserShare?.value, unreducedUserShare);

    // ---------------------------------------------------------------------
    // Export via the real serialization boundary (Task 3's underlying
    // path: vault-session.ts's exportSession wraps exportVault, which this
    // test calls directly).
    // ---------------------------------------------------------------------
    const exportPath = path.join(dir, 'export-roundtrip-test.nayose');
    const vaultToExport = vaultFromLog(log);
    await exportVault(exportPath, vaultToExport);

    // ---------------------------------------------------------------------
    // Reopen via the same function the real vault:open IPC path uses.
    // ---------------------------------------------------------------------
    const reopened = await readVaultFile(exportPath);
    assert.ok(reopened.ok, `readVaultFile failed: ${reopened.ok ? '' : reopened.error.message}`);
    if (!reopened.ok) {
      return;
    }

    const reopenedLog = loadAssertionLog(reopened.vault.body.assertions ?? []);
    const reopenedAssertions = getAssertions(reopenedLog);

    // -----------------------------------------------------------------
    // Assertion 1: every original assertion, including provenance
    // fields, is present, unchanged, and in the same order.
    // -----------------------------------------------------------------
    assert.equal(
      reopenedAssertions.length,
      originalAssertions.length,
      'reopened log must have the same number of assertions as the original',
    );
    originalAssertions.forEach((original, index) => {
      const reopenedAssertion = reopenedAssertions[index];
      assert.ok(reopenedAssertion, `missing reopened assertion at index ${index}`);
      assertAssertionsEqual(reopenedAssertion, original, `assertion[${index}] (id ${original.id})`);
    });

    // -----------------------------------------------------------------
    // Assertion 2: projected current values match pre-export vs.
    // post-reopen, for every field populated above — including the
    // override marking and the unreduced share fraction.
    // -----------------------------------------------------------------
    const postReopenWorkTitle = projectField<string>(reopenedLog, registryIds.workId, FIELD_TITLE);
    assert.deepEqual(postReopenWorkTitle, preExportWorkTitle);
    assert.equal(postReopenWorkTitle?.isOverride, true);
    assert.equal(postReopenWorkTitle?.value, OVERRIDDEN_WORK_TITLE);
    assert.equal(postReopenWorkTitle?.overriddenRegistryValue, preExportWorkTitle?.overriddenRegistryValue);
    assert.equal(postReopenWorkTitle?.overriddenRegistrySource, preExportWorkTitle?.overriddenRegistrySource);

    const postReopenUserWorkTitle = projectField<string>(reopenedLog, userIds.workId, FIELD_TITLE);
    assert.deepEqual(postReopenUserWorkTitle, preExportUserWorkTitle);

    const postReopenRecordingTitle = projectField<string>(reopenedLog, registryIds.recordingId, FIELD_TITLE);
    assert.deepEqual(postReopenRecordingTitle, preExportRecordingTitle);

    const postReopenPartyDisplayName = projectField<string>(
      reopenedLog,
      registryIds.partyIds[0],
      FIELD_DISPLAY_NAME,
    );
    assert.deepEqual(postReopenPartyDisplayName, preExportPartyDisplayName);

    // Unreduced share fractions round-trip byte-for-byte, not silently reduced.
    const postReopenRegistryShare = projectField<Share>(
      reopenedLog,
      registryIds.workId,
      shareFieldName(registryIds.partyIds[0]),
    );
    assert.deepEqual(postReopenRegistryShare, preExportRegistryShare);
    assert.equal(postReopenRegistryShare?.value.numerator, REGISTRY_WORK_SHARES[0].numerator);
    assert.equal(postReopenRegistryShare?.value.denominator, REGISTRY_WORK_SHARES[0].denominator);

    const postReopenUserShare = projectField<Share>(
      reopenedLog,
      userIds.workId,
      shareFieldName(userIds.partyId),
    );
    assert.deepEqual(postReopenUserShare, preExportUserShare);
    assert.equal(postReopenUserShare?.value.numerator, 3);
    assert.equal(postReopenUserShare?.value.denominator, 9);
  });
});

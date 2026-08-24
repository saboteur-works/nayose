// Unit tests for registry-assertions.ts's fixture seeding, per Task 12.
// Run with Node's built-in test runner: `npm test`.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createAssertionLog, getAssertionsForField } from '../../src/main/vault/assertion-log.ts';
import { projectField, sumFractions } from '../../src/main/vault/projection.ts';
import {
  FIELD_DISPLAY_NAME,
  FIELD_REGISTRATION_STATUS,
  FIELD_REGISTRY_NAME,
  FIELD_TITLE,
  FIELD_WORK_ID,
  shareFieldName,
} from '../../src/shared/types/entities.ts';
import {
  REGISTRY_PARTY_DISPLAY_NAMES,
  REGISTRY_REGISTRATION_STATUS,
  REGISTRY_REGISTRY_NAME,
  REGISTRY_RECORDING_TITLE,
  REGISTRY_WORK_SHARES,
  REGISTRY_WORK_TITLE,
  seedRegistryFixtures,
} from './registry-assertions.ts';

test('seedRegistryFixtures: Work title is recorded as a single registry-issued assertion', () => {
  const log = createAssertionLog();
  const { workId } = seedRegistryFixtures(log);

  const projected = projectField<string>(log, workId, FIELD_TITLE);
  assert.equal(projected?.value, REGISTRY_WORK_TITLE);
  assert.equal(projected?.sourceClass, 'registry-issued');
});

test('seedRegistryFixtures: Recording title is registry-issued and points at the seeded Work', () => {
  const log = createAssertionLog();
  const { workId, recordingId } = seedRegistryFixtures(log);

  const title = projectField<string>(log, recordingId, FIELD_TITLE);
  assert.equal(title?.value, REGISTRY_RECORDING_TITLE);
  assert.equal(title?.sourceClass, 'registry-issued');

  const workRef = projectField(log, recordingId, FIELD_WORK_ID);
  assert.equal(workRef?.value, workId);
});

test('seedRegistryFixtures: each seeded Party has a registry-issued displayName', () => {
  const log = createAssertionLog();
  const { partyIds } = seedRegistryFixtures(log);

  assert.equal(partyIds.length, REGISTRY_PARTY_DISPLAY_NAMES.length);
  partyIds.forEach((partyId, index) => {
    const displayName = projectField<string>(log, partyId, FIELD_DISPLAY_NAME);
    assert.equal(displayName?.value, REGISTRY_PARTY_DISPLAY_NAMES[index]);
    assert.equal(displayName?.sourceClass, 'registry-issued');
  });
});

test('seedRegistryFixtures: Work shares are present, unreduced, across multiple Parties', () => {
  const log = createAssertionLog();
  const { workId, partyIds } = seedRegistryFixtures(log);

  partyIds.forEach((partyId, index) => {
    const shareAssertions = getAssertionsForField(log, workId, shareFieldName(partyId));
    assert.equal(shareAssertions.length, 1);
    // Stored EXACTLY as given: unreduced (e.g. 2/4, not 1/2).
    assert.deepEqual(shareAssertions[0].value, REGISTRY_WORK_SHARES[index]);
    assert.equal(shareAssertions[0].sourceClass, 'registry-issued');
  });

  // Reduction only happens on read, via projection.ts's sumFractions; the
  // unreduced shares above still sum to a whole share once reduced.
  const total = sumFractions(REGISTRY_WORK_SHARES);
  assert.equal(total.numerator, 1);
  assert.equal(total.denominator, 1);
});

test('seedRegistryFixtures: Work registration state has a named registry and a status', () => {
  const log = createAssertionLog();
  const { workId, registrationId } = seedRegistryFixtures(log);

  const registryName = projectField<string>(log, registrationId, FIELD_REGISTRY_NAME);
  assert.equal(registryName?.value, REGISTRY_REGISTRY_NAME);
  assert.equal(registryName?.sourceClass, 'registry-issued');

  const status = projectField(log, registrationId, FIELD_REGISTRATION_STATUS);
  assert.equal(status?.value, REGISTRY_REGISTRATION_STATUS);
  assert.equal(status?.sourceClass, 'registry-issued');

  const workRef = projectField(log, registrationId, FIELD_WORK_ID);
  assert.equal(workRef?.value, workId);
});

// Registry-issued assertion fixtures (Task 12 deliverable).
//
// This feature (vault-core) has NO import path yet — that is Features 3-5's
// job — so a registry-issued assertion cannot arise through any normal use
// of the app today. Task 12 (contradiction warning on edit) still needs at
// least one to exercise "editing a field whose CURRENT value is
// registry-issued," so this module seeds them directly against an
// `AssertionLog`, bypassing the (nonexistent) import path.
//
// Per the Task 12 brief, this module is a DELIVERABLE for Features 4 and 5
// too, not just test scaffolding for this task — so it seeds more than the
// minimum this task strictly needs: a Work title, a Recording title, a
// Party displayName, a Work's per-Party shares (stored UNREDUCED, per
// FR-14/entities.ts's `Share` contract), and a Work's registration state
// with a named registry.
//
// Uses the same `AssertionLog`/`appendAssertion` primitives every other
// vault write path uses (see ../../src/main/vault/assertion-log.ts) rather
// than a parallel fixture-only storage shape, so seeded data round-trips
// through `projectField`/`getFieldHistory` exactly like real registry
// imports eventually will.

import { appendAssertion, type AssertionLog } from '../../src/main/vault/assertion-log.ts';
import {
  FIELD_DISPLAY_NAME,
  FIELD_REGISTRATION_STATUS,
  FIELD_REGISTRY_NAME,
  FIELD_TITLE,
  FIELD_TYPE,
  FIELD_WORK_ID,
  shareFieldName,
  type EntityKind,
  type PartyId,
  type RecordingId,
  type RegistrationId,
  type RegistrationStatus,
  type Share,
  type WorkId,
} from '../../src/shared/types/entities.ts';
import type { NewAssertion, SourceClass } from '../../src/shared/types/assertion.ts';

const REGISTRY_SOURCE_CLASS: SourceClass = 'registry-issued';
const DEFAULT_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const IMPORT_ACTOR = 'registry-import';

/** Provenance every fixture write in this module uses: always `sourceClass: 'registry-issued'`. */
export interface RegistryProvenance {
  actor: string;
  timestamp: string;
  source: string;
  sourceClass: 'registry-issued';
}

function registryProvenance(source: string, timestamp: string = DEFAULT_TIMESTAMP): RegistryProvenance {
  return { actor: IMPORT_ACTOR, timestamp, source, sourceClass: REGISTRY_SOURCE_CLASS };
}

function assertRegistryField<TValue>(
  log: AssertionLog,
  entityId: string,
  fieldName: string,
  value: TValue,
  provenance: RegistryProvenance,
): void {
  appendAssertion<TValue>(log, {
    entityId,
    fieldName,
    value,
    actor: provenance.actor,
    timestamp: provenance.timestamp,
    source: provenance.source,
    sourceClass: provenance.sourceClass,
  } satisfies NewAssertion<TValue>);
}

function newFixtureId<TId extends string>(label: string): TId {
  return `fixture-${label}` as TId;
}

// ---------------------------------------------------------------------------
// Fixed, documented content (so consuming tests can assert against known
// values rather than re-deriving them from the seed function's internals).
// ---------------------------------------------------------------------------

export const REGISTRY_WORK_TITLE = 'Registry-Issued Work Title';
export const REGISTRY_WORK_SOURCE = 'musicbrainz';

export const REGISTRY_RECORDING_TITLE = 'Registry-Issued Recording Title';
export const REGISTRY_RECORDING_SOURCE = 'musicbrainz';

/** Unreduced, per Party, in the order they are seeded — sums to 1 only after reduction (2/4 + 2/8 + 2/8 = 1/2 + 1/4 + 1/4). */
export const REGISTRY_PARTY_DISPLAY_NAMES: readonly string[] = [
  'Registry Party One',
  'Registry Party Two',
  'Registry Party Three',
];
export const REGISTRY_PARTY_SOURCE = 'ascap';

export const REGISTRY_WORK_SHARES: readonly Share[] = [
  { numerator: 2, denominator: 4 },
  { numerator: 2, denominator: 8 },
  { numerator: 2, denominator: 8 },
];
export const REGISTRY_SHARE_SOURCE = 'ascap';

export const REGISTRY_REGISTRY_NAME = 'ASCAP';
export const REGISTRY_REGISTRATION_STATUS: RegistrationStatus = 'registered';
export const REGISTRY_REGISTRATION_SOURCE = 'ascap';

export interface RegistryFixtureIds {
  workId: WorkId;
  recordingId: RecordingId;
  partyIds: PartyId[];
  registrationId: RegistrationId;
}

/**
 * Seed a fresh (or existing) `AssertionLog` with a realistic set of
 * registry-issued assertions: a Work title, a Recording of that Work, three
 * Parties, that Work's per-Party shares (unreduced), and that Work's
 * registration state with a named registry. Returns the ids of everything
 * created so a caller can immediately project/query them.
 */
export function seedRegistryFixtures(log: AssertionLog): RegistryFixtureIds {
  const workId = newFixtureId<WorkId>('work');
  const recordingId = newFixtureId<RecordingId>('recording');
  const partyIds = REGISTRY_PARTY_DISPLAY_NAMES.map((_, index) => newFixtureId<PartyId>(`party-${index + 1}`));
  const registrationId = newFixtureId<RegistrationId>('registration');

  // Work
  assertRegistryField(log, workId, FIELD_TYPE, 'Work' satisfies EntityKind, registryProvenance(REGISTRY_WORK_SOURCE));
  assertRegistryField(log, workId, FIELD_TITLE, REGISTRY_WORK_TITLE, registryProvenance(REGISTRY_WORK_SOURCE));

  // Recording (of the Work above)
  assertRegistryField(
    log,
    recordingId,
    FIELD_TYPE,
    'Recording' satisfies EntityKind,
    registryProvenance(REGISTRY_RECORDING_SOURCE),
  );
  assertRegistryField(
    log,
    recordingId,
    FIELD_TITLE,
    REGISTRY_RECORDING_TITLE,
    registryProvenance(REGISTRY_RECORDING_SOURCE),
  );
  assertRegistryField(log, recordingId, FIELD_WORK_ID, workId, registryProvenance(REGISTRY_RECORDING_SOURCE));

  // Parties + their (unreduced) shares in the Work
  partyIds.forEach((partyId, index) => {
    assertRegistryField(log, partyId, FIELD_TYPE, 'Party' satisfies EntityKind, registryProvenance(REGISTRY_PARTY_SOURCE));
    assertRegistryField(
      log,
      partyId,
      FIELD_DISPLAY_NAME,
      REGISTRY_PARTY_DISPLAY_NAMES[index],
      registryProvenance(REGISTRY_PARTY_SOURCE),
    );
    assertRegistryField(
      log,
      workId,
      shareFieldName(partyId),
      REGISTRY_WORK_SHARES[index],
      registryProvenance(REGISTRY_SHARE_SOURCE),
    );
  });

  // Registration state for the Work
  assertRegistryField(
    log,
    registrationId,
    FIELD_TYPE,
    'Registration' satisfies EntityKind,
    registryProvenance(REGISTRY_REGISTRATION_SOURCE),
  );
  assertRegistryField(log, registrationId, FIELD_WORK_ID, workId, registryProvenance(REGISTRY_REGISTRATION_SOURCE));
  assertRegistryField(
    log,
    registrationId,
    FIELD_REGISTRY_NAME,
    REGISTRY_REGISTRY_NAME,
    registryProvenance(REGISTRY_REGISTRATION_SOURCE),
  );
  assertRegistryField(
    log,
    registrationId,
    FIELD_REGISTRATION_STATUS,
    REGISTRY_REGISTRATION_STATUS,
    registryProvenance(REGISTRY_REGISTRATION_SOURCE),
  );

  return { workId, recordingId, partyIds, registrationId };
}

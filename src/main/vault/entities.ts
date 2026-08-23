// Entity model: Party, Account, Work, Recording, Release, and Registration,
// built as a LAYER OVER the assertion log (see ./assertion-log.ts) rather
// than as a second, assertion-log-parallel storage structure.
//
// Design choice (documented per Task 5's brief): an entity is "created" by
// generating a fresh, branded id and immediately appending a founding
// assertion on that id with fieldName `$type` (see FIELD_TYPE) and a value
// naming its EntityKind (e.g. 'Party'). Every other field the entity has
// (its display name, its title, its share in a Work, its registration
// status, ...) is then just another assertion on that same entityId. There
// is no separate "which entities exist" table anywhere in this module —
// `getEntityKind` and friends reconstruct that purely by reading assertions
// back out of the log.
//
// This module does NOT resolve conflicting field assertions to a single
// "current" value (that is Task 6's projection layer) and does NOT validate
// share sums or registration completeness (that is Task 7's job). Readers
// here either return the full assertion history for a field or, where a
// single value is convenient, the most recently appended one — deliberately
// not called "current value" resolution, since that is Task 6's vocabulary.

import { randomUUID } from 'node:crypto';

import type { NewAssertion } from '../../shared/types/assertion.ts';
import {
  FIELD_DISPLAY_NAME,
  FIELD_RECORDING_IDS,
  FIELD_REGISTRATION_STATUS,
  FIELD_REGISTRY_NAME,
  FIELD_TITLE,
  FIELD_TYPE,
  FIELD_WORK_ID,
  SHARE_FIELD_PREFIX,
  shareFieldName,
  type AccountId,
  type EntityKind,
  type PartyId,
  type RecordingId,
  type RegistrationId,
  type RegistrationStatus,
  type ReleaseId,
  type Share,
  type WorkId,
} from '../../shared/types/entities.ts';
import { appendAssertion, getAssertions, getAssertionsForField, type AssertionLog } from './assertion-log.ts';

/**
 * Provenance fields every entity-model write needs, mirroring
 * `NewAssertion`'s non-value fields. Callers supply these once per call
 * rather than once per underlying assertion.
 */
export interface Provenance {
  actor: string;
  timestamp: string;
  source: string;
  sourceClass: NewAssertion['sourceClass'];
}

function assertField<TValue>(
  log: AssertionLog,
  entityId: string,
  fieldName: string,
  value: TValue,
  provenance: Provenance,
): void {
  appendAssertion(log, {
    entityId,
    fieldName,
    value,
    actor: provenance.actor,
    timestamp: provenance.timestamp,
    source: provenance.source,
    sourceClass: provenance.sourceClass,
  });
}

/** Generic brand-cast: a fresh random id, branded as the given id type. */
function newId<TId extends string>(): TId {
  return randomUUID() as TId;
}

// ---------------------------------------------------------------------------
// Party
// ---------------------------------------------------------------------------

export interface CreatePartyInput extends Provenance {
  displayName?: string;
}

/** Create a new Party entity and return its id. */
export function createParty(log: AssertionLog, input: CreatePartyInput): PartyId {
  const id = newId<PartyId>();
  assertField(log, id, FIELD_TYPE, 'Party' satisfies EntityKind, input);
  if (input.displayName !== undefined) {
    assertField(log, id, FIELD_DISPLAY_NAME, input.displayName, input);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export interface CreateAccountInput extends Provenance {
  displayName?: string;
}

/** Create a new Account entity and return its id. */
export function createAccount(log: AssertionLog, input: CreateAccountInput): AccountId {
  const id = newId<AccountId>();
  assertField(log, id, FIELD_TYPE, 'Account' satisfies EntityKind, input);
  if (input.displayName !== undefined) {
    assertField(log, id, FIELD_DISPLAY_NAME, input.displayName, input);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Work
// ---------------------------------------------------------------------------

export interface CreateWorkInput extends Provenance {
  title?: string;
}

/** Create a new Work entity and return its id. */
export function createWork(log: AssertionLog, input: CreateWorkInput): WorkId {
  const id = newId<WorkId>();
  assertField(log, id, FIELD_TYPE, 'Work' satisfies EntityKind, input);
  if (input.title !== undefined) {
    assertField(log, id, FIELD_TITLE, input.title, input);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

export interface CreateRecordingInput extends Provenance {
  title?: string;
  /** The Work this Recording is a recording of. */
  workId?: WorkId;
}

/**
 * Create a new Recording entity and return its id. The Work relationship
 * (clause 4's "recording.workId = Y" style fact) is itself recorded as a
 * `workId` assertion on the Recording, not a separate untracked pointer.
 */
export function createRecording(log: AssertionLog, input: CreateRecordingInput): RecordingId {
  const id = newId<RecordingId>();
  assertField(log, id, FIELD_TYPE, 'Recording' satisfies EntityKind, input);
  if (input.title !== undefined) {
    assertField(log, id, FIELD_TITLE, input.title, input);
  }
  if (input.workId !== undefined) {
    assertField(log, id, FIELD_WORK_ID, input.workId, input);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

export interface CreateReleaseInput extends Provenance {
  title?: string;
  /** The Recordings included on this Release. */
  recordingIds?: RecordingId[];
}

/**
 * Create a new Release entity and return its id. The Release-to-Recordings
 * relationship (clause 4's "work.recordingIds includes X" style fact,
 * applied here to Release/Recording) is recorded as a `recordingIds`
 * assertion carrying the full list, exactly as given.
 */
export function createRelease(log: AssertionLog, input: CreateReleaseInput): ReleaseId {
  const id = newId<ReleaseId>();
  assertField(log, id, FIELD_TYPE, 'Release' satisfies EntityKind, input);
  if (input.title !== undefined) {
    assertField(log, id, FIELD_TITLE, input.title, input);
  }
  if (input.recordingIds !== undefined) {
    assertField(log, id, FIELD_RECORDING_IDS, input.recordingIds, input);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export interface CreateRegistrationInput extends Provenance {
  workId: WorkId;
  registryName: string;
  /**
   * Defaults to 'unknown' if omitted: a Registration record may exist for a
   * Work before its status with that registry is known, and that MUST
   * persist without a placeholder/error value blocking the write (FR-15,
   * done_when clause 7). There is no validation here — an unreduced,
   * incomplete, or otherwise "not yet resolved" status is exactly as valid
   * a write as any other.
   */
  status?: RegistrationStatus;
}

/** Create a new Registration entity (a Work's registration state with a named registry) and return its id. */
export function createRegistration(log: AssertionLog, input: CreateRegistrationInput): RegistrationId {
  const id = newId<RegistrationId>();
  assertField(log, id, FIELD_TYPE, 'Registration' satisfies EntityKind, input);
  assertField(log, id, FIELD_WORK_ID, input.workId, input);
  assertField(log, id, FIELD_REGISTRY_NAME, input.registryName, input);
  assertField(log, id, FIELD_REGISTRATION_STATUS, input.status ?? 'unknown', input);
  return id;
}

// ---------------------------------------------------------------------------
// Share relationship (Party <-> Work)
// ---------------------------------------------------------------------------

export interface AssertShareInput extends Provenance {
  workId: WorkId;
  partyId: PartyId;
  /**
   * Stored EXACTLY as given: unreduced, unnormalized, unvalidated (FR-14).
   * A share set across a Work's Parties may sum to anything, or nothing —
   * that is Task 7's read-side concern, not this write path's.
   */
  share: Share;
}

/**
 * Record a Party's fractional share in a Work, as an assertion on the Work
 * entity with fieldName `share:{partyId}`. Multiple Parties may each hold a
 * share of the same Work; each is stored as its own independent assertion,
 * so all coexist and are independently retrievable (done_when clause 3).
 */
export function assertShare(log: AssertionLog, input: AssertShareInput): void {
  assertField(log, input.workId, shareFieldName(input.partyId), input.share, input);
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/**
 * Reconstruct the EntityKind an id denotes, from its `$type` assertion(s).
 * If a `$type` field was (unusually) asserted more than once, the most
 * recently appended value wins for this reader; this is a convenience
 * read, not conflict resolution in Task 6's sense.
 */
export function getEntityKind(log: AssertionLog, entityId: string): EntityKind | undefined {
  const typeAssertions = getAssertionsForField(log, entityId, FIELD_TYPE);
  const last = typeAssertions.at(-1);
  return last ? (last.value as EntityKind) : undefined;
}

/**
 * Return the most recently appended value asserted for (entityId,
 * fieldName), or undefined if none exists. This is a raw read of append
 * order, not "current value" resolution (Task 6's job) — it does not
 * consider source class, actor trust, or any other tie-breaking rule.
 */
export function getMostRecentFieldValue<TValue = unknown>(
  log: AssertionLog,
  entityId: string,
  fieldName: string,
): TValue | undefined {
  const assertions = getAssertionsForField(log, entityId, fieldName);
  const last = assertions.at(-1);
  return last ? (last.value as TValue) : undefined;
}

/** Return every share assertion recorded against a Work, one per Party asserted so far, in append order. */
export function getWorkShares(
  log: AssertionLog,
  workId: WorkId,
): Array<{ partyId: PartyId; share: Share }> {
  return getAssertions(log)
    .filter((assertion) => assertion.entityId === workId && assertion.fieldName.startsWith(SHARE_FIELD_PREFIX))
    .map((assertion) => ({
      partyId: assertion.fieldName.slice(SHARE_FIELD_PREFIX.length) as PartyId,
      share: assertion.value as Share,
    }));
}

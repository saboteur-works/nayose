// Types for the Nayose entity model: Party, Account, Work, Recording,
// Release, and Registration.
//
// These types are a LAYER OVER the assertion log (see ./assertion.ts and
// ../../main/vault/assertion-log.ts), not a second, parallel storage
// structure. An entity does not have its own on-disk row: its identity is a
// generated id, and every field it has is itself recorded as an assertion
// whose `entityId` is that id. This module only describes the *shapes* used
// on both sides of that convention (id brands, field value shapes); the
// logic that writes and reads those assertions lives in
// ../../main/vault/entities.ts.
//
// FR-2 requires Party and Account to be distinct entity types with NO shared
// identity: a PartyId must not be usable where an AccountId is expected, and
// vice versa. Each id below is a distinct nominal ("branded") string type
// for exactly this reason — they are structurally identical (all strings)
// but the brand field makes them mutually non-assignable under `strict`
// TypeScript, so a `PartyId` cannot be passed where an `AccountId` is
// expected without an explicit (and readable) cast.

declare const partyIdBrand: unique symbol;
declare const accountIdBrand: unique symbol;
declare const workIdBrand: unique symbol;
declare const recordingIdBrand: unique symbol;
declare const releaseIdBrand: unique symbol;
declare const registrationIdBrand: unique symbol;

export type PartyId = string & { readonly [partyIdBrand]: 'PartyId' };
export type AccountId = string & { readonly [accountIdBrand]: 'AccountId' };
export type WorkId = string & { readonly [workIdBrand]: 'WorkId' };
export type RecordingId = string & { readonly [recordingIdBrand]: 'RecordingId' };
export type ReleaseId = string & { readonly [releaseIdBrand]: 'ReleaseId' };
export type RegistrationId = string & { readonly [registrationIdBrand]: 'RegistrationId' };

/** Any of the entity model's branded id types, for generic id-handling code. */
export type EntityId = PartyId | AccountId | WorkId | RecordingId | ReleaseId | RegistrationId;

/**
 * The closed set of entity kinds this model knows about. Recorded as the
 * value of the `$type` field (see FIELD_TYPE below) on every entity's
 * founding assertion, so "which entities exist, and of what kind" can be
 * reconstructed purely by reading the assertion log — there is
 * intentionally no separate entity registry/table.
 */
export type EntityKind = 'Party' | 'Account' | 'Work' | 'Recording' | 'Release' | 'Registration';

/**
 * Well-known field names used by the entity-model layer. Kept as exported
 * constants (rather than inline string literals scattered across
 * entities.ts) so a typo becomes a compile error at the call site rather
 * than a silently-orphaned assertion.
 */
export const FIELD_TYPE = '$type';
export const FIELD_DISPLAY_NAME = 'displayName';
export const FIELD_TITLE = 'title';
export const FIELD_WORK_ID = 'workId';
export const FIELD_RECORDING_IDS = 'recordingIds';
export const FIELD_REGISTRY_NAME = 'registryName';
export const FIELD_REGISTRATION_STATUS = 'status';
export const SHARE_FIELD_PREFIX = 'share:';

/** Build the fieldName used for a given Party's share assertion on a Work. */
export function shareFieldName(partyId: PartyId): string {
  return `${SHARE_FIELD_PREFIX}${partyId}`;
}

/**
 * A Party's fractional share in a Work, per FR-14: stored EXACTLY as
 * asserted, unreduced. Nothing in this model may reduce, normalize, or
 * validate this value — that is Task 6 (projection) and Task 7
 * (share-integrity detection)'s job, not this layer's.
 */
export interface Share {
  numerator: number;
  denominator: number;
}

/**
 * A Work's registration state with a single named registry. `status`
 * intentionally includes an 'unknown' member (in addition to the absence of
 * any Registration assertion at all) so "we don't know" is representable
 * without inventing a placeholder value.
 */
export type RegistrationStatus = 'registered' | 'pending' | 'unknown';

/** Minimal, non-exhaustive field shapes for each entity kind's own data. */
export interface PartyFields {
  displayName?: string;
}

export interface AccountFields {
  displayName?: string;
}

export interface WorkFields {
  title?: string;
}

export interface RecordingFields {
  title?: string;
  /** The Work this Recording is a recording of. */
  workId?: WorkId;
}

export interface ReleaseFields {
  title?: string;
  /** The Recordings included on this Release. */
  recordingIds?: RecordingId[];
}

export interface RegistrationFields {
  /** The Work this Registration record concerns. */
  workId?: WorkId;
  registryName?: string;
  status?: RegistrationStatus;
}

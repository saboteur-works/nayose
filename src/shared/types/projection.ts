// Types for the projection layer: the read-side module that derives a
// field's "current value" from its raw assertion history, per Task 6.
//
// This module deliberately does not import anything from ../../main/vault —
// it only describes shapes, matching assertion.ts and entities.ts's split
// between "types" (shared) and "logic" (main/vault).

/**
 * The result of projecting a single (entityId, fieldName) pair's assertion
 * history down to one current value, per feature-spec FR-9's decided
 * conflict rule (documented in full at src/main/vault/projection.ts):
 * user-asserted always wins over registry-issued when they disagree, the
 * registry-issued assertion is retained (never discarded), and an override,
 * if one occurred, is reported in this SAME shape — no follow-up query
 * needed.
 */
export interface ProjectedField<TValue = unknown> {
  /** The field's current, resolved value. */
  value: TValue;
  /** Id of the assertion (from the log) that `value` was taken from. */
  sourceAssertionId: string;
  /** Opaque identifier of where `value`'s assertion came from. */
  source: string;
  /** The `sourceClass` of the assertion `value` was taken from. */
  sourceClass: 'registry-issued' | 'user-asserted';
  /**
   * True when `value` is a user-asserted value that disagrees (by deep
   * structural equality) with a retained registry-issued assertion for the
   * same field. False when there is no registry-issued assertion to
   * compare against, or when the user's value and the registry's value
   * happen to agree (see design note in projection.ts on why agreement is
   * NOT flagged as an override).
   */
  isOverride: boolean;
  /** The superseded registry-issued value, present only when `isOverride` is true. */
  overriddenRegistryValue?: TValue;
  /** The `source` of the superseded registry-issued assertion, present only when `isOverride` is true. */
  overriddenRegistrySource?: string;
  /** The id of the superseded registry-issued assertion, present only when `isOverride` is true. */
  overriddenRegistryAssertionId?: string;
}

/**
 * A fraction, kept structurally identical to (and interchangeable with)
 * `Share` from entities.ts: an unreduced numerator/denominator pair as
 * asserted. Aliased under its own name here since the projection layer's
 * fraction arithmetic (reduce/sum/compare) is not Work-share-specific.
 */
export interface Fraction {
  numerator: number;
  denominator: number;
}

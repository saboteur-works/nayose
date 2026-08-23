// Types for the append-only assertion log: the core storage primitive that
// every later Nayose vault domain module (entity model, conflict resolution,
// IPC surfaces) writes through.
//
// This module deliberately stays generic: it does not know about Party or
// Account entities (Task 5) or conflict resolution (Task 6). An assertion is
// simply a fact, from some source, about a single (entityId, fieldName) pair.

/**
 * Where an assertion's fact came from, per feature-spec FR-3. This union is
 * closed intentionally — do not add source classes without a spec change.
 */
export type SourceClass = 'registry-issued' | 'user-asserted';

/**
 * A single append-only fact recorded in the vault. `entityId` and
 * `fieldName` identify what the assertion is about; the entity/field schema
 * itself is Task 5's concern, so both are kept as opaque strings here.
 *
 * `value` is deliberately generic/`unknown`-shaped: the assertion log must
 * never inspect, coerce, reduce, or otherwise transform it (e.g. share
 * fractions must round-trip byte-for-byte, per FR-14).
 */
export interface Assertion<TValue = unknown> {
  /** Unique, monotonically assigned identifier for this assertion. */
  id: string;
  /** Opaque identifier of the entity this assertion is about. */
  entityId: string;
  /** Opaque identifier of the field on that entity this assertion sets. */
  fieldName: string;
  /** The asserted value, stored and returned exactly as given. */
  value: TValue;
  /** Opaque identifier of the actor who made this assertion. */
  actor: string;
  /** ISO 8601 timestamp of when the assertion was made. */
  timestamp: string;
  /** Opaque identifier of where this assertion came from. */
  source: string;
  /** Closed classification of the assertion's source, per FR-3. */
  sourceClass: SourceClass;
}

/** Input shape for appending a new assertion: everything except its id. */
export type NewAssertion<TValue = unknown> = Omit<Assertion<TValue>, 'id'>;

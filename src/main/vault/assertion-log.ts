// Append-only assertion log: the core storage primitive that every later
// Nayose vault domain module writes through.
//
// This module is pure (no Electron/IPC dependency) so it can be exercised
// directly in unit tests, matching vault-file.ts's style. It operates on an
// in-memory `AssertionLog` structure; callers that want persistence should
// store the log's `assertions` array in a `VaultFile`'s `body.assertions`
// field (see ../../shared/types/vault.ts) and use vault-file.ts's
// read/writeVaultFile to get it to/from disk.
//
// CRITICAL: this log is append-only. There is intentionally NO update or
// delete operation anywhere in this module's public surface — see the
// structural test in assertion-log.test.ts.

import type { Assertion, NewAssertion } from '../../shared/types/assertion.ts';

/**
 * The assertion log's in-memory state: an ordered list of assertions plus
 * the counter used to mint unique, monotonically increasing ids. Treat this
 * as opaque — construct it with `createAssertionLog` and mutate it only via
 * `appendAssertion`.
 */
export interface AssertionLog {
  assertions: Assertion[];
  nextId: number;
}

/** Create a fresh, empty assertion log. */
export function createAssertionLog(): AssertionLog {
  return { assertions: [], nextId: 1 };
}

/**
 * Load an assertion log from a plain assertion array (e.g. a vault file's
 * `body.assertions`). Existing assertions are kept as-is, in their existing
 * order; the id counter continues past the highest numeric id found so
 * newly appended assertions never collide with ids loaded from disk.
 */
export function loadAssertionLog(assertions: readonly Assertion[] = []): AssertionLog {
  let highestNumericId = 0;
  for (const assertion of assertions) {
    const numericId = Number(assertion.id);
    if (Number.isInteger(numericId) && numericId > highestNumericId) {
      highestNumericId = numericId;
    }
  }
  return { assertions: [...assertions], nextId: highestNumericId + 1 };
}

/**
 * Append a new assertion to the log and return the newly created,
 * fully-formed `Assertion` (including its assigned id). The log's
 * `assertions` array is returned in append order (oldest first), which is
 * this module's documented, deterministic ordering guarantee.
 *
 * The `value` field is stored exactly as given: this function does not
 * inspect, coerce, or transform it in any way.
 */
export function appendAssertion<TValue>(
  log: AssertionLog,
  input: NewAssertion<TValue>,
): Assertion<TValue> {
  const assertion: Assertion<TValue> = {
    id: String(log.nextId),
    entityId: input.entityId,
    fieldName: input.fieldName,
    value: input.value,
    actor: input.actor,
    timestamp: input.timestamp,
    source: input.source,
    sourceClass: input.sourceClass,
  };
  log.nextId += 1;
  log.assertions.push(assertion as Assertion);
  return assertion;
}

/** Return all assertions in the log, in stable (append) order. */
export function getAssertions(log: AssertionLog): Assertion[] {
  return [...log.assertions];
}

/** Return all assertions recorded for a given (entityId, fieldName) pair, in append order. */
export function getAssertionsForField(
  log: AssertionLog,
  entityId: string,
  fieldName: string,
): Assertion[] {
  return log.assertions.filter(
    (assertion) => assertion.entityId === entityId && assertion.fieldName === fieldName,
  );
}

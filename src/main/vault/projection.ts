// Projection layer: derives a field's "current" value from its raw
// assertion history, retains conflicting assertions, and normalizes share
// fractions for comparison/summation, per Task 6.
//
// This module is pure (no Electron/IPC dependency), matching
// assertion-log.ts and entities.ts's style, and is strictly READ-ONLY over
// the assertion log: nothing here calls `appendAssertion` or otherwise
// mutates a log. It only reads via `getAssertionsForField`.
//
// ---------------------------------------------------------------------------
// THE DECIDED CONFLICT RULE (feature-spec FR-9 — not reinterpreted here):
// ---------------------------------------------------------------------------
// When a user-asserted assertion and a registry-issued assertion disagree
// about a field, the user's assertion is ALWAYS the current value; the
// registry-issued assertion is retained and remains fully queryable via
// history; and the projection reports the override (current value, the
// superseded registry value, and its issuing source) in a single return
// object.
//
// DETERMINISTIC TIE-BREAK RULE (this task's design call, since a field may
// carry more than one assertion of the same source class):
//   1. If at least one user-asserted assertion exists for the field, the
//      current value is the MOST RECENT user-asserted assertion, by append
//      order (ties cannot occur: append order is already a strict total
//      order per assertion-log.ts).
//   2. Otherwise, the current value is the MOST RECENT registry-issued
//      assertion, by append order.
//   3. If neither exists (empty history), there is no current value:
//      `projectField` returns `undefined`.
//
// OVERRIDE-FLAG RULE (this task's design call):
//   The override flag is computed only when the current value came from a
//   user-asserted assertion (rule 1 above fired). It is set to true iff at
//   least one registry-issued assertion exists for the field AND the MOST
//   RECENT registry-issued assertion's value differs (by deep structural
//   equality) from the current (user's) value. The MOST RECENT
//   registry-issued assertion is cited as "the superseded registry value" —
//   chosen over "all registry-issued assertions" because it is the single
//   value a user would otherwise be seeing as "current" if no user
//   assertion existed (see rule 2), so it is the most meaningful thing to
//   contrast against; older, already-superseded registry assertions remain
//   available via `getFieldHistory` for anyone who needs the full trail.
//
//   If the user's value structurally matches the most recent registry
//   value, `isOverride` is FALSE: this project's design choice is that
//   "override" reports a DISAGREEMENT worth surfacing to a user (per FR-9's
//   UI-marking intent — a marker exists to warn "these two facts differ"),
//   not merely "a user assertion happens to exist for a field a registry
//   also asserted." When the values agree there is nothing to warn about,
//   so flagging it would be a false positive against FR-9's stated purpose.

import type { Assertion } from '../../shared/types/assertion.ts';
import type { Fraction, ProjectedField } from '../../shared/types/projection.ts';
import { getAssertionsForField, type AssertionLog } from './assertion-log.ts';

/** Return every assertion recorded for (entityId, fieldName), in append order. Thin, read-only wrapper (done_when clause 3). */
export function getFieldHistory(log: AssertionLog, entityId: string, fieldName: string): Assertion[] {
  return getAssertionsForField(log, entityId, fieldName);
}

/** Deep structural equality, used to compare assertion values (including Fraction-shaped share values) for the override check. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * Project a field's current value from its assertion history, per the
 * decided conflict rule documented above. Returns `undefined` if the field
 * has no assertions at all.
 */
export function projectField<TValue = unknown>(
  log: AssertionLog,
  entityId: string,
  fieldName: string,
): ProjectedField<TValue> | undefined {
  const history = getFieldHistory(log, entityId, fieldName) as Array<Assertion<TValue>>;
  if (history.length === 0) {
    return undefined;
  }

  const userAssertions = history.filter((a) => a.sourceClass === 'user-asserted');
  const registryAssertions = history.filter((a) => a.sourceClass === 'registry-issued');
  const mostRecentRegistry = registryAssertions.at(-1);

  if (userAssertions.length > 0) {
    const current = userAssertions.at(-1) as Assertion<TValue>;
    const isOverride =
      mostRecentRegistry !== undefined && !deepEqual(current.value, mostRecentRegistry.value);

    return {
      value: current.value,
      sourceAssertionId: current.id,
      source: current.source,
      sourceClass: current.sourceClass,
      isOverride,
      ...(isOverride
        ? {
            overriddenRegistryValue: mostRecentRegistry.value,
            overriddenRegistrySource: mostRecentRegistry.source,
            overriddenRegistryAssertionId: mostRecentRegistry.id,
          }
        : {}),
    };
  }

  // No user assertion: current value is the most recent registry-issued
  // assertion. There is nothing to override.
  const current = mostRecentRegistry as Assertion<TValue>;
  return {
    value: current.value,
    sourceAssertionId: current.id,
    source: current.source,
    sourceClass: current.sourceClass,
    isOverride: false,
  };
}

// ---------------------------------------------------------------------------
// Fraction normalization (feature-spec FR-14 / OQ-2)
// ---------------------------------------------------------------------------
// These functions are pure, read-only transformations over Fraction-shaped
// values (e.g. a Work's per-Party Share). They never mutate their inputs
// and never write to the assertion log.

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return Math.abs(a / gcd(a, b)) * Math.abs(b);
}

/**
 * Reduce a fraction to lowest terms via GCD, returning a NEW Fraction
 * object. The input is never mutated, so callers may safely pass a stored
 * assertion's `value` directly.
 */
export function reduceFraction(fraction: Fraction): Fraction {
  if (fraction.numerator === 0) {
    return { numerator: 0, denominator: 1 };
  }
  const divisor = gcd(fraction.numerator, fraction.denominator);
  const sign = fraction.denominator < 0 ? -1 : 1;
  return {
    numerator: (sign * fraction.numerator) / divisor,
    denominator: (sign * fraction.denominator) / divisor,
  };
}

/**
 * Sum a set of fractions using LCM-based common-denominator arithmetic,
 * returning a NEW (unreduced-by-default, then reduced) Fraction. Inputs are
 * never mutated.
 */
export function sumFractions(fractions: readonly Fraction[]): Fraction {
  if (fractions.length === 0) {
    return { numerator: 0, denominator: 1 };
  }
  const commonDenominator = fractions.reduce((acc, f) => lcm(acc, f.denominator), 1);
  const numeratorSum = fractions.reduce(
    (acc, f) => acc + f.numerator * (commonDenominator / f.denominator),
    0,
  );
  return reduceFraction({ numerator: numeratorSum, denominator: commonDenominator });
}

/** Compare two fractions for equality after normalization (e.g. 1/3 equals 2/6). */
export function fractionsEqual(a: Fraction, b: Fraction): boolean {
  const reducedA = reduceFraction(a);
  const reducedB = reduceFraction(b);
  return reducedA.numerator === reducedB.numerator && reducedA.denominator === reducedB.denominator;
}

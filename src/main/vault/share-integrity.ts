// Share-integrity detection: a pure, read-only module that reports whether a
// Work's currently-recorded Party shares sum to unity, per Task 7.
//
// This is a READ-SIDE check only. It has no write-path dependency of any
// kind — it never calls the assertion log's append-write function (or any
// other write-capable function) and is not consulted as a gate before
// allowing a write anywhere in this codebase. Real catalogs frequently have
// splits that don't sum to 100% (unregistered co-writers, disputed shares,
// etc.) and the vault must
// never refuse to store this (see specs/features/vault-core.md FR-15); this
// module exists only to make that fact visible to later UI consumers
// (Task 9's catalog list-row indicator, Task 14's expanded share-list
// surfacing), not to enforce anything.
//
// Fraction arithmetic (reduce/sum/compare) is NOT reimplemented here: it is
// imported from the Task 6 projection layer (./projection.ts), which is the
// single source of truth for that normalization.

import type { Share, WorkId } from '../../shared/types/entities.ts';
import type { Fraction } from '../../shared/types/projection.ts';
import { fractionsEqual, reduceFraction, sumFractions } from './projection.ts';
import { getWorkShares } from './entities.ts';
import type { AssertionLog } from './assertion-log.ts';

const UNITY: Fraction = { numerator: 1, denominator: 1 };

/**
 * The result of checking a Work's recorded shares for integrity. Three
 * genuinely distinct states, per done_when clause 3:
 *   - 'absent': no share assertions exist for the Work at all (unknown —
 *     distinct from a recorded-but-incomplete set of shares).
 *   - 'complete': the recorded shares' normalized sum is exactly 1/1.
 *   - 'incomplete': the recorded shares' normalized sum is not 1/1; `total`
 *     is the actual (reduced) sum, `difference` is the (reduced) magnitude
 *     of the shortfall or over-allocation, and `direction` says which.
 */
export type ShareIntegrityResult =
  | { status: 'absent' }
  | { status: 'complete'; total: Fraction }
  | {
      status: 'incomplete';
      total: Fraction;
      difference: Fraction;
      direction: 'shortfall' | 'over-allocation';
    };

/**
 * Subtract fraction `b` from fraction `a`, returning a NEW, reduced
 * Fraction. Not exported by projection.ts (which only exports sum/reduce/
 * equal), so implemented here as a minimal, exact helper: exact because it
 * reuses `sumFractions`'s integer common-denominator arithmetic, just with
 * the second term's numerator negated, rather than reimplementing
 * reduction/GCD/LCM logic (both of which stay delegated to
 * `sumFractions`/`reduceFraction`).
 */
function subtractFractions(a: Fraction, b: Fraction): Fraction {
  const negatedB: Fraction = { numerator: -b.numerator, denominator: b.denominator };
  return sumFractions([a, negatedB]);
}

/**
 * Check share integrity from a plain array of Shares, decoupled from the
 * assertion log for direct unit testing. This is the core, pure entry
 * point; `checkShareIntegrity` below composes it against real vault data.
 */
export function checkShareIntegrityFromShares(shares: readonly Share[]): ShareIntegrityResult {
  if (shares.length === 0) {
    return { status: 'absent' };
  }

  const total = sumFractions(shares);

  if (fractionsEqual(total, UNITY)) {
    return { status: 'complete', total };
  }

  const isShortfall = total.numerator * UNITY.denominator < UNITY.numerator * total.denominator;
  const difference = isShortfall ? subtractFractions(UNITY, total) : subtractFractions(total, UNITY);

  return {
    status: 'incomplete',
    total,
    difference: reduceFraction(difference),
    direction: isShortfall ? 'shortfall' : 'over-allocation',
  };
}

/**
 * Check whether a Work's currently-recorded Party shares (per
 * `getWorkShares`'s raw, append-order read) sum to unity. See
 * `ShareIntegrityResult` for the three possible outcomes.
 */
export function checkShareIntegrity(log: AssertionLog, workId: WorkId): ShareIntegrityResult {
  const shares = getWorkShares(log, workId).map((entry) => entry.share);
  return checkShareIntegrityFromShares(shares);
}

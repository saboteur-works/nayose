// Pure, framework-free data-transformation helpers for share-list.tsx's
// expanded share-list surface (Task 14). Kept in a plain `.ts` module (no
// JSX) rather than inline in share-list.tsx so this logic is directly
// importable and unit-testable via Node's native TypeScript type-stripping
// (`node --test`) without hitting Node's ERR_UNKNOWN_FILE_EXTENSION on
// `.tsx` (Node's loader does not run a JSX transform) — see
// share-list-format.test.ts.

import type { Fraction } from '../../shared/types/projection.ts';
import type { ShareIntegritySummary } from '../../shared/types/catalog-ipc.ts';

/** Format a single Fraction as "n/d", unreduced-as-stored. */
export function formatFraction(fraction: Fraction): string {
  return `${fraction.numerator}/${fraction.denominator}`;
}

/**
 * Pure transformation from a `ShareIntegritySummary` to the prose summary
 * line share-list.tsx's `ShareList` renders (e.g. "Total: 5/6 — short by
 * 1/6", "Total: 3/2 — over-allocated by 1/2", "Shares total to unity
 * (1/1)", or "No shares recorded"). The three/four distinct states
 * (complete / shortfall / over-allocation / absent) are exercised directly
 * in share-list-format.test.ts.
 */
export function formatShareSummary(integrity: ShareIntegritySummary): string {
  switch (integrity.status) {
    case 'absent':
      return 'No shares recorded';
    case 'complete':
      return `Shares total to unity (${formatFraction(integrity.total)})`;
    case 'incomplete': {
      const directionText =
        integrity.direction === 'shortfall'
          ? `short by ${formatFraction(integrity.difference)}`
          : `over-allocated by ${formatFraction(integrity.difference)}`;
      return `Total: ${formatFraction(integrity.total)} — ${directionText}`;
    }
  }
}

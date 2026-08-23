// Expanded, itemized share-list surface (Task 14). Distinct from
// catalog.tsx's compact `ShareIntegrityIndicator` (one-line list-row badge)
// and entity-detail.tsx's `ShareIntegrityDetail` (a fuller-but-still-single
// marker in the Work detail view) — both of which already shipped under
// Task 9 and are NOT touched here. This component is a self-contained,
// additional surface for wherever a Work's shares need to be shown
// itemized, per Party, alongside the overall integrity condition stated in
// prose (FR-15 / done_when clause 1).
//
// This is presentation-only: it has no write/validation-gate logic of any
// kind, and never blocks or rejects a non-summing share set (done_when
// clause 3) — real catalogs frequently have splits that don't sum to 100%,
// and the vault must never refuse to store this (see
// specs/features/vault-core.md FR-15).
//
// Data flow (done_when clause 4 — projected current values, not raw
// assertions): this component's `integrity` and `shares` props are meant to
// be sourced directly from `catalog-ipc.ts`'s `WorkDetail.shareIntegrity`
// (a `ShareIntegritySummary`, structurally identical to
// `ShareIntegrityResult`) and `WorkDetail.parties` (`PartyShareEntry[]`).
// Those are populated by `catalog-queries.ts`'s `listWorks`/`getWorkDetail`,
// which call `../../main/vault/share-integrity.ts`'s `checkShareIntegrity`
// — itself built on `getWorkShares` (Task 5's entity reader, which reads
// the CURRENT/latest-per-field projected share for each Party, not every
// historical share assertion) and `sumFractions`/`reduceFraction`/
// `fractionsEqual` (Task 6's projection-layer fraction arithmetic). No raw,
// unprojected assertion-log read happens in this component or in the data
// path it's documented to consume.

import { Badge } from './ui/badge';
import { formatFraction, formatShareSummary } from './share-list-format';
import type { Fraction } from '../../shared/types/projection.ts';
import type { PartyId, ShareIntegritySummary } from '../../shared/types/catalog-ipc.ts';

export { formatFraction, formatShareSummary } from './share-list-format';

export interface ShareListEntry {
  partyId: PartyId;
  partyName?: string;
  share: Fraction;
}

export interface ShareListProps {
  shares: ShareListEntry[];
  integrity: ShareIntegritySummary;
}

/**
 * Expanded, itemized share-list surface: one row per Party with their
 * fraction share, plus a summary line/badge stating the actual total and
 * (if incomplete) the shortfall/over-allocation direction and magnitude.
 *
 * Read-only: renders exactly what it is given via props, no fetching, no
 * write path, no validation gate. Never blocks or rejects a non-summing
 * share set (done_when clause 3) — it can only ever describe one.
 */
export function ShareList({ shares, integrity }: ShareListProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3" data-testid="share-list">
      <ul className="flex flex-col gap-1">
        {shares.length === 0 ? (
          <li className="text-sm text-fg-tertiary" data-testid="share-list-empty">
            No shares recorded
          </li>
        ) : (
          shares.map((entry) => (
            <li
              key={entry.partyId}
              className="flex items-center justify-between text-sm text-fg-primary"
              data-testid="share-list-row"
            >
              <span>{entry.partyName ?? '(unnamed party)'}</span>
              <span className="font-mono text-fg-tertiary">{formatFraction(entry.share)}</span>
            </li>
          ))
        )}
      </ul>
      <ShareIntegritySummaryBadge integrity={integrity} />
    </div>
  );
}

/**
 * The summary badge/line for the overall integrity condition. Three
 * visually and textually distinct treatments, per done_when clauses 1 and
 * 2:
 *   - 'absent': a neutral "unknown" treatment — never implies "0/1" or
 *     "under-allocated".
 *   - 'complete': a neutral confirmation, no warning styling.
 *   - 'incomplete': a warning treatment (outline/red, matching the
 *     Saboteur "Live"/"Canonical"-adjacent warning convention already used
 *     by entity-detail.tsx's `ShareIntegrityDetail`), stating the actual
 *     total and the shortfall/over-allocation magnitude.
 */
function ShareIntegritySummaryBadge({ integrity }: { integrity: ShareIntegritySummary }): JSX.Element {
  const summary = formatShareSummary(integrity);

  if (integrity.status === 'incomplete') {
    return (
      <Badge variant="outline" data-testid="share-list-summary" data-status="incomplete">
        ⚠ {summary}
      </Badge>
    );
  }

  return (
    <Badge variant="muted" data-testid="share-list-summary" data-status={integrity.status}>
      {summary}
    </Badge>
  );
}

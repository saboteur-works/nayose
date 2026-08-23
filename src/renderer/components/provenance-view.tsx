// Provenance display (Task 11): the shared, reusable pieces that make
// FR-9's "override marking must be visible everywhere, with full
// provenance reachable in one interaction" guarantee STRUCTURAL rather
// than convention-based. Every future value-rendering surface should
// compose `OverrideMarker` (for the persistent marking) and
// `ProvenanceTrigger`/`ProvenanceView` (for the one-interaction
// provenance/history lookup) to get FR-9 compliance "for free," instead of
// hand-rolling its own override badge.
//
// Follows field-editor.tsx's pattern of a small, prop-driven, reusable
// renderer component (accepts data as props rather than owning its own
// vault-reading state), and catalog.tsx/entity-detail.tsx's established
// "one shared flag, two render treatments" pattern already used for
// Task 9's `ShareIntegrityIndicator`/`ShareIntegrityDetail` split.

import * as React from 'react';
import { useEffect, useState } from 'react';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { Assertion } from '../../shared/types/assertion.ts';
import type { ProjectedField } from '../../shared/types/projection.ts';
import type { FieldProvenance } from '../../shared/types/provenance-ipc.ts';

// ---------------------------------------------------------------------------
// OverrideMarker — the ONE shared flag, TWO render treatments (done_when
// clause 5). Both `variant: 'full'` (detail view) and `variant: 'minimal'`
// (list/dense view) read the SAME `isOverride: boolean` prop; there is no
// separate/independently-computed "is this a detail-view override" check,
// so the two treatments structurally cannot diverge from each other. A
// caller that wants the marking in a new display context (a list row, a
// dense table cell, an export-preview row — "any additional display
// context," per this task's done_when clause 3) always passes the SAME
// `isOverride` boolean it got from a `ProjectedField`/`FieldProvenance`
// response; it never recomputes its own override check.
// ---------------------------------------------------------------------------

export interface OverrideMarkerProps {
  /** The single shared flag both variants read from — never computed independently per variant. */
  isOverride: boolean;
  /** 'full': icon + label, for detail view. 'minimal': compact dot/badge, for list/dense views. */
  variant: 'full' | 'minimal';
  className?: string;
}

/**
 * Renders NOTHING when `isOverride` is false, in both variants: the
 * marking is only ever shown when there is something to mark (per
 * projection.ts's design note — "override" reports a disagreement worth
 * surfacing, not merely "a user value exists"). When `isOverride` is true,
 * the marking is PERSISTENT (no interaction required to see it, per
 * done_when clause 3) in whichever variant is rendered.
 */
export function OverrideMarker({ isOverride, variant, className }: OverrideMarkerProps): JSX.Element | null {
  if (!isOverride) {
    return null;
  }

  if (variant === 'minimal') {
    return (
      <span
        data-testid="override-marker-minimal"
        data-override="true"
        title="User-asserted override of a registry value"
        aria-label="User-asserted override of a registry value"
        className={`inline-block size-2 rounded-full bg-brand-red align-middle ${className ?? ''}`.trim()}
      />
    );
  }

  return (
    <Badge
      variant="outline"
      data-testid="override-marker-full"
      data-override="true"
      className={className}
    >
      ✎ User override
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// ProvenanceView — the one-interaction destination: current value, source,
// actor, timestamp, source class, full ordered history, and (if
// overridden) the superseded registry value + its source, ALL in one view
// (done_when clauses 1, 2, and 4 together).
// ---------------------------------------------------------------------------

export interface ProvenanceViewProps {
  entityId: string;
  fieldName: string;
  onClose?: () => void;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '(none)';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function CurrentValueSection({ current }: { current: ProjectedField }): JSX.Element {
  return (
    <div data-testid="provenance-current">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-fg-primary">{formatValue(current.value)}</span>
        <OverrideMarker isOverride={current.isOverride} variant="full" />
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-fg-tertiary">
        <dt>Source</dt>
        <dd data-testid="provenance-source">{current.source}</dd>
        <dt>Source class</dt>
        <dd data-testid="provenance-source-class">{current.sourceClass}</dd>
        <dt>Assertion id</dt>
        <dd data-testid="provenance-assertion-id">{current.sourceAssertionId}</dd>
      </dl>
    </div>
  );
}

/** Reachable within the SAME one interaction as the current value (done_when clause 4): the superseded registry value and its issuing source. */
function OverriddenRegistrySection({ current }: { current: ProjectedField }): JSX.Element | null {
  if (!current.isOverride) {
    return null;
  }
  return (
    <div data-testid="provenance-overridden-registry" className="mt-4 border-t border-brand-rule pt-4">
      <p className="text-xs uppercase tracking-label text-fg-tertiary">Superseded registry value</p>
      <p className="mt-1 font-mono text-sm text-fg-primary">{formatValue(current.overriddenRegistryValue)}</p>
      <p className="mt-1 text-xs text-fg-tertiary" data-testid="provenance-overridden-registry-source">
        Source: {current.overriddenRegistrySource}
      </p>
    </div>
  );
}

/** Full ordered assertion history for the field, viewable from this SAME place (done_when clause 2). */
function HistorySection({ history }: { history: Assertion[] }): JSX.Element {
  return (
    <div data-testid="provenance-history" className="mt-4 border-t border-brand-rule pt-4">
      <p className="text-xs uppercase tracking-label text-fg-tertiary">Full history ({history.length})</p>
      <ol className="mt-2 flex flex-col gap-2">
        {history.map((assertion) => (
          <li
            key={assertion.id}
            data-testid="provenance-history-entry"
            className="flex flex-col gap-0.5 text-xs text-fg-tertiary"
          >
            <span className="font-mono text-fg-primary">{formatValue(assertion.value)}</span>
            <span>
              {assertion.sourceClass} · {assertion.source} · {assertion.actor} · {assertion.timestamp}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The single provenance surface: given `{ entityId, fieldName }`, fetches
 * the field's full provenance in ONE IPC call
 * (`window.nayose.provenance.getFieldProvenance`) and renders current
 * value + source/actor/timestamp/class + full history +
 * (if overridden) the superseded registry value/source — all from this one
 * component, satisfying done_when clauses 1, 2, and 4 together.
 */
export function ProvenanceView({ entityId, fieldName, onClose }: ProvenanceViewProps): JSX.Element {
  const [provenance, setProvenance] = useState<FieldProvenance | undefined>(undefined);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    window.nayose.provenance
      .getFieldProvenance({ entityId, fieldName })
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.ok) {
          setProvenance(result.data);
        } else {
          setError(result.error.message);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entityId, fieldName]);

  return (
    <Card data-testid="provenance-view" className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-base">{fieldName}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-xs text-fg-tertiary">Loading provenance…</p>}
        {!isLoading && error && (
          <p data-testid="provenance-error" className="text-xs text-destructive">
            {error}
          </p>
        )}
        {!isLoading && !error && provenance && !provenance.current && (
          <p className="text-xs text-fg-tertiary">No assertions recorded for this field.</p>
        )}
        {!isLoading && !error && provenance?.current && (
          <>
            <CurrentValueSection current={provenance.current} />
            <OverriddenRegistrySection current={provenance.current} />
            <HistorySection history={provenance.history} />
          </>
        )}
        {onClose && (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="provenance-close">
              Close
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ProvenanceTrigger — demonstrates the "one interaction" mechanism
// (done_when's "wherever a value is currently rendered, clicking the value
// or its adjacent marker opens the provenance view directly"): wraps any
// value's display in a single click target that opens `ProvenanceView` in
// place, with no intermediate menu or screen. Self-contained (owns its own
// open/closed state) so it can be dropped into an existing render site with
// a single wrap, without that site needing to manage popover state itself.
// ---------------------------------------------------------------------------

export interface ProvenanceTriggerProps {
  entityId: string;
  fieldName: string;
  /** Whether the CURRENT value being displayed is an override — the one shared flag, passed straight through to `OverrideMarker`. */
  isOverride: boolean;
  /** 'full' for detail view, 'minimal' for list/dense views — see `OverrideMarker`. */
  markerVariant: 'full' | 'minimal';
  children: React.ReactNode;
}

/**
 * ONE interaction (a single click) opens the full `ProvenanceView` inline,
 * directly below the trigger — no intermediate menu/screen. A future
 * integration in e.g. entity-detail.tsx or catalog.tsx wraps a rendered
 * field value with this component to get done_when clause 1's "one
 * interaction" guarantee immediately.
 */
export function ProvenanceTrigger({
  entityId,
  fieldName,
  isOverride,
  markerVariant,
  children,
}: ProvenanceTriggerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div data-testid="provenance-trigger" className="inline-flex flex-col gap-2">
      <button
        type="button"
        data-testid="provenance-trigger-button"
        className="inline-flex items-center gap-2 bg-transparent p-0 text-left"
        onClick={() => setIsOpen((open) => !open)}
      >
        {children}
        <OverrideMarker isOverride={isOverride} variant={markerVariant} />
      </button>
      {isOpen && <ProvenanceView entityId={entityId} fieldName={fieldName} onClose={() => setIsOpen(false)} />}
    </div>
  );
}

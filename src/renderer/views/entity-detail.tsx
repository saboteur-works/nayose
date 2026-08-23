import { useEffect, useState } from 'react';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import type { CatalogEntityRef } from './catalog-types';

import type {
  PartyDetail,
  RecordingDetail,
  RegistrationDetail,
  ReleaseDetail,
  ShareIntegritySummary,
  WorkDetail,
} from '../../shared/types/catalog-ipc.ts';

type DetailUnion =
  | { kind: 'Work'; data: WorkDetail }
  | { kind: 'Recording'; data: RecordingDetail }
  | { kind: 'Release'; data: ReleaseDetail }
  | { kind: 'Party'; data: PartyDetail }
  | { kind: 'Registration'; data: RegistrationDetail };

interface EntityDetailViewProps {
  entityRef: CatalogEntityRef;
  onNavigate: (ref: CatalogEntityRef) => void;
  onBack: () => void;
  onClose: () => void;
}

async function fetchDetail(entityRef: CatalogEntityRef): Promise<DetailUnion | undefined> {
  switch (entityRef.kind) {
    case 'Work': {
      const result = await window.nayose.catalog.getWorkDetail(entityRef.id as never);
      return result.ok && result.data ? { kind: 'Work', data: result.data } : undefined;
    }
    case 'Recording': {
      const result = await window.nayose.catalog.getRecordingDetail(entityRef.id as never);
      return result.ok && result.data ? { kind: 'Recording', data: result.data } : undefined;
    }
    case 'Release': {
      const result = await window.nayose.catalog.getReleaseDetail(entityRef.id as never);
      return result.ok && result.data ? { kind: 'Release', data: result.data } : undefined;
    }
    case 'Party': {
      const result = await window.nayose.catalog.getPartyDetail(entityRef.id as never);
      return result.ok && result.data ? { kind: 'Party', data: result.data } : undefined;
    }
    case 'Registration': {
      const result = await window.nayose.catalog.getRegistrationDetail(entityRef.id as never);
      return result.ok && result.data ? { kind: 'Registration', data: result.data } : undefined;
    }
  }
}

/**
 * Full (non-compact) share-integrity marker, for detail view. Unlike
 * catalog.tsx's `ShareIntegrityIndicator` (a compact badge for bare list
 * rows), this may spell out the direction/amount, since detail view has
 * room for it. Both treatments are driven from the same `ShareIntegritySummary`
 * shape the IPC layer returns, per FR-15/FR-9's "one shared flag, two
 * renderings" pattern.
 */
function ShareIntegrityDetail({ integrity }: { integrity: ShareIntegritySummary }): JSX.Element {
  if (integrity.status === 'complete') {
    return (
      <Badge variant="muted" data-testid="share-integrity-detail" data-status="complete">
        Shares sum to unity
      </Badge>
    );
  }
  if (integrity.status === 'absent') {
    return (
      <Badge variant="muted" data-testid="share-integrity-detail" data-status="absent">
        No shares recorded
      </Badge>
    );
  }
  return (
    <Badge variant="outline" data-testid="share-integrity-detail" data-status="incomplete">
      ⚠ {integrity.direction === 'shortfall' ? 'Shortfall' : 'Over-allocated'} — total{' '}
      {integrity.total.numerator}/{integrity.total.denominator}, off by {integrity.difference.numerator}/
      {integrity.difference.denominator}
    </Badge>
  );
}

function DetailField({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-label text-fg-tertiary">{label}</span>
      <span className="text-sm text-fg-primary">{value}</span>
    </div>
  );
}

function RelatedEntityButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}

/**
 * Entity detail view (Task 9): given a selected entity (`entityRef`), shows
 * its own fields plus its related entities, each rendered as a clickable
 * button that calls `onNavigate` with a new `CatalogEntityRef` — the
 * mechanism that lets a user reach a Recording's Work, Release, and
 * contributing Parties (done_when clause 2). `onBack` pops one level of
 * catalog.tsx's navigation stack; `onClose` returns all the way to the bare
 * list.
 */
export function EntityDetailView({ entityRef, onNavigate, onBack, onClose }: EntityDetailViewProps): JSX.Element {
  const [detail, setDetail] = useState<DetailUnion | undefined>(undefined);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    void fetchDetail(entityRef).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result) {
        setError('This entity could not be found — it may have been part of a stale reference.');
      }
      setDetail(result);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // entityRef is a plain value object recreated per navigation; comparing
    // its two fields is enough to know when to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityRef.kind, entityRef.id]);

  return (
    <Card data-testid="entity-detail-view">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{entityRef.kind} detail</CardTitle>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onBack} data-testid="detail-back">
              ← Back
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} data-testid="detail-close">
              Close
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-fg-tertiary">Loading…</p> : null}
        {error ? (
          <p className="text-sm text-fg-tertiary" data-testid="entity-detail-error">
            {error}
          </p>
        ) : null}
        {!isLoading && detail ? <DetailBody detail={detail} onNavigate={onNavigate} /> : null}
      </CardContent>
    </Card>
  );
}

function DetailBody({
  detail,
  onNavigate,
}: {
  detail: DetailUnion;
  onNavigate: (ref: CatalogEntityRef) => void;
}): JSX.Element {
  switch (detail.kind) {
    case 'Work':
      return <WorkDetailBody work={detail.data} onNavigate={onNavigate} />;
    case 'Recording':
      return <RecordingDetailBody recording={detail.data} onNavigate={onNavigate} />;
    case 'Release':
      return <ReleaseDetailBody release={detail.data} onNavigate={onNavigate} />;
    case 'Party':
      return <PartyDetailBody party={detail.data} onNavigate={onNavigate} />;
    case 'Registration':
      return <RegistrationDetailBody registration={detail.data} onNavigate={onNavigate} />;
  }
}

function WorkDetailBody({
  work,
  onNavigate,
}: {
  work: WorkDetail;
  onNavigate: (ref: CatalogEntityRef) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <DetailField label="Title" value={work.title ?? '(untitled work)'} />
      <ShareIntegrityDetail integrity={work.shareIntegrity} />

      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-label text-fg-tertiary">Recordings</span>
        {work.recordings.length === 0 ? (
          <p className="text-sm text-fg-tertiary">No recordings yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {work.recordings.map((recording) => (
              <RelatedEntityButton
                key={recording.id}
                label={recording.title ?? '(untitled recording)'}
                onClick={() => onNavigate({ kind: 'Recording', id: recording.id })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-label text-fg-tertiary">Contributing parties</span>
        {work.parties.length === 0 ? (
          <p className="text-sm text-fg-tertiary">No shares recorded</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {work.parties.map((entry) => (
              <RelatedEntityButton
                key={entry.partyId}
                label={`${entry.displayName ?? '(unnamed party)'} — ${entry.share.numerator}/${entry.share.denominator}`}
                onClick={() => onNavigate({ kind: 'Party', id: entry.partyId })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-label text-fg-tertiary">Registrations</span>
        {work.registrations.length === 0 ? (
          <p className="text-sm text-fg-tertiary">No registrations yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {work.registrations.map((registration) => (
              <RelatedEntityButton
                key={registration.id}
                label={`${registration.registryName ?? '(unnamed registry)'} — ${registration.status ?? 'unknown'}`}
                onClick={() => onNavigate({ kind: 'Registration', id: registration.id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RecordingDetailBody({
  recording,
  onNavigate,
}: {
  recording: RecordingDetail;
  onNavigate: (ref: CatalogEntityRef) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <DetailField label="Title" value={recording.title ?? '(untitled recording)'} />

      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-label text-fg-tertiary">Work</span>
        {recording.work ? (
          <RelatedEntityButton
            label={recording.work.title ?? '(untitled work)'}
            onClick={() => onNavigate({ kind: 'Work', id: recording.work!.id })}
          />
        ) : (
          <p className="text-sm text-fg-tertiary">No Work linked</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-label text-fg-tertiary">Release</span>
        {recording.release ? (
          <RelatedEntityButton
            label={recording.release.title ?? '(untitled release)'}
            onClick={() => onNavigate({ kind: 'Release', id: recording.release!.id })}
          />
        ) : (
          <p className="text-sm text-fg-tertiary">Not on any Release yet</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-label text-fg-tertiary">Contributing parties (via Work)</span>
        {recording.parties.length === 0 ? (
          <p className="text-sm text-fg-tertiary">No shares recorded</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recording.parties.map((entry) => (
              <RelatedEntityButton
                key={entry.partyId}
                label={`${entry.displayName ?? '(unnamed party)'} — ${entry.share.numerator}/${entry.share.denominator}`}
                onClick={() => onNavigate({ kind: 'Party', id: entry.partyId })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReleaseDetailBody({
  release,
  onNavigate,
}: {
  release: ReleaseDetail;
  onNavigate: (ref: CatalogEntityRef) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <DetailField label="Title" value={release.title ?? '(untitled release)'} />

      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-label text-fg-tertiary">Recordings</span>
        {release.recordings.length === 0 ? (
          <p className="text-sm text-fg-tertiary">No recordings included</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {release.recordings.map((recording) => (
              <RelatedEntityButton
                key={recording.id}
                label={recording.title ?? '(untitled recording)'}
                onClick={() => onNavigate({ kind: 'Recording', id: recording.id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PartyDetailBody({
  party,
  onNavigate,
}: {
  party: PartyDetail;
  onNavigate: (ref: CatalogEntityRef) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <DetailField label="Display name" value={party.displayName ?? '(unnamed party)'} />

      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-label text-fg-tertiary">Works with a recorded share</span>
        {party.works.length === 0 ? (
          <p className="text-sm text-fg-tertiary">No shares recorded</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {party.works.map((work) => (
              <RelatedEntityButton
                key={work.id}
                label={`${work.title ?? '(untitled work)'} — ${work.share.numerator}/${work.share.denominator}`}
                onClick={() => onNavigate({ kind: 'Work', id: work.id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RegistrationDetailBody({
  registration,
  onNavigate,
}: {
  registration: RegistrationDetail;
  onNavigate: (ref: CatalogEntityRef) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <DetailField label="Registry" value={registration.registryName ?? '(unnamed registry)'} />
      <DetailField label="Status" value={registration.status ?? 'unknown'} />

      <section className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-label text-fg-tertiary">Work</span>
        {registration.work ? (
          <RelatedEntityButton
            label={registration.work.title ?? '(untitled work)'}
            onClick={() => onNavigate({ kind: 'Work', id: registration.work!.id })}
          />
        ) : (
          <p className="text-sm text-fg-tertiary">No Work linked</p>
        )}
      </section>
    </div>
  );
}

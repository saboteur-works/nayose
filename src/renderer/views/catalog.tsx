import { useEffect, useState } from 'react';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EntityDetailView } from './entity-detail';
import type { CatalogEntityRef } from './catalog-types';

import type {
  PartyListItem,
  RecordingListItem,
  RegistrationListItem,
  ReleaseListItem,
  ShareIntegritySummary,
  WorkListItem,
} from '../../shared/types/catalog-ipc.ts';

export type { CatalogEntityRef } from './catalog-types';

type CatalogTab = CatalogEntityRef['kind'];

const TABS: Array<{ id: CatalogTab; label: string }> = [
  { id: 'Work', label: 'Works' },
  { id: 'Recording', label: 'Recordings' },
  { id: 'Release', label: 'Releases' },
  { id: 'Party', label: 'Parties' },
  { id: 'Registration', label: 'Registrations' },
];

interface CatalogLists {
  works: WorkListItem[];
  recordings: RecordingListItem[];
  releases: ReleaseListItem[];
  parties: PartyListItem[];
  registrations: RegistrationListItem[];
}

const EMPTY_LISTS: CatalogLists = {
  works: [],
  recordings: [],
  releases: [],
  parties: [],
  registrations: [],
};

/**
 * Compact share-integrity indicator for a bare, unexpanded Work list row
 * (FR-15 / done_when clause 4). Deliberately NOT a share breakdown: a
 * `complete` Work renders no badge at all (nothing to flag), an `absent`
 * Work (no shares recorded yet) renders a muted, low-emphasis badge, and an
 * `incomplete` Work renders a visually distinct outline badge carrying only
 * the reduced total (e.g. "5/6") — enough to notice something's off without
 * expanding into the individual shares.
 */
function ShareIntegrityIndicator({ integrity }: { integrity: ShareIntegritySummary }): JSX.Element | null {
  if (integrity.status === 'complete') {
    return null;
  }
  if (integrity.status === 'absent') {
    return (
      <Badge variant="muted" data-testid="share-integrity-badge" data-status="absent">
        No shares
      </Badge>
    );
  }
  return (
    <Badge variant="outline" data-testid="share-integrity-badge" data-status="incomplete">
      ⚠ {integrity.total.numerator}/{integrity.total.denominator}
    </Badge>
  );
}

/**
 * Catalog browse view (Task 9): lists all five entity types and owns the
 * in-renderer navigation stack between a bare list and an entity's detail
 * (`EntityDetailView`, ../views/entity-detail.tsx). A plain useState-based
 * stack of `CatalogEntityRef`s is enough here — no router library needed —
 * and "back" is simply popping the stack.
 */
export function CatalogView(): JSX.Element {
  const [activeTab, setActiveTab] = useState<CatalogTab>('Work');
  const [lists, setLists] = useState<CatalogLists>(EMPTY_LISTS);
  const [stack, setStack] = useState<CatalogEntityRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCatalog = async (): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      const [works, recordings, releases, parties, registrations] = await Promise.all([
        window.nayose.catalog.listWorks(),
        window.nayose.catalog.listRecordings(),
        window.nayose.catalog.listReleases(),
        window.nayose.catalog.listParties(),
        window.nayose.catalog.listRegistrations(),
      ]);

      const firstError = [works, recordings, releases, parties, registrations].find((result) => !result.ok);
      if (firstError && !firstError.ok) {
        setError(firstError.error.message);
        setLists(EMPTY_LISTS);
        return;
      }

      setLists({
        works: works.ok ? works.data : [],
        recordings: recordings.ok ? recordings.data : [],
        releases: releases.ok ? releases.data : [],
        parties: parties.ok ? parties.data : [],
        registrations: registrations.ok ? registrations.data : [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const openDetail = (ref: CatalogEntityRef): void => {
    setStack((previous) => [...previous, ref]);
  };

  const current = stack.at(-1);
  if (current) {
    return (
      <EntityDetailView
        entityRef={current}
        onNavigate={openDetail}
        onBack={() => setStack((previous) => previous.slice(0, -1))}
        onClose={() => setStack([])}
      />
    );
  }

  return (
    <Card data-testid="catalog-view">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Catalog</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadCatalog()} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {error ? (
          <p className="text-sm text-fg-tertiary" data-testid="catalog-error">
            {error}
          </p>
        ) : (
          <CatalogTabContent activeTab={activeTab} lists={lists} onSelect={openDetail} />
        )}
      </CardContent>
    </Card>
  );
}

function CatalogTabContent({
  activeTab,
  lists,
  onSelect,
}: {
  activeTab: CatalogTab;
  lists: CatalogLists;
  onSelect: (ref: CatalogEntityRef) => void;
}): JSX.Element {
  switch (activeTab) {
    case 'Work':
      return (
        <EntityList
          items={lists.works}
          emptyLabel="No works yet"
          renderRow={(work) => (
            <>
              <span>{work.title ?? '(untitled work)'}</span>
              <ShareIntegrityIndicator integrity={work.shareIntegrity} />
            </>
          )}
          onSelect={(work) => onSelect({ kind: 'Work', id: work.id })}
        />
      );
    case 'Recording':
      return (
        <EntityList
          items={lists.recordings}
          emptyLabel="No recordings yet"
          renderRow={(recording) => <span>{recording.title ?? '(untitled recording)'}</span>}
          onSelect={(recording) => onSelect({ kind: 'Recording', id: recording.id })}
        />
      );
    case 'Release':
      return (
        <EntityList
          items={lists.releases}
          emptyLabel="No releases yet"
          renderRow={(release) => <span>{release.title ?? '(untitled release)'}</span>}
          onSelect={(release) => onSelect({ kind: 'Release', id: release.id })}
        />
      );
    case 'Party':
      return (
        <EntityList
          items={lists.parties}
          emptyLabel="No parties yet"
          renderRow={(party) => <span>{party.displayName ?? '(unnamed party)'}</span>}
          onSelect={(party) => onSelect({ kind: 'Party', id: party.id })}
        />
      );
    case 'Registration':
      return (
        <EntityList
          items={lists.registrations}
          emptyLabel="No registrations yet"
          renderRow={(registration) => (
            <span>
              {registration.registryName ?? '(unnamed registry)'} — {registration.status ?? 'unknown'}
            </span>
          )}
          onSelect={(registration) => onSelect({ kind: 'Registration', id: registration.id })}
        />
      );
  }
}

function EntityList<TItem extends { id: string }>({
  items,
  emptyLabel,
  renderRow,
  onSelect,
}: {
  items: TItem[];
  emptyLabel: string;
  renderRow: (item: TItem) => JSX.Element;
  onSelect: (item: TItem) => void;
}): JSX.Element {
  if (items.length === 0) {
    return (
      <p className="text-sm text-fg-tertiary" data-testid="catalog-empty">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="catalog-list">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-brand-rule bg-brand-surface px-4 py-3 text-left text-sm text-fg-primary transition-colors duration-150 ease-out hover:border-brand-mid hover:bg-surface-hover"
          >
            {renderRow(item)}
          </button>
        </li>
      ))}
    </ul>
  );
}

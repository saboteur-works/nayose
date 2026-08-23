// Request/result shapes for the read-only catalog-browsing IPC channels
// (Task 9), shared between the main-process handler
// (../../main/ipc/catalog-handlers.ts) and the renderer's preload bridge
// (../../main/preload.ts).
//
// Kept in shared/types rather than defined in catalog-handlers.ts itself,
// mirroring entity-ipc.ts's split from entity-handlers.ts: catalog-handlers.ts
// has VALUE imports of main-only modules (entities.ts, share-integrity.ts,
// vault-session.ts) that themselves use relative `.ts` extension imports
// meant for Node's native TypeScript resolution (see tsconfig.main.json's
// `rewriteRelativeImportExtensions`). The renderer's tsconfig (Bundler
// resolution, no such rewrite) cannot type-check a file reached through a
// VALUE-import chain that uses `.ts` extensions. Rather than type-importing
// `ShareIntegrityResult` from `../../main/vault/share-integrity.ts` and
// relying on `import type` erasure to dodge that, this module defines its
// own structurally-identical `ShareIntegritySummary` shape using only
// leaf shared/types (`Fraction`, from projection.ts) — a self-contained
// shared/types module with no main-only import at all, which is the
// strictly safer version of the same split.

import type { Fraction } from './projection.ts';
import type {
  PartyId,
  RecordingId,
  RegistrationId,
  RegistrationStatus,
  ReleaseId,
  Share,
  WorkId,
} from './entities.ts';

/**
 * Structurally identical to `ShareIntegrityResult`
 * (../../main/vault/share-integrity.ts): the three possible outcomes of
 * checking a Work's recorded Party shares for integrity. See that module
 * for the authoritative logic; this is only the wire shape.
 */
export type ShareIntegritySummary =
  | { status: 'absent' }
  | { status: 'complete'; total: Fraction }
  | {
      status: 'incomplete';
      total: Fraction;
      difference: Fraction;
      direction: 'shortfall' | 'over-allocation';
    };

export interface WorkListItem {
  id: WorkId;
  title?: string;
  /**
   * Present on the bare list item (not just the detail lookup) so the
   * catalog list view can render a compact indicator on unexpanded rows,
   * per FR-15 / done_when clause 4.
   */
  shareIntegrity: ShareIntegritySummary;
}

export interface RecordingListItem {
  id: RecordingId;
  title?: string;
  workId?: WorkId;
}

export interface ReleaseListItem {
  id: ReleaseId;
  title?: string;
  recordingIds: RecordingId[];
}

export interface PartyListItem {
  id: PartyId;
  displayName?: string;
}

export interface RegistrationListItem {
  id: RegistrationId;
  workId?: WorkId;
  registryName?: string;
  status?: RegistrationStatus;
}

/** A Party's fractional share in a Work, with the Party's display name resolved for convenience. */
export interface PartyShareEntry {
  partyId: PartyId;
  displayName?: string;
  share: Share;
}

export interface WorkDetail extends WorkListItem {
  recordings: RecordingListItem[];
  parties: PartyShareEntry[];
  registrations: RegistrationListItem[];
}

export interface RecordingDetail extends RecordingListItem {
  work?: WorkListItem;
  release?: ReleaseListItem;
  /** The contributing Parties, reached via the Recording's Work's shares. */
  parties: PartyShareEntry[];
}

export interface ReleaseDetail extends ReleaseListItem {
  recordings: RecordingListItem[];
}

export interface PartyDetail extends PartyListItem {
  works: Array<WorkListItem & { share: Share }>;
}

export interface RegistrationDetail extends RegistrationListItem {
  work?: WorkListItem;
}

export type CatalogResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: { message: string } };

export type { PartyId, RecordingId, RegistrationId, ReleaseId, WorkId } from './entities.ts';

import { contextBridge, ipcRenderer } from 'electron';
import type { VaultCloseResult, VaultCreateResult, VaultOpenResult } from '../shared/types/vault.ts';
// Types come from shared/types/entity-ipc.ts (not ./ipc/entity-handlers.ts):
// entity-handlers.ts has VALUE imports of main-only modules using relative
// `.ts` extensions (for Node's native TS resolution, see
// tsconfig.main.json), which the renderer's Bundler-resolution tsconfig
// cannot type-check through. See entity-ipc.ts's header comment for detail.
import type {
  CreatePartyRequest,
  CreateRecordingRequest,
  CreateReleaseRequest,
  CreateWorkRequest,
  EntityCreateResult,
} from '../shared/types/entity-ipc.ts';
import type { AccountId, PartyId, RecordingId, ReleaseId, WorkId } from '../shared/types/entities.ts';
// Task 9 addition: read-only catalog-browsing request/result types (see
// entity-ipc.ts's header comment for why these live in shared/types
// rather than being type-imported from ../main/ipc/catalog-handlers.ts).
import type {
  CatalogResult,
  PartyDetail,
  PartyListItem,
  RecordingDetail,
  RecordingListItem,
  RegistrationDetail,
  RegistrationId,
  RegistrationListItem,
  ReleaseDetail,
  ReleaseListItem,
  WorkDetail,
  WorkListItem,
} from '../shared/types/catalog-ipc.ts';

// Safely-scoped bridge: the renderer only ever sees the `nayose` namespace
// below, never the raw ipcRenderer/electron APIs. Node integration stays off
// and context isolation stays on (set in main.ts's BrowserWindow config).
const nayoseApi = {
  ping: (payload: string): Promise<string> => ipcRenderer.invoke('nayose:ping', payload),
  vault: {
    create: (): Promise<VaultCreateResult> => ipcRenderer.invoke('vault:create'),
    open: (): Promise<VaultOpenResult> => ipcRenderer.invoke('vault:open'),
    close: (): Promise<VaultCloseResult> => ipcRenderer.invoke('vault:close'),
  },
  // Task 8 addition: manual entity-creation channels, operating on the
  // currently-open vault (see ../main/vault/vault-session.ts).
  entities: {
    ensureAccount: (): Promise<EntityCreateResult<AccountId>> =>
      ipcRenderer.invoke('entity:ensureAccount'),
    createParty: (request: CreatePartyRequest): Promise<EntityCreateResult<PartyId>> =>
      ipcRenderer.invoke('entity:createParty', request),
    createWork: (request: CreateWorkRequest): Promise<EntityCreateResult<WorkId>> =>
      ipcRenderer.invoke('entity:createWork', request),
    createRecording: (request: CreateRecordingRequest): Promise<EntityCreateResult<RecordingId>> =>
      ipcRenderer.invoke('entity:createRecording', request),
    createRelease: (request: CreateReleaseRequest): Promise<EntityCreateResult<ReleaseId>> =>
      ipcRenderer.invoke('entity:createRelease', request),
  },
  // Task 9 addition: read-only catalog-browsing channels, operating on the
  // currently-open vault (see ../main/vault/catalog-queries.ts).
  catalog: {
    listWorks: (): Promise<CatalogResult<WorkListItem[]>> => ipcRenderer.invoke('catalog:listWorks'),
    listRecordings: (): Promise<CatalogResult<RecordingListItem[]>> =>
      ipcRenderer.invoke('catalog:listRecordings'),
    listReleases: (): Promise<CatalogResult<ReleaseListItem[]>> => ipcRenderer.invoke('catalog:listReleases'),
    listParties: (): Promise<CatalogResult<PartyListItem[]>> => ipcRenderer.invoke('catalog:listParties'),
    listRegistrations: (): Promise<CatalogResult<RegistrationListItem[]>> =>
      ipcRenderer.invoke('catalog:listRegistrations'),
    getWorkDetail: (workId: WorkId): Promise<CatalogResult<WorkDetail | undefined>> =>
      ipcRenderer.invoke('catalog:getWorkDetail', workId),
    getRecordingDetail: (recordingId: RecordingId): Promise<CatalogResult<RecordingDetail | undefined>> =>
      ipcRenderer.invoke('catalog:getRecordingDetail', recordingId),
    getReleaseDetail: (releaseId: ReleaseId): Promise<CatalogResult<ReleaseDetail | undefined>> =>
      ipcRenderer.invoke('catalog:getReleaseDetail', releaseId),
    getPartyDetail: (partyId: PartyId): Promise<CatalogResult<PartyDetail | undefined>> =>
      ipcRenderer.invoke('catalog:getPartyDetail', partyId),
    getRegistrationDetail: (
      registrationId: RegistrationId,
    ): Promise<CatalogResult<RegistrationDetail | undefined>> =>
      ipcRenderer.invoke('catalog:getRegistrationDetail', registrationId),
  },
};

export type NayoseApi = typeof nayoseApi;

contextBridge.exposeInMainWorld('nayose', nayoseApi);

// Registers the read-only catalog-browsing IPC channels used by the
// renderer via window.nayose.catalog (Task 9). This module is thin
// `ipcMain.handle` glue only: the actual listing/detail-lookup logic lives
// in ../vault/catalog-queries.ts (a pure, Electron-free module, following
// vault-handlers.ts / entity-handlers.ts's existing split between IPC glue
// and vault-domain logic, and specifically so that logic can be unit-tested
// headlessly without importing 'electron' — see catalog-queries.test.ts).
//
// Every channel here is a PURE READ: none of them appends an assertion,
// calls `persistSession`, or otherwise mutates the currently-open vault's
// AssertionLog.

import { ipcMain } from 'electron';

import type {
  PartyId,
  RecordingId,
  RegistrationId,
  ReleaseId,
  WorkId,
} from '../../shared/types/entities.ts';
import type {
  CatalogResult,
  PartyDetail,
  PartyListItem,
  RecordingDetail,
  RecordingListItem,
  RegistrationDetail,
  RegistrationListItem,
  ReleaseDetail,
  ReleaseListItem,
  WorkDetail,
  WorkListItem,
} from '../../shared/types/catalog-ipc.ts';
import type { AssertionLog } from '../vault/assertion-log.ts';
import {
  getPartyDetail,
  getRecordingDetail,
  getRegistrationDetail,
  getReleaseDetail,
  getWorkDetail,
  listParties,
  listRecordings,
  listReleases,
  listRegistrations,
  listWorks,
} from '../vault/catalog-queries.ts';
import { getSession } from '../vault/vault-session.ts';

const NO_OPEN_VAULT_ERROR = 'No vault is currently open. Open a vault to browse its catalog.';

function requireSessionLog(): CatalogResult<AssertionLog> {
  const session = getSession();
  if (!session) {
    return { ok: false, error: { message: NO_OPEN_VAULT_ERROR } };
  }
  return { ok: true, data: session.log };
}

/** Run a pure listing/lookup function against the currently-open session's log, wrapped in a CatalogResult. */
function withSessionLog<TData>(fn: (log: AssertionLog) => TData): CatalogResult<TData> {
  const sessionResult = requireSessionLog();
  if (!sessionResult.ok) {
    return sessionResult;
  }
  return { ok: true, data: fn(sessionResult.data) };
}

export function registerCatalogHandlers(): void {
  ipcMain.handle('catalog:listWorks', async (): Promise<CatalogResult<WorkListItem[]>> =>
    withSessionLog(listWorks),
  );

  ipcMain.handle('catalog:listRecordings', async (): Promise<CatalogResult<RecordingListItem[]>> =>
    withSessionLog(listRecordings),
  );

  ipcMain.handle('catalog:listReleases', async (): Promise<CatalogResult<ReleaseListItem[]>> =>
    withSessionLog(listReleases),
  );

  ipcMain.handle('catalog:listParties', async (): Promise<CatalogResult<PartyListItem[]>> =>
    withSessionLog(listParties),
  );

  ipcMain.handle('catalog:listRegistrations', async (): Promise<CatalogResult<RegistrationListItem[]>> =>
    withSessionLog(listRegistrations),
  );

  ipcMain.handle(
    'catalog:getWorkDetail',
    async (_event, workId: WorkId): Promise<CatalogResult<WorkDetail | undefined>> =>
      withSessionLog((log) => getWorkDetail(log, workId)),
  );

  ipcMain.handle(
    'catalog:getRecordingDetail',
    async (_event, recordingId: RecordingId): Promise<CatalogResult<RecordingDetail | undefined>> =>
      withSessionLog((log) => getRecordingDetail(log, recordingId)),
  );

  ipcMain.handle(
    'catalog:getReleaseDetail',
    async (_event, releaseId: ReleaseId): Promise<CatalogResult<ReleaseDetail | undefined>> =>
      withSessionLog((log) => getReleaseDetail(log, releaseId)),
  );

  ipcMain.handle(
    'catalog:getPartyDetail',
    async (_event, partyId: PartyId): Promise<CatalogResult<PartyDetail | undefined>> =>
      withSessionLog((log) => getPartyDetail(log, partyId)),
  );

  ipcMain.handle(
    'catalog:getRegistrationDetail',
    async (_event, registrationId: RegistrationId): Promise<CatalogResult<RegistrationDetail | undefined>> =>
      withSessionLog((log) => getRegistrationDetail(log, registrationId)),
  );
}

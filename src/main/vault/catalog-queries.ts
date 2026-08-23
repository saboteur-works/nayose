// Read-only catalog-browsing queries over the assertion log (Task 9).
//
// This module is pure (no Electron/IPC dependency), matching
// assertion-log.ts, entities.ts, and share-integrity.ts's style, so it can
// be exercised directly in unit tests without a live Electron renderer or a
// vault file on disk. ../ipc/catalog-handlers.ts is a thin IPC-registration
// wrapper around these functions — it adds nothing beyond the
// `ipcMain.handle` glue and the "no vault is open" guard.
//
// Every function here is a PURE READ: none of them appends an assertion or
// otherwise mutates the log. Listing and detail-lookup logic reads
// exclusively through entities.ts's readers (`getEntityKind`,
// `getMostRecentFieldValue`, `getWorkShares`) and share-integrity.ts's
// `checkShareIntegrity`; it does not reimplement any of that logic, and
// does not resolve field-value conflicts itself (Task 6's projection.ts is
// not consulted here — these are the raw, most-recently-asserted values,
// matching entity-handlers.ts's existing read conventions).

import {
  FIELD_DISPLAY_NAME,
  FIELD_RECORDING_IDS,
  FIELD_REGISTRATION_STATUS,
  FIELD_REGISTRY_NAME,
  FIELD_TITLE,
  FIELD_WORK_ID,
  type EntityKind,
  type PartyId,
  type RecordingId,
  type RegistrationId,
  type RegistrationStatus,
  type ReleaseId,
  type WorkId,
} from '../../shared/types/entities.ts';
import type {
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
import { getAssertions, type AssertionLog } from './assertion-log.ts';
import { getEntityKind, getMostRecentFieldValue, getWorkShares } from './entities.ts';
import { checkShareIntegrity } from './share-integrity.ts';

/** Return every distinct entityId of the given EntityKind, in first-seen (append) order. */
function listEntityIdsOfKind(log: AssertionLog, kind: EntityKind): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const assertion of getAssertions(log)) {
    if (seen.has(assertion.entityId)) {
      continue;
    }
    seen.add(assertion.entityId);
    if (getEntityKind(log, assertion.entityId) === kind) {
      ids.push(assertion.entityId);
    }
  }
  return ids;
}

/** List every Work in the log, each carrying its share-integrity status on the bare list item (FR-15). */
export function listWorks(log: AssertionLog): WorkListItem[] {
  return listEntityIdsOfKind(log, 'Work').map((id) => {
    const workId = id as WorkId;
    return {
      id: workId,
      title: getMostRecentFieldValue<string>(log, workId, FIELD_TITLE),
      shareIntegrity: checkShareIntegrity(log, workId),
    };
  });
}

/** List every Recording in the log. */
export function listRecordings(log: AssertionLog): RecordingListItem[] {
  return listEntityIdsOfKind(log, 'Recording').map((id) => {
    const recordingId = id as RecordingId;
    return {
      id: recordingId,
      title: getMostRecentFieldValue<string>(log, recordingId, FIELD_TITLE),
      workId: getMostRecentFieldValue<WorkId>(log, recordingId, FIELD_WORK_ID),
    };
  });
}

/** List every Release in the log. */
export function listReleases(log: AssertionLog): ReleaseListItem[] {
  return listEntityIdsOfKind(log, 'Release').map((id) => {
    const releaseId = id as ReleaseId;
    return {
      id: releaseId,
      title: getMostRecentFieldValue<string>(log, releaseId, FIELD_TITLE),
      recordingIds: getMostRecentFieldValue<RecordingId[]>(log, releaseId, FIELD_RECORDING_IDS) ?? [],
    };
  });
}

/** List every Party in the log. */
export function listParties(log: AssertionLog): PartyListItem[] {
  return listEntityIdsOfKind(log, 'Party').map((id) => {
    const partyId = id as PartyId;
    return {
      id: partyId,
      displayName: getMostRecentFieldValue<string>(log, partyId, FIELD_DISPLAY_NAME),
    };
  });
}

/** List every Registration in the log. */
export function listRegistrations(log: AssertionLog): RegistrationListItem[] {
  return listEntityIdsOfKind(log, 'Registration').map((id) => {
    const registrationId = id as RegistrationId;
    return {
      id: registrationId,
      workId: getMostRecentFieldValue<WorkId>(log, registrationId, FIELD_WORK_ID),
      registryName: getMostRecentFieldValue<string>(log, registrationId, FIELD_REGISTRY_NAME),
      status: getMostRecentFieldValue<RegistrationStatus>(log, registrationId, FIELD_REGISTRATION_STATUS),
    };
  });
}

/** A Work's recorded Party shares, with each Party's display name resolved for convenience. */
function getWorkPartyShares(log: AssertionLog, workId: WorkId): WorkDetail['parties'] {
  return getWorkShares(log, workId).map(({ partyId, share }) => ({
    partyId,
    displayName: getMostRecentFieldValue<string>(log, partyId, FIELD_DISPLAY_NAME),
    share,
  }));
}

/** Look up a Work's detail: its own fields plus its Recordings, contributing Parties, and Registrations. */
export function getWorkDetail(log: AssertionLog, workId: WorkId): WorkDetail | undefined {
  if (getEntityKind(log, workId) !== 'Work') {
    return undefined;
  }
  return {
    id: workId,
    title: getMostRecentFieldValue<string>(log, workId, FIELD_TITLE),
    shareIntegrity: checkShareIntegrity(log, workId),
    recordings: listRecordings(log).filter((recording) => recording.workId === workId),
    parties: getWorkPartyShares(log, workId),
    registrations: listRegistrations(log).filter((registration) => registration.workId === workId),
  };
}

/** Look up a Recording's detail: its own fields plus its Work, containing Release, and contributing Parties. */
export function getRecordingDetail(log: AssertionLog, recordingId: RecordingId): RecordingDetail | undefined {
  if (getEntityKind(log, recordingId) !== 'Recording') {
    return undefined;
  }
  const workId = getMostRecentFieldValue<WorkId>(log, recordingId, FIELD_WORK_ID);
  const work = workId ? listWorks(log).find((candidate) => candidate.id === workId) : undefined;
  const release = listReleases(log).find((candidate) => candidate.recordingIds.includes(recordingId));

  return {
    id: recordingId,
    title: getMostRecentFieldValue<string>(log, recordingId, FIELD_TITLE),
    workId,
    work,
    release,
    parties: workId ? getWorkPartyShares(log, workId) : [],
  };
}

/** Look up a Release's detail: its own fields plus its included Recordings. */
export function getReleaseDetail(log: AssertionLog, releaseId: ReleaseId): ReleaseDetail | undefined {
  if (getEntityKind(log, releaseId) !== 'Release') {
    return undefined;
  }
  const recordingIds = getMostRecentFieldValue<RecordingId[]>(log, releaseId, FIELD_RECORDING_IDS) ?? [];
  return {
    id: releaseId,
    title: getMostRecentFieldValue<string>(log, releaseId, FIELD_TITLE),
    recordingIds,
    recordings: listRecordings(log).filter((recording) => recordingIds.includes(recording.id)),
  };
}

/** Look up a Party's detail: its own fields plus every Work it holds a recorded share in. */
export function getPartyDetail(log: AssertionLog, partyId: PartyId): PartyDetail | undefined {
  if (getEntityKind(log, partyId) !== 'Party') {
    return undefined;
  }
  const works = listWorks(log)
    .map((work) => ({
      work,
      share: getWorkShares(log, work.id).find((entry) => entry.partyId === partyId)?.share,
    }))
    .filter((entry): entry is { work: WorkListItem; share: NonNullable<typeof entry.share> } => entry.share !== undefined)
    .map(({ work, share }) => ({ ...work, share }));

  return {
    id: partyId,
    displayName: getMostRecentFieldValue<string>(log, partyId, FIELD_DISPLAY_NAME),
    works,
  };
}

/** Look up a Registration's detail: its own fields plus the Work it concerns. */
export function getRegistrationDetail(log: AssertionLog, registrationId: RegistrationId): RegistrationDetail | undefined {
  if (getEntityKind(log, registrationId) !== 'Registration') {
    return undefined;
  }
  const workId = getMostRecentFieldValue<WorkId>(log, registrationId, FIELD_WORK_ID);
  const work = workId ? listWorks(log).find((candidate) => candidate.id === workId) : undefined;

  return {
    id: registrationId,
    workId,
    registryName: getMostRecentFieldValue<string>(log, registrationId, FIELD_REGISTRY_NAME),
    status: getMostRecentFieldValue<RegistrationStatus>(log, registrationId, FIELD_REGISTRATION_STATUS),
    work,
  };
}

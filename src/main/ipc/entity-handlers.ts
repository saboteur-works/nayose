// Registers the manual entity-creation IPC channels used by the renderer
// via window.nayose.entities. Operates on the currently-open vault's
// in-memory AssertionLog (see ../vault/vault-session.ts), writing through
// entities.ts's constructor functions and persisting the updated log back
// to the open vault file after every creating write.
//
// Every assertion these handlers cause to be appended is `sourceClass:
// 'user-asserted'` with `actor` set to the vault's single Account id (see
// vault-session.ts's `ensureAccount`), per Task 8's done_when clause 2.

import { ipcMain } from 'electron';

import { appendAssertion } from '../vault/assertion-log.ts';
import {
  createParty,
  createRecording,
  createRelease,
  createWork,
  type Provenance,
} from '../vault/entities.ts';
import { ensureAccount, getSession, persistSession } from '../vault/vault-session.ts';
import type { AccountId, PartyId, RecordingId, ReleaseId, WorkId } from '../../shared/types/entities.ts';
import type {
  CreatePartyRequest,
  CreateRecordingRequest,
  CreateReleaseRequest,
  CreateWorkRequest,
  EditFieldRequest,
  EditFieldResult,
  EntityCreateResult,
} from '../../shared/types/entity-ipc.ts';

const NO_OPEN_VAULT_ERROR = 'No vault is currently open. Create or open a vault before adding entities.';

/**
 * Build the shared provenance every entity-creation write in this module
 * uses: `sourceClass: 'user-asserted'` and `actor` = the vault's single
 * Account id, established (or created on first use) via `ensureAccount`.
 */
function userProvenance(accountId: AccountId): Provenance {
  return {
    actor: accountId,
    timestamp: new Date().toISOString(),
    source: 'nayose-app',
    sourceClass: 'user-asserted',
  };
}

export function registerEntityHandlers(): void {
  ipcMain.handle('entity:ensureAccount', async (): Promise<EntityCreateResult<AccountId>> => {
    const session = getSession();
    if (!session) {
      return { ok: false, error: { message: NO_OPEN_VAULT_ERROR } };
    }

    const accountId = ensureAccount(session.log);
    await persistSession(session);
    return { ok: true, id: accountId };
  });

  ipcMain.handle(
    'entity:createParty',
    async (_event, request: CreatePartyRequest): Promise<EntityCreateResult<PartyId>> => {
      const session = getSession();
      if (!session) {
        return { ok: false, error: { message: NO_OPEN_VAULT_ERROR } };
      }

      const accountId = ensureAccount(session.log);
      const id = createParty(session.log, { ...userProvenance(accountId), displayName: request.displayName });
      await persistSession(session);
      return { ok: true, id };
    },
  );

  ipcMain.handle(
    'entity:createWork',
    async (_event, request: CreateWorkRequest): Promise<EntityCreateResult<WorkId>> => {
      const session = getSession();
      if (!session) {
        return { ok: false, error: { message: NO_OPEN_VAULT_ERROR } };
      }

      const accountId = ensureAccount(session.log);
      const id = createWork(session.log, { ...userProvenance(accountId), title: request.title });
      await persistSession(session);
      return { ok: true, id };
    },
  );

  ipcMain.handle(
    'entity:createRecording',
    async (_event, request: CreateRecordingRequest): Promise<EntityCreateResult<RecordingId>> => {
      const session = getSession();
      if (!session) {
        return { ok: false, error: { message: NO_OPEN_VAULT_ERROR } };
      }

      const accountId = ensureAccount(session.log);
      const id = createRecording(session.log, {
        ...userProvenance(accountId),
        title: request.title,
        workId: request.workId,
      });
      await persistSession(session);
      return { ok: true, id };
    },
  );

  ipcMain.handle(
    'entity:createRelease',
    async (_event, request: CreateReleaseRequest): Promise<EntityCreateResult<ReleaseId>> => {
      const session = getSession();
      if (!session) {
        return { ok: false, error: { message: NO_OPEN_VAULT_ERROR } };
      }

      const accountId = ensureAccount(session.log);
      const id = createRelease(session.log, {
        ...userProvenance(accountId),
        title: request.title,
        recordingIds: request.recordingIds,
      });
      await persistSession(session);
      return { ok: true, id };
    },
  );

  // Task 10 addition: additive field editing. This NEVER updates or deletes
  // an existing assertion (assertion-log.ts has no such operation) — it
  // only ever appends a new user-asserted assertion for (entityId,
  // fieldName). The prior assertion(s) remain untouched and fully
  // retrievable via projection.ts's getFieldHistory/getAssertionsForField.
  ipcMain.handle(
    'entity:editField',
    async (_event, request: EditFieldRequest): Promise<EditFieldResult> => {
      const session = getSession();
      if (!session) {
        return { ok: false, error: { message: NO_OPEN_VAULT_ERROR } };
      }

      const accountId = ensureAccount(session.log);
      const assertion = appendAssertion(session.log, {
        ...userProvenance(accountId),
        entityId: request.entityId,
        fieldName: request.fieldName,
        value: request.value,
      });
      await persistSession(session);
      return { ok: true, id: assertion.id };
    },
  );
}

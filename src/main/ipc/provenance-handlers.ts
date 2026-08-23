// Registers the read-only provenance-lookup IPC channel used by the
// renderer via window.nayose.provenance (Task 11). This module is thin
// `ipcMain.handle` glue only: the actual query logic lives in
// ../vault/provenance-queries.ts (a pure, Electron-free module, following
// catalog-handlers.ts / catalog-queries.ts's established split between IPC
// glue and vault-domain logic, since `ipcMain` cannot be imported outside
// Electron and must therefore be kept out of anything that needs headless
// unit tests — see provenance-queries.test.ts).
//
// The single channel here (`provenance:getFieldProvenance`) is a PURE READ:
// it never appends an assertion, calls `persistSession`, or otherwise
// mutates the currently-open vault's AssertionLog. It returns the field's
// current (projected) value AND its full assertion history in ONE response
// (see provenance-queries.ts / shared/types/provenance-ipc.ts), satisfying
// this task's done_when clause 2 structurally at the IPC level.

import { ipcMain } from 'electron';

import type { FieldProvenance, GetFieldProvenanceRequest, ProvenanceResult } from '../../shared/types/provenance-ipc.ts';
import { getFieldProvenance } from '../vault/provenance-queries.ts';
import { getSession } from '../vault/vault-session.ts';

const NO_OPEN_VAULT_ERROR = 'No vault is currently open. Open a vault to view field provenance.';

export function registerProvenanceHandlers(): void {
  ipcMain.handle(
    'provenance:getFieldProvenance',
    async (_event, request: GetFieldProvenanceRequest): Promise<ProvenanceResult<FieldProvenance>> => {
      const session = getSession();
      if (!session) {
        return { ok: false, error: { message: NO_OPEN_VAULT_ERROR } };
      }

      return { ok: true, data: getFieldProvenance(session.log, request.entityId, request.fieldName) };
    },
  );
}

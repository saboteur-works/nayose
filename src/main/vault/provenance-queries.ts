// Read-only provenance-lookup query over the assertion log (Task 11).
//
// This module is pure (no Electron/IPC dependency), matching
// catalog-queries.ts and projection.ts's style, so it can be exercised
// directly in unit tests without a live Electron renderer or a vault file
// on disk (`ipcMain` cannot be imported outside Electron, per Task 9's
// documented finding — see catalog-handlers.ts's header comment).
// ../ipc/provenance-handlers.ts is a thin IPC-registration wrapper around
// `getFieldProvenance`; it adds nothing beyond the `ipcMain.handle` glue and
// the "no vault is open" guard.
//
// This is a PURE READ: it never appends an assertion or otherwise mutates
// the log. It composes projection.ts's two existing read functions —
// `projectField` (current value + override info) and `getFieldHistory`
// (full ordered history) — into ONE response shape, per feature-spec FR-9 /
// FR-11 and this task's done_when clause 2: "the full assertion history for
// that field is viewable from the SAME PLACE" as the current value/override
// info, not via a follow-up query.

import type { AssertionLog } from './assertion-log.ts';
import { getFieldHistory, projectField } from './projection.ts';
import type { Assertion } from '../../shared/types/assertion.ts';
import type { FieldProvenance } from '../../shared/types/provenance-ipc.ts';

/**
 * Return a field's full provenance: its projected current value (with
 * override info, if any) and its complete ordered assertion history,
 * together in one object. `current` is `undefined` iff the field has no
 * assertions at all; `history` is `[]` in that same case.
 */
export function getFieldProvenance<TValue = unknown>(
  log: AssertionLog,
  entityId: string,
  fieldName: string,
): FieldProvenance<TValue> {
  return {
    entityId,
    fieldName,
    current: projectField<TValue>(log, entityId, fieldName),
    history: getFieldHistory(log, entityId, fieldName) as Array<Assertion<TValue>>,
  };
}

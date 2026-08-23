// Request/result shapes for the manual entity-creation IPC channels (Task
// 8), shared between the main-process handler (../../main/ipc/entity-handlers.ts)
// and the renderer's preload bridge (../../main/preload.ts).
//
// Kept in shared/types (mirroring vault.ts's split from vault-handlers.ts)
// rather than defined in entity-handlers.ts itself: entity-handlers.ts has
// VALUE imports (not just type imports) of main-only modules like
// entities.ts and vault-session.ts, which themselves use relative `.ts`
// extension imports meant for Node's native TypeScript resolution (see
// tsconfig.main.json's `rewriteRelativeImportExtensions`). The renderer's
// tsconfig (Bundler resolution, no such rewrite) cannot type-check a file
// reached through a VALUE-import chain that uses `.ts` extensions
// (TS5097), even though a `import type`-only chain is fine. Since
// preload.ts needs these request/result types, they live here — a
// leaf module with no value imports — so preload.ts's `import type` never
// has to pull entity-handlers.ts's runtime import graph into the renderer
// program.

import type { AccountId, PartyId, RecordingId, ReleaseId, WorkId } from './entities.ts';

export interface CreatePartyRequest {
  displayName?: string;
}

export interface CreateWorkRequest {
  title?: string;
}

export interface CreateRecordingRequest {
  title?: string;
  workId?: WorkId;
}

export interface CreateReleaseRequest {
  title?: string;
  recordingIds?: RecordingId[];
}

export type EntityCreateResult<TId> =
  | { ok: true; id: TId }
  | { ok: false; error: { message: string } };

// Task 10 addition: additive field editing. Editing a field never mutates or
// deletes an existing assertion — it always appends a new one (see
// ../../main/ipc/entity-handlers.ts's `entity:editField` handler, which is
// the only place this request type is consumed, via `appendAssertion`).
//
// `value` is intentionally `unknown`, mirroring `Assertion['value']` in
// ./assertion.ts: fields can hold strings, numbers, Fraction objects,
// arrays, etc., and this IPC surface must not narrow that.
export interface EditFieldRequest {
  entityId: string;
  fieldName: string;
  value: unknown;
}

/** Result of an `entity:editField` call: the id of the newly appended assertion. */
export type EditFieldResult = EntityCreateResult<string>;

export type { AccountId, PartyId, RecordingId, ReleaseId, WorkId };

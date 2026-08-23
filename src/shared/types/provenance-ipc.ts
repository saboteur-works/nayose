// Request/result shapes for the read-only provenance-lookup IPC channel
// (Task 11), shared between the main-process handler
// (../../main/ipc/provenance-handlers.ts) and the renderer's preload bridge
// (../../main/preload.ts).
//
// Kept in shared/types as a self-contained leaf module, mirroring
// catalog-ipc.ts's split from catalog-handlers.ts: provenance-handlers.ts
// (and the provenance-queries.ts module it wraps) has VALUE imports of
// main-only modules (projection.ts, assertion-log.ts, vault-session.ts)
// that use relative `.ts` extension imports meant for Node's native
// TypeScript resolution (see tsconfig.main.json's
// `rewriteRelativeImportExtensions`), which the renderer's Bundler-resolution
// tsconfig cannot type-check through. This module only depends on
// `projection.ts` and `assertion.ts`, which are themselves leaf shared/types
// modules with no main-only imports, so it is safe for preload.ts to
// `import type` from here.

import type { Assertion } from './assertion.ts';
import type { ProjectedField } from './projection.ts';

/** Input to the `provenance:getFieldProvenance` channel. */
export interface GetFieldProvenanceRequest {
  entityId: string;
  fieldName: string;
}

/**
 * The single response shape for a field's full provenance: its projected
 * current value (including override info, per `ProjectedField`) AND its
 * full ordered assertion history, together in ONE object — satisfying
 * done_when clause 2's "full history viewable from the SAME PLACE" at the
 * IPC level, not just by UI convention.
 *
 * `current` is `undefined` only if the field has no assertions at all
 * (mirrors `projectField`'s own `undefined` case).
 */
export interface FieldProvenance<TValue = unknown> {
  entityId: string;
  fieldName: string;
  current: ProjectedField<TValue> | undefined;
  history: Assertion<TValue>[];
}

export type ProvenanceResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: { message: string } };

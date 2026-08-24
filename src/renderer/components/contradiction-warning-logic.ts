// Pure, framework-free decision logic behind contradiction-warning.tsx
// (Task 12), split out the same way share-list-format.ts was split from
// share-list.tsx (Task 14) and provenance-view.tsx's helpers were kept
// plain where possible: so it can be exercised directly via `node --test`
// without a DOM/React-testing harness, which this codebase does not have.
//
// THE DECIDED RULE (this task's design call, per its brief):
//   A pending edit should warn iff the field's CURRENT value (before this
//   edit) is registry-issued with no user-asserted override yet — i.e.
//   `ProjectedField.sourceClass === 'registry-issued'`.
//
//   Per `projection.ts`'s conflict rule, `sourceClass` is 'user-asserted'
//   as soon as ANY user assertion exists for the field, even if that user
//   assertion happens to (structurally) match the registry value. So a
//   field that has already been overridden once does NOT warn again on a
//   subsequent edit — FR-8 is read here as "warn on the FIRST contradiction
//   of a registry value," not "warn every time a field with any registry
//   history is edited." A field with no assertions at all (`current`
//   undefined) has nothing to contradict, so it does not warn either.

import type { ProjectedField } from '../../shared/types/projection.ts';
import type { FieldProvenance } from '../../shared/types/provenance-ipc.ts';

/** True iff a field whose CURRENT value is `current` should be warned about before it is edited. */
export function shouldWarnBeforeEdit(current: ProjectedField | undefined): boolean {
  return current?.sourceClass === 'registry-issued';
}

/** Convenience wrapper over `shouldWarnBeforeEdit` for the shape `provenance:getFieldProvenance` returns. */
export function shouldWarnFromProvenance(provenance: FieldProvenance | undefined): boolean {
  return shouldWarnBeforeEdit(provenance?.current);
}

/**
 * A user-confirmable action held while a warning is pending. `source`
 * names the registry the CURRENT value came from, for display in the
 * warning; `proceed` performs the actual edit (e.g. calling
 * `window.nayose.entities.editField`) and is invoked ONLY by
 * `confirmPending`, never by `cancelPending`.
 */
export interface PendingConfirmation<TResult> {
  source: string;
  proceed: () => TResult;
}

/**
 * Cancel a pending confirmation. Structurally guarantees done_when clause
 * 3 ("cancelling writes nothing"): this function's body never references,
 * calls, or otherwise reaches `pending.proceed` — there is no code path
 * from here to an edit write.
 */
export function cancelPending<TResult>(_pending: PendingConfirmation<TResult> | undefined): void {
  // Intentionally a no-op over `pending`: cancelling never invokes `proceed`.
}

/** Confirm a pending confirmation: invokes `proceed` exactly once (if a confirmation is actually pending) and returns its result. */
export function confirmPending<TResult>(pending: PendingConfirmation<TResult> | undefined): TResult | undefined {
  return pending?.proceed();
}

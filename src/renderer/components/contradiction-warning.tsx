// Contradiction warning on edit (Task 12): a thin GUARD/WRAPPER around the
// edit action, per FR-8. It does not duplicate field-editor.tsx's input
// UI — it intercepts the SUBMIT step, so any current or future
// edit-submitting surface can compose it to get FR-8 compliance without
// hand-rolling its own "is this a registry value?" check, the same way
// provenance-view.tsx's `OverrideMarker` is meant to be composed for FR-9.
//
// Shape: a `useContradictionGuard` hook (owns the "is a warning pending?"
// state and the held edit action) plus a presentational
// `ContradictionWarningDialog` (renders the warning + Confirm/Cancel).
// The hook's control flow itself defers to contradiction-warning-logic.ts's
// pure functions (`shouldWarnFromProvenance`, `confirmPending`,
// `cancelPending`) so the meaningful decision logic stays unit-testable
// without a DOM/React-testing harness (see that module's tests).
//
// Wired into field-editor.tsx's submit handler (see that file): a field
// whose CURRENT value is registry-issued now shows this warning BEFORE
// `window.nayose.entities.editField` is ever called; confirming calls it,
// cancelling never does.

import { useCallback, useState } from 'react';

import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  cancelPending,
  confirmPending,
  shouldWarnFromProvenance,
  type PendingConfirmation,
} from './contradiction-warning-logic';

export interface UseContradictionGuardResult {
  /** The issuing source of the registry value being contradicted, present only while a warning awaits the user's decision. */
  pendingSource: string | undefined;
  /**
   * Run BEFORE writing an edit. Fetches the field's current provenance via
   * `window.nayose.provenance.getFieldProvenance` (Task 11's IPC); if the
   * current value is registry-issued, holds `performEdit` and returns
   * without calling it — `confirm`/`cancel` decide its fate from here.
   * Otherwise (user-asserted current value, or no assertions at all) calls
   * `performEdit` immediately.
   */
  guard: (entityId: string, fieldName: string, performEdit: () => Promise<void> | void) => Promise<void>;
  /** User confirmed: runs the held edit action (if any) and clears the pending warning. */
  confirm: () => Promise<void>;
  /** User cancelled: clears the pending warning WITHOUT running the held edit action. Nothing is written. */
  cancel: () => void;
}

/**
 * Hook form of the guard, so a composing component (field-editor.tsx, or a
 * future one) keeps its own submit-button wiring while delegating the
 * "should this warn, and did the user confirm" decision here.
 */
export function useContradictionGuard(): UseContradictionGuardResult {
  const [pending, setPending] = useState<PendingConfirmation<Promise<void> | void> | undefined>(undefined);

  const guard = useCallback(
    async (entityId: string, fieldName: string, performEdit: () => Promise<void> | void): Promise<void> => {
      const result = await window.nayose.provenance.getFieldProvenance({ entityId, fieldName });
      const provenance = result.ok ? result.data : undefined;

      if (shouldWarnFromProvenance(provenance)) {
        setPending({ source: provenance?.current?.source ?? 'a registry', proceed: performEdit });
        return;
      }

      await performEdit();
    },
    [],
  );

  const confirm = useCallback(async (): Promise<void> => {
    const outcome = confirmPending(pending);
    setPending(undefined);
    await outcome;
  }, [pending]);

  const cancel = useCallback((): void => {
    cancelPending(pending);
    setPending(undefined);
  }, [pending]);

  return { pendingSource: pending?.source, guard, confirm, cancel };
}

export interface ContradictionWarningDialogProps {
  /** The issuing source of the registry value the pending edit would override. */
  source: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The warning surface itself: names the issuing source (done_when clause
 * 1) and offers proceed-or-cancel (done_when clause 2). Rendered only
 * while `useContradictionGuard`'s `pendingSource` is set.
 */
export function ContradictionWarningDialog({
  source,
  onConfirm,
  onCancel,
}: ContradictionWarningDialogProps): JSX.Element {
  return (
    <Card data-testid="contradiction-warning" className="w-full max-w-md border-brand-red">
      <CardHeader>
        <CardTitle className="text-base">Overriding a registry value</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-fg-tertiary" data-testid="contradiction-warning-message">
          This value came from <span className="font-mono text-fg-primary">{source}</span>. Your edit will
          override it. Continue?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" data-testid="contradiction-warning-cancel" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" data-testid="contradiction-warning-confirm" onClick={onConfirm}>
            Override
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

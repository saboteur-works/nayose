// Unit tests for contradiction-warning-logic.ts's pure decision logic, per
// Task 12. Follows share-list-format.test.ts's precedent: a plain `.ts`
// module (no JSX) so it can be imported directly under `node --test`'s
// native TypeScript type-stripping, without a DOM/React-testing harness.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cancelPending,
  confirmPending,
  shouldWarnBeforeEdit,
  shouldWarnFromProvenance,
  type PendingConfirmation,
} from './contradiction-warning-logic.ts';
import type { ProjectedField } from '../../shared/types/projection.ts';
import type { FieldProvenance } from '../../shared/types/provenance-ipc.ts';

function registryIssuedField(overrides: Partial<ProjectedField> = {}): ProjectedField {
  return {
    value: 'Registry Title',
    sourceAssertionId: '1',
    source: 'musicbrainz',
    sourceClass: 'registry-issued',
    isOverride: false,
    ...overrides,
  };
}

function userAssertedField(overrides: Partial<ProjectedField> = {}): ProjectedField {
  return {
    value: 'User Title',
    sourceAssertionId: '2',
    source: 'nayose-app',
    sourceClass: 'user-asserted',
    isOverride: false,
    ...overrides,
  };
}

// Scenario 1: current provenance is registry-issued -> warning-should-fire is true.
test('shouldWarnBeforeEdit: true when the current value is registry-issued', () => {
  assert.equal(shouldWarnBeforeEdit(registryIssuedField()), true);
});

// Scenario 2: current provenance is user-asserted (already overridden once) -> warning-should-fire is false.
// Design decision (documented in contradiction-warning-logic.ts): FR-8 is
// read as "warn on the FIRST contradiction of a registry value," so a field
// that already carries a user assertion does not warn again on a
// subsequent edit, even if a registry-issued assertion still exists
// earlier in its history.
test('shouldWarnBeforeEdit: false when the current value is already user-asserted', () => {
  assert.equal(shouldWarnBeforeEdit(userAssertedField()), false);
});

// Scenario 3: no assertions at all (new field) -> warning-should-fire is false.
test('shouldWarnBeforeEdit: false when the field has no current value at all', () => {
  assert.equal(shouldWarnBeforeEdit(undefined), false);
});

test('shouldWarnFromProvenance: delegates to the `current` field of a FieldProvenance response', () => {
  const provenance: FieldProvenance = {
    entityId: 'work-1',
    fieldName: 'title',
    current: registryIssuedField(),
    history: [],
  };
  assert.equal(shouldWarnFromProvenance(provenance), true);

  const noAssertions: FieldProvenance = {
    entityId: 'work-1',
    fieldName: 'title',
    current: undefined,
    history: [],
  };
  assert.equal(shouldWarnFromProvenance(noAssertions), false);
  assert.equal(shouldWarnFromProvenance(undefined), false);
});

// done_when clause 3, verified structurally: cancelling never invokes the
// held edit action.
test('cancelPending: never invokes the pending action', () => {
  let calls = 0;
  const pending: PendingConfirmation<void> = {
    source: 'musicbrainz',
    proceed: () => {
      calls += 1;
    },
  };

  cancelPending(pending);
  cancelPending(undefined);

  assert.equal(calls, 0);
});

// Counterpart: confirming DOES invoke the held edit action, exactly once.
test('confirmPending: invokes the pending action exactly once and returns its result', () => {
  let calls = 0;
  const pending: PendingConfirmation<string> = {
    source: 'musicbrainz',
    proceed: () => {
      calls += 1;
      return 'assertion-id-123';
    },
  };

  const result = confirmPending(pending);

  assert.equal(calls, 1);
  assert.equal(result, 'assertion-id-123');
  assert.equal(confirmPending(undefined), undefined);
});

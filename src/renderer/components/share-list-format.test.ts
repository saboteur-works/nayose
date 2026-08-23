// Unit tests for share-list-format.ts's pure, framework-free
// `formatShareSummary` helper, per Task 14. This is deliberately a plain
// data-transformation test (no DOM, no component-testing harness) so it
// fits this codebase's existing `node --test`-based approach without
// introducing a new test runner for one component. `share-list-format.ts`
// is a plain `.ts` module (no JSX) specifically so it can be imported here
// directly via Node's native TypeScript type-stripping — importing
// share-list.tsx itself (which contains JSX) fails with
// ERR_UNKNOWN_FILE_EXTENSION under `node --test`, since Node's loader does
// not run a JSX transform. See share-list.tsx's `ShareList`/
// `ShareIntegritySummaryBadge` for the JSX that renders this same string.
//
// Follows share-integrity.test.ts's style: node:test, node:assert/strict,
// `.ts`-extension relative imports for Node's native TypeScript
// type-stripping.

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatFraction, formatShareSummary } from './share-list-format.ts';
import type { ShareIntegritySummary } from '../../shared/types/catalog-ipc.ts';

test('formatFraction: renders numerator/denominator unreduced-as-stored', () => {
  assert.equal(formatFraction({ numerator: 5, denominator: 6 }), '5/6');
});

// done_when scenario: status 'complete' renders without any warning/
// incomplete indication — no "short by" / "over-allocated" text at all.
test('formatShareSummary: complete status states the total with no warning language', () => {
  const integrity: ShareIntegritySummary = { status: 'complete', total: { numerator: 1, denominator: 1 } };
  const summary = formatShareSummary(integrity);
  assert.match(summary, /1\/1/);
  assert.doesNotMatch(summary, /short/i);
  assert.doesNotMatch(summary, /over-allocat/i);
});

// done_when clause 1 + scenario: incomplete/shortfall states the ACTUAL
// total (5/6) and the shortfall magnitude (1/6), not just "incomplete".
test('formatShareSummary: incomplete shortfall states actual total and shortfall magnitude', () => {
  const integrity: ShareIntegritySummary = {
    status: 'incomplete',
    total: { numerator: 5, denominator: 6 },
    difference: { numerator: 1, denominator: 6 },
    direction: 'shortfall',
  };
  const summary = formatShareSummary(integrity);
  assert.match(summary, /5\/6/);
  assert.match(summary, /short by 1\/6/);
});

// done_when clause 1 + scenario: incomplete/over-allocation states the
// actual total (3/2) and the over-allocation magnitude (1/2).
test('formatShareSummary: incomplete over-allocation states actual total and over-allocation magnitude', () => {
  const integrity: ShareIntegritySummary = {
    status: 'incomplete',
    total: { numerator: 3, denominator: 2 },
    difference: { numerator: 1, denominator: 2 },
    direction: 'over-allocation',
  };
  const summary = formatShareSummary(integrity);
  assert.match(summary, /3\/2/);
  assert.match(summary, /over-allocated by 1\/2/);
});

// done_when clause 2: a Work with no shares recorded must never be reported
// as under-allocated — no "0/1", no "incomplete"/"short by" language, and a
// distinct textual state ("no shares recorded" / "unknown").
test('formatShareSummary: absent status is distinct — never "0/1", never under-allocation language', () => {
  const integrity: ShareIntegritySummary = { status: 'absent' };
  const summary = formatShareSummary(integrity);
  assert.match(summary, /no shares recorded/i);
  assert.doesNotMatch(summary, /0\/1/);
  assert.doesNotMatch(summary, /short/i);
  assert.doesNotMatch(summary, /incomplete/i);
  assert.doesNotMatch(summary, /over-allocat/i);
});

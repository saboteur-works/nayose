# Architecture: the vault

This document covers the data model implemented by Feature 1
(`feat/vault-core`, spec at `specs/features/vault-core.md`). It is for a
developer working in `src/main/vault/`, `src/main/ipc/`, or the renderer
surfaces that consume them.

## The assertion log is append-only

The vault's primary store is not a table of current field values — it is a
log of assertions (`src/main/vault/assertion-log.ts`). An assertion carries
an entity id, a field name, a value, an actor, a timestamp, a source, and a
source class of either `registry-issued` or `user-asserted`.

The log's public interface has **no update and no delete operation**. This
is enforced structurally, not by convention: `appendAssertion` is the only
way to add data, `getAssertions` / `getAssertionsForField` are the only ways
to read it back, and there is nothing else in the module's exported surface.
Correcting a value never touches the assertion that was wrong — it appends a
new, later assertion for the same field. The old assertion stays in the log,
in its original append position, forever.

Every entity type, every field, every share, and every registration state
is recorded this way. There is no separate "current value" table.

## Projections derive current values

`src/main/vault/projection.ts` reads the log and derives a field's current
value; it is strictly read-only and never appends to the log. Given a
field's full assertion history, `projectField` applies a fixed rule:

1. If any `user-asserted` assertion exists for the field, the current value
   is the **most recent** user-asserted assertion (by append order).
2. Otherwise, the current value is the most recent `registry-issued`
   assertion.
3. If neither exists, there is no current value.

Nothing is ever discarded to compute this — conflicting assertions on the
same field all remain retrievable via the full history (`getFieldHistory`),
regardless of which one wins as "current."

## The conflict rule and the override marking

When a user-asserted value and a retained registry-issued value disagree,
the user's value always wins as current — the vault never silently overrides
a user's own correction. But the superseded registry-issued assertion is
never dropped, and the projection surfaces the conflict: `projectField`
returns an `isOverride` flag, and when it is true, also returns the
overridden registry value, its source, and its assertion id, in the same
return object (no second query needed).

The requirement this exists to satisfy (feature-spec FR-9) is that this
override must be **marked wherever the value is displayed, with zero
interaction required to see it** — a user should never need to click
anything to notice they are looking at a correction. That marking renders as
two treatments driven by one shared "is this overridden" flag, so they
cannot diverge from each other:

- a full marker (icon plus label) in detail views, and
- a minimal indicator in list and dense views,

both reading the same `isOverride` flag computed once by the projection. The
underlying superseded registry-issued assertion remains reachable from that
marking within one interaction (provenance detail).

"Override" here specifically means a *disagreement* — if a user's assertion
happens to match the most recent registry-issued value exactly (deep
structural equality), `isOverride` is `false`, because there is nothing to
warn about.

## Shares are stored unreduced; normalization is a projection concern

A party's fractional share in a work is a first-class relationship, not a
freeform string, and (like everything else) is recorded as an assertion. Per
feature-spec FR-14, a share assertion is stored **exactly as asserted** — an
unreduced numerator/denominator pair. `assertion-log.ts` never inspects or
transforms a value on write, so this falls out of the log's generic
behavior rather than being special-cased.

Normalization — reducing a fraction, summing a set of fractions via
LCM-based common-denominator arithmetic, or comparing two fractions for
equality — happens only in the projection layer
(`reduceFraction`, `sumFractions`, `fractionsEqual` in
`src/main/vault/projection.ts`). The stored assertions are never rewritten
by this arithmetic; it operates on values read out of the log and returns
new values.

`src/main/vault/share-integrity.ts` builds on this to report, for a work,
whether its currently-projected shares sum to unity — distinguishing
**absent** (no shares recorded at all) from **incomplete** (shares recorded,
but summing to something other than 1/1, with the shortfall or
over-allocation reported). This check is read-only and never blocks or
refuses a write: real catalogs frequently have splits that do not sum to
100%, and the vault's job is to make that visible, not to enforce it.

## Storage format is provisional

The vault is currently a single JSON file (`src/main/vault/vault-file.ts`),
identified by a marker field and a format-version field, validated on read.
This is a working implementation choice for Feature 1, not a published
contract — Feature 2 is where the on-disk format becomes a documented,
versioned deliverable (`specs/product/nayose.md` FR-20 through FR-29), and
that work may force a revision of today's shape. The boundary is kept
narrow deliberately: only `vault-file.ts` and `src/shared/types/vault.ts`
know the current on-disk shape, so that a future format change does not
ripple through the entity model, the projection layer, or the renderer.

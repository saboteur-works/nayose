# Feature Spec: Vault with Hand-Entered Catalog

**Branch:** feat/vault-core
**Source feature breakdown:** specs/product/nayose.features.md, Feature 1
**Source product spec:** specs/product/nayose.md
**Local ID note:** User story and requirement IDs below are renumbered sequentially for this document, starting at 1. Each item carries its originating product-spec ID in parentheses for traceability back to `specs/product/nayose.md`.

## Overview

This feature is the vault itself: the assertion-log store, the entity model (Party, Account, Work, Recording, Release, and the share and registration-state relationships), the projection logic that derives current values from assertion history, and the desktop application shell that lets a musician create works, recordings, releases, and parties by hand, correct any value without destroying its history, and see where every value came from. No import path exists yet — everything in the vault at this milestone got there because a person typed it or a test fixture inserted it directly. This is the foundational, one-way-door layer: the assertion log and the Party/Account separation cannot be retrofitted later without discarding history, so this feature exists to get that shape right before anything else is built on top of it.

### Constraints (context, not new requirements)

These are fixed implementation constraints inherited from outside this spec's ladder — recorded here as context so the design-system integration work has a documented basis, not as new functional requirements:

- **Stack is fixed:** TypeScript + Electron. React with shadcn/ui primitives in the renderer. Vault file I/O and all domain logic live in the MAIN process; the renderer holds interface only and reaches the vault over IPC. Context isolation on, node integration off.
- **Styling authority is `~/Repositories/saboteur-labs/saboteur-styles`** (brand system v0.6, Tailwind v4 `@theme` tokens). No colour, font, weight, radius, or spacing value may be introduced that is not in `saboteur-base.css`. Product-specific tokens belong in a product theme file under a `--color-nayose-*` namespace.
- **shadcn/ui token remapping is required, not optional.** shadcn/ui ships its own token vocabulary (`--background`, `--foreground`, `--radius`, and the rest) which does not match Saboteur's; taking the shadcn defaults silently violates the styles repo's central rule, so every shadcn token must be remapped onto the Saboteur brand tokens before use.

## Goals

- A user can create a vault and populate it entirely by hand: works, recordings, releases, parties, shares, and registration state.
- Every stored value is traceable to the assertion that produced it, including actor, timestamp, source, and source class (registry-issued or user-asserted).
- A user can correct any value without losing the assertion that was overridden, and sees at a glance when their correction overrides a registry-issued value.
- A user can browse the catalog and move between related entities (works, recordings, releases, parties, registrations).
- The application runs on macOS, Windows, and Linux with zero network dependency for any of the above.

## Non-goals

- No import of any kind, from any source (files, streaming APIs, or presets). Nothing populates the vault except hand entry and test fixtures. Import is Features 3, 4, and 5.
- No export and no published on-disk format guarantee. The storage format used here is provisional; Feature 2 (export and published format) may force a revision, and the boundary between storage and everything built on top of it must stay clean enough to absorb that.
- No network access of any kind, including for verification, sync, or telemetry. FR-13 (below) requires the application to work fully offline and to never transmit vault contents.
- No browser extension, no discrepancy surfacing against live registry pages, no sync across devices, and no annotations layer (freeform fields, file pointers, tool references).
- No enforcement of multi-party permissions or roles; Party/Account separation is representable but MVP creates exactly one Account per vault.

## User stories

- US-1: As a musician, I want to see where any value came from and when, so that I know whether to trust it. (product spec US-5)
- US-2: As a musician, I want to browse my works, recordings, releases, parties, and registrations and move between related items, so that I can see what I actually have. (product spec US-6)
- US-3: As a musician, I want to correct a value an import got wrong, so that a bad identifier is not permanent. (product spec US-7) — at this milestone, "an import got wrong" is necessarily read as "a prior assertion got wrong," since no import exists yet; the correction mechanism itself does not distinguish the two.
- US-4: As a musician, I want to add a work by hand, so that unreleased and non-distributed material can be recorded. (product spec US-8)

## Functional requirements

1. FR-1: The vault MUST be a single user-owned file containing one or more Party entities. [US-2] (product spec FR-1)
2. FR-2: Party (subject of metadata) and Account (actor on metadata) MUST be distinct entity types in the schema; a vault MUST support multiple coexisting Party entities acted on by a single Account, and the system MUST create exactly one Account per vault at this milestone. [US-1] (product spec FR-2)
3. FR-3: Every stored value MUST be recorded as an assertion carrying actor, timestamp, source, and source class of either registry-issued or user-asserted. [US-1] (product spec FR-3)
4. FR-4: The system MUST derive a field's current value from its assertions, and MUST be able to retrieve the full assertion history for any field. [US-1] (product spec FR-4)
5. FR-5: The vault MUST be able to hold conflicting assertions about the same field without discarding either. [US-3] (product spec FR-5)
6. FR-6: Users MUST be able to create works, recordings, releases, and parties by hand. [US-4] (product spec FR-15)
7. FR-7: Users MUST be able to edit any field; an edit MUST be recorded as a new user-asserted assertion and MUST NOT delete or overwrite an existing registry-issued assertion. [US-3] (product spec FR-16)
8. FR-8: The system MUST warn the user when a manual edit contradicts a registry-issued value, and MUST identify the issuing source in that warning. [US-3] (product spec FR-17)
9. FR-9: A field whose current value is a user-asserted assertion overriding a retained registry-issued assertion MUST be marked as such wherever that value is displayed, with the marking present without requiring an interaction; this MUST render as two treatments driven by one shared "is this overridden" flag — a full marker (icon plus label) in detail view and a minimal indicator in list and dense views — so the two treatments cannot diverge, since a marker illegible in a list row would make FR-9's zero-interaction guarantee a compliance failure rather than a cosmetic one; the underlying registry-issued assertion MUST remain retrievable via provenance detail (FR-11). [US-3] (product spec FR-30)
10. FR-10: The system MUST present works, recordings, releases, parties, and registrations, and MUST allow navigation between related entities. [US-2] (product spec FR-18)
11. FR-11: Provenance for any displayed value MUST be reachable within one interaction from where the value is shown. [US-1] (product spec FR-19)
12. FR-12: The application MUST run on macOS, Windows, and Linux. [US-2] (product spec FR-24)
13. FR-13: All functionality in this feature MUST work with no network connection, and the application MUST NOT transmit vault contents to any server. [US-2] (product spec FR-25)
14. FR-14: The vault MUST be able to represent a party's fractional share in a work, and a work's registration state with a named registry, as first-class relationships rather than freeform values, each recorded as an assertion like any other value; shares MUST be stored as fractions, not percentages, and each share assertion MUST be stored exactly as asserted — an unreduced numerator/denominator pair — with normalization for comparison or summation performed only in the projection layer, never at write time. [US-4] (product spec FR-32 — see traceability note below)
15. FR-15: The system MUST detect when the shares recorded against a work do not sum to unity, and MUST surface that condition everywhere the work appears, including bare catalog list rows via a compact indicator, even when individual shares are not expanded; the system MUST NOT refuse to store an incomplete or over-allocated share set. [US-2] (product spec FR-33 — see traceability note below)

### Traceability note: FR-14 and FR-15 (product spec FR-32/FR-33)

The product spec tags FR-32 and FR-33 with US-2 ("As a songwriter, I want to import my MLC catalog export…"), but this feature's declared user stories are US-5 through US-8 (renumbered US-1–US-4 above) — US-2 belongs to Feature 4. This is a real mismatch, not an oversight to paper over: the feature breakdown places the share and registration-state *data model* here because it is entity-model shape and a one-way door (per the breakdown's own notes), while the *user story that motivates and would end-to-end validate it* — a songwriter's MLC import populating shares and registration state — belongs to a feature this one does not include.

Resolution taken in this spec: FR-14 and FR-15 are built here as storage and detection mechanics only, attached above to US-2 and US-4 (browsing and hand entry) as the closest-available local proxies, because those are the only interactions this feature offers that touch shares or registration state at all. They are **not validated against their originating scenario at this milestone**. What that means concretely: acceptance testing for FR-14/FR-15 in this feature can only exercise hand-entered and fixture-loaded share sets (e.g., a work with three co-writers manually assigned 1/3 each, or a set summing to 5/6 to confirm the incompleteness surfacing in FR-15 fires without a write refusal). The authoritative validation — an actual MLC export producing shares and registration state — cannot happen until Feature 4 exists. Any acceptance criterion that assumes import-sourced shares is out of scope here and must be re-verified when Feature 4 ships.

## Open questions

- OQ-1: FR-9's zero-interaction override marking and FR-11's one-interaction provenance reachability both apply to every displayed field; is a single persistent visual treatment (e.g., an icon or underline) sufficient to satisfy FR-9 across list views, detail views, and any future compact/dense display mode, or does list-view space force a different treatment than detail-view? — Impact: FR-9, FR-11. — RESOLVED: two treatments driven by one shared override flag — a full marker (icon plus label) in detail view, a minimal indicator in list and dense views — both rendered from the same underlying "is this overridden" flag so they cannot diverge. Rationale: FR-9 is a zero-interaction MUST, so a marker that becomes illegible in a list row is a compliance failure, not a cosmetic one.
  Resolution: two treatments (full marker in detail view; minimal indicator in list/dense views), both driven by one shared override flag.
- OQ-2: FR-14 requires shares to be stored as fractions. What is the canonical in-memory/on-disk representation (e.g., numerator/denominator pair vs. a rational-number library type), and how are non-reducible or very-high-denominator fractions from real catalogs (twelfths, thirds) handled without float drift? — Impact: FR-14. — RESOLVED: store the fraction exactly as asserted, unreduced, as a numerator/denominator pair. Normalization for comparison and summation happens in the projection layer, never at write time. Rationale: FR-3 and FR-4 promise an assertion is retrievable as recorded, so reducing at write time would store something other than what was asserted; this keeps the append-only layer exact and dumb, and puts revisable arithmetic in the projection.
  Resolution: unreduced numerator/denominator pair at write time; normalization is a projection-layer concern.
- OQ-3: FR-15 requires surfacing an unresolved share set "wherever the work's shares are shown." Does this include summary/list views that show a work without expanding its shares, or only views that already display individual share values? — Impact: FR-15, FR-10. — RESOLVED: surface everywhere a work appears, including bare catalog list rows, via a compact indicator, even when individual shares are not expanded. Rationale: FR-15 says "wherever... shown" literally, and the point is that a user is never surprised by an unresolved split. Consequence: the catalog list view must carry share-integrity data it would not otherwise need.
  Resolution: surface everywhere the work appears, including unexpanded catalog list rows, via a compact indicator.
- OQ-4: The provisional storage format (a non-goal to finalize here) still has to support the assertion log, the entity model, and the share/registration-state relationships well enough that Feature 2's export work does not force a full data migration. What level of format stability is expected from this feature before Feature 2 begins, given the format itself is explicitly out of this feature's scope? — Impact: FR-1 through FR-15 collectively, and the Feature 1 → Feature 2 dependency. — RESOLVED: the as-built format supports everything Feature 2 needs; no migration is forced. Basis, verified against the source: `src/main/vault/entities.ts` builds every entity, field, share and registration state as assertions on `(entityId, fieldName)` pairs — its own header states it is "a LAYER OVER the assertion log rather than a second, assertion-log-parallel storage structure" — and `persistSession` in `src/main/vault/vault-session.ts` round-trips the whole log into `body.assertions`. `body.assertions` is therefore already a complete representation, and Feature 2 needs no new top-level `VaultBody` fields for that data.
- OQ-5: US-3's phrasing ("a value an import got wrong") does not map cleanly onto a feature with no import. Should the edit/correction UI use import-neutral language at this milestone, and does that wording choice need to be revisited once Features 3–5 exist? — Impact: FR-7, FR-8, FR-9. — RESOLVED by the spec's own text.
  Resolution: see the US-3 line above, which already states that at this milestone "an import got wrong" reads as "a prior assertion got wrong," and that the correction mechanism does not distinguish the two. The correction UI uses import-neutral language now; revisit once Features 3–5 exist.
- OQ-6: FR-2 requires Party and Account to be distinct entity types with exactly one Account per vault at MVP. Is there a concrete scenario this feature must support where a single vault's one Account acts on behalf of more than one Party (e.g., a songwriter vault holding co-writer Parties who are not Account holders), or does "one Account per vault" imply exactly one Party is ever edited by that Account? — Impact: FR-2, FR-14. — RESOLVED: multiple Parties per vault is required, not merely permitted; one Account acts on behalf of many Parties. Basis: FR-1 says "one or more Party entities," and the traceability note's worked example (a work with three co-writers each holding 1/3) needs at least three coexisting Party entities for the share model to mean anything.
  Resolution: multiple Party entities per vault is required, coexisting under one Account.

## Out of scope (deferred)

- File import, streaming-API import, MLC/PRO preset import, and the shared import pipeline (preview, match, confirm, commit) — Features 3, 4, 5.
- Export, format versioning, the published format specification, and the independent reader implementation — Feature 2.
- Browser-extension capture, on-page discrepancy surfacing, and staleness prompts — product spec v1 milestone.
- Annotations layer (freeform fields, file location pointers, tool references) — product spec v1 milestone.
- Sync across devices, read/write API for other applications, and multi-party enforcement — product spec v2 and post-v2.

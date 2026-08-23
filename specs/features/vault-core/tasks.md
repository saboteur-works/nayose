# Tasks: Feature 1 — Vault with hand-entered catalog

**Feature source:** `specs/product/nayose.features.md`
**Spec source:** `specs/features/vault-core.md` (feature FR-1–FR-15), tracing back to `specs/product/nayose.md` — FR-1–FR-5, FR-15–FR-19, FR-24, FR-25, FR-30, FR-32, FR-33 (US-2, US-5, US-6, US-7, US-8)
**Branch:** `feat/vault-core`
**Granularity:** story points (1/2/3/5/8)

> **Stack:** TypeScript + Electron, React with shadcn/ui primitives in the renderer. Vault file I/O and all domain logic live in the main process; the renderer holds interface only and reaches the vault over IPC.
>
> **Styling authority:** `~/Repositories/saboteur-labs/saboteur-styles` — brand system v0.6, Tailwind v4 `@theme` tokens. Read `docs/tokens.md`, `docs/color-rules.md`, `docs/typography-rules.md`, and `docs/products.md` before writing any interface code. No colour, font, weight, radius, or spacing value may be introduced that is not in `saboteur-base.css`; product-specific tokens belong in a product theme file under a `--color-nayose-*` namespace.


### Task 1: Cross-platform application shell
**What:** A TypeScript Electron application that launches on macOS, Windows, and Linux, with a reproducible build per platform.
**Files:** `package.json`, `tsconfig.json`, `electron-builder.yml`, `src/main/main.ts`, `src/main/preload.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`, `.github/workflows/build.yml`
**Done when:** The application launches to an empty window on all three platforms, React renders in the renderer, IPC round-trips a test message between renderer and main, and CI produces an installable artifact per platform from a clean checkout.
**Depends on:** none
**Estimate:** 5
**Notes:** Establishes feature-spec FR-12 (product-spec FR-24) and the offline posture of feature-spec FR-13 (product-spec FR-25). Contains no vault logic and no styling — platform and IPC problems should surface before anything depends on them. Context isolation on, node integration off in the renderer.
**Done:** [ ]

### Task 2: Saboteur design system integration
**What:** Wire the Saboteur brand tokens into the renderer and reconcile shadcn/ui primitives against them.
**Files:** `src/renderer/styles/index.css`, `src/renderer/styles/nayose-theme.css`, `tailwind.config.ts`, `components.json`, `src/renderer/components/ui/*`
**Done when:** `saboteur-base.css` is imported and its tokens resolve as Tailwind v4 utilities and CSS custom properties in the renderer; a rendered sample of button, card, input, and badge matches the Storybook `Examples/UI Primitives` treatment; no colour, font, weight, radius, or spacing value outside `saboteur-base.css` appears in product CSS, verified by review against `docs/tokens.md`.
**Depends on:** 1
**Estimate:** 5
**Notes:** This task satisfies no FR of its own — it is enabling work. Its justification is the "Constraints (context, not new requirements)" subsection under the feature spec's Overview, which records the fixed stack (TypeScript + Electron, React with shadcn/ui in the renderer) and the styling authority as inherited constraints rather than functional requirements. It serves the feature's UI-facing requirements — feature-spec FR-6, FR-9, FR-10, FR-11, and FR-15 — none of which can be built without it, but it does not itself satisfy any of them. **shadcn/ui ships its own token vocabulary** (`--background`, `--foreground`, `--radius`, and the rest) which will not match Saboteur's. Remapping those to Saboteur tokens is the substance of this task, not a detail — take defaults as they come and the app silently violates the styles repo's core rule. Two further points: this is the first **desktop** Saboteur product, while `docs/products.md` covers web products only, so a new entry there is required and lands in a different repository; and GetWrite is the nearest sibling (local-first, studio-shaped, restrained red) and the closest reference for colour tempo.
**Done:** [ ]

### Task 3: Vault file lifecycle
**What:** Create, open, close, and persist a vault as a single file at a user-chosen path.
**Files:** `src/main/vault/vault-file.ts`, `src/main/ipc/vault-handlers.ts`, `src/shared/types/vault.ts`
**Done when:** A user can create a new vault, close the application, reopen the file, and observe identical contents. Opening a file that is not a vault fails with a clear message rather than a crash or partial load.
**Depends on:** 1
**Estimate:** 3
**Notes:** Partially satisfies feature-spec FR-1 (product-spec FR-1). Storage format chosen here is provisional — Feature 2 publishes the format specification and may force revision, so keep the boundary between storage and everything above it clean.
**Done:** [ ]

### Task 4: Append-only assertion log
**What:** The storage primitive: assertions carrying actor, timestamp, source, and source class, appended and read back in order.
**Files:** `src/main/vault/assertion-log.ts`, `src/shared/types/assertion.ts`
**Done when:** An assertion can be appended and retrieved with all four attributes intact; assertions return in a stable order; the API exposes no update or delete operation, verified by test.
**Depends on:** 3
**Estimate:** 5
**Notes:** Satisfies feature-spec FR-3 (product-spec FR-3). The absence of mutation is the requirement — enforce it in the interface rather than by convention, because every later task writes through this. Feature-spec FR-14 (product-spec FR-32) requires a share assertion's fraction to be stored exactly as asserted — an unreduced numerator/denominator pair — with no normalization at write time; the log's generic append/read API already stores whatever value shape it is given verbatim, so this is a confirmation of existing behaviour, not new work, and estimate is unchanged.
**Done:** [ ]

### Task 5: Entity model
**What:** Party, Account, Work, Recording, Release, and Registration as distinct entity types over the assertion log.
**Files:** `src/main/vault/entities.ts`, `src/shared/types/entities.ts`
**Done when:** All six types are defined and instantiable; Party and Account are separate types with no shared identity; creating a vault produces exactly one Account and multiple coexisting Party entities under it — not merely "at least one" — with the share relationship exercised across several distinct Parties (the spec's worked example: three co-writers each holding 1/3 of a work); relationships between works, recordings, releases, and parties are representable; a party's fractional share in a work is representable as a relationship carrying the fraction, stored exactly as asserted as an unreduced numerator/denominator pair, and a work's registration state with a named registry is representable; both are storable while incomplete — a share set that does not sum to unity, or a registration whose state is unknown, persists without a placeholder value.
**Depends on:** 4
**Estimate:** 5
**Notes:** Satisfies feature-spec FR-1, FR-2, and FR-14 (product-spec FR-1, FR-2, and FR-32). Party/Account separation is the one-way door identified in the concept — a shared type here is a rewrite for the label tier, not a refactor. **Shares are modelled here even though nothing populates them until Feature 4.** A share is a three-way fact (party, work, fraction), not a string on a work; modelled as a string it cannot be validated, summed, or conflict-resolved, and the annotations layer swallows it. Store a fraction rather than a percentage, and store it unreduced — MLC and PRO sources disagree on percent, decimal, and twelfths, and a percentage-typed field bakes a lossy conversion into the boundary; reducing at write time would store something other than what was asserted, which contradicts the assertion log's exact-retrieval guarantee (feature-spec FR-3/FR-4). Normalization for comparison and summation is explicitly Task 6's concern, not this one's. Adding this relationship after the log is populated rewrites history the concept exists to preserve, so it lands now and stays empty until ingest arrives. Multiple Party entities per vault under one Account is a decided requirement (feature-spec FR-2, OQ-6), not merely permitted — the "at least one Party" done-when has been strengthened accordingly, though this does not add new modelling work since Party plurality was already structurally supported; estimate is unchanged at 5. Estimate raised from 3 to 5 (prior to this amendment) on the share-modelling basis above.
**Done:** [ ]

### Task 6: Projection and conflict retention
**What:** Derive a field's current value from its assertions, retain conflicting assertions, expose full per-field history, and normalize share fractions for comparison and summation.
**Files:** `src/main/vault/projection.ts`, `src/shared/types/projection.ts`
**Done when:** Given multiple assertions on one field, the current value resolves deterministically by a documented rule; two conflicting assertions are both retrievable after resolution; full history for any field is queryable in order; a field whose current user-asserted value contradicts a retained registry-issued assertion reports that override, and the superseded registry value and its issuing source, without a second query; given a work's share assertions stored as unreduced numerator/denominator pairs, the projection normalizes them (common-denominator reduction/LCM) to compare and sum shares correctly, without ever rewriting the stored assertions themselves.
**Depends on:** 4, 5
**Estimate:** 8
**Notes:** Satisfies feature-spec FR-4 and FR-5 (product-spec FR-4 and FR-5). **The conflict-resolution rule is now decided and specified** (feature-spec FR-9, tracing to product spec Constraints/FR-30): when a user-asserted assertion and a registry-issued assertion disagree about a field, the user's assertion is the current value, the registry-issued assertion is retained, and the projection MUST expose the override so display surfaces can mark it. Implement that as part of the projection's return shape — an overridden-registry-value flag alongside the current value — rather than leaving each consumer to re-derive it from the history. **New scope from the fraction-representation decision (feature-spec FR-14, OQ-2):** shares are stored unreduced at write time (Task 4/5), so this task now owns GCD/LCM normalization for comparison and summation — arithmetic that was not previously scoped here. Estimate raised from 5 to 8 on that basis: the override-flag work already justified the prior raise from 3 to 5, and the normalization arithmetic is a distinct, additional piece of logic on top of it, not a refinement of it.
**Done:** [ ]

### Task 7: Share-integrity detection
**What:** A pure module that, given a work's projected share set, determines whether the shares sum to unity and reports the actual total and the shortfall or over-allocation.
**Files:** `src/main/vault/share-integrity.ts`, `src/main/vault/share-integrity.test.ts`
**Done when:** Given a work's projected current share values, the module reports whether they sum to unity, and when they do not, the actual total and the shortfall or over-allocation; unreduced numerator/denominator pairs are normalized via GCD/LCM consistent with Task 6's projection-layer normalization before summing; a work with no shares recorded is reported as absent (unknown), distinct from a work with shares recorded that do not sum to unity (incomplete); the module never blocks, rejects, or refuses a write — it is a pure read-side check with no write-path or UI dependency.
**Depends on:** 5, 6
**Estimate:** 2
**Notes:** Satisfies no requirement alone — it is the shared mechanism behind feature-spec FR-15 (product-spec FR-33), consumed by Task 9 (the compact list-row indicator) and Task 14 (full surfacing on expanded share views). It is the first piece of the v1 verification layer pulled into MVP, so it must stay independent of the storage path in order to be reusable by v1 discrepancy work. Off the critical path; runs parallel to Task 8 (both depend only on Tasks 5 and 6), but must land before Task 9 and Task 14 can consume it. This task's number places it in its natural dependency position, between Tasks 6 and 8 — see the Summary note that task numbers are stable labels and the dependency graph determines execution order.
**Done:** [ ]

### Task 8: Manual entity creation
**What:** Create works, recordings, releases, and parties by hand through the interface.
**Files:** `src/main/ipc/entity-handlers.ts`, `src/renderer/views/entity-create.tsx`
**Done when:** A user can create each of the four types; every created field is stored as a user-asserted assertion with the acting Account recorded; a created entity survives close and reopen.
**Depends on:** 2, 5, 6
**Estimate:** 5
**Notes:** Satisfies feature-spec FR-6 (product-spec FR-15). First task producing observable user value and the first end-to-end exercise of the log.
**Done:** [ ]

### Task 9: Catalog browse and navigation
**What:** List works, recordings, releases, parties, and registrations, move between related entities, and surface a compact share-integrity indicator on catalog list rows for works with non-unity share sets.
**Files:** `src/renderer/views/catalog.tsx`, `src/renderer/views/entity-detail.tsx`
**Done when:** All five types are listable; from a recording a user can reach its work, its release, and its contributing parties, and navigate back; an empty vault renders without error; a work whose shares do not sum to unity displays a compact indicator in its bare catalog list row, without the row expanding shares.
**Depends on:** 7, 8
**Estimate:** 6
**Notes:** Satisfies feature-spec FR-10 (product-spec FR-18). **New scope from feature-spec FR-15 (OQ-3):** share-integrity surfacing must reach bare, unexpanded catalog list rows, not just detail views — this task must now query and render that data, which it previously had no need for. This task consumes Task 7's `share-integrity.ts` module for the underlying unity check rather than building its own — it is responsible only for querying that module per row and rendering the compact indicator. Estimate raised from 5 to 6 for the query/render work now that the detection logic itself is Task 7's.
**Done:** [ ]

### Task 10: Additive field editing
**What:** Edit any field, recording the change as a new assertion rather than a mutation.
**Files:** `src/renderer/components/field-editor.tsx`, `src/main/ipc/entity-handlers.ts`
**Done when:** Editing a field appends a new user-asserted assertion; the prior assertion remains retrievable; no existing assertion is deleted or altered, verified by inspecting the log after an edit.
**Depends on:** 6, 8
**Estimate:** 3
**Notes:** Satisfies feature-spec FR-7 (product-spec FR-16).
**Done:** [ ]

### Task 11: Provenance display
**What:** Surface where any displayed value came from, and its history, with an override marking that renders as two treatments from one shared flag.
**Files:** `src/renderer/components/provenance-view.tsx`, `src/main/ipc/provenance-handlers.ts`
**Done when:** From any value shown in the interface, a user reaches its source, actor, timestamp, and source class within one interaction; the full assertion history for that field is viewable from the same place. A value that is a user-asserted override of a retained registry-issued assertion carries a persistent visual marking wherever it is displayed — list, detail, and export preview — with no interaction required to see it, and the superseded registry value and its issuing source are reachable within one interaction from that marking. That marking renders as two distinct treatments driven by one shared "is this overridden" flag: a full marker (icon plus label) in detail view, and a minimal indicator in list and dense views, so the two treatments cannot diverge from each other.
**Depends on:** 6, 9
**Estimate:** 8
**Notes:** Satisfies feature-spec FR-11 and FR-9 (product-spec FR-19 and FR-30). The one-interaction bound is the requirement — a provenance view reachable only through a separate screen does not meet it. FR-9 is the stricter half: the override marking is *zero*-interaction and must survive every surface a value appears on, so it belongs to the shared value-rendering component rather than to individual views. **Decided at the gate (feature-spec OQ-1):** rather than one persistent treatment, this is now two treatments — full marker in detail, minimal indicator in list/dense — both reading the same shared flag so they cannot diverge. That is a second render path, not a restyle of the first. Estimate raised from 5 to 8 on that basis (previously raised from 3 to 5 for the zero-interaction requirement alone). The marking needs a Saboteur token treatment agreed in Task 2 — it is a standing state, not an alert, so an alarm colour would be wrong.
**Done:** [ ]

### Task 12: Contradiction warning on edit
**What:** Warn before committing an edit that contradicts a registry-issued value, naming the issuing source.
**Files:** `src/renderer/components/contradiction-warning.tsx`, `test/fixtures/registry-assertions.ts`
**Done when:** Editing a field whose current value is registry-issued presents a warning identifying the source before the assertion is written; the user can proceed or cancel; cancelling writes nothing.
**Depends on:** 10, 11
**Estimate:** 2
**Notes:** Satisfies feature-spec FR-8 (product-spec FR-17). **Not naturally testable in this feature** — no import exists yet, so no registry-issued assertions can arise through normal use. Build against seeded fixtures with source class set to registry-issued, and treat those fixtures as a deliverable, since Features 4 and 5 will need them too. Those fixtures must carry share and registration-state data as well as plain identifiers — otherwise Feature 4 arrives with no seeded example of the shape it is importing into, and Task 14 has nothing to exercise.
**Done:** [ ]

### Task 13: Offline guarantee
**What:** Verify and enforce that the application performs every function without network access and transmits no vault contents.
**Files:** `test/offline.spec.ts`, `scripts/check-no-network.ts`, `.github/workflows/build.yml`
**Done when:** All functionality from Tasks 3–12 works with networking disabled; an automated check fails the build if vault codepaths acquire an outbound network dependency.
**Depends on:** 12
**Estimate:** 2
**Notes:** Satisfies feature-spec FR-13 (product-spec FR-25). The automated check matters more than the manual verification — this feature is offline by default, but Feature 5 introduces the first network client, and this guard is what keeps that from leaking into the vault core.
**Done:** [ ]

### Task 14: Share integrity surfacing
**What:** Surface the share-integrity condition wherever a work's shares are shown in expanded form.
**Files:** `src/renderer/components/share-list.tsx`
**Done when:** A work whose recorded shares sum to less than or more than unity displays that condition wherever its shares appear, stating the actual total; a work with no shares recorded is not reported as under-allocated; storing or editing a non-summing share set is never blocked or rejected; the check runs over projected current values rather than raw assertions.
**Depends on:** 5, 7, 9
**Estimate:** 3
**Notes:** Satisfies feature-spec FR-15 (product-spec FR-33). **This detects and reports; it never validates.** Refusing to store a set summing to 87% refuses to store the truth — real catalogs have genuinely unresolved splits, and a vault that cannot hold one sends the user back to the spreadsheet. Distinguish absent from incomplete — no shares recorded is unknown, not wrong. This task consumes Task 7's `share-integrity.ts` module rather than owning or building it; its scope is the expanded share-list surface (and any other non-list-row surface a work's shares appear on) rendering what Task 7 reports. Estimate reduced from 5 to 3 now that the detection module and the list-row consolidation are Task 7's and Task 9's concerns respectively, leaving only this surface's rendering work. Off the critical path; runs parallel to Tasks 10-12.
**Done:** [ ]

## Summary

Task numbers are stable labels; the dependency graph determines execution order, not the numbering.

- **Total tasks:** 14
- **Total estimated effort:** 62 points (5 + 5 + 3 + 5 + 5 + 8 + 2 + 5 + 6 + 3 + 8 + 2 + 2 + 3 = 62, for Tasks 1–14 in order).
- **Critical path:** 1 → 3 → 4 → 5 → 6 → 8 → 9 → 11 → 12 → 13 (5 + 3 + 5 + 5 + 8 + 5 + 6 + 8 + 2 + 2 = 49 points). Task 6 completes at 26 accumulated points (5+3+5+5+8). Task 7 (share-integrity detection) depends only on Tasks 5 and 6, same as Task 8, and finishes before Task 8 does (26+2=28 points of accumulated work through Task 7 vs. 26+5=31 through Task 8), so it runs parallel to Task 8 and does not extend the path even though Task 9 now depends on it. Task 2 runs parallel to Tasks 3–6 and must land before Task 8; Task 10 runs parallel to Task 9; Task 14 runs parallel to Tasks 10–12.
- **Risks:**
  - **Task 2 carries hidden integration work.** shadcn/ui's default token vocabulary conflicts with `saboteur-base.css`, and accepting the defaults silently violates the styles repo's central rule. Budgeted at 5 points on that basis; if the remapping proves deeper it will grow.
  - **Task 6's conflict-resolution rule is decided** (user-asserted wins as current, registry-issued retained, override marked — feature-spec FR-9). The residual risk moved to Task 11: the marking must appear on every surface a value renders on, which is a shared-component constraint rather than a per-view one.
  - **Task 12 cannot be validated through normal use** in this feature and depends on fixtures that will outlive it.
  - **Task 3's storage choice is provisional** until Feature 2 publishes the format specification; keep storage isolated or that publication becomes a rewrite.
  - **Share modelling lands ahead of its consumer.** Feature-spec FR-14 and FR-15 (product-spec FR-32/FR-33) are exercised only by fixtures and hand entry until Feature 4 ships, so a modelling error here surfaces late. The fixtures from Task 12 are the only defence, which raises their value further.
  - **Sequential shape.** Ten of fourteen tasks sit on the critical path, so this feature parallelises poorly across people — consistent with its size flag in the feature breakdown.
  - **RESOLVED — Task 9/Task 14 sequencing tension on share-integrity surfacing.** Feature-spec FR-15's decision that non-unity shares must surface on bare, unexpanded catalog list rows originally meant Task 9 (which builds those rows) needed a unity-sum check before Task 14 (which owned the canonical `share-integrity.ts` module and depended on Task 9) existed. The narrative fix considered — Task 9 shipping a throwaway inline check for Task 14 to later consolidate — was rejected as duplicate-then-consolidate work that could drift and left unforced work on the critical path. Resolved instead by extracting detection into Task 7, landing before both, which Task 9 and Task 14 now consume rather than build.
  - **NEW — Task 6 and Task 11 both grew from decided gate outputs, not from new discovery.** The fraction-normalization arithmetic (Task 6) and the two-treatment override marking (Task 11) were both explicit user decisions rather than emergent risks, so their estimate increases are firmer than the speculative risk-driven raises elsewhere in this list — but they still move the critical path from 42 to 49 points, which should be re-confirmed against the timeline this feature was originally scheduled against.

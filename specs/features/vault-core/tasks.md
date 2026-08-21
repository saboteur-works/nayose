# Tasks: Feature 1 — Vault with hand-entered catalog

**Feature source:** `specs/product/nayose.features.md`
**Spec source:** `specs/product/nayose.md` — FR-1–FR-5, FR-15–FR-19, FR-24, FR-25 (US-5, US-6, US-7, US-8)
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
**Notes:** Establishes FR-24 and the offline posture of FR-25. Contains no vault logic and no styling — platform and IPC problems should surface before anything depends on them. Context isolation on, node integration off in the renderer.
**Done:** [ ]

### Task 2: Saboteur design system integration
**What:** Wire the Saboteur brand tokens into the renderer and reconcile shadcn/ui primitives against them.
**Files:** `src/renderer/styles/index.css`, `src/renderer/styles/nayose-theme.css`, `tailwind.config.ts`, `components.json`, `src/renderer/components/ui/*`
**Done when:** `saboteur-base.css` is imported and its tokens resolve as Tailwind v4 utilities and CSS custom properties in the renderer; a rendered sample of button, card, input, and badge matches the Storybook `Examples/UI Primitives` treatment; no colour, font, weight, radius, or spacing value outside `saboteur-base.css` appears in product CSS, verified by review against `docs/tokens.md`.
**Depends on:** 1
**Estimate:** 5
**Notes:** **shadcn/ui ships its own token vocabulary** (`--background`, `--foreground`, `--radius`, and the rest) which will not match Saboteur's. Remapping those to Saboteur tokens is the substance of this task, not a detail — take defaults as they come and the app silently violates the styles repo's core rule. Two further points: this is the first **desktop** Saboteur product, while `docs/products.md` covers web products only, so a new entry there is required and lands in a different repository; and GetWrite is the nearest sibling (local-first, studio-shaped, restrained red) and the closest reference for colour tempo.
**Done:** [ ]

### Task 3: Vault file lifecycle
**What:** Create, open, close, and persist a vault as a single file at a user-chosen path.
**Files:** `src/main/vault/vault-file.ts`, `src/main/ipc/vault-handlers.ts`, `src/shared/types/vault.ts`
**Done when:** A user can create a new vault, close the application, reopen the file, and observe identical contents. Opening a file that is not a vault fails with a clear message rather than a crash or partial load.
**Depends on:** 1
**Estimate:** 3
**Notes:** Partially satisfies FR-1. Storage format chosen here is provisional — Feature 2 publishes the format specification and may force revision, so keep the boundary between storage and everything above it clean.
**Done:** [ ]

### Task 4: Append-only assertion log
**What:** The storage primitive: assertions carrying actor, timestamp, source, and source class, appended and read back in order.
**Files:** `src/main/vault/assertion-log.ts`, `src/shared/types/assertion.ts`
**Done when:** An assertion can be appended and retrieved with all four attributes intact; assertions return in a stable order; the API exposes no update or delete operation, verified by test.
**Depends on:** 3
**Estimate:** 5
**Notes:** Satisfies FR-3. The absence of mutation is the requirement — enforce it in the interface rather than by convention, because every later task writes through this.
**Done:** [ ]

### Task 5: Entity model
**What:** Party, Account, Work, Recording, Release, and Registration as distinct entity types over the assertion log.
**Files:** `src/main/vault/entities.ts`, `src/shared/types/entities.ts`
**Done when:** All six types are defined and instantiable; Party and Account are separate types with no shared identity; creating a vault produces exactly one Account and at least one Party; relationships between works, recordings, releases, and parties are representable.
**Depends on:** 4
**Estimate:** 3
**Notes:** Satisfies FR-1 and FR-2. Party/Account separation is the one-way door identified in the concept — a shared type here is a rewrite for the label tier, not a refactor.
**Done:** [ ]

### Task 6: Projection and conflict retention
**What:** Derive a field's current value from its assertions, retain conflicting assertions, and expose full per-field history.
**Files:** `src/main/vault/projection.ts`, `src/shared/types/projection.ts`
**Done when:** Given multiple assertions on one field, the current value resolves deterministically by a documented rule; two conflicting assertions are both retrievable after resolution; full history for any field is queryable in order.
**Depends on:** 4, 5
**Estimate:** 5
**Notes:** Satisfies FR-4 and FR-5. **Contains an unresolved design decision:** the spec does not state which assertion wins when a user-asserted value conflicts with a registry-issued one. FR-16 requires the registry-issued assertion be retained and FR-17 requires warning on contradiction, which together imply the user's value displays as current while the registry value persists and is flagged — but that is inference, not specification. Settle it explicitly here and record the rule, because every display surface inherits it.
**Done:** [ ]

### Task 7: Manual entity creation
**What:** Create works, recordings, releases, and parties by hand through the interface.
**Files:** `src/main/ipc/entity-handlers.ts`, `src/renderer/views/entity-create.tsx`
**Done when:** A user can create each of the four types; every created field is stored as a user-asserted assertion with the acting Account recorded; a created entity survives close and reopen.
**Depends on:** 2, 5, 6
**Estimate:** 5
**Notes:** Satisfies FR-15. First task producing observable user value and the first end-to-end exercise of the log.
**Done:** [ ]

### Task 8: Catalog browse and navigation
**What:** List works, recordings, releases, parties, and registrations, and move between related entities.
**Files:** `src/renderer/views/catalog.tsx`, `src/renderer/views/entity-detail.tsx`
**Done when:** All five types are listable; from a recording a user can reach its work, its release, and its contributing parties, and navigate back; an empty vault renders without error.
**Depends on:** 7
**Estimate:** 5
**Notes:** Satisfies FR-18.
**Done:** [ ]

### Task 9: Additive field editing
**What:** Edit any field, recording the change as a new assertion rather than a mutation.
**Files:** `src/renderer/components/field-editor.tsx`, `src/main/ipc/entity-handlers.ts`
**Done when:** Editing a field appends a new user-asserted assertion; the prior assertion remains retrievable; no existing assertion is deleted or altered, verified by inspecting the log after an edit.
**Depends on:** 6, 7
**Estimate:** 3
**Notes:** Satisfies FR-16.
**Done:** [ ]

### Task 10: Provenance display
**What:** Surface where any displayed value came from, and its history.
**Files:** `src/renderer/components/provenance-view.tsx`, `src/main/ipc/provenance-handlers.ts`
**Done when:** From any value shown in the interface, a user reaches its source, actor, timestamp, and source class within one interaction; the full assertion history for that field is viewable from the same place.
**Depends on:** 6, 8
**Estimate:** 3
**Notes:** Satisfies FR-19. The one-interaction bound is the requirement — a provenance view reachable only through a separate screen does not meet it.
**Done:** [ ]

### Task 11: Contradiction warning on edit
**What:** Warn before committing an edit that contradicts a registry-issued value, naming the issuing source.
**Files:** `src/renderer/components/contradiction-warning.tsx`, `test/fixtures/registry-assertions.ts`
**Done when:** Editing a field whose current value is registry-issued presents a warning identifying the source before the assertion is written; the user can proceed or cancel; cancelling writes nothing.
**Depends on:** 9, 10
**Estimate:** 2
**Notes:** Satisfies FR-17. **Not naturally testable in this feature** — no import exists yet, so no registry-issued assertions can arise through normal use. Build against seeded fixtures with source class set to registry-issued, and treat those fixtures as a deliverable, since Features 4 and 5 will need them too.
**Done:** [ ]

### Task 12: Offline guarantee
**What:** Verify and enforce that the application performs every function without network access and transmits no vault contents.
**Files:** `test/offline.spec.ts`, `scripts/check-no-network.ts`, `.github/workflows/build.yml`
**Done when:** All functionality from Tasks 3–11 works with networking disabled; an automated check fails the build if vault codepaths acquire an outbound network dependency.
**Depends on:** 11
**Estimate:** 2
**Notes:** Satisfies FR-25. The automated check matters more than the manual verification — this feature is offline by default, but Feature 5 introduces the first network client, and this guard is what keeps that from leaking into the vault core.
**Done:** [ ]

## Summary

- **Total tasks:** 12
- **Total estimated effort:** 46 points
- **Critical path:** 1 → 3 → 4 → 5 → 6 → 7 → 8 → 10 → 11 → 12 (38 points). Task 2 runs parallel to Tasks 3–6 and must land before Task 7; Task 9 runs parallel to Task 8.
- **Risks:**
  - **Task 2 carries hidden integration work.** shadcn/ui's default token vocabulary conflicts with `saboteur-base.css`, and accepting the defaults silently violates the styles repo's central rule. Budgeted at 5 points on that basis; if the remapping proves deeper it will grow.
  - **Task 6 carries an unresolved design decision** — the conflict-resolution rule between user-asserted and registry-issued values. Every display surface inherits it, so deciding late means changing several tasks.
  - **Task 11 cannot be validated through normal use** in this feature and depends on fixtures that will outlive it.
  - **Task 3's storage choice is provisional** until Feature 2 publishes the format specification; keep storage isolated or that publication becomes a rewrite.
  - **Sequential shape.** Ten of twelve tasks sit on the critical path, so this feature parallelises poorly across people — consistent with its size flag in the feature breakdown.

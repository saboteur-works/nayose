# Tasks: Feature 2 — Export and Published Format

**Feature source:** `specs/product/nayose.features.md`
**Spec source:** `specs/features/export-format.md` (feature FR-1–FR-8), tracing back to `specs/product/nayose.md` — FR-20–FR-23, FR-26–FR-29 (US-9, US-10)
**Branch:** `feat/export-format`
**Depends on:** Feature 1 (`specs/features/vault-core.md`, merged to `main`)
**Granularity:** story points (1/2/3/5/8)

> **Stack:** TypeScript + Electron, matching Feature 1. Export and format-reading logic are domain logic and live in the main process (`src/main/vault/`, `src/main/ipc/`); the renderer only triggers export and displays results over IPC.
>
> **Offline posture:** `npm run check:no-network` (`scripts/check-no-network.ts`) already statically guards `src/main/vault/**`, `src/main/ipc/**`, and `src/shared/**`. New export files placed under those roots are covered automatically; nothing in this feature needs a network dependency.
>
> **Provisional envelope becomes the published contract.** `src/shared/types/vault.ts` and `src/main/vault/vault-file.ts` are the only two files that know the on-disk shape (per `docs/architecture.md`). This feature keeps that boundary intact rather than growing a second one: export goes through a named serialization function in `vault-file.ts`, never `fs.copyFile`, so a future derived export format can be introduced behind that boundary without changing callers (feature-spec Overview constraints, OQ-4 resolution).

### Task 1: Vault open/create UI
**What:** A renderer UI that lets a user create a new vault, open an existing one, and close it, wired to the `vault:create` / `vault:open` / `vault:close` channels already exposed in `src/main/preload.ts`.
**Files:** `src/renderer/App.tsx`, `src/renderer/views/vault-lifecycle.tsx`, `src/renderer/views/vault-lifecycle-logic.ts`, `src/renderer/views/vault-lifecycle-logic.test.ts`
**Done when:** A user can create a new vault at a chosen path from the interface, close the application, reopen that file from the interface, and observe identical contents; opening a file that is not a vault surfaces the returned error message in the UI rather than failing silently or crashing. The existing `VaultCreateResult` / `VaultOpenResult` canceled-vs-failure distinction is handled — a canceled dialog is not reported as an error.
**Depends on:** none
**Estimate:** 3
**Notes:** This closes a gap in Feature 1 rather than adding new product scope: Feature 1's Task 3 ("Vault file lifecycle") carries the done-when "A user can create a new vault, close the application, reopen the file, and observe identical contents," but its Files field listed only main-process modules, so the user-facing half was never built. The IPC channels and main-process handlers already exist and work; this task supplies only the renderer surface that calls them. Enables feature-spec FR-1 (product-spec FR-20) and feature-spec FR-8 (product-spec FR-29) by making both demonstrable through the interface. Follow the existing house pattern in `src/renderer/views/`; use React + shadcn/ui with the Saboteur design system already wired up in Feature 1.
**Done:** [ ]

### Task 2: Export serialization boundary
**What:** A named `exportVault` function in the main process that serializes the current vault envelope to a user-chosen path through the existing JSON write primitive, not a file copy.
**Files:** `src/main/vault/vault-file.ts`, `src/main/vault/vault-file.test.ts`, `src/main/vault/vault-session.ts`, `src/main/vault/vault-session.test.ts`, `src/shared/types/vault.ts`
**Done when:** `vault-file.ts` exposes an `exportVault(path, vault)` (or equivalently named) function that builds the envelope the same way `persistSession`/`writeVaultFile` already do and writes it via `writeVaultFile`; calling it does not invoke `fs.copyFile` anywhere in the implementation (verified by code review and a unit test asserting the module has no `fs.copyFile` import); calling it with no vault open returns a typed error rather than throwing.
**Depends on:** none
**Estimate:** 3
**Notes:** Satisfies feature-spec FR-1 (product-spec FR-20), partially — this task is the serialization boundary only; Task 3 wires it to the user. This is the concrete seam OQ-4's resolution requires: the exported artifact and the live vault file are the same artifact for MVP, but export MUST NOT be `fs.copyFile`, so that a future derived export format can be introduced behind this boundary without touching `vault-session.ts` or the IPC layer. Reuses `VAULT_FORMAT_MARKER`/`VAULT_FORMAT_VERSION`/`writeVaultFile` from Task 3 of Feature 1 rather than duplicating envelope-building logic.
**Done:** [ ]

### Task 3: Export IPC handler and renderer trigger
**What:** A user-facing "Export Vault" action that lets a musician choose a save location and produces a complete export via Task 2's serialization boundary.
**Files:** `src/main/ipc/vault-handlers.ts`, `src/main/ipc/vault-handlers.test.ts`, `src/main/preload.ts`, `src/renderer/views/vault-lifecycle.tsx`, `src/renderer/views/vault-lifecycle-logic.ts`, `src/renderer/views/vault-lifecycle-logic.test.ts`, `src/shared/types/vault.ts`
**Done when:** A user with an open vault can trigger export from the interface, choose a destination via a save dialog, and the resulting file is written through `exportVault`; the action requires no payment, account, or network access; the exported file, reopened via the existing `vault:open` path, validates successfully and contains the complete vault including full assertion history.
**Depends on:** 1, 2
**Estimate:** 3
**Notes:** Satisfies feature-spec FR-1 (product-spec FR-20). "Complete vault, no cost, no account, offline" are the done-when's testable restatement of FR-1's exact wording — export scope is the whole vault or nothing, per the feature spec's Non-goals (no selective/partial export, product-spec FR-20). Depends on Task 1 in addition to Task 2 because "a user with an open vault" presupposes the open-vault UI that task builds — without it there is no interface path to an open vault for export to trigger from.
**Done:** [ ]

### Task 4: Round-trip re-import test
**What:** An automated test proving an exported vault re-imports without losing any assertion or its provenance.
**Files:** `test/export-roundtrip.spec.ts`
**Done when:** A test populates a vault with assertions spanning multiple entity types, both source classes (user-asserted and registry-issued), an override case, and an unreduced share fraction; exports it via Task 3's path; reopens the exported file; and asserts every assertion — including `actor`, `timestamp`, `source`, and `sourceClass` — is present and unchanged, and that projected current values (including the override marking) match the pre-export vault.
**Depends on:** 3
**Estimate:** 3
**Notes:** Satisfies feature-spec FR-2 (product-spec FR-21). This is the genuine round-trip test the feature spec's Goals section requires ("An exported vault can be re-imported without losing any assertion or its provenance") — a test that only checks the file exists or is valid JSON would not discharge this FR.
**Done:** [ ]

### Task 5: Published format specification document
**What:** The written, versioned specification of the on-disk vault format, published at `docs/format/v1.md`, detailed enough to be the FR-4 reader's only permitted input.
**Files:** `docs/format/v1.md`
**Done when:** `docs/format/v1.md` exists and documents: the envelope (`nayoseVault` marker, `formatVersion`, `body`); the assertion shape (`entityId`, `fieldName`, `value`, `actor`, `timestamp`, `source`, `sourceClass`) and the log's append-only, ordered semantics; the entity model's `$type`-assertion convention and the `share:{partyId}` field-name convention for Party/Work share relationships; the projection/conflict-resolution rule (user-asserted wins as current, most-recent-by-append-order tie-break within a source class, registry-issued retained and exposed as an override with source and superseded value); that share fractions are stored unreduced and normalized only at read time via GCD/LCM; and the version field's exact-match-or-refuse behaviour. The document's own preamble states the never-overwrite policy: once published, `docs/format/vN.md` is never edited or deleted, and any change ships as a new version file.
**Depends on:** none
**Estimate:** 5
**Notes:** Satisfies feature-spec FR-3 and, for its preamble policy statement, FR-7 (product-spec FR-22 and FR-28). No `CONTRIBUTING.md` currently exists in this repository, so the OQ-5 resolution's "and in CONTRIBUTING if one exists" clause is inapplicable for now — the preamble alone carries the policy; add it to CONTRIBUTING.md if one is created later. This document is real, load-bearing work, not boilerplate: it is the sole input Task 6's reader is permitted to consult (feature-spec OQ-3's governing rule), so any gap here becomes a defect discovered only when someone tries to build against it — write it as if the TypeScript source will not be available to cross-check.
**Done:** [ ]

### Task 6: Independent reader implementation
**What:** A standalone Python 3 CLI that reads a vault export using only `docs/format/v1.md`, proving the published specification is sufficient on its own.
**Files:** `tools/format-reader/read_vault.py`, `tools/format-reader/fixtures/sample-vault.json`
**Done when:** A single-file, standard-library-only Python 3 script at `tools/format-reader/read_vault.py`, invoked as `python3 read_vault.py <vault.json>`, (1) reads the declared `formatVersion` and refuses any version it does not support, reporting the declared version; (2) reconstructs current field values from the assertion log by reimplementing projection, including the user-asserted-wins conflict rule; (3) surfaces each value's provenance and the user-over-registry override marking. It does not perform share-integrity summation, writing, editing, or any rendering/GUI. A committed fixture vault at `tools/format-reader/fixtures/sample-vault.json` exercises a plain field, a conflict/override case, and a share fraction, and the script runs successfully against it via bare `assert` statements with no test framework.
**Depends on:** 5
**Estimate:** 8
**Notes:** Satisfies feature-spec FR-4 (product-spec FR-23). Ordered after Task 5 deliberately: per OQ-3's governing rule, the reader MUST be written using only `docs/format/v1.md` as source, and if its author needs to consult the TypeScript to make it work, that is a defect in the document requiring the document to be amended — never a reason to consult the source and move on. Writing the reader before the doc exists would make that rule unenforceable. No third-party packages, no `requirements.txt`, no virtualenv — `json` is the only stdlib module this needs. Explicitly excludes share-integrity summation per the feature spec's Non-goals: that is a derived business rule on top of projection, not a test of whether the assertion-to-current-value semantics are documented.
**Done:** [ ]

### Task 7: CI job for the independent reader
**What:** A new, isolated CI job that runs the FR-4 reader against its fixture vault on every push and PR.
**Files:** `.github/workflows/build.yml`
**Done when:** `build.yml` gains a new job, pinned to `runs-on: ubuntu-latest` only (not part of the existing `[macos-latest, windows-latest, ubuntu-latest]` matrix), that checks out the repo, sets up Python 3, and runs `python3 tools/format-reader/read_vault.py tools/format-reader/fixtures/sample-vault.json`; the workflow fails if the script raises or its `assert` statements fail; the existing 3-OS application build job is unmodified.
**Depends on:** 6
**Estimate:** 2
**Notes:** Satisfies feature-spec FR-4 (product-spec FR-23), the CI half. Per the feature spec's Overview constraints and OQ-3's cap: the reader's correctness does not vary by platform, so running it three times would triple cost for no additional evidence — it MUST NOT be added to the existing matrix.
**Done:** [ ]

### Task 8: Version-refusal surfacing and coverage
**What:** Confirm and finish the version-declaration and refusal behaviour FR-5, FR-6, and FR-8 require, surfacing the refusal to the user and proving it with tests.
**Files:** `src/main/vault/vault-file.test.ts`, `src/renderer/views/vault-lifecycle-logic.test.ts`
**Done when:** A test opens a file whose `formatVersion` does not match `VAULT_FORMAT_VERSION` and asserts `validateVaultEnvelope` returns `reason: 'unsupported-version'` with a message stating the declared version (FR-5, FR-8); the renderer displays that message to the user when `vault:open` returns this failure, rather than swallowing it or showing a generic error; a test or code-level check confirms `VAULT_FORMAT_VERSION` (`src/shared/types/vault.ts`) is not derived from and does not influence the application's `package.json` version, and vice versa (FR-6).
**Depends on:** 1
**Estimate:** 3
**Notes:** Satisfies feature-spec FR-5, FR-6, and FR-8 (product-spec FR-26, FR-27, FR-29). FR-5 and FR-8 are already largely met by `validateVaultEnvelope` in `src/main/vault/vault-file.ts`, which exact-matches `formatVersion` and already reports the declared version in its error message — per the feature spec's OQ-1 resolution, this is deliberately the chosen versioning scheme, not something to rebuild. This task is scoped to what is genuinely missing: proof by test, and surfacing that existing error to the user in the renderer, which nothing currently does. Depends on Task 1 because the renderer error display lives in the open-vault UI that task builds — there is no existing caller of `vault:open` to attach this surfacing to otherwise.
**Done:** [ ]

### Task 9: Offline coverage for export
**What:** Extend the offline guarantee to cover the export path added by this feature.
**Files:** `test/offline.spec.ts`
**Done when:** `offline.spec.ts` is extended to exercise Task 3's export action with networking disabled and asserts it succeeds and writes the expected file; `npm run check:no-network` continues to pass with export's new files in place (they live under the already-scanned `src/main/vault/` and `src/main/ipc/` roots, so no scanner changes are needed).
**Depends on:** 3
**Estimate:** 1
**Notes:** Extends feature-spec FR-1's "without... network access" clause and the Overview's inherited offline constraint (product-spec FR-25), which Feature 1's Task 13 established. No changes to `scripts/check-no-network.ts` itself are required — its `SCAN_ROOTS` already cover this feature's files by construction, since export logic lands in `src/main/vault/` and `src/main/ipc/` rather than a new directory.
**Done:** [ ]

## Summary

Task numbers are stable labels; the dependency graph determines execution order, not the numbering.

- **Total tasks:** 9
- **Total estimated effort:** 31 points (3 + 3 + 3 + 3 + 5 + 8 + 2 + 3 + 1 = 31, for Tasks 1–9 in order).
- **Critical path:** 5 → 6 → 7 (5 + 8 + 2 = 15 points). This is longer than the export-and-test chain 1 → 3 → 4 (3 + 3 + 3 = 9 points) or 1 → 3 → 9 (3 + 3 + 1 = 7 points), because Task 6's reader cannot start until Task 5's specification document is written and stable (OQ-3's governing rule), and Task 7's CI job cannot start until Task 6's reader exists. Task 8 (version-refusal surfacing) depends only on Task 1 and runs in parallel with both the doc→reader→CI chain and the export chain.
- **Risks:**
  - **This feature absorbs a gap left by Feature 1.** Feature 1's Task 3 ("Vault file lifecycle") was reported complete with the done-when "A user can create a new vault, close the application, reopen the file, and observe identical contents," but its Files field listed only main-process modules — the user-facing renderer half of that done-when was never built, and nothing caught the gap until this feature's Task 3 and Task 8 done-whens turned out to depend on a renderer caller of `vault:open`/`vault:create` that does not exist. Task 1 of this feature builds that missing UI. Future done-when review should check that a done-when phrased as a user-observable action ("a user can...") is backed by a Files entry that actually reaches the renderer, not just the main process.
  - **Task 5 is the single point of failure for Tasks 6 and 7.** If the specification document has a gap, the correct remedy is to amend `docs/format/v1.md`, not to let Task 6's author consult the TypeScript source — per OQ-3's governing rule, doing so silently would make the reader prove nothing. Budget slack in Task 6 for at least one round-trip back to Task 5.
  - **Task 6 carries most of the feature's estimation uncertainty.** It is the only task in a different language and runtime than the rest of the codebase, and its required depth (reimplementing projection and conflict resolution from documentation alone) is the substantive evidentiary burden of FR-4, not incidental scope. Budgeted at 8 points on that basis.
  - **Task 8's estimate assumes FR-5/FR-8 are already satisfied at the validation layer**, per the feature spec's binding note that `validateVaultEnvelope` already implements exact-match-or-refuse with the declared version in its message. If that assumption is wrong on inspection, this task grows to include fixing `vault-file.ts` itself, not just surfacing and testing it.
  - **A `Files` field naming a speculative path with an "(or equivalent ...)" hedge defeats the orchestrator's conflict detection.** During this feature's own execution, Task 3 and Task 8 each named a placeholder renderer file with an "or equivalent" hedge instead of a real path; both hedges independently resolved to the same actual file, so the two tasks appeared disjoint to `file_conflicts` detection and two implementors appended to it in parallel, halting Wave 2 on a cherry-pick conflict. Future task lists should name only files that exist or that the task itself is expected to create, never a guessed-at-or-equivalent placeholder.
  - **No CONTRIBUTING.md exists yet.** Task 5's never-overwrite policy currently lives only in `docs/format/v1.md`'s preamble; if a CONTRIBUTING.md is added later, the policy should be mirrored there per OQ-5's resolution, but that is out of this feature's scope until such a file exists.

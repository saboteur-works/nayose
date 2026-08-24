# Feature Spec: Export and Published Format

**Branch:** feat/export-format
**Source feature breakdown:** specs/product/nayose.features.md, Feature 2
**Source product spec:** specs/product/nayose.md
**Depends on:** Feature 1 (specs/features/vault-core.md)
**Local ID note:** User story and requirement IDs below are renumbered sequentially for this document, starting at 1. Each item carries its originating product-spec ID in parentheses for traceability back to `specs/product/nayose.md`. See the Traceability note section for the full mapping table.

## Overview

This feature makes the custody promise in the concept checkable rather than asserted: a musician can take their entire vault out of the application at no cost, and a third party can read what came out using only a publicly documented specification, with an independent reader implementation as the proof that the documentation is actually sufficient — not a test fixture, but a deliverable in its own right. It covers export itself, the format-version declaration and refusal-to-misread behaviour that make a declared version trustworthy, and the publication lifecycle of the format specification, including the obligation that a superseded version stays available after a newer one ships.

### Constraints (context, not new requirements)

Fixed implementation constraints inherited from outside this spec's ladder, recorded here as context:

- **Stack is fixed:** TypeScript + Electron, per Feature 1. Export and format-reading logic are domain logic and belong in the main process; the renderer triggers export and displays results over IPC only, per the existing `src/main/` / `src/renderer/` split.
- **Offline-only:** export MUST work with no network connection and MUST NOT transmit vault contents anywhere, per the same no-network posture Feature 1 established and enforces via `check:no-network`.
- **Builds on the provisional envelope, not a green field.** `src/shared/types/vault.ts` already defines `VAULT_FORMAT_MARKER` and `VAULT_FORMAT_VERSION`, and `src/main/vault/vault-file.ts` already validates a file's marker and version on read, returning `'unsupported-version'` as one of `VaultOpenErrorReason`'s cases. That module's own header comment states the format is provisional and that "a later feature will publish a formal storage format spec and may force revision." This feature is that later feature: it does not start the version-checking machinery from nothing, but it does need to decide what that machinery is required to guarantee once the format is published (see FR-5 through FR-8 below), which may require revising today's envelope shape.
- **The exported artifact and the live vault file are the same artifact for MVP** (see Open questions, OQ-4): the JSON vault file already written by `src/main/vault/vault-file.ts` IS the published format, and export produces a copy of it at a user-chosen location. Knowledge of the on-disk shape stays confined to `src/shared/types/vault.ts` and `src/main/vault/vault-file.ts` — the same two files `docs/architecture.md` already identifies as the only ones that know it. The export path MUST go through a named serialization boundary rather than copying the file with `fs.copyFile`, so a future derived export format can be introduced behind that boundary without changing callers.
- **Independent-reader CI runs on one OS, deliberately outside the application's build matrix.** `.github/workflows/build.yml` builds the application itself across three OSes (macos-latest, windows-latest, ubuntu-latest). The FR-4 reader (see Open questions, OQ-3's cap) gets its own new job, pinned to `ubuntu-latest` only, and is not added to that matrix: the reader's correctness does not vary by platform, so running it three times would triple cost for no additional evidence.

## Goals

- A musician can export the complete vault, including full assertion history, at no cost, offline, and without an account.
- An exported vault can be re-imported without losing any assertion or its provenance.
- The on-disk format is published as a written specification at MVP release, and a party with no access to this application's source can parse an export using only that specification.
- A reader can always determine which format version a given file declares, without needing information from outside the file.
- The application never silently misreads a vault of a version it does not support — it refuses and reports the declared version instead.

## Non-goals

- No encryption, sync, or network transmission of vault contents as part of export — export produces a local artifact only.
- No selective or partial export; the scope is the complete vault or nothing, per product-spec FR-20.
- No automatic migration of an older-format vault to a newer version in place. FR-8 (below) requires refusal and an accurate version report, not best-effort upgrading.
- No requirement that the independent reader implementation (FR-4) itself support writing or exporting; it exists to prove the specification is sufficient to read a vault, not to be a second implementation of this application. It MUST be written in a different language and runtime than the application (not TypeScript), per Open questions OQ-3, but need not be built by a different author or team. Per OQ-3's cap, that language is Python 3, standard-library only (no pip, no third-party packages), delivered as a single CLI script at `tools/format-reader/read_vault.py` with a committed fixture vault, run in exactly one CI job pinned to `ubuntu-latest`, kept outside the existing 3-OS build matrix. The reader is explicitly not required to perform share-integrity summation/fraction normalization, writing, editing, exporting, or any GUI or rendering — share-integrity summation in particular was considered and deliberately excluded, not overlooked.
- No dedicated viewer application or GUI for browsing an exported file outside this application; FR-1 and FR-2 require the artifact and its re-importability, not a second way to view it.
- No CI enforcement of FR-7's never-overwrite obligation, and no automated publishing step for `docs/format/vN.md`. Per Open questions OQ-5, FR-7 is satisfied by a written, owner-held policy, not by tooling.

## User stories

- US-1: As a musician, I want to export everything in the vault at no cost, so that leaving this product costs me nothing. (product spec US-9)
- US-2: As a musician, I want to have the file format documented publicly, so that my data is readable even if this product disappears. (product spec US-10)

## Functional requirements

1. FR-1: Users MUST be able to export the complete vault, including its full assertion history, without payment, account, or network access. [US-1] (product-spec FR-20)
2. FR-2: An exported vault MUST be re-importable without loss of any assertion or its provenance. [US-1] (product-spec FR-21)
3. FR-3: The on-disk format MUST be published as a written specification at MVP release, committed in this repository under `docs/format/` with a versioned filename (`docs/format/v1.md`, and so on for later versions). [US-2] (product-spec FR-22)
4. FR-4: A third party MUST be able to parse an exported vault using only the published specification, verified by an independent reader implementation — one that does not import, link against, or otherwise depend on this application's own source code — built as a deliverable of this feature, not merely a test fixture. [US-2] (product-spec FR-23)
5. FR-5: An exported vault MUST declare, within the file itself, the format version it conforms to, so that a reader can determine the version without any out-of-band information. [US-2] (product-spec FR-26)
6. FR-6: The format version MUST be independent of the application version: an application release MUST NOT imply a format version change, and a format version change MUST NOT imply an application release. [US-2] (product-spec FR-27)
7. FR-7: Every published format version MUST remain publicly available after it is superseded by a later version: the `docs/format/vN.md` file for a given version is never edited or deleted once published, and any change is published as a new version file instead. [US-2] (product-spec FR-28)
8. FR-8: The application MUST refuse to read a vault declaring a format version it does not support, and MUST report the declared version to the user rather than failing silently or interpreting the file on a best-effort basis. [US-2] (product-spec FR-29)

## Traceability note

This document's FR numbers are local to this spec, renumbered sequentially starting at 1 per the `sab.feature-spec/1` schema's requirement for locally sequential IDs. The mapping to the product spec (`specs/product/nayose.md`) is:

| Local ID | Product-spec ID | User story |
| --- | --- | --- |
| FR-1 | FR-20 | US-1 (product US-9) |
| FR-2 | FR-21 | US-1 (product US-9) |
| FR-3 | FR-22 | US-2 (product US-10) |
| FR-4 | FR-23 | US-2 (product US-10) |
| FR-5 | FR-26 | US-2 (product US-10) |
| FR-6 | FR-27 | US-2 (product US-10) |
| FR-7 | FR-28 | US-2 (product US-10) |
| FR-8 | FR-29 | US-2 (product US-10) |

No renumbering mismatch exists between this feature's local user-story assignment and the product spec's: every requirement above is tagged in the product spec against the same user story (US-9 or US-10) it carries here, so — unlike the Feature 1 spec's FR-14/FR-15 situation — no proxy mapping was needed.

## Open questions

- OQ-1: What versioning granularity does the format use — semver-style major/minor with defined compatibility rules, or a single incrementing integer where any change is a hard break? Does an older reader need to tolerate a newer minor version, or does any declared-version mismatch trigger FR-8's refusal? — Impact: FR-5, FR-6, FR-8. The product spec's own OQ-5 resolution explicitly leaves this as residual and unresolved. — RESOLVED: a single incrementing integer. Any declared-version mismatch refuses; there is no minor-version tolerance. Rationale: this is exactly what `src/main/vault/vault-file.ts` already implements (`validateVaultEnvelope` exact-matches `formatVersion` against `VAULT_FORMAT_VERSION`), it satisfies FR-5, FR-6 and FR-8 as written, and the product spec's own OQ-5 resolution frames granularity as residual rather than blocking. Consequence: every future format change is a hard break for third-party readers, including additive ones. That cost is accepted for MVP and revisited only if a genuine additive change arrives.
- OQ-2: Where does the published specification document (FR-3) live — committed in this repository (e.g., under `docs/`), hosted at a URL independent of this repository's lifecycle, or both? This also bears on FR-7: "remains publicly available" needs a concrete, durable location before it can be checked as satisfied. — Impact: FR-3, FR-4, FR-7. — RESOLVED: in-repo, under `docs/format/`, with versioned filenames — `docs/format/v1.md`, `docs/format/v2.md`, and so on. Rationale: it stays in sync with the code it describes, and versioned filenames make the FR-7 archive append-only by construction rather than by process. Consequence: "publicly available" is inherited from the repository's own public visibility; if the repository ever goes private, FR-7 is violated by that act alone.
- OQ-3: What language and runtime is the independent reader implementation (FR-4) built in, and does "independent" require a different author/team, or only that it not import this application's own source code? — Impact: FR-4. — RESOLVED: written in a different language and runtime from the application (not TypeScript), by the same author. Rationale: FR-4's purpose is to prove the published specification is sufficient on its own. A same-stack reader lets code be copy-pasted and unstated assumptions leak across, which weakens the proof; a different language forces the author to work from the document alone. Consequence: the reader is a deliverable in its own right and needs a home in the repo and a way to run it in CI.
  Cap on scope: the choice of Python 3 above is bounded as follows. Language
  and dependencies: Python 3, standard library only — no pip, no
  `requirements.txt`, no virtualenv, no third-party packages; `json` is
  stdlib and is all the reader requires. Shape: a single file at
  `tools/format-reader/read_vault.py`, invoked as a CLI (`python3
  read_vault.py <vault.json>`), plus a small committed fixture vault to run
  it against — not a package, not installable, no test framework beyond
  bare `assert`. CI: one new job pinned to `ubuntu-latest` only, kept
  deliberately outside the existing 3-OS build matrix in
  `.github/workflows/build.yml` (macos-latest, windows-latest,
  ubuntu-latest) — see Constraints in Overview. Required depth, which is
  the substantive part and the entire evidentiary value of FR-4, not the
  choice of language: the reader MUST (1) read the format version declared
  in the file and refuse any version it does not support, reporting the
  declared version, mirroring FR-5 and FR-8 from the outside; (2)
  reconstruct current field values from the assertion log, that is,
  reimplement projection including conflict resolution between competing
  assertions; (3) surface each value's provenance, and the
  user-asserted-over-registry-issued override marking. Explicitly not
  required of the reader: share-integrity summation and fraction
  normalization; writing, editing, or exporting; any GUI or rendering.
  Share-integrity summation is excluded as a deliberate boundary —
  considered and declined, not overlooked — because it is a derived
  business rule layered on top of projection, not a test of whether the
  format's assertion-to-current-value semantics are documented. Governing
  rule: the reader MUST be written using only `docs/format/v1.md` as its
  source; if its author needs to consult the application's TypeScript
  source to make it work, that is a defect in the specification document,
  and the required remedy is to amend `docs/format/v1.md`, never to
  consult the source and move on — without this rule the reader is merely
  a second parser and proves nothing beyond "the file is JSON." Rationale:
  depth, not language, is what makes the reader meaningful — the vault
  stores only assertions, every current value is a projection over them, a
  reader that merely parses JSON and prints assertions proves only that
  the file is JSON, which was never in doubt; requiring projection and
  provenance reconstruction is what tests whether the published
  specification actually documents the assertion-to-current-value
  semantics well enough for a third party to derive them. Consequence:
  this cap has no product-spec parent and is not itself a new functional
  requirement — it constrains how FR-4 is satisfied, not what FR-4
  requires.
- OQ-4: Is an exported vault the same artifact as the live, on-disk vault file Feature 1 already writes (`src/main/vault/vault-file.ts`), or a distinct export format produced from it? This determines whether FR-1 and FR-2 require a new serialization path or reuse the existing one, and whether "re-importable" (FR-2) means reopening the same file directly or importing an export into a vault. — Impact: FR-1, FR-2, FR-3. — RESOLVED: for MVP, the same artifact — the JSON vault file the application already writes IS the published format, and "export" means producing a copy of it at a user-chosen location. This is recorded as a concrete seam, not merely an intention: all knowledge of the on-disk shape stays confined to `src/shared/types/vault.ts` and `src/main/vault/vault-file.ts` (the only two files `docs/architecture.md` identifies as knowing it), and the export path MUST go through a named serialization boundary rather than copying the file with `fs.copyFile`, so a future derived export format can be introduced behind that boundary without changing callers. Rationale: the assertion envelope already holds everything Feature 2 must serialize (entities, shares and registration state are all assertions, not a parallel structure), so a distinct format would be cost without present benefit — but FR-7 means the published v1 can never be retracted, so the seam has to exist now.
- OQ-5: FR-7 requires every superseded format version to stay publicly available indefinitely. What mechanism enforces that beyond the initial publish — a manual archival step per format-version release, an automated publish-on-release process, or a passive never-delete policy at wherever OQ-2's hosting location resolves to? This is a standing operational obligation outside the codebase, not a one-time build task, and needs an owner. — Impact: FR-7. — RESOLVED: a written never-overwrite rule — once a `docs/format/vN.md` file is published it is never edited or deleted; any change means a new version file. The rule is recorded in the repository (in the format spec's own preamble, and in CONTRIBUTING if one exists) and owned by the repository owner. No CI enforcement and no automated publishing step — those stay out of scope for this feature. Rationale: the versioned-filename choice from OQ-2 already makes violating this a deliberate act rather than an oversight, so a stated policy is proportionate.

## Out of scope (deferred)

- File import, streaming-API import, MLC/PRO preset import, and the shared import pipeline (preview, match, confirm, commit) — Features 3, 4, 5.
- Hand entry, the assertion log, the entity model, projections, and share-integrity detection — Feature 1 (this feature builds on top of, not instead of).
- Browser-extension capture, on-page discrepancy surfacing, and staleness prompts — product spec v1 milestone.
- Annotations layer (freeform fields, file location pointers, tool references) — product spec v1 milestone.
- Sync across devices, read/write API for other applications, opt-in encrypted sync relay, and multi-party enforcement — product spec v2 and post-v2.

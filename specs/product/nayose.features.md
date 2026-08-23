# Feature Breakdown: Nayose

**Milestone scope:** MVP only (FR-1 through FR-33)
**Source spec:** `specs/product/nayose.md`

### Feature 1: Vault with hand-entered catalog
**Value:** A musician can create a vault, record works, recordings, releases, and parties by hand, correct them, and see where every value came from — a complete working record with no import involved.
**Vertical slice:** Assertion-log storage, entity model including share and registration-state relationships, projection logic, application shell across three platforms, catalog browsing UI, entry and edit UI, provenance display, share-integrity surfacing.
**Requirements covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-15, FR-16, FR-17, FR-18, FR-19, FR-24, FR-25, FR-30, FR-32, FR-33
**User stories:** US-5, US-6, US-7, US-8
**Depends on:** none
**Notes:** The largest feature by requirement count, and deliberately not split. The assertion log (FR-3, FR-4), conflict tolerance (FR-5), and provenance display (FR-19) are one mechanism viewed from three angles — retrofitting any of them onto a mutable store is precisely the migration the concept exists to avoid. Splitting further would produce horizontal layers rather than shippable slices. Expect the task breakdown for this feature to be long; that is the correct place to absorb the size.

### Feature 2: Export and published format
**Value:** A musician can take their entire vault out at no cost, and a third party can read it using only public documentation — the custody promise, made checkable.
**Vertical slice:** Serialization, format version declaration and gating logic, export UI, the published specification document, and an independent reader implementation used as the verification.
**Requirements covered:** FR-20, FR-21, FR-22, FR-23, FR-26, FR-27, FR-28, FR-29
**User stories:** US-9, US-10
**Depends on:** Feature 1
**Notes:** FR-23 makes the independent reader a deliverable, not a test artifact — it is the evidence that the specification is sufficient. FR-28 (superseded versions stay published) is a standing obligation rather than a build task and should be recorded somewhere durable outside the codebase. Ships independently of all import features; nothing in ingest blocks it.

### Feature 3: File import with column mapping and match confirmation
**Value:** A musician can bring an arbitrary spreadsheet into the vault — including an MLC catalog export — map its columns once, preview exactly what will change, and confirm any ambiguous matches before anything is written.
**Vertical slice:** File parsing, mapping model with savable presets, entity matching logic, rejection memory, idempotency, mapping UI, import preview UI, match confirmation queue UI.
**Requirements covered:** FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14
**User stories:** US-3, US-4
**Depends on:** Feature 1
**Notes:** Owns the shared import pipeline — preview, match, confirm, commit — that Features 4 and 5 reuse rather than reimplement. This is the "one mapper, N presets" decision from the ingest research made structural. The matching semantics here (FR-11 exact-identifier only, FR-12 no fuzzy titles, FR-13 sticky rejections) are the product's main defense against silent corruption and warrant the heaviest test coverage in the MVP.

### Feature 4: MLC catalog import preset
**Value:** A songwriter importing their MLC catalog export does not have to map its columns by hand — the mapping is already there and correct.
**Vertical slice:** MLC-specific mapping preset over the Feature 3 pipeline, and an import entry point that selects it.
**Requirements covered:** FR-31
**User stories:** US-2
**Depends on:** Feature 3
**Notes:** Only the preset is blocked by OQ-1. FR-8 — importing the file at all — is satisfied by Feature 3 the moment Feature 3 ships, since the user can map the columns themselves; this feature removes that manual step. The composition-layer semantics that previously sat here (shares, registration state) have moved to Feature 1 under FR-32 and FR-33, because they are entity-model shape rather than import detail, and the entity model is a one-way door. What remains is a preset definition. **Fallback if the account does not materialise:** FR-9 already requires savable presets, so the first user with a real export produces one and it is bundled in a later release — one release cycle, zero architecture. **Do not author the preset against the export tool's filter fields**; those are what the tool narrows by, not necessarily what it emits, and a preset built on inferred columns fails silently against a real file.

### Feature 5: Streaming discography import
**Value:** A musician can confirm their artist identity once and have every released recording and release identifier pulled in automatically, without touching a distributor.
**Vertical slice:** DSP API client, artist identity confirmation UI, discography enumeration, identifier extraction, and reuse of the Feature 3 preview and match pipeline.
**Requirements covered:** FR-6, FR-7
**User stories:** US-1
**Depends on:** Feature 3
**Notes:** The only feature requiring network access, and the only path carrying the recording layer at MVP now that DistroKid is verified to offer no export. FR-6's explicit artist confirmation is a hard requirement, not a nicety — a wrong artist match silently poisons the vault. OQ-2 (enumeration completeness for compilations and features on others' tracks) determines what this feature may truthfully claim, not whether it can be built.

## Coverage check

- **Requirements covered:**
  - FR-1 → Feature 1 · FR-2 → Feature 1 · FR-3 → Feature 1 · FR-4 → Feature 1 · FR-5 → Feature 1
  - FR-6 → Feature 5 · FR-7 → Feature 5
  - FR-8 → Feature 3
  - FR-9 → Feature 3 · FR-10 → Feature 3 · FR-11 → Feature 3 · FR-12 → Feature 3 · FR-13 → Feature 3 · FR-14 → Feature 3
  - FR-15 → Feature 1 · FR-16 → Feature 1 · FR-17 → Feature 1 · FR-18 → Feature 1 · FR-19 → Feature 1
  - FR-20 → Feature 2 · FR-21 → Feature 2 · FR-22 → Feature 2 · FR-23 → Feature 2
  - FR-24 → Feature 1 · FR-25 → Feature 1
  - FR-26 → Feature 2 · FR-27 → Feature 2 · FR-28 → Feature 2 · FR-29 → Feature 2
  - FR-30 → Feature 1 · FR-32 → Feature 1 · FR-33 → Feature 1
  - FR-31 → Feature 4
- **Unassigned requirements:** none

## Summary

- **Total features:** 5
- **Suggested build order:** 1 → then 2 and 3 in parallel → then 4 and 5 in parallel
- **Independently shippable:** Feature 1 only. Every other feature requires the vault to exist first; this is inherent rather than a decomposition failure, since nothing can be imported into or exported from a vault that has no model.
- **Risks:**
  - **Feature 1 concentration.** Fifteen requirements in the foundational slice. It cannot be split without creating horizontal layers, but it is the schedule risk and the one place where a modelling mistake is expensive to reverse.
  - **Feature 3 as a shared dependency.** Features 4 and 5 both build on its import pipeline, so its interfaces need to be right before either starts. Getting matching semantics wrong here propagates to every ingest path.
  - **Feature 4's block is now scoped to the preset (FR-31), not to MLC ingest.** The residual risk is calendar, not engineering: resolving OQ-1 means an account signup, an approval wait, an export request, and an email. Start it in parallel with Feature 1 or it stalls Feature 4 for administrative reasons.
  - **Feature 2 has no downstream consumers** in the MVP, which makes it easy to defer under schedule pressure — and it is the differentiator. Worth protecting.

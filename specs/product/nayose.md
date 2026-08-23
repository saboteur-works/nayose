# Product Spec: Nayose

**Milestone scope:** MVP only. v1 and v2 requirements are listed under Out of Scope (Deferred).
**Status:** Draft
**Source concept:** Nayose — `docs/concept.md`, with ingest findings in `docs/ingest-research.md`

## Overview

Creators accumulate externally-assigned identifiers — ISRC, ISWC, IPI, UPC, registration status, split percentages — that they did not choose, cannot regenerate, and hold no canonical copy of. Each value lives in a system that owns the record and shows the creator a view of it, so nothing tells them when the version held elsewhere has drifted. The consequence is financial and silent: unmatched works and unclaimed royalties discovered years late. This product gives a musician one portable, verifiable, exportable record of their identifiers and registration state, stored locally in a documented format that outlives any platform they use.

## Goals

- A self-releasing musician can populate a vault with their existing catalog without hand-typing identifiers.
- A user can determine, for any stored value, where it came from and whether a registry issued it or a person asserted it.
- A user can export their complete vault at any time, at no cost, and read it without this application.
- A user can correct any value the import got wrong, without destroying the record of what was imported.
- The vault holds identifiers from multiple sources describing the same works without silently merging distinct works.
- The stored format is documented publicly and parseable by a third party at release.

## Non-goals

- Not a digital asset manager: the vault stores no file bytes at MVP.
- Not a distributor, registrar, or royalty collector: it issues no identifiers and submits nothing on the user's behalf.
- Not a general notes or project tool: values failing the facts-of-record test are out of scope at MVP.
- Not a credential holder: no passwords, stored sessions, or server-side login to any registry.
- Not multi-user: multi-party is representable in the model but enforced nowhere.
- Not the MLC royalty-recovery product, which is a separate application consuming this vault.
- **Milestone boundary:** browser-extension capture, discrepancy surfacing, staleness prompts, and the annotations layer are v1 and explicitly out of scope here.

## Users

**Self-releasing musician or songwriter (primary)**
Holds roughly 20–200 recordings, distributes through a service such as DistroKid, TuneCore, or CD Baby, is affiliated with a PRO, and may or may not be registered with the MLC. Currently tracks identifiers in a spreadsheet or not at all.
**Key need:** One authoritative copy of identifiers currently scattered across five systems, none of which will hand them back in bulk.
**Success looks like:** Their catalog is in one file they own; they can answer "what is the ISRC for that track" without logging in anywhere.

**Adjacent-domain creators (secondary)** and **managers, labels, and studios (tertiary)** are not served at MVP. The data model must accommodate them without a rewrite; no MVP requirement targets them.

## User Stories

**Self-releasing musician or songwriter**

- **US-1:** As a musician, I want to pull my released discography from a streaming service by artist identity, so that recording and release identifiers arrive without hand-typing. [MVP]
- **US-2:** As a songwriter, I want to import my MLC catalog export file, so that composition identifiers, shares, and registration state arrive in the same vault. [MVP]
- **US-3:** As a musician, I want to import an arbitrary spreadsheet by mapping its columns, so that sources without a built-in preset — including my own spreadsheet — still work. [MVP]
- **US-4:** As a musician, I want to confirm that a proposed match between two imported records is correct, so that distinct works are never merged silently. [MVP]
- **US-5:** As a musician, I want to see where any value came from and when, so that I know whether to trust it. [MVP]
- **US-6:** As a musician, I want to browse my works, recordings, releases, parties, and registrations and move between related items, so that I can see what I actually have. [MVP]
- **US-7:** As a musician, I want to correct a value an import got wrong, so that a bad identifier is not permanent. [MVP]
- **US-8:** As a musician, I want to add a work by hand, so that unreleased and non-distributed material can be recorded. [MVP]
- **US-9:** As a musician, I want to export everything in the vault at no cost, so that leaving this product costs me nothing. [MVP]
- **US-10:** As a musician, I want the file format documented publicly, so that my data is readable even if this product disappears. [MVP]

## Functional Requirements

### MVP Requirements

**Vault and data model**

- **FR-1:** A vault MUST be a single user-owned file containing one or more Party entities. [US-6]
- **FR-2:** Party (subject of metadata) and Account (actor on metadata) MUST be distinct entity types; MVP MUST create exactly one Account per vault. [US-5]
- **FR-3:** Every stored value MUST be recorded as an assertion carrying actor, timestamp, source, and source class of either registry-issued or user-asserted. [US-5]
- **FR-4:** The system MUST derive a field's current value from its assertions, and MUST be able to retrieve the full assertion history for any field. [US-5]
- **FR-5:** The vault MUST be able to hold conflicting assertions about the same field without discarding either. [US-4]
- **FR-32:** The vault MUST be able to represent a party's fractional share in a work, and a work's registration state with a named registry, as first-class relationships rather than freeform values — each recorded as an assertion like any other value. [US-2]
- **FR-33:** The system MUST detect when the shares recorded against a work do not sum to unity, and MUST surface that condition wherever the work's shares are shown. It MUST NOT refuse to store an incomplete or over-allocated share set — a catalog whose splits are genuinely unresolved must remain recordable. [US-2]

**Ingest**

- **FR-6:** Users MUST be able to import a released discography from a streaming service API given an artist identity, and the system MUST require explicit user confirmation of that identity before writing any assertion. [US-1]
- **FR-7:** Streaming import MUST capture ISRC per recording and UPC per release wherever the source provides them. [US-1]
- **FR-8:** Users MUST be able to import an MLC catalog export file. [US-2]
- **FR-31:** The system MUST provide a built-in column-mapping preset for the MLC catalog export, so that the user is not required to map its columns by hand. [US-2] [BLOCKED: OQ-1]
- **FR-9:** Users MUST be able to import any CSV or XLSX file by mapping its columns to vault fields, and MUST be able to save a mapping as a reusable preset. [US-3]
- **FR-10:** Every import MUST present a preview of proposed changes before any assertion is written, and MUST be cancellable with zero writes. [US-4]
- **FR-11:** The system MUST automatically link records across sources only on exact match of a strong identifier (ISRC, ISWC, or UPC); all other match candidates MUST be queued for user confirmation. [US-4]
- **FR-12:** The system MUST NOT merge records on title or artist similarity alone. [US-4]
- **FR-13:** A match candidate the user has rejected MUST NOT be proposed again on subsequent imports. [US-4]
- **FR-14:** Re-importing an unchanged source MUST NOT create duplicate entities or duplicate assertions. [US-1] [US-2]

**Manual entry and correction**

- **FR-15:** Users MUST be able to create works, recordings, releases, and parties by hand. [US-8]
- **FR-16:** Users MUST be able to edit any field; an edit MUST be recorded as a new user-asserted assertion and MUST NOT delete or overwrite an existing registry-issued assertion. [US-7]
- **FR-17:** The system MUST warn the user when a manual edit contradicts a registry-issued value, and MUST identify the issuing source in that warning. [US-7]
- **FR-30:** A field whose current value is a user-asserted assertion overriding a retained registry-issued assertion MUST be marked as such wherever that value is displayed, and the marking MUST be present without requiring an interaction. [US-7]

**Catalog view**

- **FR-18:** The system MUST present works, recordings, releases, parties, and registrations, and MUST allow navigation between related entities. [US-6]
- **FR-19:** Provenance for any displayed value MUST be reachable within one interaction from where the value is shown. [US-5]

**Export and format**

- **FR-20:** Users MUST be able to export the complete vault, including assertion history, without payment, account, or network access. [US-9]
- **FR-21:** An exported vault MUST be re-importable without loss of any assertion or its provenance. [US-9]
- **FR-22:** The on-disk format MUST be published as a written specification at MVP release. [US-10]
- **FR-23:** A third party MUST be able to parse an exported vault using only the published specification, verified by an independent reader implementation. [US-10]

**Platform**

- **FR-24:** The application MUST run on macOS, Windows, and Linux. [US-6]
- **FR-25:** All functionality except streaming-service import MUST work with no network connection, and the application MUST NOT transmit vault contents to any server. [US-9]

**Format versioning**

- **FR-26:** An exported vault MUST declare, within the file itself, the format version it conforms to, so that a reader can determine the version without out-of-band information. [US-10]
- **FR-27:** The format version MUST be independent of the application version; an application release MUST NOT imply a format version change, and a format version MUST NOT imply an application release. [US-10]
- **FR-28:** Every published format version MUST remain publicly available after it is superseded. [US-10]
- **FR-29:** The application MUST refuse to read a vault declaring a format version it does not support, and MUST report the declared version rather than failing silently or interpreting the file on a best-effort basis. [US-10]

## Constraints

- Local-first: the vault is a file on the user's disk; any network behaviour is opt-in and per-feature.
- The application must never store registry credentials, replay registry sessions, or authenticate to a registry from a server.
- The assertion log is the primary store; current values are projections over it, not independently stored truth.
- Party and Account must remain distinct in the schema even though MVP has exactly one Account.
- Export must never be gated behind payment, account creation, or a feature tier — the custody claim depends on it.
- The format is a published artifact with its own lifecycle: it versions independently of the application, and superseded versions stay available, because a vault that outlives the product is only readable if its specification does too.
- Wrong values are a trust liability rather than a cosmetic defect: any automatic linking must fail toward asking rather than toward merging.
- Conflict resolution is fixed: when a user-asserted assertion and a registry-issued assertion disagree about a field, the user's value is the current value, the registry-issued assertion is retained, and the field is marked as overriding a registry value wherever it appears. The user owns their record; the vault never silently overrides them, and never lets the override go unnoticed.
- Import must tolerate sources that provide only a subset of fields; partial data must be storable without placeholder values.

## Open Questions

**OQ-1: What are the actual column shapes of the MLC, ASCAP, and BMI catalog exports?**
**Impact:** Blocks FR-31 only. FR-8 is satisfiable without it — the generic mapper of FR-9 imports the file, and the user maps the columns themselves. What OQ-1 gates is whether that mapping ships pre-made. Existence of these exports is established; field-level structure requires an account to verify.
**Latency, not difficulty:** the path to an answer is account signup, approval, export request, and email delivery, none of which is engineering work. Started late, it stalls Feature 4 for administrative reasons rather than technical ones.
**Owner:** Product research

**OQ-2: How complete is streaming-service discography enumeration, given known unreliability for compilations and features on others' tracks?**
**Impact:** Determines whether FR-6 and FR-7 deliver an authoritative catalog or a strong first pass requiring review, and therefore what the product may truthfully claim.
**Owner:** Engineering spike

**OQ-3: Does any distributor besides Symphonic offer a catalog export, and does CD Baby?**
**Impact:** Adds or removes presets under FR-9. DistroKid is verified to have none.
**Owner:** Product research

**OQ-4: Where does acquisition urgency come from, given MLC recovery is a separate product?**
**Impact:** No functional requirement, but the concept identifies this as the primary adoption risk. Affects onboarding design and launch positioning.
**Owner:** Product

**OQ-5: Does the published format specification version independently of the application? — RESOLVED**
**Resolution:** Yes. The published format carries its own version, independent of the application's. Superseded versions remain published, so a vault written today stays readable against its own specification regardless of how the format later evolves. See FR-26 through FR-29.
**Residual:** The versioning scheme's granularity — what constitutes a breaking change, and whether older readers must tolerate newer minor versions — is an implementation choice, not a blocker. FR-29 makes the safe behaviour mandatory either way: an unsupported version fails loudly rather than being misread.

**OQ-6: What is the minimum honest verification cadence the v1 extension can support?**
**Impact:** No MVP requirement, but determines what MVP copy may promise about the vault staying current.
**Owner:** Product

**OQ-7: What event triggers the shift from adoption-forward to substrate — an integration deadline, a user count, or a date?**
**Impact:** Sequencing of the v2 application API. No MVP requirement.
**Owner:** Product

## Out of Scope (Deferred)

- **[v1]** Browser-extension capture of identifiers from registry and distributor pages the user is already logged into.
- **[v1]** On-page discrepancy surfacing between vault values and registry values.
- **[v1]** Staleness prompts tracking when each registry was last checked.
- **[v1]** Annotations layer — freeform user fields, file location pointers, and tool references.
- **[v2]** Extension autofill writing vault values into registry and distributor forms.
- **[v2]** Opt-in end-to-end encrypted sync relay across the user's own devices.
- **[v2]** Read/write API for other applications to consume and contribute metadata.
- **[v2]** Second creator vertical proving the generic model in production.
- **[post-v2]** Multi-party vaults for labels and studios, likely inverting to a server-primary topology.

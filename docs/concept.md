# Concept: Nayose

名寄せ — *nayose*, the consolidation of records referring to the same entity across separate systems.

*Ideation output — 2026-08-21*

## Problem & Value

Creators accumulate externally-assigned identifiers they did not choose, cannot regenerate, and do not hold a canonical copy of. A musician's ISRCs live in their distributor's dashboard, their ISWCs at a PRO, their splits at the MLC, their IPI on a portal they log into twice a year. Each of those systems owns the record and shows the creator a view of it. Nothing hands the creator their own copy, and nothing tells them when the version held elsewhere has drifted from what they believe. The consequence is specific and financial: unmatched works, unclaimed royalties, and a discovery lag measured in years, because wrong metadata fails silently. The value is custody — one portable, verifiable, exportable record of a creator's identifiers and registration state that outlives every platform they use.

## Target Audience

**Primary:** Self-releasing musicians and songwriters with a catalog large enough to have lost track of it — roughly 20–200 recordings, distributing through DistroKid/TuneCore/CD Baby, affiliated with a PRO, registered (or not) with the MLC. They are aware they may be losing money and currently track this in a spreadsheet or not at all.

**Secondary:** Creators in adjacent domains with the same structural problem and lower financial stakes — authors (ISBN/ONIX), podcasters (episode GUIDs), visual artists (IPTC/C2PA). Not served at MVP, but the model must accommodate them without a rewrite.

**Tertiary, explicitly later:** Managers, small labels, and studios administering catalogs across many artists.

## Core Concept

The vault stores **facts of record**: values assigned by a third party, that have a state living somewhere external which can drift, and where being wrong costs money or breaks a machine-to-machine match. That definition is the product's scope boundary — it is what lets the vault say no to becoming a general-purpose notes app. A second, deliberately unbounded layer holds **annotations**: the user's own freeform additions, including pointers to file locations and the tools used. Annotations are schemaless and carry no verification burden, so they cost nothing to support and cannot dilute the core.

Underneath, the vault is an append-only log of assertions — who claimed what, about which entity, when, and from what source. A field's current value is a projection over that log rather than a stored truth. This one choice yields provenance, device sync, audit history, and the ability to hold two conflicting claims about a split without destroying either. The alternative — mutable rows with last-write-wins — requires fighting each of those separately, and each retrofit discards history that cannot be reconstructed.

The application is local-first and cross-platform desktop: the vault is a real file on a real disk in an open, published format, so the data survives the company. Network features are opt-in. Because the registries that would need checking are mostly human-facing web apps behind logins and MFA, verification runs through a browser extension operating in the user's own authenticated session rather than through server-side automation — reading pages the user has already navigated to, and surfacing mismatches at the moment the user is positioned to fix them.

## Key Capabilities

- Users can import an existing catalog in bulk, either by pulling a released discography from a DSP API or by mapping the columns of a PRO, registry, or distributor export file.
- Users can see, for any field, where the value came from, when, and whether it was issued by a registry or asserted by a person.
- Users can export the complete vault at any time, free, in open documented formats — and read it without this application.
- Users can capture identifiers from a registry page they are already logged into, without the app ever handling credentials.
- The system flags discrepancies between the vault and a registry page while the user is on that page.
- The system tracks when each registry was last checked and prompts the user to look.
- Users can attach freeform annotations, file locations, and tool references to any work.
- Users can autofill registry and distributor forms from vault values.
- Users can sync a vault across their own devices via an opt-in relay.

## Feature Milestones

### MVP — a musician gets their catalog out of five systems and into one file they own

1. **Tier-1 ingest** — Spotify API discography pull, MLC catalog export, and a generic column-mapped CSV/XLSX importer. Solves cold start, the single largest adoption risk; nothing else matters if users must hand-type. Scoped to the best-documented, lowest-friction sources — every other source becomes a preset on the same importer rather than new work (see [ingest-research.md](ingest-research.md)).
2. **Assertion-log vault with provenance** — the core data commitment; cannot be retrofitted later without losing history.
3. **Complete free export in a published format** — the custody promise is the differentiator, and a promise deferred is not credible.
4. **Music catalog view** (works, recordings, releases, parties, registrations) — the minimum surface to see what you have.

### v1 — the vault stays current instead of going stale

1. **Extension capture** from registry pages — read-only; extends ingest past whatever exports exist.
2. **Discrepancy surfacing** on-page — turns storage into verification, the thing that makes the record trustworthy.
3. **Staleness prompts** — local, credential-free; recovers most of the monitoring value the extension's user-driven cadence gives up.
4. **Annotations layer** — the "creative bible" warmth, safely quarantined from the verified core.

### v2 — the vault becomes a substrate and reaches beyond one device

1. **Extension autofill** (write) — reuses v1's adapters; deferred because a bad write submits wrong data to a registry.
2. **Opt-in encrypted sync relay** — needed once the vault is trusted enough to be consulted from a phone.
3. **Read/write API for other applications** — what lets Otocho, GetWrite, and the MLC app consume and contribute.
4. **Second vertical** (books or podcasts) — proves the generic model in production.

*Post-v2 backlog:* multi-party vaults for labels and studios, which likely invert to server-primary and are a different deployment rather than a feature flag.

## What This Is Not

- **Not a DAM.** The vault stores pointers, checksums, and last-seen locations — never file bytes. Storage is Dropbox's problem.
- **Not a distributor, registrar, or royalty collector.** It never submits registrations on the user's behalf without an explicit action, and it issues no identifiers.
- **Not a general project or notes tool.** Anything failing the facts-of-record test is an annotation, and annotations get no schema, no verification, and no roadmap.
- **Not a credential holder.** No passwords, no stored sessions, no server-side login to any registry, ever.
- **Not multi-user at MVP.** Multi-party is *representable* from day one; it is *enforced* nowhere.
- **Not the MLC app.** Royalty recovery is a separate product consuming this vault.

## Competitive Landscape

**Spreadsheets and Notion templates** — the actual incumbent for nearly every indie creator. Free, flexible, already populated. Overlaps on storage and organization. Differs in that a spreadsheet cannot verify itself, has no provenance, and does not know an ISRC from a string. *Learn from:* the reason people stay is zero friction and total flexibility — the annotations layer must be at least that permissive.

**Disco** — music catalog and pitching platform used by labels, sync agents, and some artists; stores rich track metadata and splits. Closest functional overlap on holding credits and splits. Differs in intent: Disco is a delivery and pitching tool where metadata is in service of sending music; this is custody-first with no delivery surface, local, and export-guaranteed. *Learn from:* their track-level metadata schema is well-shaped by real industry use. *(Current pricing and feature set unverified — worth checking directly.)*

**Muso.AI / Jaxsta** — credit databases surfacing who worked on what. Overlap on identifiers and contributor roles. Differ fundamentally: they are public display layers built from industry data feeds, where the creator is the subject rather than the owner. This inverts that — the creator holds the record. *Learn from:* their role vocabularies and the demonstrated appetite for credit accuracy.

**Label back-office platforms (Revelator, Curve, Vistex and similar)** — royalty accounting and catalog administration for labels and distributors. Overlap on the underlying data model, which is largely the same entities. Differ on price, audience, and posture: enterprise-priced, hosted, and built for the entity paying the artist rather than the artist. *Learn from:* they have already solved the party/work/recording/registration model at scale; don't reinvent its shape.

**Distributor dashboards (DistroKid, TuneCore, CD Baby)** — where most indie identifiers currently live. Overlap almost completely on the data itself. Differ on custody: the record is theirs, scoped to what they distributed, and leaving takes it with you. *Learn from:* the absence of export is itself the finding — DistroKid holds identifiers it will not hand back in bulk (verified 2026-08-21), which is the custody argument in miniature and the sharpest available illustration of the problem to a prospective user.

**Clearest differentiator:** nothing in this space is consumer-priced, cross-domain, and export-first. Every existing option either holds a creator's identifiers on someone else's terms or charges label money for the privilege. The specific, checkable promise — *your vault is a documented file on your disk, complete and readable without us, free forever* — is one no hosted competitor can match at any price, because it contradicts their business model. The verification layer is what makes that record trustworthy rather than merely portable.

## Caveats & Pitfalls

- **Adoption:** the chosen framing — pure substrate, with MLC recovery as a separate product — leaves this app without a painkiller pitch. "A central place for your metadata" describes a category, not a pain, and categories convert badly. Something must supply urgency at the top of the funnel; if not royalty recovery, then the concrete answer needs naming before spec.
- **Cold start is the whole battle.** If a user must hand-enter 60 ISRCs, they leave in the first session. Research (2026-08-21, see [ingest-research.md](ingest-research.md)) establishes viable ingest paths on both sides of the model, so this risk is reduced but not eliminated: the residual gap is unreleased work, non-DSP work, and per-track credits, none of which any export covers.
- **Staleness makes the vault actively harmful.** A vault nobody opens becomes confidently wrong, and unlike a wrong password, it fails silently on a multi-year delay. If v1's verification loop does not work, MVP has shipped a nicer spreadsheet that lies.
- **The extension is a permanent maintenance treadmill** against DOMs owned by others, plus Manifest V3 churn and store review scrutiny for an extension that reads financial portals. Scope host permissions to a declared registry list; expect adapters to be disposable.
- **Correctness is a trust liability.** Telling a user their split is 50/50 when it isn't is unrecoverable. Provenance and confirmation flows are load-bearing, not polish.
- **Assumption to test:** that creators will do gathering work up front for a payoff that is deferred and invisible. Some will not, no matter how good the import is.
- **"Adoption first, monetize later" has no forcing function.** With no revenue pressure and no paying users, the honest risk is that the project stalls at MVP with a well-designed format and few users.

## Technical Considerations

- **Assertion log as the primary store** — worth exploring how far to take event-sourcing. It buys provenance, sync, and multi-party representation in one structure, but projections and querying are more work than a mutable schema, and the ergonomics of "current value" need care.
- **The on-disk format is a first-class deliverable**, not an artifact of implementation. Worth exploring SQLite-with-published-schema versus human-readable files; the custody claim is only as strong as third-party readability.
- **Sync topology** — worth exploring CRDT-based merge (Automerge/Yjs/Electric) with an end-to-end-encrypted relay, so the opt-in network layer never holds plaintext. This is the largest single engineering commitment and shapes the eventual label version, which will likely want the inverse topology.
- **Party/Account separation from day one** — the artist is a subject of metadata; the operator is an actor on it. Conflating them is the mistake this domain punishes hardest.

## Open Questions

- **What are the actual column shapes** of the MLC, ASCAP, and BMI exports? Their existence is established; the field-level structure requires an account to verify and directly determines import mapping effort.
- **Can "my discography" be enumerated reliably** from the Spotify API, given its known unreliability for compilations and features-on-others'-tracks? Determines whether API ingest is authoritative or merely a strong first pass needing user review.
- **Where does urgency come from,** given MLC recovery is a separate product? Without an answer, MVP has no acquisition story.
- **Is a vault one artist or one user?** This fixes future sharing granularity and cannot be adjusted later.
- **What is the minimum honest verification cadence** the extension can support, and what can the copy truthfully promise?
- **Does the format get published as a spec** others can implement, and is that a goal or just a consequence?
- **What triggers the shift** from adoption-forward to substrate — an integration deadline from Otocho/GetWrite, a user count, or a date?

## Next Steps

The registry-export question is resolved at the level needed to unblock speccing: ingest paths exist for both the composition and recording layers, so MVP feature #1 is viable as scoped. Remaining open questions reshape the spec rather than invalidate it. Ready for `write-product-spec` as a whole product across the three milestones.

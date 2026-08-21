# Ingest Research

*Researched 2026-08-21. Supports MVP feature #1 in [concept.md](concept.md).*

## Scope and confidence

This records which sources a creator's identifiers can be pulled from, how well
each is documented, and how much friction each imposes on the user. Every export
screen sits behind an account login, so what follows establishes **that a
documented mechanism exists** and its stated format — not the field-level column
shapes, which require an account to verify.

Confidence is labelled per source and is uneven. Only the MLC and Spotify entries
rest on primary documentation. Treat third-party entries as strong leads pending
confirmation.

## Prioritisation

Selection criterion: best-documented and lowest-friction first. Friction is
measured from the user's side — steps, waiting, and whether credentials or an
account are involved at all.

| Tier | Source | Documentation | User friction | Status |
|---|---|---|---|---|
| 1 | Spotify Web API | Primary — public API reference | Lowest — confirm artist identity, nothing else | MVP |
| 1 | MLC Catalog Export | Primary — vendor page | Medium — log in, request, wait for email, drag file in | MVP |
| 1 | Generic mapped CSV/XLSX | N/A — our own importer | Low — drag file, confirm column mapping | MVP |
| 2 | BMI Online Services | Third-party walkthrough | Medium — same shape as MLC | Preset, post-MVP |
| 2 | ASCAP ACE | Third-party walkthrough | Medium — same shape as MLC | Preset, post-MVP |
| 3 | TuneCore sales reports | Inferred from support docs | Medium, and semantically indirect | Preset, low priority |
| 3 | Symphonic catalog inventory | Vendor help article | Unknown | Preset, low priority |
| — | DistroKid | Verified: no metadata export exists | N/A | Extension capture (v1) |
| — | CD Baby | Not established | N/A | Needs research |
| — | SoundExchange | Licensee-facing, not artist-facing | N/A | Not an ingest path |

**The design consequence of this ordering:** do not build per-source parsers.
Build one column-mapping importer with per-source presets layered on top. Tier 2
and 3 sources then cost a preset definition each rather than an integration, and
a source we have never seen still works via manual mapping. This is what makes
"start with the well-documented ones" a scoping decision rather than a
limitation.

## Composition / registration layer

This is where the high-value data lives — ISWC, IPI, writer and publisher
shares, registration status — and where exports are genuinely good.

| Source | Export mechanism | Confidence |
|---|---|---|
| MLC | Catalog Export Tool. Excel-compatible file, delivered by email. Filterable before export by artist, MLC song code, publisher IPI, publisher name, publisher number, writer IPI, writer ID, writer name. Available in both Member Hub and Songwriter Hub. | Vendor-documented |
| BMI | "Export All to CSV" via the Reports control in BMI Online Services. | Third-party walkthrough |
| ASCAP | Catalog file download in Excel format via ACE. | Third-party walkthrough |

Note the MLC filter fields are a useful signal about the export's likely shape,
but the vendor page does not state the exported columns. No size or frequency
limits are documented.

## Recording / release layer

Distributors largely do not offer bulk export:

- **DistroKid** — **verified 2026-08-21 by direct account inspection.** No
  metadata export exists by any route. The Vault contains audio backups only,
  with no manifest; the Bank page carries no usable identifiers, so the
  TuneCore-style earnings-report backdoor does not apply here. The My Music page
  lists all tracks, but ISRCs are visible only after drilling into each release.
  Caveat: one account, current UI, and DistroKid has plan tiers — features may
  differ elsewhere.
- **TuneCore** — no catalog export found. Downloadable sales reports do carry
  ISRC and UPC columns, making them a usable backdoor, though they only cover
  releases with reported activity.
- **CD Baby** — not established either way.
- **Symphonic** — documents an explicit catalog inventory export, so the practice
  is not universal among distributors.
- **SoundExchange** — public ISRC search with download at isrc.soundexchange.com
  plus an API. The bulk Repertoire Matching Service is licensee-facing, aimed at
  services matching catalogs against the database, not at artists retrieving
  their own.

### Adapter shape implied by the DistroKid finding

Because My Music enumerates every track while ISRCs live one level deeper, a
distributor adapter naturally splits in two: a cheap list-page reader that
learns *what exists*, and a per-release reader that captures the identifier.
The useful consequence is that the vault can then show capture progress — "42
of 118 tracks captured" — which makes incremental, browse-driven capture feel
bounded rather than endless. Expect this two-level shape to recur across
distributors.

Note also that for anything already released, Spotify supplies the same ISRC
without the drilling. The distributor adapter's real value is therefore
unreleased work, non-DSP releases, and cross-checking — not bulk acquisition.

**This gap is largely bypassable.** The Spotify Web API exposes
`external_ids.isrc` on track objects and `external_ids.upc` on album objects,
with Get Artist's Albums enumerating a discography. The released-recording
identifier layer is therefore recoverable without any distributor's cooperation,
which is why no distributor appears in Tier 1.

Constraints to design around:

- App registration and ToS terms apply.
- Get Artist's Albums is known to handle compilations and
  features-on-others'-tracks unreliably, so the result is a strong first pass
  rather than an authoritative enumeration.
- Matching the correct artist page to the user must be an explicit confirmation
  step, never an inference — a wrong match silently poisons the vault, which is
  precisely the failure mode the provenance model exists to prevent.

## Residual gap

After both paths, what remains uncovered is unreleased work, work never
distributed to a DSP, and per-track credits and contributor roles. This is the
case the v1 browser extension exists to cover, and it should not be addressed by
expanding import scope.

## To verify

Each of these converts a "probably" into a fact, and the first three also yield
the column shapes that import mapping needs.

- [ ] MLC export — actual columns, and whether registration status and share
      percentages are included or only work identity.
- [ ] BMI "Export All to CSV" — confirm it exists as described; capture columns.
- [ ] ASCAP ACE catalog download — confirm; capture columns.
- [x] ~~DistroKid Vault — is the bundled ISRC/UPC data machine-readable?~~ No —
      audio only, no manifest. Verified 2026-08-21.
- [ ] CD Baby — establish whether any export exists.
- [ ] Spotify — measure discography enumeration completeness against a known
      catalog, including features and compilation appearances.

## Sources

- [MLC Catalog Export Tool](https://www.themlc.com/catalogexport) — vendor
- [Spotify Web API: Get Track](https://developer.spotify.com/documentation/web-api/reference/get-track) — vendor
- [BMI catalog download walkthrough](https://help.usemogul.com/en/articles/8927760-how-to-download-your-catalog-files-from-bmi) — third party
- [ASCAP catalog download walkthrough](https://help.usemogul.com/en/articles/8417796-how-to-download-your-catalog-file-from-ascap) — third party
- [DistroKid: Getting ISRCs](https://support.distrokid.com/hc/en-us/articles/360013649173-Getting-ISRCs-From-DistroKid) — vendor
- [DistroKid: Backing Up Your Uploads With the Vault](https://support.distrokid.com/hc/en-us/articles/360013534214-Backing-Up-Your-Uploads-With-the-DistroKid-Vault) — vendor
- [TuneCore UPCs and ISRCs](https://support.tunecore.com/hc/en-us/articles/115006499567-TuneCore-UPCs-and-ISRCs) — vendor
- [Symphonic: export catalog inventory](https://support.symdistro.com/hc/en-us/articles/217194746-How-to-find-UPCs-ISRCs-and-export-catalog-inventory) — vendor
- [SoundExchange: All About ISRCs](https://www.soundexchange.com/2024/01/09/all-about-isrcs/) — vendor

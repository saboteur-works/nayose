# Nayose

名寄せ — *nayose*, the consolidation of records referring to the same entity
across separate systems.

Nayose is a local-first desktop application that gives a musician custody of
their own metadata. Creators accumulate identifiers they did not choose and
do not hold a canonical copy of — ISRCs at a distributor, ISWCs at a PRO,
splits at the MLC, an IPI on a portal logged into twice a year. Each of those
systems owns the record and shows the creator a view of it; nothing hands the
creator their own copy, and nothing tells them when the version held
elsewhere has drifted from what they believe. Nayose stores one portable
record of a creator's identifiers and registration state, on their own disk,
that outlives any platform they use.

See [`docs/concept.md`](docs/concept.md) for the full problem statement and
product framing.

## Status: Features 1 and 2

This repository currently implements **Feature 1 — the vault with a
hand-entered catalog** (`specs/features/vault-core.md`) and **Feature 2 —
export and the published on-disk format**
(`specs/features/export-format.md`). Concretely, that means:

- You can create a vault and populate it by hand: works, recordings,
  releases, parties, shares, and registration state.
- Every value is stored as an assertion with full provenance, and you can
  correct any value without destroying the assertion it overrides.
- You can open, create, and close a vault from the app's UI, and export the
  currently open vault's complete contents to a user-chosen path.
- The on-disk vault format is a published, versioned specification —
  [`docs/format/v1.md`](docs/format/v1.md) — with an independent
  stdlib-only Python 3 reader (`tools/format-reader/read_vault.py`) that
  proves the spec alone is sufficient to build a conformant reader in a
  different language.
- The application runs fully offline; it has no network access anywhere.

What does **not** exist yet:

- **No import.** Nothing populates the vault except hand entry (and test
  fixtures). Streaming-service import, MLC import, and generic spreadsheet
  import are Features 3, 4, and 5.
- **No network access of any kind** — no verification, no sync, no
  telemetry, nothing. Enforced by an automated check (`check:no-network`),
  not just by omission.
- **No browser extension**, no discrepancy surfacing against live registry
  pages, no sync across devices, and no freeform annotations layer.
- **No enforcement of multi-party permissions.** Party/Account separation
  exists in the data model, but the app creates exactly one Account per
  vault.

For the product's full scope and the milestones beyond this feature, see
[`specs/product/nayose.md`](specs/product/nayose.md).

## Prerequisites and setup

- **Node.js 22.6 or newer.** The test suite runs `.ts` files directly
  through Node's native test runner, which requires TypeScript
  type-stripping. Node 20 cannot run it: `node --test` there fails with
  `ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".ts"` (measured
  against Node v20.20.2). Verified working on Node 24.
- npm.

CI pins `node-version: '22'` (`.github/workflows/build.yml`), verified
green on Node v22.23.2 and v24.15.0 across typecheck, tests, the
no-network check, and build. A separate `format-reader` job (`ubuntu-latest`
only) runs the independent Python reader against a fixture vault to prove
`docs/format/v1.md` is sufficient on its own.

```bash
npm install
npm run dev:renderer   # Vite dev server for the renderer only
npm start              # build main + renderer, then launch the Electron app
```

## npm scripts

| Script | What it does |
| --- | --- |
| `dev:renderer` | Runs the Vite dev server for the renderer in isolation. |
| `build` | Compiles the main process (`tsc -p tsconfig.main.json`) and builds the renderer (`vite build`). |
| `start` | Runs `build`, then launches the Electron app (`electron .`). |
| `typecheck` | Type-checks the main and renderer TypeScript projects separately (`tsconfig.main.json` and `tsconfig.renderer.json`). |
| `test` | Runs the project's test files directly under Node's native test runner (`node --test`). |
| `check:no-network` | Static guard that fails if `src/main/vault/**`, `src/main/ipc/**`, or `src/shared/**` acquire an outbound network dependency. See [Architecture](#architecture). |
| `dist` | Builds the app and packages installers per platform via `electron-builder` (see `electron-builder.yml`). |

## Architecture

Nayose is a TypeScript + Electron desktop application with a strict split
between process types:

- **Main process (`src/main/`)** owns all vault file I/O and all domain
  logic — the assertion log, the entity model, projections, and share
  integrity checks. This is deliberate: the vault is the thing being given
  custody guarantees, so the code that touches the vault file and derives
  values from it is kept in one place, off the renderer's attack surface,
  and reachable by an automated network guard (`check:no-network`) that
  would be meaningless if domain logic were scattered into the renderer.
- **Renderer (`src/renderer/`)** is interface only — React with shadcn/ui
  primitives, remapped onto Saboteur brand tokens. It holds no filesystem or
  network access of its own and reaches the vault exclusively over IPC,
  through a narrow `window.nayose` bridge exposed by `src/main/preload.ts`
  (context isolation on, node integration off, sandboxed renderer).
- **`src/shared/`** holds types shared between the two processes (assertion,
  entity, vault, and IPC request/result shapes) with no runtime logic of its
  own.

For the assertion log, projection, and conflict-resolution model in detail,
see [`docs/architecture.md`](docs/architecture.md).

### Storage format

The on-disk vault format (a single JSON file — see
`src/main/vault/vault-file.ts`) is published as a versioned specification at
[`docs/format/v1.md`](docs/format/v1.md). Per that document's never-overwrite
policy, `docs/format/v1.md` itself is never edited or deleted once
published; any future change to the shape ships as a new `docs/format/vN.md`
file. `tools/format-reader/read_vault.py` is an independent, stdlib-only
Python 3 reader written against the published spec alone, run in CI against
`tools/format-reader/fixtures/sample-vault.json` (see the `format-reader`
job in `.github/workflows/build.yml`).

## Specs

Documentation of what to build lives under `specs/`, in a fixed rung
structure, each rung tracing to the one above it:

1. **Concept** — [`docs/concept.md`](docs/concept.md) — the product idea and
   the "why."
2. **Product spec** — [`specs/product/nayose.md`](specs/product/nayose.md) —
   the full MVP/v1/v2 requirement set for Nayose as a product.
3. **Feature list** — `specs/product/nayose.features.md` — the product spec
   broken into shippable features.
4. **Feature specs** —
   [`specs/features/vault-core.md`](specs/features/vault-core.md) (Feature 1)
   and [`specs/features/export-format.md`](specs/features/export-format.md)
   (Feature 2) — each feature's requirements, traced back to the product
   spec.
5. **Tasks** —
   [`specs/features/vault-core/tasks.md`](specs/features/vault-core/tasks.md)
   and
   [`specs/features/export-format/tasks.md`](specs/features/export-format/tasks.md)
   — each feature spec broken into the tasks actually executed on
   `feat/vault-core` and `feat/export-format` respectively.

Anything under `specs/` is an approved, authoritative artifact of what was
agreed to be built — treat it as source of truth over this README if the two
ever disagree.

## Development notes

The root `tsconfig.json` is a **base** config, meant only to be extended by
`tsconfig.main.json` and `tsconfig.renderer.json` — it has no `include`, no
`types`, and no `jsx` setting of its own. `npm run typecheck` is correct
because it invokes the two child configs explicitly. An editor's `tsserver`,
however, will fall back to the root config for files it can't otherwise
place and report a batch of spurious errors (missing Node/JSX types) that
`npm run typecheck` does not produce. If you see a wall of editor-only
errors, check which tsconfig the file resolves to before assuming something
is broken.

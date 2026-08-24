// Static guard: fails the build if the vault's own codepaths
// (src/main/vault/**, src/main/ipc/**, src/shared/**) acquire an outbound
// network dependency, per Task 13 / feature-spec FR-13.
//
// Nayose must work with ZERO network access anywhere and must never
// transmit vault contents (see specs/features/vault-core.md FR-13). Nothing
// in this feature currently uses the network; this script is a guard rail
// for the future, since a later feature introduces the app's first network
// client elsewhere in the codebase, and this check is what keeps that
// client from ever getting wired into the vault's own codepaths.
//
// This is a REAL static check: it reads every .ts file under the scanned
// directories and regex-matches import/require specifiers (and any bare
// reference to the global `fetch`) against a list of network-capable
// module names. It does not scan src/renderer/**, which only ever talks to
// main over IPC and has no filesystem/network access of its own, per the
// Electron security posture already in place elsewhere in this codebase.
//
// Run via `npm run check:no-network` (see package.json), or directly with
// `node scripts/check-no-network.ts` — this project already runs `.ts`
// test files straight through Node's native TypeScript support (see
// package.json's `test` script and any `*.test.ts` file's header comment),
// so this script is written and invoked the same way: no build step, no
// separate `tsx`/`ts-node` dependency.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Directories that make up the vault's own codepaths, scanned relative to the repo root. */
const SCAN_ROOTS = ['src/main/vault', 'src/main/ipc', 'src/shared'];

/**
 * Node builtins capable of outbound network I/O. `node:` prefix is matched
 * separately from the bare specifier, since either form is valid.
 */
const NETWORK_BUILTINS = ['http', 'https', 'net', 'dns', 'tls', 'dgram'];

/**
 * npm dependencies known for network I/O. Checked against actual imports
 * found in scanned files, not against package.json (package.json currently
 * declares none of these — see this script's own header comment — but a
 * future dependency addition without a matching import would not be a
 * violation of THIS guard, which is specifically about the vault's
 * codepaths acquiring a network dependency, not about what's merely
 * installed).
 */
const NETWORK_PACKAGES = ['axios', 'node-fetch', 'ws', 'got', 'undici', 'request', 'superagent', 'isomorphic-fetch'];

interface Violation {
  file: string;
  detail: string;
}

/** Recursively list every `.ts` file under `dir` (absolute path), excluding `.test.ts` files (test doubles are not shipped codepaths). */
async function listTsFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTsFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Extract every static/dynamic import and `require(...)` specifier referenced in `source`. */
function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

/** Strip a `node:` prefix and any subpath (e.g. `node:http` -> `http`, `node-fetch/dist/x` -> `node-fetch`). */
function baseModuleName(specifier: string): string {
  const withoutNodePrefix = specifier.startsWith('node:') ? specifier.slice('node:'.length) : specifier;
  if (withoutNodePrefix.startsWith('@')) {
    // Scoped package: base name is the first two path segments.
    const parts = withoutNodePrefix.split('/');
    return parts.slice(0, 2).join('/');
  }
  return withoutNodePrefix.split('/')[0];
}

/** Check a single file's contents for network-capable imports/requires and bare global-`fetch` usage. */
function checkFileContents(relativePath: string, source: string): Violation[] {
  const violations: Violation[] = [];

  for (const specifier of extractImportSpecifiers(source)) {
    const base = baseModuleName(specifier);
    if (NETWORK_BUILTINS.includes(base)) {
      violations.push({ file: relativePath, detail: `imports Node network builtin '${specifier}'` });
    } else if (NETWORK_PACKAGES.includes(base)) {
      violations.push({ file: relativePath, detail: `imports network-capable package '${specifier}'` });
    }
  }

  // Bare global `fetch(...)` call — not an import, so matched directly.
  // Matches `fetch(` not preceded by a `.` (to avoid flagging e.g.
  // `something.fetch(...)`, a plausible unrelated method name) and not
  // part of a longer identifier.
  if (/(?<![.\w])fetch\s*\(/.test(source)) {
    violations.push({ file: relativePath, detail: "calls the global 'fetch' function" });
  }

  return violations;
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const violations: Violation[] = [];

  for (const scanRoot of SCAN_ROOTS) {
    const absoluteRoot = path.join(repoRoot, scanRoot);
    const files = await listTsFiles(absoluteRoot);
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const relativePath = path.relative(repoRoot, file);
      violations.push(...checkFileContents(relativePath, source));
    }
  }

  if (violations.length > 0) {
    console.error('check-no-network: found outbound network dependencies in vault codepaths:\n');
    for (const violation of violations) {
      console.error(`  ${violation.file}: ${violation.detail}`);
    }
    console.error(
      `\n${violations.length} violation(s) found. src/main/vault/**, src/main/ipc/**, and src/shared/** must never depend on networking (FR-13).`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `check-no-network: OK — no network-capable imports found in ${SCAN_ROOTS.join(', ')}.`,
  );
}

await main();

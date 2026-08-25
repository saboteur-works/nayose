/**
 * The root package.json declares `"type": "module"` so that Node's native
 * test runner and the `.ts` scripts in this directory parse as ES modules
 * without a per-run warning. The main process, however, is compiled to
 * CommonJS (`tsconfig.main.json`) because Electron's sandboxed preload
 * loader requires CJS.
 *
 * Node resolves a file's module format from the *nearest* package.json, so
 * writing one inside `dist/` scopes everything tsc emits there back to
 * CommonJS, leaving the root declaration to apply only to source and
 * tooling. electron-builder ships it via its `dist/**` files glob.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(import.meta.dirname, '..', 'dist');
mkdirSync(distDir, { recursive: true });
writeFileSync(
  path.join(distDir, 'package.json'),
  `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`,
);

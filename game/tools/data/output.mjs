// Where the importer writes, and how the generated files compare with what is on disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** src/content/demo of the checkout this script lives in. */
export const DEMO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'content', 'demo');
/** Everything in data/ is generated, plus these files; index.ts and composite.ts are hand-written. */
const GENERATED_TOP = new Set(['types.ts', 'tables.ts', 'registry.ts', 'manifest.json']);

/** src/content of the checkout: the manifests (tools/data/manifests.mjs) are keyed relative to it. */
export const CONTENT_DIR = path.resolve(DEMO_DIR, '..');

/** Generated manifests that differ from disk (they live beside hand-written files, so nothing is ever stale). */
export function compareManifests(files, dir = CONTENT_DIR) {
  const changed = [...files].filter(([rel, text]) => {
    const file = path.join(dir, rel);
    return !fs.existsSync(file) || fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n') !== text;
  });
  return { changed: changed.map(([rel]) => rel), stale: [] };
}

export function writeManifests(files, { changed }, dir = CONTENT_DIR) {
  for (const rel of changed) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), files.get(rel));
  }
}

/** Generated files that differ from disk (`changed`) and files in data/ the import no longer produces (`stale`). */
export function compareGenerated(files, dir = DEMO_DIR) {
  for (const rel of files.keys()) if (!rel.startsWith('data/') && !GENERATED_TOP.has(rel)) throw new Error(`unexpected output ${rel}`);
  // Line endings do not count: a checkout may convert them.
  const changed = [...files].filter(([rel, text]) => {
    const file = path.join(dir, rel);
    return !fs.existsSync(file) || fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n') !== text;
  });
  const dataDir = path.join(dir, 'data');
  const stale = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).map(f => `data/${f}`).filter(f => !files.has(f)) : [];
  return { changed: changed.map(([rel]) => rel), stale };
}

/** Writes the changed files and removes the stale ones. */
export function writeGenerated(files, { changed, stale }, dir = DEMO_DIR) {
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  for (const rel of changed) fs.writeFileSync(path.join(dir, rel), files.get(rel));
  for (const rel of stale) fs.rmSync(path.join(dir, rel));
}

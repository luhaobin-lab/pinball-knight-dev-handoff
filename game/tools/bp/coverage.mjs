// node tools/bp/coverage.mjs [--report <bot report.json>] [--root <checkout>] [--dump <dir>] [--card <id>] [--json]
//
// Coverage of the scoped skill classes (src/content/demo/reachable.ts) per owner card: which are ported (a module
// under src/content/bp declares `static … path = '<asset>'` and a batch file imports it), which are still served by the
// runtime stub, and, given a bot report (coverage.classCounts, or the legacy coverage.classes list; coverage.stubsHit
// [{path, count}], coverage.unportedCalls [{fn, count}]), which were hit. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { computeReach } from '../data/reach.mjs';
import { assignOwners } from './batches.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = 'CatapultHero/BP/Skill/';
const STATIC_PATH = /static\s+(?:override\s+)?readonly\s+path(?:\s*:\s*[\w.]+)?\s*=\s*['"]([^'"]+)['"]/g;
const IMPORT_FROM = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;

function walkTs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walkTs(full) : e.name.endsWith('.ts') ? [full] : [];
  });
}

/** Asset paths declared by modules that a batch file of src/content/bp/batches imports, and by src/core. */
export function portedClasses(root) {
  const declared = new Map();
  for (const file of [...walkTs(path.join(root, 'src/content/bp')), ...walkTs(path.join(root, 'src/core'))]) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(STATIC_PATH)) declared.set(path.resolve(file), [...(declared.get(path.resolve(file)) ?? []), m[1]]);
  }
  const ported = new Set();
  for (const batch of walkTs(path.join(root, 'src/content/bp/batches'))) {
    for (const m of fs.readFileSync(batch, 'utf8').matchAll(IMPORT_FROM)) {
      const target = path.resolve(path.dirname(batch), m[2]);
      for (const p of declared.get(target) ?? []) ported.add(p);
    }
  }
  // Core base classes register themselves (studio/ARCHITECTURE.md §7.3).
  for (const [file, paths] of declared) if (file.startsWith(path.resolve(root, 'src/core'))) for (const p of paths) ported.add(p);
  return ported;
}

const countMap = slice => new Map(Array.isArray(slice)
  ? slice.map(x => (typeof x === 'string' ? [x, 1] : [x.path ?? x.fn, x.count ?? 1]))
  : slice && typeof slice === 'object' ? Object.entries(slice) : []);

/** { cards: {card: {classes, ported, stubbed, hit, stubsHit}}, classes: [{path, card, ported, hits, stubHits}], unportedCalls } */
export function coverage({ reach, ported, report }) {
  const owners = assignOwners(reach);
  const cov = report?.coverage ?? {};
  const hit = countMap(cov.classCounts ?? (typeof cov.classesHit === 'number' ? cov.classes : cov.classesHit));
  const stubHit = countMap(cov.stubsHit ?? cov.stubs);
  const classes = reach.scoped.map(a => {
    const card = owners.owner[a.slice(SKILL.length)];
    return { path: a, card, ported: ported.has(a), hits: hit.get(a) ?? 0, stubHits: stubHit.get(a) ?? 0 };
  });
  const cards = {};
  for (const c of classes) {
    const s = (cards[c.card] ??= { classes: 0, ported: 0, stubbed: 0, hit: 0, stubsHit: 0 });
    s.classes++;
    if (c.ported) s.ported++;
    else s.stubbed++;
    if (c.hits) s.hit++;
    if (c.stubHits) s.stubsHit++;
  }
  return { cards, classes, unportedCalls: [...countMap(cov.unportedCalls ?? cov.unported)].map(([fn, count]) => ({ fn, count })) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      report: { type: 'string' },
      root: { type: 'string', default: path.resolve(HERE, '..', '..') },
      dump: { type: 'string', default: 'D:/TAPTAPGAME_codex/reference/dump' },
      card: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
    strict: true,
  });
  const report = values.report ? JSON.parse(fs.readFileSync(values.report, 'utf8')) : null;
  const result = coverage({ reach: computeReach(values.dump), ported: portedClasses(values.root), report });
  if (values.card) {
    result.classes = result.classes.filter(c => c.card === values.card);
    result.cards = { [values.card]: result.cards[values.card] };
  }
  if (values.json) process.stdout.write(`${JSON.stringify(result, null, 1)}\n`);
  else {
    for (const [card, s] of Object.entries(result.cards).sort()) {
      console.log(`${card.padEnd(22)} ${String(s.ported).padStart(3)}/${String(s.classes).padEnd(3)} ported  ${s.stubbed} stubbed  ${report ? `${s.hit} hit, ${s.stubsHit} stubs hit` : ''}`);
    }
    if (values.card) for (const c of result.classes) console.log(`  ${c.ported ? 'ported ' : 'stubbed'} ${report ? `hit ${c.hits} stub ${c.stubHits} ` : ''}${c.path}`);
    if (report) console.log(`unported facade calls: ${result.unportedCalls.length}`);
  }
}

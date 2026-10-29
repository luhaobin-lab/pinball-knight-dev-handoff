// node tools/bp/batches.mjs [--dump D:/TAPTAPGAME_ref/dump] [--out D:/TAPTAPGAME_studio/tmp/bp-owners.json] [--compare <owners.json>]
//
// Assigns every scoped skill class (tools/data/reach.mjs: the in-scope roots of PROTOTYPE_SCOPE) to exactly one card:
// the hand map of tools/bp/owners.mjs, then contiguous code-point-ordered chunks of 效果/物品 and 效果/天赋 balanced
// by pseudo lines. Writes { owner, cards, lines } (the shape of the planner's owners.json plus per-card line totals).
// --compare prints the differences against another owners.json and exits 1 if there are any.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { computeReach } from '../data/reach.mjs';
import { EXTRA, FOLDER_BATCHES, OWN } from './owners.mjs';

const SKILL = 'CatapultHero/BP/Skill/';
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const dirname = s => (s.includes('/') ? s.slice(0, s.lastIndexOf('/')) : '');

/** plan_owners.split: contiguous chunks; a chunk closes once the running total reaches its share. */
function split(items, k, lines) {
  const total = items.reduce((n, s) => n + lines(s), 0);
  const out = [];
  let cur = [];
  let acc = 0;
  for (const s of items) {
    cur.push(s);
    acc += lines(s);
    if (acc >= (total / k) * (out.length + 1) && out.length < k - 1) {
      out.push(cur);
      cur = [];
    }
  }
  out.push(cur);
  return out;
}

/** { owner: short path -> card, cards: card -> short paths, lines: card -> pseudo lines }. */
export function assignOwners(reach) {
  const scoped = new Set(reach.scoped.map(a => a.slice(SKILL.length)));
  const lines = s => reach.graph.lines.get(SKILL + s);
  const owner = new Map();
  const claim = (card, s) => {
    if (!scoped.has(s)) throw new Error(`${card}: ${s} is not in the scoped set`);
    if (owner.has(s)) throw new Error(`${s}: owned by ${owner.get(s)} and ${card}`);
    owner.set(s, card);
  };
  for (const [card, list] of Object.entries(OWN)) for (const s of list) claim(card, s);
  for (const [card, list] of Object.entries(EXTRA)) for (const s of list) claim(card, s);
  for (const [folder, k, prefix] of FOLDER_BATCHES) {
    const items = [...scoped].filter(s => dirname(s) === folder && !owner.has(s)).sort(byCodePoint);
    split(items, k, lines).forEach((chunk, i) => chunk.forEach(s => owner.set(s, `${prefix}-${i + 1}`)));
  }
  const missing = [...scoped].filter(s => !owner.has(s)).sort(byCodePoint);
  if (missing.length) throw new Error(`classes without an owner: ${missing.join(', ')}`);
  const sortedOwner = Object.fromEntries([...owner].sort(([a], [b]) => byCodePoint(a, b)));
  const cards = {};
  for (const [s, c] of Object.entries(sortedOwner)) (cards[c] ??= []).push(s);
  const cardLines = Object.fromEntries(Object.entries(cards).map(([c, l]) => [c, l.reduce((n, s) => n + lines(s), 0)]));
  return { owner: sortedOwner, cards, lines: cardLines };
}

/** Differences between two owner maps: [path, ours, theirs]. */
export function compareOwners(ours, theirs) {
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs)])].sort(byCodePoint);
  return keys.filter(k => ours[k] !== theirs[k]).map(k => [k, ours[k] ?? null, theirs[k] ?? null]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      dump: { type: 'string', default: 'D:/TAPTAPGAME_codex/reference/dump' },
      out: { type: 'string', default: 'D:/TAPTAPGAME_codex/studio/tmp/bp-owners.json' },
      compare: { type: 'string' },
    },
    strict: true,
  });
  const result = assignOwners(computeReach(values.dump));
  fs.mkdirSync(path.dirname(values.out), { recursive: true });
  fs.writeFileSync(values.out, `${JSON.stringify(result, null, 1)}\n`);
  const counts = Object.fromEntries(Object.entries(result.cards).map(([c, l]) => [c, `${l.length} classes, ${result.lines[c]} lines`]));
  console.error(counts);
  console.log(JSON.stringify({ out: values.out, classes: Object.keys(result.owner).length, cards: Object.keys(result.cards).length }));
  if (values.compare) {
    const diff = compareOwners(result.owner, JSON.parse(fs.readFileSync(values.compare, 'utf8')).owner);
    for (const [k, a, b] of diff) console.error(`differs: ${k}: ours ${a}, theirs ${b}`);
    console.log(JSON.stringify({ compare: values.compare, differences: diff.length }));
    if (diff.length) process.exit(1);
  }
}

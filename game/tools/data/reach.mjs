// Reachability of the Demo's skill blueprints (CatapultHero/BP/Skill/**), read-only on the dump. Two sets:
// - `live`: rooted at every live table row (no 过期 table, no 测试 row key) and every non-过期 non-skill blueprint,
//   closed over code references and parents. A port of the architect's step-0 content_stats.py (495 classes).
// - `scoped`: rooted at the in-scope rows of PROTOTYPE_SCOPE (tools/data/scope.mjs) and the live non-skill
//   blueprints, following DataTableRowHandles, code references and parents. A port of the planner's plan_scope.py
//   (349 classes); src/content/demo/reachable.ts and tools/bp/batches.mjs use it.
// Code references are read from the pseudo-code: `/Game/CatapultHero/...` paths and `<name>_C` class names.
import fs from 'node:fs';
import path from 'node:path';
import {
  NO_FOLLOW, OUT_NONSKILL, SCOPE_BOSS_TALENTS, SCOPE_ENEMIES, SCOPE_EXCLUDED_HERO_TAGS, SCOPE_ITEMS, SCOPE_MENTAL_STATES,
  SCOPE_PLAYERS, SCOPE_PROPS, SCOPE_REWARDS, SCOPE_SYSTEM_ITEMS, SCOPE_TASKS,
} from './scope.mjs';

const SKILL = '/BP/Skill/';
const GAME_REF = /\/Game\/(CatapultHero\/[^.'"]+)/g;
// Python's `(蓝图_…+?)_C\b`: the boundary is Unicode-aware there, so the lookahead stands in for \b.
const CLASS_NAME = /(蓝图_[^\s.'"(),:<>[\]{}]+?)_C(?![\p{L}\p{N}\p{Mn}\p{Mc}_])/gu;
const PARENT_LINE = /\/\/ parent chain: \/Game\/([^ .]+)/;

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Files of `dir` (sorted) before its subdirectories (sorted, recursively): the order os.walk yields them in. */
function walk(dir, ext) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => byCodePoint(a.name, b.name));
  const files = entries.filter(e => e.isFile() && e.name.endsWith(ext)).map(e => path.join(dir, e.name));
  const sub = entries.filter(e => e.isDirectory()).flatMap(e => walk(path.join(dir, e.name), ext));
  return [...files, ...sub];
}
const slash = p => p.split(path.sep).join('/');

/** Every pseudo file: asset path -> text, in os.walk order. */
export function readPseudo(dumpDir) {
  const root = path.join(dumpDir, 'blueprints-pseudo');
  const out = new Map();
  for (const file of walk(path.join(root, 'CatapultHero'), '.txt')) {
    out.set(slash(path.relative(root, file)).slice(0, -'.txt'.length), fs.readFileSync(file, 'utf8'));
  }
  return out;
}

/** Raw dump tables by table name (every table under 数据表/, 过期 included), rows as dumped. */
export function readRawTables(dumpDir) {
  const root = path.join(dumpDir, 'datatables', 'CatapultHero', '数据表');
  const out = new Map();
  for (const file of walk(root, '.json')) {
    out.set(path.basename(file, '.json'), { deprecated: slash(file).includes('/过期/'), rows: JSON.parse(fs.readFileSync(file, 'utf8')).rows ?? {} });
  }
  return out;
}

function* values(v) {
  yield v;
  if (Array.isArray(v)) for (const x of v) yield* values(x);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* values(x);
}
function gameRefs(text, out = new Set()) {
  for (const m of text.matchAll(GAME_REF)) out.add(m[1]);
  return out;
}
/** Class asset paths referenced by any string inside a row. */
function rowClassRefs(row) {
  const out = new Set();
  for (const v of values(row)) if (typeof v === 'string') gameRefs(v, out);
  return out;
}
/** (table, row) of every DataTableRowHandle inside a row (raw dump shape). */
function rowHandles(row) {
  const out = [];
  const visit = v => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!v || typeof v !== 'object') return;
    const keys = Object.keys(v);
    if (keys.length === 2 && 'DataTable' in v && 'RowName' in v) {
      const m = v.DataTable ? /\.([^.']+)'?$/.exec(v.DataTable) : null;
      if (m) out.push([m[1], v.RowName]);
      return;
    }
    Object.values(v).forEach(visit);
  };
  visit(row);
  return out;
}

/** Code graph of the pseudo files: skill classes, their pseudo-line counts, parents and code references. */
export function codeGraph(pseudo) {
  const skill = [...pseudo.keys()].filter(a => a.includes(SKILL));
  const skillSet = new Set(skill);
  const byName = new Map();
  for (const a of skill) byName.set(a.slice(a.lastIndexOf('/') + 1), a); // a later duplicate name wins, as in the script
  const lines = new Map();
  const parent = new Map();
  const refs = new Map();
  for (const [a, text] of pseudo) {
    lines.set(a, text.split('\n').length - 1);
    const to = new Set();
    for (const t of gameRefs(text)) if (skillSet.has(t) && t !== a) to.add(t);
    for (const m of text.matchAll(CLASS_NAME)) {
      const t = byName.get(m[1]);
      if (t !== undefined && t !== a) to.add(t);
    }
    refs.set(a, to);
    const p = PARENT_LINE.exec(text);
    if (p) parent.set(a, p[1]);
  }
  return { skill, skillSet, lines, parent, refs };
}

function closure(graph, seeds) {
  const out = new Set();
  const stack = [...seeds];
  while (stack.length) {
    const x = stack.pop();
    if (out.has(x) || !graph.skillSet.has(x)) continue;
    out.add(x);
    stack.push(...(graph.refs.get(x) ?? []));
    const p = graph.parent.get(x);
    if (p !== undefined && graph.skillSet.has(p)) stack.push(p);
  }
  return out;
}

/** The architect's live set (content_stats.py). */
export function liveSet(graph, tables) {
  const roots = new Set();
  for (const t of tables.values()) {
    if (t.deprecated) continue;
    for (const [key, row] of Object.entries(t.rows)) {
      if (key.includes('测试')) continue;
      for (const c of rowClassRefs(row)) if (c.includes(SKILL)) roots.add(c);
    }
  }
  for (const a of graph.refs.keys()) if (!a.includes(SKILL) && !a.includes('过期')) for (const c of graph.refs.get(a)) roots.add(c);
  return closure(graph, roots);
}

const tagsOf = row => ['类型', '标签'].flatMap(k => (Array.isArray(row[k]) ? row[k].filter(x => typeof x === 'string') : []));
const abilityClass = row => JSON.stringify(row.能力?.能力类 ?? null);

/** The in-scope root rows: 'table#row' keys. */
function scopeRoots(tables) {
  const rows = name => tables.get(name)?.rows ?? {};
  const roots = new Set();
  const add = (t, r) => roots.add(`${t}#${r}`);
  for (const [t, list] of Object.entries(SCOPE_ITEMS)) for (const r of list) add(t, r);
  for (const [t, r] of SCOPE_SYSTEM_ITEMS) add(t, r);
  for (const r of Object.keys(rows('数据表_天赋_新新通用'))) if (!tagsOf(rows('数据表_天赋_新新通用')[r]).some(x => x.includes('忽略'))) add('数据表_天赋_新新通用', r);
  for (const [r, row] of Object.entries(rows('数据表_天赋_专属'))) {
    const tags = tagsOf(row);
    if (tags.some(x => x.includes('忽略')) || tags.some(x => SCOPE_EXCLUDED_HERO_TAGS.some(h => x.includes(h)))) continue;
    add('数据表_天赋_专属', r);
  }
  for (const r of Object.keys(rows('数据表_天赋_boss专属'))) if (SCOPE_BOSS_TALENTS.includes(r)) add('数据表_天赋_boss专属', r);
  // 蓝图_能力_给自身加主动 reads 数据表_技能_默认[能力名]: an active talent links to the 默认 row of its own name.
  for (const t of ['数据表_天赋_新新通用', '数据表_天赋_专属', '数据表_天赋_boss专属']) {
    for (const [r, row] of Object.entries(rows(t))) {
      if (roots.has(`${t}#${r}`) && abilityClass(row).includes('给自身加主动') && Object.hasOwn(rows('数据表_技能_默认'), r)) add('数据表_技能_默认', r);
    }
  }
  for (const r of SCOPE_ENEMIES) {
    if (!Object.hasOwn(rows('数据表_敌人_普通'), r)) throw new Error(`scope: no enemy row ${r}`);
    add('数据表_敌人_普通', r);
  }
  for (const r of SCOPE_PLAYERS) if (Object.hasOwn(rows('数据表_玩家'), r)) add('数据表_玩家', r);
  const table = (t, list) => {
    for (const r of list) {
      if (!Object.hasOwn(rows(t), r)) throw new Error(`scope: no row ${t}#${r}`);
      add(t, r);
    }
  };
  table('数据表_道具_通用', SCOPE_PROPS);
  table('数据表_技能_奖励', SCOPE_REWARDS);
  for (const r of SCOPE_MENTAL_STATES) add('数据表_技能_精神状态', r);
  for (const r of SCOPE_TASKS) add('数据表_技能_任务', r);
  return roots;
}

/** The planner's scoped set (plan_scope.py), with the row references of every class reached through rows. */
export function scopedSet(graph, tables, pseudo) {
  const roots = scopeRoots(tables);
  const noFollow = new Set(NO_FOLLOW);
  const seen = new Set();
  const stack = [...roots];
  const rowRefs = new Map();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const [t, r] = [id.slice(0, id.indexOf('#')), id.slice(id.indexOf('#') + 1)];
    const rows = tables.get(t)?.rows;
    const row = rows && Object.hasOwn(rows, r) ? rows[r] : undefined;
    if (row === undefined) continue;
    for (const c of rowClassRefs(row)) {
      if (!rowRefs.has(c)) rowRefs.set(c, new Set());
      rowRefs.get(c).add(`${t}:${r}`);
    }
    for (const [ht, hr] of rowHandles(row)) if (!noFollow.has(ht) || roots.has(`${ht}#${hr}`)) stack.push(`${ht}#${hr}`);
    // 蓝图_能力_事件抉择 names its options in 参数[i].词条 (rows of the same table).
    if (abilityClass(row).includes('事件抉择')) {
      for (const p of row.参数 ?? []) {
        const name = p && typeof p === 'object' ? p.词条 : undefined;
        if (name && Object.hasOwn(rows, name)) stack.push(`${t}#${name}`);
      }
    }
  }
  const nonSkillRoots = new Set();
  for (const [a, text] of pseudo) {
    if (a.includes(SKILL) || OUT_NONSKILL.test(a)) continue;
    for (const c of gameRefs(text)) if (c.includes(SKILL)) nonSkillRoots.add(c);
    for (const c of graph.skill) if (text.includes(`${c.slice(c.lastIndexOf('/') + 1)}_C`)) nonSkillRoots.add(c);
  }
  const fromRows = closure(graph, rowRefs.keys());
  const fromBp = closure(graph, nonSkillRoots);
  const scoped = new Set([...fromRows, ...fromBp]);
  return { scoped, fromRows, onlyBp: new Set([...fromBp].filter(a => !fromRows.has(a))), rowRefs, rootRows: roots.size, followedRows: seen.size };
}

/** Both sets, sorted in code-point order. */
export function computeReach(dumpDir, pseudo = readPseudo(dumpDir)) {
  const graph = codeGraph(pseudo);
  const tables = readRawTables(dumpDir);
  const live = liveSet(graph, tables);
  const s = scopedSet(graph, tables, pseudo);
  const sorted = set => [...set].sort(byCodePoint);
  return { graph, live: sorted(live), scoped: sorted(s.scoped), onlyBp: sorted(s.onlyBp), rowRefs: s.rowRefs, rootRows: s.rootRows, followedRows: s.followedRows };
}

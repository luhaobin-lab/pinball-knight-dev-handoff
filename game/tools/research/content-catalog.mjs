// Read-only source/implementation catalogue. Writes only its explicitly selected output directory.
// node tools/research/content-catalog.mjs [--out spec/parity/catalog] [--report bot/report.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { buildDemoContent } from '../data/build.mjs';
import { computeReach, readPseudo } from '../data/reach.mjs';
import * as scope from '../data/scope.mjs';
import { mangle } from '../data/mangle.mjs';
import { assignOwners } from '../bp/batches.mjs';
import { registry, batches } from '../../src/content/bp/index.ts';
import { demoClasses } from '../../src/content/demo/classes.ts';
import { CORE_CLASSES, createWorld } from '../../src/core/sim/runtime.ts';
import { createSystems } from '../../src/core/sys/index.ts';
import { G2_SCOPE, g2Item, g2Talent, g2Enemy, g2Tile } from '../../src/core/sim/stage-scope.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { values } = parseArgs({ options: { out: { type: 'string', default: 'spec/parity/catalog' },
  reference: { type: 'string', default: 'D:/TAPTAPGAME_codex/reference' },
  report: { type: 'string', default: 'D:/TAPTAPGAME_codex/studio/review/g2-5cd47eb-r2/mix1000/report.json' },
}, strict: true });
const REF = path.resolve(values.reference), DUMP = path.join(REF, 'dump'), OUT = path.resolve(ROOT, values.out);
const allowed = [path.join(ROOT, 'spec/parity'), 'D:/TAPTAPGAME_codex/studio/reports'];
if (!allowed.some(base => OUT.startsWith(path.resolve(base) + path.sep))) throw Error('Output must be a dedicated spec/parity or new studio/reports directory');
const slash = p => p.replaceAll('\\', '/');
const sha = x => createHash('sha256').update(x).digest('hex');
const rel = p => slash(path.relative(ROOT, p));
const read = p => fs.readFileSync(p, 'utf8');
const json = p => JSON.parse(read(p));
const walk = (dir, ext = '') => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), ext) : e.name.endsWith(ext) ? [path.join(dir, e.name)] : []);
const refPath = p => slash(path.relative(REF, p));
const asset = s => typeof s === 'string' ? (s.match(/\/Game\/([^.'"]+)/)?.[1] ?? s.replace(/^\/Game\//, '').replace(/\.[^/]*$/, '')) : null;
const baseName = s => s?.slice(s.lastIndexOf('/') + 1);
const escapeRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lineOf = (text, needle) => { const n = text.indexOf(needle); return n < 0 ? null : text.slice(0, n).split('\n').length; };
const objects = (x, visit, key = '') => { visit(x, key); if (Array.isArray(x)) x.forEach((v, i) => objects(v, visit, `${key}[${i}]`));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) objects(v, visit, key ? `${key}.${k}` : k); };
const tagsOf = x => ['类型', '标签'].flatMap(k => Array.isArray(x[k]) ? x[k].filter(v => typeof v === 'string') : []);
const textOf = x => typeof x === 'string' ? x : x?.zh ?? x?.text ?? '';
const sum = (xs, f) => xs.reduce((n, x) => n + f(x), 0);

const sourceFiles = [];
function source(file, text = read(file)) {
  if (!sourceFiles.some(x => x.path === slash(file))) sourceFiles.push({ path: slash(file), bytes: Buffer.byteLength(text), sha256: sha(text) });
  return { path: refPath(file), sha256: sha(text) };
}
const normalized = buildDemoContent(DUMP); // Pure builder: checks all four composites against ordered parent merges.
const normalizedByName = new Map(normalized.tables.map(t => [t.name, t]));
const rawTables = walk(path.join(DUMP, 'datatables'), '.json').map(file => ({ file, text: read(file), data: json(file) }));
const tablesByAsset = new Map(rawTables.map(t => [asset(t.data.asset), t]));
const tablesByName = new Map(rawTables.map(t => [baseName(asset(t.data.asset)), t]));
const pseudo = readPseudo(DUMP), reach = computeReach(DUMP, pseudo), owners = assignOwners(reach);
const scoped = new Set(reach.scoped), live = new Set(reach.live);
const funcsMap = json(path.join(ROOT, 'tools/gen/fn-modules.json'));
const systems = createSystems();
const constructors = new Map([...CORE_CLASSES, ...Object.values(batches).flat()].map(c => [c.path, c]));
const batchByPath = new Map(Object.entries(batches).flatMap(([b, cs]) => cs.map(c => [c.path, b])));
const world = createWorld({ content: registry, seed: 1, filter: 'ported' }); // No game boot/commands or original game launch.
const report = fs.existsSync(values.report) ? json(values.report) : null;
const hits = new Map((report?.coverage?.classCounts ?? []).map(x => [x.path, x.count]));
const stubHits = new Map((report?.coverage?.stubsHit ?? []).map(x => [x.path, x.count]));
const sourceTs = [...walk(path.join(ROOT, 'src/content/bp'), '.ts'), ...walk(path.join(ROOT, 'src/core'), '.ts')]
  .map(file => ({ file, text: read(file) }));
const implementations = new Map();
for (const s of sourceTs) for (const m of s.text.matchAll(/static\s+(?:override\s+)?readonly\s+path(?:\s*:\s*[\w.]+)?\s*=\s*['"]([^'"]+)['"]/g)) {
  if (!implementations.has(m[1])) implementations.set(m[1], []);
  implementations.get(m[1]).push({ path: rel(s.file), line: lineOf(s.text, m[0]), text: s.text });
}
const tests = walk(path.join(ROOT, 'tests'), '.test.ts').map(file => ({ path: rel(file), text: read(file) }));
const sourceGaps = [];
for (const s of sourceTs) s.text.split('\n').forEach((line, i) => {
  if (/SPEC-GAP|UNKNOWN|TODO/.test(line)) sourceGaps.push({ path: rel(s.file), line: i + 1, text: line.trim() });
});
const itemAuditFile = 'D:/TAPTAPGAME_codex/studio/legacy/tmp/step0/reach.txt';
const itemAudit = new Map();
if (fs.existsSync(itemAuditFile)) read(itemAuditFile).split('\n').forEach((line, i) => {
  const p = line.split('|'); if (p.length >= 6) itemAudit.set(`${p[1]}#${p[2]}`, { status: p[0].trim(), generated: p[4], drops: p[5], tags: p[6]?.trim(), source: slash(itemAuditFile), line: i + 1 });
});

function classification(table, key, data) {
  const tags = tagsOf(data), ignore = tags.some(x => x.includes('忽略'));
  if (scope.SCOPE_ITEMS[table]) {
    const scoped = scope.SCOPE_ITEMS[table].includes(key), system = key === '锁定格';
    const old = itemAudit.get(`${table.replace('数据表_修炼物品_', '')}#${key}`);
    return { category: 'item', reachable: scoped ? 'demo-reachable-static' : system ? 'system-only' : 'excluded-by-demo-scope',
      basis: ignore ? 'Source ignore tag; locked cell remains system-only' : scoped ? 'Source-joined offer/drop/byproduct/craft reach audit; see route evidence and PROTOTYPE_SCOPE §8' : 'Other-boss/no-positive-source row in Demo',
      scopeEvidence: { path: 'studio/PROTOTYPE_SCOPE.md', line: scoped ? 501 : 533 }, routeEvidence: old ?? null,
      currentStage: system ? 'system' : g2Item(key) ? 'declared-g2' : key === '破损的神像' ? 'creation-only-stage-exception' : 'excluded-by-g2-item-whitelist' };
  }
  if (['数据表_天赋_新新通用', '数据表_天赋_专属', '数据表_天赋_boss专属'].includes(table)) {
    const excludedHero = tags.some(t => scope.SCOPE_EXCLUDED_HERO_TAGS.some(h => t.includes(h)));
    const reachable = !ignore && !excludedHero && (table !== '数据表_天赋_boss专属' || scope.SCOPE_BOSS_TALENTS.includes(key));
    const heroes = reachable ? ['幽冥骑士', '灵魂猎手'].filter(h => !tags.some(t => /幽冥骑士|灵魂猎手/.test(t) && !t.includes(h))) : [];
    return { category: 'talent', reachable: reachable ? 'demo-reachable-static' : 'excluded-by-demo-scope', heroes,
      basis: ignore ? 'Source ignore tag' : excludedHero ? 'Talent belongs to unavailable Plague/Elemental hero' : table === '数据表_天赋_boss专属' ? 'Only8 relics from Ruins boss tags reachable' : 'General or playable-hero offer filter; finite-run affordability is not proven',
      scopeEvidence: { path: 'studio/PROTOTYPE_SCOPE.md', line: 553 }, currentStage: g2Talent(key) ? 'declared-g2' : 'excluded-by-g2-talent-whitelist' };
  }
  if (table === '数据表_敌人_普通') return { category: key === '守门人' ? 'boss' : 'enemy', reachable: scope.SCOPE_ENEMIES.includes(key) ? 'demo-reachable-static' : 'excluded-by-demo-scope',
    basis: scope.SCOPE_ENEMIES.includes(key) ? 'Ruins/tutorial room pools or explicit enemy spawns' : 'Other chapter boss/spawn, zero-count corridor, unused/test row', scopeEvidence: { path: 'studio/PROTOTYPE_SCOPE.md', line: 312 },
    currentStage: g2Enemy(key) ? key === '守门人' ? `declared-boss-${G2_SCOPE.boss.fixedSkills.length}-source-skills` : 'declared-g2' : 'excluded-by-g2-enemy-whitelist' };
  if (table === '数据表_玩家') return { category: ['幽冥骑士', '灵魂猎手'].includes(key) ? 'hero' : 'npc-or-unavailable-hero',
    reachable: scope.SCOPE_PLAYERS.includes(key) ? 'demo-reachable-static' : 'excluded-by-demo-scope', basis: 'Demo selectable Knight/Hunter plus merchant/statue NPC',
    currentStage: ['幽冥骑士','灵魂猎手'].includes(key) ? 'playable-hero-source-skills-registered-runtime-coverage-separate' : 'not-g2-verified' };
  if (table === '数据表_地图格') return { category: 'map-tile', reachable: [...G2_SCOPE.tiles, '精英战斗', '抉择房', '传奇房', '恢复点', '锻造房', ...Array.from({ length: 7 }, (_, i) => `新手关0${i + 1}`)].includes(key) ? 'demo-reachable-static' : 'excluded-by-demo-scope',
    basis: 'PROTOTYPE_SCOPE §5 Demo map pool and tutorial fixed sequence', currentStage: g2Tile(key) ? 'declared-g2' : 'excluded-by-g2-map-whitelist' };
  if (table === '数据表_关卡_固定地点') return { category: 'room', reachable: 'requires-variant-predicate', basis: 'Each layer has chapter tags/spawn counts; row existence alone is not runtime reachability', currentStage: /战斗房_(简单|普通)/.test(key) ? 'only-variants-0-1' : 'stage-dependent' };
  if (table === '数据表_技能_诅咒祝福') return { category: 'curse-blessing', reachable: 'excluded-by-demo-scope', basis: 'Demo maximum abyss=-1; WAVE_B/PROTOTYPE_SCOPE exclude these18 rows', currentStage: 'not-g2' };
  return { category: /天赋|技能/.test(table) ? 'skill' : /道具/.test(table) ? 'prop' : /掉落池/.test(table) ? 'drop-pool' : /任务/.test(table) ? 'task' : /材料/.test(table) ? 'material' : 'other-table',
    reachable: 'reference-closure-pending', basis: 'Conservative row-handle closure from audited Demo roots; raw presence alone is not proof', currentStage: 'dependency-based' };
}

const tableInventory = [], rows = [], rowById = new Map();
for (const t of rawTables) {
  const a = asset(t.data.asset), name = baseName(a), norm = normalizedByName.get(name), provenance = source(t.file, t.text);
  const keys = Object.keys(t.data.rows ?? {}), parents = (t.data.parent_tables ?? []).map(asset);
  tableInventory.push({ name, asset: a, class: t.data.class, source: provenance, rowStruct: t.data.row_struct,
    rawRows: keys.length, importedRows: Object.keys(norm?.table.rows ?? {}).length, parents, deprecated: norm?.deprecated ?? false,
    dropped: norm?.dropped ?? {}, fields: t.data.row_struct_fields ?? [], compositionVerified: t.data.class === 'CompositeDataTable' ? true : null });
  for (const key of keys) {
    const kept = Object.hasOwn(norm?.table.rows ?? {}, key), data = kept ? norm.table.rows[key] : t.data.rows[key];
    const origins = parents.filter(p => Object.hasOwn(tablesByAsset.get(p)?.data.rows ?? {}, key));
    const origin = origins.at(-1), c = classification(name, key, data), refs = [], classes = new Set();
    objects(data, (v, field) => {
      if (v && typeof v === 'object' && 'DataTable' in v && 'RowName' in v && v.DataTable) refs.push({ table: baseName(asset(v.DataTable)), row: v.RowName, field });
      if (typeof v === 'string') { const p = asset(v); if (p?.includes('/BP/Skill/')) classes.add(p); }
    });
    if (data.能力?.能力类?.includes('给自身加主动') && tablesByName.get('数据表_技能_默认')?.data.rows[key]) refs.push({ table: '数据表_技能_默认', row: key, field: 'dynamic: ability name -> 默认 row (source 给自身加主动)' });
    if (data.能力?.能力类?.includes('事件抉择')) for (const p of data.参数 ?? []) if (t.data.rows[p.词条]) refs.push({ table: name, row: p.词条, field: 'dynamic:事件抉择 parameter option row' });
    const row = { id: `${name}#${key}`, table: name, row: key, asset: a, displayName: textOf(data.描述?.[0]) || textOf(data.额外描述?.[0]) || key,
      description: Array.isArray(data.描述) ? data.描述.map(textOf) : textOf(data.描述), source: { ...provenance, line: lineOf(t.text, `  ${JSON.stringify(key)}:`), pointer: `/rows/${key.replaceAll('~', '~0').replaceAll('/', '~1')}` },
      composite: parents.length > 0, compositeOrigins: origins, canonicalId: origin ? `${baseName(origin)}#${key}` : `${name}#${key}`,
      imported: kept, importFlags: norm?.flags?.[key] ?? null, importDropReason: norm?.dropped?.[key] ?? null,
      ...c, tags: tagsOf(data), data, rowReferences: refs, directClasses: [...classes], rowClosure: [], requiredClasses: [],
      implementation: null, differences: [] };
    rows.push(row); rowById.set(row.id, row);
  }
}
// Resolve composite table handles to their winning physical row, without counting merged aliases as new content.
const canonical = id => rowById.get(id)?.canonicalId ?? id;
for (const r of rows) r.rowReferences = r.rowReferences.map(x => ({ ...x, target: canonical(`${x.table}#${x.row}`), exists: rowById.has(`${x.table}#${x.row}`) }));
const scopedRows = new Set(rows.filter(r => !r.composite && r.reachable === 'demo-reachable-static').map(r => r.id));
for (const [table, list] of [['数据表_道具_通用', scope.SCOPE_PROPS], ['数据表_技能_奖励', scope.SCOPE_REWARDS], ['数据表_技能_精神状态', scope.SCOPE_MENTAL_STATES], ['数据表_技能_任务', scope.SCOPE_TASKS]])
  for (const key of list) scopedRows.add(`${table}#${key}`);
const noFollow = new Set(scope.NO_FOLLOW), todoRows = [...scopedRows];
for (let i = 0; i < todoRows.length; i++) for (const edge of rowById.get(todoRows[i])?.rowReferences ?? []) {
  if (!edge.exists || noFollow.has(edge.table) && !scopedRows.has(edge.target)) continue;
  if (!scopedRows.has(edge.target)) { scopedRows.add(edge.target); todoRows.push(edge.target); }
}
for (const row of rows) {
  if (row.composite) { const c = rowById.get(row.canonicalId); if (c) for (const k of ['category', 'reachable', 'basis', 'scopeEvidence', 'routeEvidence', 'heroes', 'currentStage']) row[k] = c[k]; }
  else if (row.reachable === 'reference-closure-pending') row.reachable = scopedRows.has(row.id) ? 'demo-dependency-static' : 'not-reached-by-audited-roots';
}
const incomingRows = new Map();
for (const from of rows.filter(r => !r.composite)) for (const edge of from.rowReferences) {
  if (!incomingRows.has(edge.target)) incomingRows.set(edge.target, []);
  incomingRows.get(edge.target).push({ from: from.id, field: edge.field, source: from.source });
}
for (const row of rows) row.incomingReferences = incomingRows.get(row.canonicalId) ?? [];

const bpFiles = walk(path.join(DUMP, 'blueprints'), '.json'), classes = [], functions = [];
const shortClassPaths = new Map();
for (const p of pseudo.keys()) { const n = baseName(p); if (!shortClassPaths.has(n)) shortClassPaths.set(n, []); shortClassPaths.get(n).push(p); }
for (const file of bpFiles) {
  const bpText = read(file), bp = JSON.parse(bpText), p = asset(bp.asset), name = bp.class?.replace(/_C$/, '') ?? baseName(p);
  const pseudoText = pseudo.get(p) ?? '', pseudoFile = path.join(DUMP, 'blueprints-pseudo', `${p}.txt`);
  const impl = implementations.get(p) ?? [], ctor = constructors.get(p), route = funcsMap.modules?.[name] ?? {};
  const ownMethods = ctor ? Object.getOwnPropertyNames(ctor.prototype).filter(x => x !== 'constructor' && typeof Object.getOwnPropertyDescriptor(ctor.prototype, x)?.value === 'function') : [];
  // The legacy reach graph's last-wins short-name map confuses enemy/item classes both named 吸血.
  // Per-row debt uses qualified asset paths from raw JSON, not that ambiguous convenience graph.
  const qualifiedRefs = new Set();
  objects(bp, value => { if (typeof value === 'string') for (const match of value.matchAll(/\/Game\/(CatapultHero\/[^.'"\s]+)/g))
    if (match[1].includes('/BP/Skill/') && match[1] !== p) qualifiedRefs.add(match[1]); });
  const ambiguousShortNames = [...shortClassPaths].filter(([n, ps]) => ps.length > 1 && pseudoText.includes(`${n}_C`)).map(([name, candidates]) => ({ name, candidates }));
  const c = { path: p, name, kind: demoClasses[p]?.kind ?? (bp.type === 'WidgetBlueprintGeneratedClass' ? 'widget' : 'other'), source: source(file, bpText),
    pseudo: fs.existsSync(pseudoFile) ? source(pseudoFile, pseudoText) : null, parent: asset(bp.parent), parentChain: (bp.parent_chain ?? []).map(asset),
    sourceVariables: bp.variables ?? [], cdo: bp.cdo?.properties ?? {}, inheritedDefaults: demoClasses[p]?.vars ?? null, inheritedOverrides: demoClasses[p]?.overrides ?? null,
    components: bp.components ?? [], componentOverrides: bp.component_overrides ?? [], timelines: bp.timelines ?? {},
    reachability: p.includes('/BP/Skill/') ? scoped.has(p) ? 'demo-scoped-closure' : live.has(p) ? 'broad-live-outside-demo-scope' : 'not-reached-static' : 'non-skill-owner-audit-required',
    registered: !!ctor, registration: ctor ? batchByPath.get(p) ?? 'core-generated' : 'runtime-manifest-fallback',
    expectedOwner: owners.owner[p.replace('CatapultHero/BP/Skill/', '')] ?? null,
    implementation: impl.map(({ text, ...loc }) => loc), ownMethods, observedInstances: hits.get(p) ?? 0, observedStubInstances: stubHits.get(p) ?? 0,
    verification: 'Original-runtime behaviour not certified by registration, imports, methods, test names or instance counts.',
    testsMentioning: tests.filter(t => t.text.includes(p) || t.text.includes(name)).map(t => ({ path: t.path, line: lineOf(t.text, t.text.includes(p) ? p : name) })),
    differences: !ctor ? ['No registered implementation; source class resolves to an inherited manifest fallback when instantiated'] : [],
    codeReferences: [...qualifiedRefs], ambiguousShortNames, functionIds: [] };
  for (const fn of bp.functions ?? []) {
    const tsName = mangle(fn.name), module = route[fn.name] ?? null;
    let status = 'no-registered-override', methodOwner = null;
    if (module) status = ['engine', 'dead', 'math', 'present'].includes(module) ? `facade-${module}` : typeof systems[module]?.[name]?.[tsName] === 'function' ? 'facade-hook-present' : 'facade-hook-missing';
    else if (fn.name.startsWith('ExecuteUbergraph_')) status = 'source-graph-split-across-events';
    else if (ctor) {
      for (let proto = ctor.prototype; proto; proto = Object.getPrototypeOf(proto)) if (typeof Object.getOwnPropertyDescriptor(proto, tsName)?.value === 'function') {
        methodOwner = proto.constructor.path ?? proto.constructor.name; status = methodOwner === p ? 'own-method-present-unverified' : 'inherited-method-only-needs-source-comparison'; break;
      }
    }
    const implementation = module && !['engine', 'dead', 'math', 'present'].includes(module)
      ? sourceTs.filter(s => rel(s.file).startsWith(`src/core/sys/${module}/`) && s.text.includes(tsName)).map(s => ({ path: rel(s.file), line: lineOf(s.text, tsName) }))
      : (implementations.get(methodOwner ?? p) ?? []).filter(s => s.text.includes(tsName)).map(s => ({ path: s.path, line: lineOf(s.text, tsName) }));
    const f = { id: `${p}::${fn.name}`, class: p, name: fn.name, flags: fn.flags, overrides: fn.overrides ?? null, params: fn.params ?? [],
      source: { path: refPath(pseudoFile), line: lineOf(pseudoText, `function ${fn.name}(`), json: refPath(file), pointer: `/functions/${(bp.functions ?? []).indexOf(fn)}` },
      bytecodeInstructions: fn.bytecode?.length ?? 0, endsInEndOfScript: fn.bytecode?.at(-1)?.op === 'EndOfScript', module, status, methodOwner, implementation };
    functions.push(f); c.functionIds.push(f.id);
  }
  classes.push(c);
}
const byClass = new Map(classes.map(c => [c.path, c]));
for (const row of rows) {
  const visitedRows = new Set(), required = new Set(), queue = [row.id];
  for (let i = 0; i < queue.length; i++) {
    const id = canonical(queue[i]); if (visitedRows.has(id)) continue; visitedRows.add(id);
    const r = rowById.get(id); if (!r) continue;
    for (const p of r.directClasses) required.add(p);
    for (const e of r.rowReferences) if (e.exists && /技能|天赋/.test(e.table)) queue.push(e.target);
  }
  const pending = [...required];
  for (let i = 0; i < pending.length; i++) {
    const c = byClass.get(pending[i]); if (!c) continue;
    if (c.parent?.includes('/BP/Skill/') && !required.has(c.parent)) { required.add(c.parent); pending.push(c.parent); }
    // Framework classes contain all-purpose spawn helpers; following all of them would falsely make every item require all content.
    if (CORE_CLASSES.some(k => k.path === c.path)) continue;
    for (const p of c.codeReferences) if (!required.has(p)) { required.add(p); pending.push(p); }
  }
  row.rowClosure = [...visitedRows].filter(x => x !== row.canonicalId);
  row.requiredClasses = [...required].sort();
  const missing = row.requiredClasses.filter(p => !constructors.has(p)), directMissing = row.directClasses.filter(p => !constructors.has(p));
  let advertised = null;
  if (row.imported && !row.composite) try { advertised = world.isRowPorted(row.asset, row.row); } catch { advertised = null; }
  row.implementation = { directCount: row.directClasses.length, directMissing, dependencyCount: required.size, missing,
    sourcePresentCount: row.requiredClasses.filter(p => implementations.has(p)).length,
    registeredCount: row.requiredClasses.filter(p => constructors.has(p)).length,
    shallowRuntimeIsRowPorted: advertised,
    status: missing.length ? 'missing-behaviour-dependencies' : required.size ? 'dependencies-present-behaviour-unverified' : 'data-only-no-behaviour-proof',
    locations: row.requiredClasses.flatMap(p => (implementations.get(p) ?? []).map(({ text, ...loc }) => ({ class: p, ...loc }))),
    behaviourVerifiedAgainstOriginal: false };
  if (missing.length) row.differences.push(`${missing.length}/${required.size} source dependency classes lack a registered implementation`);
  if (/excluded|only|no-actives|not-g2/.test(row.currentStage)) row.differences.push(`Current production filter: ${row.currentStage}`);
  if (!row.imported) row.differences.push(`Importer omitted raw row: ${row.importDropReason}`);
  if (row.row === G2_SCOPE.boss.row && row.table === '数据表_敌人_普通') row.differences.push(`Current boss projection omits source fixed skills: ${(row.data.固定技能 ?? []).filter(h => !G2_SCOPE.boss.fixedSkills.includes(h.RowName)).map(h => h.RowName).join(', ')}`);
  row.differences.push('No complete original-runtime parity receipt attached to this row');
  if (['enemy', 'boss', 'hero', 'npc-or-unavailable-hero', 'item'].includes(row.category)) {
    const family = key => (row.data[key] ?? []).map(h => {
      const target = rowById.get(canonical(`${baseName(asset(h.DataTable))}#${h.RowName}`));
      const skill = target?.data;
      return { handle: h, source: target?.source ?? null, rowId: target?.id ?? null,
        description: skill ? textOf(skill.描述) : null, parameters: skill?.参数 ?? null,
        conditions: skill ? { main: skill.主条件, secondary: skill.副条件 } : null,
        timingAndTarget: skill ? { cooldownSeconds: skill.冷却秒, cooldownTurns: skill.冷却回合, chant: skill.吟唱, cost: skill.消耗,
          range: skill.技能距离, area: skill['范围攻击？'], triggersCombat: skill['触发战斗？'], damageMultiplier: skill.伤害修正, impulse: skill.冲击力,
          tags: skill.标签, abilityType: skill.类型 } : null,
        classAndEffects: skill?.能力 ?? null, missingDependencies: target?.implementation?.missing ?? null };
    });
    row.mechanics = { fixedSkills: family('固定技能'), randomNormalSkills: family('随机普通技能'), randomEliteSkills: family('随机精英技能'),
      actorStats: row.data.属性 ?? null, scientificAttributes: row.data.科学词条 ?? null, description: row.description,
      implementationPaths: ['src/core/sys/ai/index.ts', 'src/core/sys/ability/ability.ts', 'src/core/sys/turn/loop.ts'],
      sourceBehaviour: [{ path: 'dump/blueprints-pseudo/CatapultHero/BP/Actor/BP_Actor_Other.txt', line: 34, role: 'elite choice and growth' },
        { path: 'dump/blueprints-pseudo/CatapultHero/BP/Actor/BP_ManeActor.txt', line: 4355, role: 'skill choice' },
        { path: 'dump/blueprints-pseudo/CatapultHero/BP/Actor/BP_ManeActor.txt', line: 4478, role: 'skill condition loop' },
        { path: 'spec-drafts/enemy-ai-intents.md', line: 1, role: 'label-mapped AI behaviour specification' }],
      aiCodeDifferences: sourceGaps.filter(g => /src\/core\/sys\/(ai|physics|ability)\//.test(g.path)),
      targetSelectionNote: 'Skill range/conditions are source data. AI activation order, charge/AP, target queries and chosen skill execution require Blueprint comparison; missing child ability/projectile/effect classes below are not satisfied by a shared AI loop.' };
  }
}
for (const row of rows) if (row.mechanics) for (const family of ['fixedSkills', 'randomNormalSkills', 'randomEliteSkills'])
  for (const skill of row.mechanics[family]) skill.missingDependencies = rowById.get(skill.rowId)?.implementation?.missing ?? null;

const nativeFile = path.join(DUMP, 'native/CatapultHero.json'), native = json(nativeFile), deepFiles = walk(path.join(DUMP, 'native/deep'), '.asm');
const deepFunctions = json(path.join(DUMP, 'native/deep/_functions.json'));
const nativeFunctions = Object.entries(native.classes).flatMap(([name, c]) => (c.functions ?? []).map(f => ({ class: name, ...f,
  reflected: true, source: { ...source(nativeFile), line: lineOf(read(nativeFile), `"name": ${JSON.stringify(f.name)}`) },
  thunkDisassembly: fs.existsSync(path.join(DUMP, `native/disasm/${name}.${f.name}.asm`)) ? `dump/native/disasm/${name}.${f.name}.asm` : null,
  recursiveDisassembly: fs.existsSync(path.join(DUMP, `native/deep/${name}.${f.name}.asm`)) ? `dump/native/deep/${name}.${f.name}.asm` : null,
  implementation: sourceTs.filter(s => s.text.includes(f.name)).map(s => ({ path: rel(s.file), line: lineOf(s.text, f.name) })),
  behaviourVerifiedAgainstOriginal: false,
})));
const nativeGaps = [];
for (const name of ['native-trajectory.md', 'core-math.md']) {
  const file = path.join(REF, 'spec-drafts', name), lines = read(file).split('\n'); source(file);
  lines.forEach((line, i) => { if (/^[-|].*(UNKNOWN|SPEC-GAP)|^-[ ]+\*\*U-/.test(line)) nativeGaps.push({ path: refPath(file), line: i + 1, text: line.trim(), status: 'historical-source-gap-needs-current-resolution' }); });
}
const nativeInventory = {
  classes: native.classes, reflectedFunctions: nativeFunctions, structs: native.structs, enums: native.enums,
  disasmFileCount: walk(path.join(DUMP, 'native/disasm'), '.asm').length,
  recursiveDisasmFileCount: deepFiles.length, recursiveFunctions: deepFunctions,
  provenance: json(path.join(DUMP, 'native/deep/_provenance.json')),
  reportDrift: 'dump/REPORT.md only-thunk/no-followup wording is stale: deep recursive launch disassembly and native-trajectory.md now exist.',
  newReferenceWork: { binaryHashReconfirmedByCoordinator: 'ccd1db79c2eb3668242c4c10d271234963bc9dc1efa3ec0afddace444d1afcab', roomMaskExtraction: 'D:/TAPTAPGAME_codex/studio/reference-session-20261027/room-masks', status: 'Coordinator reports newly decoded masks; historical missing-room-shape wording is retained as historical, not asserted current. Runtime collision integration still requires validation.' },
  prdFreshEvidence: { path: 'D:/TAPTAPGAME_codex/studio/reference-session-20261027/native-prd-final/manifest.json',
    manifest: json('D:/TAPTAPGAME_codex/studio/reference-session-20261027/native-prd-final/manifest.json'),
    producer: 'tools/reverse/prd-evidence.py commit be8ac31',
    interpretation: 'Complete contiguous native ranges include the three-rand open-interval helper and geometric skip/rejection. Actual wrappers now use the independently reviewed reconstruction and numeric machine-code oracle; global stream initialization/interleaving and rare libm boundaries remain separate gaps.',
    numericOracle: 'D:/TAPTAPGAME_codex/studio/reference-session-20261027/native-prd-oracle-0522/vectors.json' },
  criticalGaps: [
    { id: 'NATIVE-PRD-SEQUENCE', priority: 'P1', source: 'spec-drafts/core-math.md:487-572', implementation: 'src/core/math/prd-native.ts',
      description: 'Actual native skip/rejection and raw draw counts match the bounded original-machine-code oracle. CfromP was analyzed separately; rare JS/native log rounding and original whole-game stream order are not certified. The historical shallow46byte fragment and distribution-only shortcut remain superseded provenance, not current implementation.' },
    { id: 'NATIVE-ENGINE-COLLISION', priority: 'P0', source: 'spec-drafts/native-trajectory.md:2226-2237', implementation: 'src/core/launch/world.ts',
      description: 'Contact inflation/touching/MTD corners, item tie order, follower/latent ordering and actor iteration order need original-runtime traces. Synthetic/ideal vectors and self-determinism do not certify the shipped Chaos result.' },
    { id: 'NATIVE-RNG-DOMAINS', priority: 'P0', source: 'spec-drafts/core-math.md:637-700', implementation: 'src/core/rng/domains.ts',
      description: 'Unseeded engine draws are replaced with seeded domains; original global initialization/interleaving remain unresolved. Local UCRT rand primitive was directly compared for1536 draws, but that does not prove the complete original stream order.' },
    { id: 'NATIVE-VFX', priority: 'P1', source: 'spec-drafts/native-trajectory.md:2230', implementation: 'src/game/launch-preview.ts',
      description: 'Niagara modules consuming pulse fields were not recovered as executable graphs. Existing approved procedural effects must be restored; raw metadata cannot prove original timing/brightness parity.' },
  ], historicalGapLines: nativeGaps,
};

const schemaAssets = Object.fromEntries(['structs', 'enums', 'curves', 'levels'].map(kind => [kind,
  walk(path.join(DUMP, kind), '.json').map(file => ({ ...source(file), data: json(file) }))]));
const reusableExtractionTools = [
  ['tools/py/decompress_iostore.py', 'Reads .utoc/.ucas, Oodle-decompresses to independent work/paks', 'Requires explicit decompressor path; do not run old absolute wrapper'],
  ['tools/py/reflect_exe.py', 'Statically extracts reflection and .usmap from shipping PE', 'Read sourcebinary only; all outputs must target independent studio'],
  ['tools/RaDump/Program.cs', 'CUE4Parse package/export dump with ScriptData', 'Existing cleaned dump complete; re-extract only missing evidence'],
  ['tools/py/build_dump.py', 'Cleans raw JSON into tables/Blueprints/widgets/native metadata', 'Old CLI has external localization/root dependencies; parameterize before execution'],
  ['tools/py/kismet_pseudo.py', 'Decoded Blueprint bytecode to labeled pseudo text', '5240streams currently complete; keep raw-bytecode provenance'],
  ['tools/py/disasm_native.py', 'Depth-limited native exec-thunk recursion with annotated constants', 'Deep launch and complete contiguous PRD extraction exist; consult their saved provenance before repeating'],
  ['tools/run_all.sh', 'Historical full six-stage extraction wrapper', 'DO NOT EXECUTE AS-IS: writes old D:/TAPTAPGAME_ref and contains rm -rf; catalogue does not invoke it'],
].map(([p, role, constraint]) => ({ source: source(path.join(REF, p)), role, constraint, executed: false }));
const dependencyFanout = reach.scoped.filter(p => !constructors.has(p)).map(p => ({ class: p,
  owner: owners.owner[p.replace('CatapultHero/BP/Skill/', '')], affectedRows: rows.filter(r => !r.composite && r.reachable === 'demo-reachable-static' && r.requiredClasses.includes(p)).map(r => r.id),
  sourcePseudoLines: reach.graph.lines.get(p) ?? 0 })).sort((a, b) => b.affectedRows.length - a.affectedRows.length || a.sourcePseudoLines - b.sourcePseudoLines);

const primary = rows.filter(r => !r.composite), byCategory = {};
for (const category of [...new Set(primary.map(r => r.category))]) {
  const all = primary.filter(r => r.category === category), demo = all.filter(r => r.reachable === 'demo-reachable-static');
  byCategory[category] = { all: all.length, demoReachable: demo.length, systemOnly: all.filter(r => r.reachable === 'system-only').length,
    missingDependencies: demo.filter(r => r.implementation.missing.length).length, dependenciesPresentNotVerified: demo.filter(r => !r.implementation.missing.length).length,
    currentG2Declared: demo.filter(r => /^declared-g2/.test(r.currentStage)).length, originalRuntimeVerified: 0 };
}
const batchesSummary = Object.entries(owners.cards).map(([owner, paths]) => {
  const ps = paths.map(p => 'CatapultHero/BP/Skill/' + p), missing = ps.filter(p => !constructors.has(p));
  return { owner, sourceClasses: ps.length, missingClasses: missing.length, registeredClasses: ps.length - missing.length,
    sourcePseudoLines: owners.lines[owner], affectedReachableRows: primary.filter(r => r.reachable === 'demo-reachable-static' && r.requiredClasses.some(p => missing.includes(p))).map(r => r.id),
    missing, present: ps.filter(p => constructors.has(p)) };
});
const sourceFunctionMissing = functions.filter(f => f.status === 'facade-hook-missing');
const priority = [
  { rank: 0, id: 'feel-native-reference', reason: 'Producer explicitly rejected roll/ricochet/effect/environment behaviour; establish exact original capture and restore existing approved presentation before another thin-loop claim.', owners: ['root-reference', 'parity-launch', 'parity-presentation'], evidence: ['studio/control/USER-REVISION-20261027.md', 'nativeInventory.criticalGaps'] },
  { rank: 1, id: 'gatekeeper-complete', owners: ['boss-gatekeeper'], reason: `Current stage declares ${G2_SCOPE.boss.fixedSkills.length} boss skills. Declaration alone does not verify both phases, telegraphs, timing, attacks or original runtime parity; inspect exact-commit runtime evidence.`, prerequisites: ['hazard/projectile render bridge', 'original boss replay'], rows: ['数据表_敌人_普通#守门人'] },
  { rank: 2, id: 'room-tutorial-enemy-admission', owners: ['core-room', 'sys-tutorial', 'enemy-eyeball-ghost', 'enemy-crystal-brain', 'env-hazards'], reason: `Current stage declares ${G2_SCOPE.enemies.length} enemy rows and ${G2_SCOPE.combatVariants.length} ordinary combat variants. Validate current room shapes, authored child collisions, fog and ordinary tutorial entry from runtime evidence; this static catalogue cannot establish those paths.`, prerequisites: ['source shape/collision traces', 'real UI input and projectile presentation'] },
  { rank: 3, id: 'inventory-economy-state', owners: ['sys-craft', 'sys-enchant', 'sys-shop-events', 'sys-camp-meta', 'sys-save'], reason: 'Reachable recipes/enchant/event/reward/save lifecycle are not optional under the revised complete-Demo target. They unlock broad item routes; implement before counting content admission.' },
  { rank: 4, id: 'hero-and-passive-content', owners: ['bp-hero-knight', 'bp-hero-hunter', 'bp-items-1', 'bp-items-2', 'bp-items-3', 'bp-items-4', 'bp-items-5', 'bp-items-6', 'bp-talents-1', 'bp-talents-2', 'bp-talents-3'], reason: 'Port by shared missing dependency fan-out, not by number of empty registrations. Test trigger/cost/target/duration/cleanup and original runtime comparison per mechanism.' },
  { rank: 5, id: 'full-filter-reference-acceptance', owners: ['integration', 'verify-items', 'verify-talents'], reason: 'Remove G2 stage exclusions only after each natural source route has working dependencies. All-mode alone currently permits fallback stubs; bot self-consistency alone is not parity.' },
];
const inventoryCounts = Object.fromEntries(['datatables', 'blueprints', 'blueprints-pseudo', 'widgets', 'curves', 'structs', 'enums', 'levels', 'config'].map(d => [d, walk(path.join(DUMP, d)).length]));
const catalogue = { schemaVersion: 1, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  sourceTree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  referenceRoot: slash(REF), generatedBy: 'tools/research/content-catalog.mjs',
  decision: 'G2 rejected by producer. This is a complete source inventory and evidence-qualified implementation debt catalogue, not a completion claim.',
  methodology: [
    'All49 raw tables retained including composite aliases/deprecated/test rows. Physical row counts exclude composite aliases.',
    'Demo reachable labels are static code-and-audit classifications, not proof every row was observed in finite gameplay. All source values and references remain inspectable.',
    'The172items/93talents/14enemies hypotheses are checked against raw rows, source tags and historical audited routes. Item byproduct routes remain explicitly audit-backed rather than pretending an exhaustive engine reachability proof.',
    'Required classes traverse skill/talent row handles, dynamic active-talent/event links, inheritance and qualified raw-JSON content references; generic core framework reference fan-out is excluded to avoid every item requiring every class. Ambiguous duplicate short names are recorded and never redirected by last-wins lookup.',
    'Registered/method-present/source-tests/instantiated are separate from original-runtime behaviour verified. No row is asserted parity-complete.',
    'Presentation routes are facade-present, not miscounted as missing simulation hooks; they still require independent renderer/cue wiring proof. Existing approved effects cannot be excused as new placeholders.',
    'Runtime isRowPorted is shallow and does not prove complete recursive source behaviour; catalogue lists missing dependencies independently.',
  ],
  summary: { rawInventoryFiles: inventoryCounts, tables: tableInventory.length, rawTableRowsIncludingCompositeAliases: rows.length,
    physicalRows: primary.length, compositeAliases: rows.length - primary.length, blueprintClasses: classes.length, blueprintFunctions: functions.length,
    decodedFunctionsEndingInEndOfScript: functions.filter(f => f.endsInEndOfScript).length,
    skillClasses: reach.graph.skill.length, broadlyLiveSkillClasses: reach.live.length, demoScopedSkillClasses: reach.scoped.length,
    demoScopedRegistered: reach.scoped.filter(p => constructors.has(p)).length, demoScopedMissing: reach.scoped.filter(p => !constructors.has(p)).length,
    contentRegistry: registry.size, coreClasses: CORE_CLASSES.length, missingFacadeHooks: sourceFunctionMissing.length,
    categories: byCategory, nativeReflectedFunctions: nativeFunctions.length,
    heroTalentReach: Object.fromEntries(['幽冥骑士', '灵魂猎手'].map(h => [h, primary.filter(r => r.category === 'talent' && r.heroes?.includes(h)).length])),
    artifactCountNotes: ['widgets113 files =112 widgetassets +_engine_defaults.json', 'config11 files includes _pak_files.json manifest; originalreport10configdatafiles', 'native deep29asmfiles contain119 indexed functions; shallow UFunction disasm48 files'] },
  evidence: { extractionReport: 'dump/REPORT.md', extractionStats: json(path.join(DUMP, 'stats.json')), importedManifest: json(path.join(ROOT, 'src/content/demo/manifest.json')),
    observedRun: report ? { path: slash(path.resolve(values.report)), sha256: sha(read(values.report)), stage: 'prior G2 filtered content; not complete Demo', runs: report.runs, stubs: report.coverage?.stubsHit, unported: report.coverage?.unportedCalls } : null },
  tables: tableInventory, rows, classes, functions, nativeInventory, schemaAssets, reusableExtractionTools, sourceGaps, batches: batchesSummary, dependencyFanout, priority,
  countsThatMustNotBeConflated: ['2546 raw table rows includes970 composite aliases; the importer retains950 aliases after test-row filtering', '172items counts source physical loot rows, not all imported item aliases', '349 scoped skill dependencies is the legacy scope closure;590 is the full skill dump, and ambiguous short-name edges are disclosed separately', '104registry/107scoped available includes base plumbing, not107 certified behaviours', 'Data bytecode decoding and tests are not full original-runtime parity'],
  sourceFiles,
};
const errors = [];
if (tableInventory.length !== 49 || rows.length !== 2546 || classes.length !== 793 || functions.length !== 5240) errors.push('Extraction counts changed; investigate raw dump before using old scope totals');
for (const [category, n] of [['item', 172], ['talent', 93]]) if (byCategory[category].demoReachable !== n) errors.push(`${category} reachable ${byCategory[category].demoReachable} != audited${n}`);
if (byCategory.enemy.demoReachable + byCategory.boss.demoReachable !== 14) errors.push('enemy/boss scope mismatch');
for (const row of rows) if (!row.source.line || !Object.hasOwn(row, 'data')) errors.push(`missing exact source/data ${row.id}`);
for (const c of classes) if (!c.pseudo) errors.push(`missing pseudo ${c.path}`);
for (const [table, names] of Object.entries(scope.SCOPE_ITEMS)) for (const name of names) if (!rowById.has(`${table}#${name}`)) errors.push(`audited item root missing in raw source:${table}#${name}`);
if (primary.filter(r => r.category === 'item' && r.reachable === 'demo-reachable-static' && r.tags.some(t => t.includes('忽略'))).length) errors.push('audited loot root carries ignore tag; re-check scope');
catalogue.validation = { errors, sourceValuesIncluded: true, compositeParentMergeChecked: true, registrationReadFromRuntimeRegistry: true,
  rowIdsUnique: rowById.size === rows.length, sourceFunctionCountChecked: true, generatedOnlyNoGameplayWrites: true };
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalogue, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ sourceCommit: catalogue.sourceCommit, summary: catalogue.summary, validation: catalogue.validation, batches: batchesSummary, priority, nativeCriticalGaps: nativeInventory.criticalGaps }, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'priority-queue.json'), JSON.stringify({ sourceCommit: catalogue.sourceCommit, priority, batches: batchesSummary, dependencyFanout }, null, 2) + '\n');
const { makeHtml } = await import('./catalog-html.mjs');
fs.writeFileSync(path.join(OUT, 'index.html'), makeHtml(catalogue));
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ sourceCommit: catalogue.sourceCommit,
  outputs: ['catalog.json', 'summary.json', 'priority-queue.json', 'index.html'].map(name => ({ name, bytes: fs.statSync(path.join(OUT, name)).size, sha256: sha(fs.readFileSync(path.join(OUT, name))) })), sourceFiles: sourceFiles.length,
  readOnlyReference: true, validationErrors: errors }, null, 2) + '\n');
console.log(JSON.stringify({ out: slash(OUT), summary: catalogue.summary, errors }, null, 2));
process.exitCode = errors.length ? 1 : 0;

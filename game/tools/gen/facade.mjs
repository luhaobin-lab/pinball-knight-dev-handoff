#!/usr/bin/env node
/**
 * The facade generator (WAVE_A §3.6, decision D8). Reads the pseudo-code of the 19 Demo system classes and writes their
 * TypeScript declarations: one field per blueprint variable (CDO default, D11 name) and one method per Demo function
 * that delegates to exactly one system module (`tools/gen/fn-modules.json`):
 *
 *   造成即时伤害(伤害数据: 伤害, …): void { const f = this.world.sys.damage.BP_ManeActor?.造成即时伤害; if (f) return f(this, …); … }
 *
 * plus the Systems interface (`src/core/bp/systems.ts`) and, when missing, the module stubs `src/core/sys/<m>/index.ts`.
 *
 *   node tools/gen/facade.mjs [--dump <dir>] [--check] [--report]
 *
 * --check exits 1 when a generated file differs from what the dump produces; --report prints the function table.
 * The generator fails on a name collision inside a class (D11) unless `tools/gen/names.json` resolves it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const DUMP = opt('--dump') ?? 'D:/TAPTAPGAME_codex/reference/dump';
const PSEUDO = join(DUMP, 'blueprints-pseudo', 'CatapultHero');
const CHECK = args.includes('--check');
const REPORT = args.includes('--report');

const FN_MODULES = JSON.parse(readFileSync(join(ROOT, 'tools/gen/fn-modules.json'), 'utf8'));
const NAMES = JSON.parse(readFileSync(join(ROOT, 'tools/gen/names.json'), 'utf8'));

/** W2 modules, in composition order (ARCHITECTURE §6.5): src/core/sys/<m>, one owner each. */
export const MODULES = ['sim', 'kernel', 'ability', 'projectile', 'physics', 'ai', 'turn', 'stamina', 'damage', 'rating', 'launch', 'charge',
  'inventory', 'text', 'rewards', 'talents', 'map', 'room', 'run', 'meta', 'save', 'craft', 'enchant', 'shop', 'camp', 'tutorial'];
/** Pseudo-only buckets: present emits a source-backed adapter when registered below, otherwise no-op; dead/engine/math retain their declared dispatch. */
const BUCKETS = ['present', 'dead', 'engine', 'math'];

/** Class → output file and parent (TS). Libraries go to src/core/bp/index.ts as static facades. */
const CLASSES = [
  { name: 'BP_ManeActor', file: 'src/core/sim/actor.ts', parent: 'BpObject' },
  { name: 'BP_Actor_Player', file: 'src/core/sim/player.ts', parent: 'BP_ManeActor' },
  { name: 'BP_Actor_Other', file: 'src/core/sim/other.ts', parent: 'BP_ManeActor' },
  { name: 'BP_Actor_Card', file: 'src/core/sim/card.ts', parent: 'BP_ManeActor' },
  { name: '蓝图_动作游戏模式', file: 'src/core/sim/mode.ts', parent: 'BpObject' },
  { name: '修炼系统', file: 'src/core/sim/cult.ts', parent: 'BpObject' },
  { name: '修炼物品格子组', file: 'src/core/sim/cult-grid.ts', parent: 'BpObject' },
  { name: '蓝图_主角色控制器', file: 'src/core/sim/controller.ts', parent: 'BpObject' },
  { name: '蓝图_房间', file: 'src/core/sim/room.ts', parent: 'BpObject' },
  { name: '蓝图_房间格子', file: 'src/core/sim/room-cell.ts', parent: 'BpObject' },
  { name: '蓝图_通用路口', file: 'src/core/sim/junction.ts', parent: 'BpObject' },
  { name: '蓝图_动画结算', file: 'src/core/sim/settlement.ts', parent: 'BpObject' },
  { name: '蓝图_能力', file: 'src/core/ability/ability.ts', parent: 'BpObject' },
  { name: '蓝图_效果', file: 'src/core/ability/effect.ts', parent: 'BpObject' },
  { name: '蓝图_发射物', file: 'src/core/ability/projectile.ts', parent: 'BpObject' },
  { name: '函数库_工具', file: 'src/core/bp/index.ts', library: true },
  { name: '函数库_技能', file: 'src/core/bp/index.ts', library: true },
  { name: '函数库_科学数', file: 'src/core/bp/index.ts', library: true },
  { name: '函数库_战斗日志', file: 'src/core/bp/index.ts', library: true },
];
/**
 * Widget function facades (src/core/bp/widgets.ts): the few widget functions other modules call (fn-modules.json lists
 * them; the widget's other functions are not declared). Library-shaped: the calling object is `ctx`.
 */
const WIDGETS = [
  { name: 'UI_关卡地图页面', file: 'src/core/bp/widgets.ts', library: true, widget: true },
  { name: 'UI_冒险结束统计页', file: 'src/core/bp/widgets.ts', library: true, widget: true },
  { name: 'UI_战斗结束统计页', file: 'src/core/bp/widgets.ts', library: true, widget: true },
  { name: 'UI_主界面', file: 'src/core/bp/widgets.ts', library: true, widget: true },
];
const BY_NAME = new Map(CLASSES.map(c => [c.name, c]));
/** Members of BpObject (src/core/sim/object.ts): a Demo name may only reuse them as an override of the same member. */
const BPOBJECT_MEMBERS = new Set(['id', 'world', 'def', 'valid', 'location', 'attachParent', 'OwnedGameplayTags', 'fx', 'ReceiveBeginPlay', 'ReceiveTick',
  'setTickEnabled', 'K2_GetActorLocation', 'K2_SetActorLocation', 'K2_AttachToActor', 'K2_DetachFromActor', 'K2_DestroyActor', 'HasMatchingGameplayTag',
  'delay', 'retriggerableDelay', 'nextTick', 'setTimer', 'clearTimer', 'timeline', 'playAnim', 'constructor', 'path']);
const BPOBJECT_OVERRIDABLE = new Set(['ReceiveBeginPlay', 'ReceiveTick']);

// ---------------------------------------------------------------------------------------------------------------------
// Names (ARCHITECTURE §4.11, D11)

const ID_START = /[\p{ID_Start}$_]/u;
const ID_CONT = /[\p{ID_Continue}$\u200C\u200D]/u;
/** D11: characters that cannot appear in an identifier are dropped at the end and replaced by `_` inside. */
export function mangle(name) {
  const chars = [...name];
  let end = chars.length;
  while (end > 0 && !ID_CONT.test(chars[end - 1])) end--;
  let out = '';
  for (let i = 0; i < end; i++) out += ID_CONT.test(chars[i]) ? chars[i] : '_';
  if (out === '' || !ID_START.test([...out][0])) out = '_' + out;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Pseudo parsing

function splitTop(s, sep = ',') {
  const out = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if (ch === '<' || ch === '[' || ch === '{') depth++;
    if (ch === '>' || ch === ']' || ch === '}') depth--;
    if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseParam(p) {
  const flags = [];
  let s = p;
  for (;;) { const m = s.match(/^(.*)\s\[(out|ref|return)\]$/); if (!m) break; flags.unshift(m[2]); s = m[1]; }
  const i = s.indexOf(': ');
  return { name: s.slice(0, i), type: s.slice(i + 2), out: flags.includes('out'), ref: flags.includes('ref'), ret: flags.includes('return') };
}

export function parsePseudo(file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const vars = []; const fns = []; const overrides = new Map();
  let inOverrides = false; let flags = ''; let current = null;
  for (const line of lines) {
    if (current) {
      if (line === '    }') { current = null; continue; }
      const w = line.match(/^ {8}(\S+) = /);
      const p = w && current.params.find(x => x.ref && x.name.trim() === w[1]);
      if (p) p.written = true;
      continue;
    }
    if (/^ {4}\/\/ CDO overrides of inherited properties/.test(line)) { inOverrides = true; continue; }
    if (inOverrides) {
      const m = line.match(/^ {4}\/\/ {3}(.+?) = (.*)$/);
      if (m) { overrides.set(m[1], m[2]); continue; }
      inOverrides = false;
    }
    const v = line.match(/^ {4}var (.*?): (\S.*?) = (.*)$/);
    if (v) { vars.push({ name: v[1], type: v[2], def: v[3] }); continue; }
    const fl = line.match(/^ {4}\/\/ flags: (.*)$/);
    if (fl) { flags = fl[1]; continue; }
    const f = line.match(/^ {4}function (.*)\(([^()]*)\)([^(]*)$/);
    if (f) {
      const name = f[1];
      if (!name.startsWith('ExecuteUbergraph_')) {
        current = { name, params: splitTop(f[2]).map(parseParam), override: /\/\/ overrides /.test(f[3]), flags };
        fns.push(current);
      } else current = { params: [] };
      flags = '';
    }
  }
  return { vars, fns, overrides };
}

// ---------------------------------------------------------------------------------------------------------------------
// Types

const RUNTIME_STRUCTS = { '结构_科学数': '科学数', '结构_科学映射词条': '科学映射词条', '结构_伤害': '伤害', '结构_治疗': '治疗', '结构_效果': '效果配置' };
const ENGINE_STRUCTS = { Vector: 'Vec3', Vector2D: 'Vec2', Rotator: 'Rotator', HitResult: 'HitResult', LinearColor: 'LinearColor', Transform: 'Transform',
  GameplayTag: 'Tag', GameplayTagContainer: 'TagSet', DataTableRowHandle: 'DataTableRowHandle', IntPoint: 'Vec2', Color: 'LinearColor' };
const BASE_FOR_PREFIX = [['蓝图_效果', '蓝图_效果'], ['蓝图_能力', '蓝图_能力'], ['蓝图_发射物', '蓝图_发射物'], ['BP_Actor_Equip', 'BP_Actor_Card']];
const ASSET_TYPES = /^(DataTable|CompositeDataTable|CurveTable|CurveFloat|CurveVector|CurveLinearColor|NiagaraSystem|ParticleSystem|SoundBase|SoundWave|SoundCue|Texture|Texture2D|PaperSprite|PaperFlipbook|PaperZDAnimSequence|PaperZDAnimSequence_Flipbook|MaterialInterface|MaterialInstance|MaterialInstanceConstant|StaticMesh|SkeletalMesh|Font|Object<?.*Sequence|LevelSequence|World|CameraShakeBase|InputAction|MediaSource|FileMediaSource|DataAsset|PrimaryDataAsset|ABP_.*|.*AnimBP.*)$/;
const COMPONENT = /(Component|^Widget$|^UI_|^WBP_|^UserWidget$|^技能指示_C$|^MaterialInstanceDynamic$|^PlayerController$|^Controller$)/;

let structNames = new Set();
let enumNames = new Set();
/** The display name of each enum's first value (UE zero value). */
let enumFirst = new Map();

/** Pseudo type → { ts, neutral, kind, imports }. `skip` marks widget / component references (not declared as variables). */
function mapType(t, use) {
  let m;
  if (t === 'Bool') return { ts: 'boolean', neutral: 'false' };
  if (/^(Int|Int64|Byte|Float|Double)$/.test(t)) return { ts: 'number', neutral: '0' };
  if (t === 'Str') return { ts: 'string', neutral: "''" };
  // FName's zero value is NAME_None, written 'None' like the importer's rows and class manifest (tools/data/classes.mjs).
  if (t === 'Name') return { ts: 'string', neutral: "'None'" };
  if (t === 'Text') { use.content.add('FText'); return { ts: 'FText', neutral: "{ zh: '', en: '' }" }; }
  if ((m = t.match(/^Byte<(.+)>$/))) {
    if (enumNames.has(m[1])) { use.content.add(m[1]); return { ts: m[1], neutral: lit(enumFirst.get(m[1])), enumName: m[1] }; }
    return { ts: 'number', neutral: '0' };
  }
  if ((m = t.match(/^Array<(.+)>$/))) {
    const e = mapType(m[1], use);
    return { ts: `${wrap(e.ts)}[]`, neutral: '[]', skip: e.skip, elem: e };
  }
  if ((m = t.match(/^Set<(.+)>$/))) { const e = mapType(m[1], use); return { ts: `Set<${e.ts}>`, neutral: 'new Set()', skip: e.skip, elem: e }; }
  if ((m = t.match(/^Map<(.+)>$/))) {
    const [k, v] = splitTop(m[1]);
    if (k === 'Str' && v === 'Struct<结构_科学映射词条>') { use.stats.add('词条映射'); return { ts: '词条映射', neutral: 'new Map()' }; }
    const kt = mapType(k, use); const vt = mapType(v, use);
    return { ts: `Map<${kt.ts}, ${vt.ts}>`, neutral: 'new Map()', skip: kt.skip || vt.skip, key: kt, value: vt };
  }
  if ((m = t.match(/^Struct<(.+)>$/))) {
    const s = m[1];
    if (s === '结构_科学数') { use.sci.add('科学数'); return { ts: '科学数', neutral: '{ 系数: 0, 指数: 0 }', sci: true }; }
    if (s === '结构_科学映射词条') { use.stats.add('科学映射词条'); return { ts: '科学映射词条', neutral: "{ 计算类型: '加算', 来源映射: new Map() }" }; }
    if (RUNTIME_STRUCTS[s]) {
      const ts = RUNTIME_STRUCTS[s]; use.structs.add(ts);
      const maker = { 伤害: 'make伤害', 治疗: 'make治疗', 效果配置: 'make效果配置' }[ts];
      use.structsValue.add(maker);
      return { ts, neutral: `${maker}()` };
    }
    if (ENGINE_STRUCTS[s]) {
      const ts = ENGINE_STRUCTS[s];
      if (ts === 'TagSet') { use.tagsValue.add('TagSet'); return { ts, neutral: 'new TagSet()', tagset: true }; }
      if (ts === 'Tag') { use.simTypes.add('Tag'); return { ts, neutral: "''", tag: true }; }
      if (ts === 'HitResult') { use.simTypes.add('HitResult'); use.structsValue.add('makeHitResult'); return { ts, neutral: 'makeHitResult()' }; }
      if (ts === 'DataTableRowHandle' || ts === 'Transform') { use.content.add(ts); return { ts, neutral: ts === 'Transform' ? 'identityTransform()' : "{ DataTable: null, RowName: 'None' }", handle: ts === 'DataTableRowHandle', transform: ts === 'Transform', ...(ts === 'Transform' ? use.structsValue.add('identityTransform') && {} : {}) }; }
      use.simTypes.add(ts);
      const zero = { Vec3: '{ x: 0, y: 0, z: 0 }', Vec2: '{ x: 0, y: 0 }', Rotator: '{ Pitch: 0, Yaw: 0, Roll: 0 }', LinearColor: '{ R: 0, G: 0, B: 0, A: 0 }' }[ts];
      return { ts, neutral: zero, vec: ts };
    }
    // FRandomStream is passed [ref] and advanced in place: the UeStream object of src/core/rng/ue.ts is shared the same way.
    if (s === 'RandomStream') { use.rng.add('UeStream'); return { ts: 'UeStream', neutral: '{ InitialSeed: 0, Seed: 0 }', stream: true }; }
    if (s === 'InputRange') { use.simTypes.add('InputRange'); return { ts: 'InputRange', neutral: '{ Min: 0, Max: 0 }', range: true }; }
    // FTimerHandle: the latent service keys timers by name (LatentService.setTimer), so a handle variable holds that name.
    if (s === 'TimerHandle') return { ts: 'string', neutral: "''" };
    if (structNames.has(s)) { use.content.add(s); use.structsValue.add('structOf'); return { ts: s, neutral: `structOf('${s}')`, demoStruct: s }; }
    return { ts: 'unknown', neutral: 'null' };
  }
  if ((m = t.match(/^(Object|Interface|WeakObject)<(.+)>$/))) {
    const o = m[2];
    const cls = o.replace(/_C$/, '');
    if (BY_NAME.has(cls) && !BY_NAME.get(cls).library) { use.classes.add(cls); return { ts: `${cls} | null`, neutral: 'null', obj: true }; }
    for (const [prefix, base] of BASE_FOR_PREFIX) if (cls.startsWith(prefix) && o.endsWith('_C')) { use.classes.add(base); return { ts: `${base} | null`, neutral: 'null', obj: true }; }
    if (o === '技能指示_C') { use.object.add('BpObject'); return { ts: 'BpObject | null', neutral: 'null', obj: true }; }
    if (COMPONENT.test(o)) return { ts: 'unknown', neutral: 'null', skip: true };
    if (ASSET_TYPES.test(o)) { use.content.add('AssetPath'); return { ts: 'AssetPath | null', neutral: 'null', asset: true }; }
    use.object.add('BpObject');
    return { ts: 'BpObject | null', neutral: 'null', obj: true };
  }
  if (/^(Class|SoftClass|SoftObject)<.+>$/.test(t)) { use.content.add('AssetPath'); return { ts: 'AssetPath | null', neutral: 'null', asset: true }; }
  return { ts: 'unknown', neutral: 'null' };
}
/** Pseudo types passed by value in JS: a [ref] of one of them that the callee assigns needs to be handed back. */
const SCALAR = /^(Bool|Int|Int64|Byte|Float|Double|Str|Name|Text|Byte<.+>)$/;
const wrap = ts => (ts.includes('|') ? `(${ts})` : ts);

/** UE asset reference "Class'/Game/Path/Name.Name_C'" → the content AssetPath (minus /Game/, object kept when it differs). */
function assetPath(ref) {
  const m = ref.match(/^[^']*'\/Game\/(.+)'$/) ?? ref.match(/^\/Game\/(.+)$/);
  if (!m) return ref;
  const [pkg, obj] = m[1].split('.');
  const base = pkg.split('/').pop();
  return !obj || obj === base || obj === `${base}_C` ? pkg : `${pkg}.${obj}`;
}

const lit = v => JSON.stringify(v);
/** Text safe inside a block comment. */
const cmt = s => s.replace(/\*\//g, '*\\/');

/** A pseudo default literal (JSON) → TS expression for type info `ti`; null when the value equals the neutral one. */
function defaultExpr(raw, ti, use) {
  if (raw === '<zero>') return null;
  let v;
  try { v = JSON.parse(raw); } catch { return null; }
  return valueExpr(v, ti, use);
}

function valueExpr(v, ti, use) {
  if (v === null) return null;
  if (ti.sci) return `{ 系数: ${v.系数}, 指数: ${v.指数} }`;
  if (ti.ts === 'boolean' || ti.ts === 'number') return typeof v === typeof (ti.ts === 'boolean' ? true : 0) ? String(v) : null;
  if (ti.ts === 'string') return typeof v === 'string' ? lit(v) : null;
  if (ti.enumName) return lit(enumDisplay(v));
  if (ti.ts === 'FText') return textExpr(v);
  if (ti.tag) return lit(v?.TagName ?? v);
  if (ti.tagset) return Array.isArray(v) && v.length ? `new TagSet(${lit(v.map(x => x?.TagName ?? x))})` : null;
  if (ti.vec) return ti.vec === 'Vec3' ? `{ x: ${v.X}, y: ${v.Y}, z: ${v.Z} }` : ti.vec === 'Vec2' ? `{ x: ${v.X}, y: ${v.Y} }` : lit(v);
  if (ti.handle) return lit({ DataTable: v.DataTable ? assetPath(v.DataTable) : null, RowName: v.RowName });
  if (ti.asset) return typeof v === 'string' ? lit(assetPath(v)) : null;
  if (ti.stream) return v && typeof v === 'object' ? `{ InitialSeed: ${v.InitialSeed}, Seed: ${v.Seed} }` : null;
  if (ti.range) return v && typeof v === 'object' ? `{ Min: ${v.Min}, Max: ${v.Max} }` : null;
  if (ti.demoStruct) return `structOf('${ti.demoStruct}', ${lit(convertData(v))})`;
  if (ti.elem && Array.isArray(v)) {
    if (!v.length) return null;
    const items = v.map(x => valueExpr(x, ti.elem, use) ?? ti.elem.neutral);
    return ti.ts.startsWith('Set<') ? `new Set([${items.join(', ')}])` : `[${items.join(', ')}]`;
  }
  if (ti.key && Array.isArray(v)) {
    if (!v.length) return null;
    return `new Map([${v.map(e => `[${valueExpr(e.key, ti.key, use) ?? ti.key.neutral}, ${valueExpr(e.value, ti.value, use) ?? ti.value.neutral}]`).join(', ')}])`;
  }
  return null; // runtime structs, HitResult, transforms: their struct defaults (the generator test samples the plain variables)
}

function enumDisplay(v) { return v && typeof v === 'object' ? (v.display ?? v.name) : v; }
function textExpr(v) {
  if (typeof v === 'string') return `{ zh: ${lit(v)}, en: ${lit(v)} }`;
  const s = v?.invariant ?? v?.source ?? v?.zh ?? v?.text ?? '';
  return `{ zh: ${lit(s)}, en: ${lit(v?.en ?? s)} }`;
}
/** Data-shaped struct value (content/demo conventions): enums → display, assets → paths, texts → { zh, en }. */
function convertData(v) {
  if (Array.isArray(v)) return v.map(convertData);
  if (v && typeof v === 'object') {
    if ('$enum' in v) return v.display ?? v.name;
    if ('invariant' in v) return { zh: v.invariant, en: v.invariant };
    if ('TagName' in v && Object.keys(v).length === 1) return v.TagName;
    if ('key' in v && 'value' in v && Object.keys(v).length === 2) return v;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, convertData(x)]));
  }
  if (typeof v === 'string' && /^[A-Za-z_0-9]+'\/Game\//.test(v)) return assetPath(v);
  return v;
}

// ---------------------------------------------------------------------------------------------------------------------
// Model

function loadEnumsAndStructs() {
  const types = readFileSync(join(ROOT, 'src/content/demo/types.ts'), 'utf8');
  enumNames = new Set([...types.matchAll(/^export type (枚举_\S+) =/gm)].map(m => m[1]));
  enumFirst = new Map([...types.matchAll(/^export type (枚举_\S+) = "([^"]*)"/gm)].map(m => [m[1], m[2]]));
  structNames = new Set([...types.matchAll(/^export interface (结构_\S+) \{/gm)].map(m => m[1]));
}

const VAR_SKIP = /^(UberGraphFrame|K2Node_.*|Temp_.*|_+[0-9A-F]{32}|_*Direction_[0-9A-F]{32}|.*_[0-9A-F]{32})$/;

function buildModel(pseudo = PSEUDO) {
  loadEnumsAndStructs();
  const model = new Map();
  for (const c of [...CLASSES, ...WIDGETS]) {
    const path = FN_MODULES.files[c.name];
    const parsed = parsePseudo(join(pseudo, `${path}.txt`));
    if (c.widget) { parsed.vars = []; parsed.fns = parsed.fns.filter(f => FN_MODULES.modules[c.name][f.name]); }
    model.set(c.name, { ...c, assetPath: `CatapultHero/${path}`, parsed });
  }
  for (const c of model.values()) {
    const rename = NAMES[c.name] ?? {};
    const use = newUse();
    c.use = use;
    c.vars = [];
    for (const v of c.parsed.vars) {
      if (VAR_SKIP.test(v.name)) continue;
      const ti = mapType(v.type, use);
      if (ti.skip) continue;
      const ts = mangle(v.name);
      // This gameplay cap is a JSON-object TMap in the source CDO, not the usual [{key,value}] encoding.
      // Keep this proven field narrow; other object-map defaults require their own source review.
      const raw = c.name === '蓝图_动作游戏模式' && v.name === '发射物上限数'
        ? JSON.stringify(Object.entries(JSON.parse(v.def)).map(([key, value]) => ({ key, value }))) : v.def;
      c.vars.push({ demo: v.name, ts: rename[`var:${v.name}`] ?? ts, type: ti, def: defaultExpr(raw, ti, use) ?? ti.neutral, raw: v.def });
    }
    c.fns = c.parsed.fns.map(f => {
      const module = FN_MODULES.modules[c.name]?.[f.name];
      if (!module) throw new Error(`${c.name}.${f.name}: no module in tools/gen/fn-modules.json`);
      if (!MODULES.includes(module) && !BUCKETS.includes(module)) throw new Error(`${c.name}.${f.name}: unknown module ${module}`);
      const params = []; const outs = []; let ret = null; let ctx = false;
      for (const p of f.params) {
        if (p.name === '__WorldContext') { ctx = true; continue; }
        const ti = mapType(p.type, use);
        const entry = { demo: p.name, ts: mangle(p.name), type: ti, ref: p.ref };
        if (p.ret) ret = entry; else if (p.out) outs.push(entry); else params.push(entry);
      }
      dedupe([...params, ...outs, ...(ret ? [ret] : [])], `${c.name}.${f.name}`);
      // A [ref] scalar the body assigns is passed in and handed back as an out field of the same name (callers store it).
      for (const p of f.params) {
        if (!p.written || !SCALAR.test(p.type)) continue;
        const input = params.find(x => x.demo === p.name);
        outs.unshift({ ...input, inout: true });
      }
      return { demo: f.name, ts: rename[`fn:${f.name}`] ?? mangle(f.name), module, params, outs, ret, ctx, override: f.override, flags: f.flags };
    });
  }
  checkNames(model);
  return model;
}

function dedupe(list, where) {
  const seen = new Set();
  for (const p of list) {
    if (p.ts === 'ctx' || p.ts === 'self') p.ts = `${p.ts}_`;
    let n = p.ts; let i = 2;
    while (seen.has(n)) n = `${p.ts}_${i++}`;
    if (n !== p.ts && REPORT) console.log(`param rename ${where}: ${p.demo} -> ${n}`);
    p.ts = n; seen.add(n);
  }
}

function chainOf(model, c) {
  const out = [];
  for (let p = c.parent; p && p !== 'BpObject'; p = model.get(p).parent) out.push(model.get(p));
  return out;
}

/** D11 collision rule: no two members of a class (with its ancestors) share a name, except a function overriding the same function. */
function checkNames(model) {
  const errors = [];
  for (const c of model.values()) {
    if (c.library) {
      const seen = new Map();
      for (const f of c.fns) { if (seen.has(f.ts)) errors.push(`${c.name}: functions "${seen.get(f.ts)}" and "${f.demo}" both mangle to ${f.ts}`); seen.set(f.ts, f.demo); }
      continue;
    }
    const inherited = new Map(); // ts name → { kind, demo, cls }
    for (const a of chainOf(model, c).reverse()) {
      for (const v of a.vars) inherited.set(v.ts, { kind: 'var', demo: v.demo, cls: a.name });
      for (const f of a.fns) inherited.set(f.ts, { kind: 'fn', demo: f.demo, cls: a.name, f });
    }
    const own = new Map();
    const add = (ts, kind, demo, f) => {
      if (BPOBJECT_MEMBERS.has(ts) && !(kind === 'fn' && BPOBJECT_OVERRIDABLE.has(ts))) errors.push(`${c.name}: ${kind} "${demo}" collides with BpObject.${ts}`);
      if (own.has(ts)) errors.push(`${c.name}: ${kind} "${demo}" and ${own.get(ts).kind} "${own.get(ts).demo}" both mangle to ${ts}`);
      const inh = inherited.get(ts);
      if (inh && !(kind === 'fn' && inh.kind === 'fn' && inh.demo === demo)) errors.push(`${c.name}: ${kind} "${demo}" collides with ${inh.cls}.${inh.demo} (${ts})`);
      if (kind === 'fn' && inh) f.overrides = inh.f;
      own.set(ts, { kind, demo });
    };
    for (const v of c.vars) add(v.ts, 'var', v.demo);
    for (const f of c.fns) add(f.ts, 'fn', f.demo, f);
  }
  if (errors.length) {
    throw new Error(`facade: ${errors.length} name collisions (resolve them in tools/gen/names.json):\n  ${errors.join('\n  ')}`);
  }
}

function newUse() {
  return { content: new Set(), rng: new Set(), sci: new Set(), stats: new Set(), structs: new Set(), structsValue: new Set(), simTypes: new Set(), tagsValue: new Set(), classes: new Set(), object: new Set() };
}

// ---------------------------------------------------------------------------------------------------------------------
// Emit

const HEADER = '// Generated by tools/gen/facade.mjs from dump/blueprints-pseudo. Do not edit: change the generator, fn-modules.json or names.json and re-run it.\n';

function returnType(f) {
  if (!f.outs.length) return f.ret ? f.ret.type.ts : 'void';
  const fields = f.outs.map(o => `${o.ts}: ${o.type.ts}`);
  if (f.ret) fields.push(`ReturnValue: ${f.ret.type.ts}`);
  return `{ ${fields.join('; ')} }`;
}
/** The value an unported function returns; an in-out [ref] hands its input back unchanged. */
function neutralReturn(f, unused) {
  if (!f.outs.length) return f.ret ? f.ret.type.neutral : null;
  const fields = f.outs.map(o => `${o.ts}: ${o.inout && !unused ? o.ts : o.type.neutral}`);
  if (f.ret) fields.push(`ReturnValue: ${f.ret.type.neutral}`);
  return `{ ${fields.join(', ')} }`;
}
const paramList = (f, unused) => f.params.map(p => `${unused ? '_' : ''}${p.ts}: ${p.type.ts}`).join(', ');

/** Hand-written delegations of 函数库_科学数 to src/core/math (WAVE_A §3.6: pure library math delegates straight to core/math). */
const MATH = {
  '科学数Power': { body: '({ 输出: 科学数Power(Base, Exp) })', uses: ['科学数Power'] },
  '限制科学数': { body: '({ 值: 限制科学数(输入, Min, Max) })', uses: ['限制科学数'] },
  '科学数ABS': { body: '({ 输出: 科学数ABS(输入) })', uses: ['科学数ABS'] },
  '科学数<=': { body: "科学数比较(A, '<=', B)", uses: ['科学数比较'] },
  '科学数>=': { body: "科学数比较(A, '>=', B)", uses: ['科学数比较'] },
  '科学数=': { body: "科学数比较(A, '=', B)", uses: ['科学数比较'] },
  '科学数<': { body: "科学数比较(A, '<', B)", uses: ['科学数比较'] },
  '科学数>': { body: "科学数比较(A, '>', B)", uses: ['科学数比较'] },
  '比较科学数（纯正）': { body: '({ 值: 比较科学数_纯正(A, B, 取大_取小) })', uses: ['比较科学数_纯正'] },
  '比较科学数': { body: '比较科学数(A, B, 取大_取小)', uses: ['比较科学数'] },
  '移除科学映射值': { body: '移除科学映射值(映射, 词条名, 来源)', uses: ['移除科学映射值'], stats: true },
  '添加科学映射值': { body: '添加科学映射值(映射, 词条名, 来源, 科学值, 覆盖_修改)', uses: ['添加科学映射值'], stats: true },
  // SPEC-GAP: 浮点 is the plain value of 科学 (CORE-M-056 lists only the science output).
  '科学映射原始值': { body: '{ const 科学 = 科学映射原始值(词条映射, 词条名, 补充永久); return { 科学, 浮点: 科学数变普通(科学) }; }', uses: ['科学数变普通'], statsUses: ['科学映射原始值'], block: true },
  '科学数变普通': { body: '({ 输出: 科学数变普通(输入) })', uses: ['科学数变普通'] },
  '获取科学映射词条': { body: '{ const r = 获取科学映射词条(词条映射, 词条名); return { 输出值: r.输出值, ReturnValue: r.found }; }', statsUses: ['获取科学映射词条'], block: true },
  '科学数乘除*/': { body: '({ 输出: 科学数乘除(输入A, 输入B, 乘_除) })', uses: ['科学数乘除'] },
  '科学数加减+-': { body: '({ 输出: 科学数加减(输入A, 输入B, 加_减) })', uses: ['科学数加减'] },
  '科学数标准化': { body: '({ 输出: 科学数标准化(输入) })', uses: ['科学数标准化'] },
};

// Source-backed presentation methods must survive regeneration. BP_ManeActor source ln5460:
// A attached KeepWorld at hit+Z30, B at that point, then damage-type-specific effect, with nested validity gates.
const PRESENT = {
  'BP_ManeActor.受击特效处理': `{
    // BP_ManeActor ln5460: A attached in KeepWorld at hit+Z30, then B at that point, then the type-specific asset.
    // Preserve the nested validity gates. This used to be an empty presentation facade in the ordinary game.
    if (!this.被击特效A) return;
    const at = { ...击中点位置, z: 击中点位置.z + 30 };
    const length = Math.hypot(击中点法线.x, 击中点法线.y);
    const normal = length * length > 0.0001 ? { x: 击中点法线.x / length, y: 击中点法线.y / length, z: 0 } : { x: 0, y: 0, z: 0 };
    this.world.bus.emit({ t: this.world.clock.now, kind: 'vfx', asset: this.被击特效A, at, attach: this.id, normal });
    if (!this.被击特效B) return;
    this.world.bus.emit({ t: this.world.clock.now, kind: 'vfx', asset: this.被击特效B, at: { ...at }, attach: null });
    const extra: Partial<Record<枚举_伤害类型, AssetPath>> = {
      流血: 'CatapultHero/粒子/粒子_Blood_02', 中毒: 'CatapultHero/粒子/粒子_Hit_剧毒',
      燃烧: 'CatapultHero/粒子/粒子_Hit_火焰', 电击: 'CatapultHero/粒子/粒子_Hit_闪电',
    };
    const asset = extra[伤害类型];
    if (asset) this.world.bus.emit({ t: this.world.clock.now, kind: 'vfx', asset, at: { ...at }, attach: this.id, normal });
  }`,
};

function methodBody(c, f, selfExpr, worldExpr) {
  if (f.module === 'present' && PRESENT[`${c.name}.${f.demo}`]) return PRESENT[`${c.name}.${f.demo}`];
  const call = [selfExpr, ...f.params.map(p => p.ts)].join(', ');
  const neutral = neutralReturn(f, ['present', 'engine', 'dead'].includes(f.module) || (f.module === 'math' && !MATH[f.demo]));
  const tail = neutral ? `\n    return ${neutral};` : '';
  if (f.module === 'present' || f.module === 'engine') {
    const why = f.module === 'present' ? 'presentation (fx in content; the game layer renders)' : 'engine event (input mapping or component delegate; the shell and the sim drive it)';
    return `{\n    // ${why}${tail}\n  }`;
  }
  if (f.module === 'dead') return `{\n    ${worldExpr}.unported('${c.name}.${f.ts}'); // dead in the Demo (ARCHITECTURE Appendix B)${tail}\n  }`;
  if (f.module === 'math') {
    const m = MATH[f.demo];
    if (!m) return `{\n    ${worldExpr}.unported('${c.name}.${f.ts}');${tail}\n  }`;
    return m.block ? m.body.replace(/^\{ /, '{\n    ').replace(/ \}$/, '\n  }').replace(/; return /, ';\n    return ') : `{\n    return ${m.body};\n  }`;
  }
  return `{\n    const f = ${worldExpr}.sys.${f.module}.${c.name}?.${f.ts};\n    if (f) return f(${call});\n    ${worldExpr}.unported('${c.name}.${f.ts}');${tail}\n  }`;
}

function emitClass(model, c) {
  const lines = [];
  const doc = `/**\n * ${c.name}: generated declaration (CDO defaults and one delegating method per Demo function).\n * Demo: ${c.assetPath} (dump/blueprints-pseudo/${c.assetPath}.txt). Parent: ${c.parent}.\n */`;
  lines.push(doc);
  lines.push(`export class ${c.name} extends ${c.parent} {`);
  lines.push(`  static override readonly path: AssetPath = '${c.assetPath}';`);
  const inheritedVars = new Map();
  for (const a of chainOf(model, c)) for (const v of a.vars) inheritedVars.set(v.demo, { v, a });
  for (const [name, raw] of c.parsed.overrides) {
    const iv = inheritedVars.get(name);
    if (!iv) continue;
    const e = defaultExpr(raw, iv.v.type, c.use);
    if (e) lines.push(`  override ${iv.v.ts}: ${iv.v.type.ts} = ${e};`);
  }
  for (const v of c.vars) {
    const demoName = v.ts === v.demo ? '' : ` // ${cmt(v.demo)}`;
    lines.push(`  ${v.ts}: ${v.type.ts} = ${v.def};${demoName}`);
  }
  for (const f of c.fns) {
    lines.push('');
    const unused = ['present', 'engine', 'dead', 'math'].includes(f.module) && !(f.module === 'math' && MATH[f.demo]) && !PRESENT[`${c.name}.${f.demo}`];
    const ov = f.overrides || (BPOBJECT_OVERRIDABLE.has(f.ts)) ? 'override ' : '';
    const label = f.ts === f.demo ? '' : ` Demo: ${cmt(f.demo)}.`;
    lines.push(`  /** Module ${f.module}.${label} */`);
    lines.push(`  ${ov}${f.ts}(${paramList(f, unused)}): ${returnType(f)} ${methodBody(c, f, 'this', 'this.world')}`);
  }
  if (c.name === '蓝图_动作游戏模式') {
    lines.push('');
    lines.push('  /** Kernel service (not a Demo function): opens a blocking modal; the turn-start barrier waits for it (TURN-034/035). */');
    lines.push('  openModal(view: ModalView, onAnswer: (answer: ModalAnswer) => void): void {');
    lines.push('    this.world.modal.open(view, onAnswer);');
    lines.push('  }');
    c.use.extraApi = true;
  }
  lines.push('}');
  return lines.join('\n');
}

function emitLibrary(model, c) {
  const doc = c.widget
    ? `/** ${c.name}: widget function facade (${c.assetPath}): only the functions other modules call. The calling object is \`ctx\`. */`
    : `/** ${c.name}: Demo library facade (${c.assetPath}). The calling object is the world context \`ctx\`. */`;
  const lines = [doc, `export const ${c.name} = {`];
  for (const f of c.fns) {
    const unused = ['present', 'engine', 'dead'].includes(f.module) || (f.module === 'math' && !MATH[f.demo]);
    const ctxName = f.module === 'math' && MATH[f.demo] ? '_ctx' : unused && f.module !== 'dead' && f.module !== 'math' ? '_ctx' : 'ctx';
    const ps = paramList(f, unused);
    const label = f.ts === f.demo ? '' : ` Demo: ${cmt(f.demo)}.`;
    lines.push(`  /** Module ${f.module}.${label} */`);
    lines.push(`  ${f.ts}(${ctxName}: BpObject${ps ? ', ' + ps : ''}): ${returnType(f)} ${methodBody(c, f, 'ctx', 'ctx.world')},`);
  }
  lines.push('};');
  return lines.join('\n');
}

function relImport(fromFile, toFile) {
  let r = relative(dirname(fromFile), toFile).replace(/\\/g, '/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

const CLASS_FILE = new Map(CLASSES.map(c => [c.name, c.file]));

const usesToken = (body, name) => new RegExp(String.raw`(?<![\p{ID_Continue}$])` + name.replace(/[$]/g, '\\$') + String.raw`(?![\p{ID_Continue}$])`, 'u').test(body);

function importsFor(file, uses, own, body) {
  const out = [];
  const add = (target, names, typeOnly) => {
    const list = [...names].filter(n => !own.has(n) && usesToken(body, n)).sort();
    if (!list.length) return;
    out.push(`import ${typeOnly ? 'type ' : ''}{ ${list.join(', ')} } from '${relImport(file, target)}';`);
  };
  const u = mergeUses(uses);
  add('src/content/demo/types.ts', u.content, true);
  add('src/core/math/sci.ts', u.sci, true);
  add('src/core/rng/ue.ts', u.rng, true);
  add('src/core/math/stats.ts', u.stats, true);
  add('src/core/sim/types.ts', u.simTypes, true);
  add('src/core/bp/structs.ts', u.structs, true);
  add('src/core/bp/structs.ts', u.structsValue, false);
  add('src/core/sim/tags.ts', u.tagsValue, false);
  const byFile = new Map();
  for (const cls of u.classes) { if (own.has(cls)) continue; const f = CLASS_FILE.get(cls); if (!byFile.has(f)) byFile.set(f, new Set()); byFile.get(f).add(cls); }
  for (const [f, names] of byFile) add(f, names, true);
  return out;
}
function mergeUses(list) {
  const u = newUse();
  for (const x of list) for (const k of Object.keys(u)) for (const v of x[k] ?? []) u[k].add(v);
  return u;
}

function emitFiles(model) {
  const files = new Map();
  for (const c of model.values()) {
    if (!files.has(c.file)) files.set(c.file, []);
    files.get(c.file).push(c);
  }
  const out = new Map();
  for (const [file, classes] of files) {
    const own = new Set(classes.map(c => c.name));
    const body = classes.map(c => (c.library ? emitLibrary(model, c) : emitClass(model, c))).join('\n\n');
    const uses = classes.map(c => c.use);
    const imports = importsFor(file, uses, own, body);
    if (usesToken(body, 'AssetPath')) imports.push(`import type { AssetPath } from '${relImport(file, 'src/content/demo/types.ts')}';`);
    const parents = new Set(classes.filter(c => !c.library).map(c => c.parent).filter(p => !own.has(p)));
    for (const p of parents) imports.push(p === 'BpObject' ? `import { BpObject } from '${relImport(file, 'src/core/sim/object.ts')}';` : `import { ${p} } from '${relImport(file, CLASS_FILE.get(p))}';`);
    if (classes.some(c => c.library) || mergeUses(uses).object.size) if (!parents.has('BpObject')) imports.push(`import type { BpObject } from '${relImport(file, 'src/core/sim/object.ts')}';`);
    if (classes.some(c => c.use.extraApi)) imports.push(`import type { ModalAnswer } from '${relImport(file, 'src/core/api/commands.ts')}';`, `import type { ModalView } from '${relImport(file, 'src/core/api/view.ts')}';`);
    if (classes.some(c => c.name === '函数库_科学数')) {
      const sciFns = new Set(); const statFns = new Set();
      for (const f of model.get('函数库_科学数').fns) { const m = MATH[f.demo]; if (!m) continue; (m.uses ?? []).forEach(x => (m.stats ? statFns : sciFns).add(x)); (m.statsUses ?? []).forEach(x => statFns.add(x)); }
      imports.push(`import { ${[...sciFns].sort().join(', ')} } from '${relImport(file, 'src/core/math/sci.ts')}';`);
      imports.push(`import { ${[...statFns].sort().join(', ')} } from '${relImport(file, 'src/core/math/stats.ts')}';`);
    }
    const dedup = [...new Set(imports)];
    const merged = mergeImportLines(dedup);
    out.set(file, `${HEADER}${merged.join('\n')}\n\n${body}\n`);
  }
  out.set('src/core/bp/systems.ts', emitSystems(model));
  return out;
}

/** Merges `import type { A } from 'x'` lines that name the same module. */
function mergeImportLines(lines) {
  const map = new Map(); const order = [];
  for (const l of lines) {
    const m = l.match(/^import (type )?\{ (.+) \} from '(.+)';$/);
    if (!m) { order.push(l); continue; }
    const key = `${m[1] ?? ''}|${m[3]}`;
    if (!map.has(key)) { map.set(key, new Set()); order.push(key); }
    m[2].split(', ').forEach(n => map.get(key).add(n));
  }
  return order.map(k => {
    if (!map.has(k)) return k;
    const [t, from] = k.split('|');
    return `import ${t}{ ${[...map.get(k)].sort().join(', ')} } from '${from}';`;
  });
}

function emitSystems(model) {
  const file = 'src/core/bp/systems.ts';
  const byModule = new Map(MODULES.map(m => [m, new Map()]));
  const uses = [];
  for (const c of model.values()) {
    uses.push(c.use);
    for (const f of c.fns) {
      if (!byModule.has(f.module)) continue;
      const cls = byModule.get(f.module);
      if (!cls.has(c.name)) cls.set(c.name, []);
      const self = c.library ? 'ctx: BpObject' : `self: ${c.name}`;
      const ps = f.params.map(p => `${p.ts}: ${p.type.ts}`).join(', ');
      cls.get(c.name).push(`    ${f.ts}?(${self}${ps ? ', ' + ps : ''}): ${returnType(f)};`);
    }
  }
  const parts = [];
  for (const [m, classes] of byModule) {
    const iface = `${m[0].toUpperCase()}${m.slice(1)}Fns`;
    const body = [...classes].map(([cls, fns]) => `  readonly ${cls}?: {\n${fns.join('\n')}\n  };`).join('\n');
    parts.push(`/** Module \`${m}\` (src/core/sys/${m}): the Demo functions it implements, per class. */\nexport interface ${iface} {\n${body}\n}`);
  }
  const u = mergeUses(uses);
  for (const c of model.values()) if (!c.library) u.classes.add(c.name);
  const imports = importsFor(file, [u], new Set(), parts.join('\n'));
  imports.push(`import type { BpObject } from '${relImport(file, 'src/core/sim/object.ts')}';`);
  imports.push(`import type { SysModule } from '${relImport(file, 'src/core/api/compose.ts')}';`);
  const typeOnly = mergeImportLines(imports).map(l => l.replace(/^import \{/, 'import type {'));
  const table = MODULES.map(m => `  readonly ${m}: SysModule & ${m[0].toUpperCase()}${m.slice(1)}Fns;`).join('\n');
  return `${HEADER}${mergeImportLines(typeOnly).join('\n')}\n\n/** The module names of WAVE_A Appendix W2, in composition order. */\nexport const MODULE_NAMES = ${lit(MODULES)} as const;\nexport type ModuleName = (typeof MODULE_NAMES)[number];\n\n${parts.join('\n\n')}\n\n/** world.sys: one entry per module. Every function is optional: a missing one makes its facade method call world.unported. */\nexport interface Systems {\n${table}\n}\n`;
}

function emitStub(m) {
  const T = `${m[0].toUpperCase()}${m.slice(1)}Fns`;
  return `/**
 * Module \`${m}\` (WAVE_A Appendix W2): stub created by core-contracts. Its owner replaces this file: implement the Demo
 * functions of \`${T}\` (src/core/bp/systems.ts) per class, plus \`commands\`, \`legal\` and \`view\` where the module has them.
 */
import type { Systems } from '../../bp/systems.ts';

export const ${m}: Systems['${m}'] = {};
`;
}

// ---------------------------------------------------------------------------------------------------------------------

/** Everything the generator writes (paths relative to the repo); module stubs only where the owner has no file yet. */
export function generate(dump = DUMP) {
  const model = buildModel(join(dump, 'blueprints-pseudo', 'CatapultHero'));
  const files = emitFiles(model);
  for (const m of MODULES) {
    const f = `src/core/sys/${m}/index.ts`;
    if (!existsSync(join(ROOT, f))) files.set(f, emitStub(m));
  }
  return { model, files };
}

function main() {
  const { model, files } = generate();
  let stale = 0;
  for (const [f, text] of files) {
    const abs = join(ROOT, f);
    const old = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    if (old === text) continue;
    if (CHECK) { console.error(`stale: ${f}`); stale++; continue; }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    console.log(`wrote ${f}`);
  }
  if (REPORT) {
    for (const c of model.values()) for (const f of c.fns) console.log(`${c.name}\t${f.demo}\t${f.ts}\t${f.module}`);
  }
  const nf = [...model.values()].reduce((n, c) => n + c.fns.length, 0);
  const nv = [...model.values()].reduce((n, c) => n + c.vars.length, 0);
  console.log(`facade: ${model.size} classes, ${nf} functions, ${nv} variables${CHECK ? (stale ? `, ${stale} stale` : ', up to date') : ''}`);
  if (stale) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
export { buildModel, CLASSES, WIDGETS };

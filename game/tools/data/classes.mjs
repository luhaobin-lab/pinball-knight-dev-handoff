// The class manifest (src/content/demo/classes.ts, studio/ARCHITECTURE.md §7.1): one entry per Demo blueprint under
// CatapultHero/BP (widgets excluded): parent, kind, CDO tags (inherited and redirected), own variables with their CDO
// defaults (mangled names, runtime-shaped values), CDO overrides of inherited variables, timelines, the component
// data the logic reads, live row references and reachability. Pure apart from reading the dump.
import fs from 'node:fs';
import path from 'node:path';
import { mangle } from './mangle.mjs';
import { assetPath } from './normalize.mjs';

const REF = /^([A-Za-z0-9_]+)'(\/[^']+)'$/;
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Blueprint JSONs under blueprints/CatapultHero/BP, widgets (BP/UI) excluded, by asset path (sorted). */
export function readBlueprints(dumpDir) {
  const root = path.join(dumpDir, 'blueprints');
  const out = new Map();
  const visit = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => byCodePoint(a.name, b.name))) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) visit(full);
      else if (e.name.endsWith('.json')) {
        const json = JSON.parse(fs.readFileSync(full, 'utf8'));
        out.set(json.asset.slice('/Game/'.length), json);
      }
    }
  };
  visit(path.join(root, 'CatapultHero', 'BP'));
  for (const k of [...out.keys()]) if (k.startsWith('CatapultHero/BP/UI/')) out.delete(k);
  return new Map([...out].sort(([a], [b]) => byCodePoint(a, b)));
}

// ---- types -----------------------------------------------------------------------------------------------------

function splitTop(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '<') depth++;
    else if (text[i] === '>') depth--;
    else if (text[i] === ',' && depth === 0) return [text.slice(0, i).trim(), text.slice(i + 1).trim()];
  }
  throw new Error(`cannot split "${text}"`);
}
/** A blueprint variable type (a superset of the table field types: Float, Byte, Set, Int64 …). */
export function parseVarType(text) {
  const m = /^(Array|Set|Map|Struct|Object|Class|Byte|SoftObject|SoftClass|Interface|WeakObject)<(.+)>$/.exec(text);
  if (!m) return { kind: 'prim', name: text };
  const [, outer, inner] = m;
  if (outer === 'Array' || outer === 'Set') return { kind: 'array', item: parseVarType(inner) };
  if (outer === 'Map') {
    const [k, v] = splitTop(inner);
    return { kind: 'map', key: parseVarType(k), value: parseVarType(v) };
  }
  if (outer === 'Struct') return { kind: 'struct', name: inner };
  if (outer === 'Byte') return { kind: 'enum', name: inner };
  return { kind: 'ref', class: inner };
}

const ENGINE_ZERO = {
  Vector: { X: 0, Y: 0, Z: 0 },
  Vector2D: { X: 0, Y: 0 },
  IntPoint: { X: 0, Y: 0 },
  Rotator: { Pitch: 0, Yaw: 0, Roll: 0 },
  LinearColor: { R: 0, G: 0, B: 0, A: 0 },
  Color: { B: 0, G: 0, R: 0, A: 0 },
  Quat: { X: 0, Y: 0, Z: 0, W: 1 },
  Transform: { Rotation: { X: 0, Y: 0, Z: 0, W: 1 }, Translation: { X: 0, Y: 0, Z: 0 }, Scale3D: { X: 1, Y: 1, Z: 1 } },
  GameplayTag: '',
  GameplayTagContainer: [],
  DataTableRowHandle: { DataTable: null, RowName: 'None' },
  InputRange: { Min: 0, Max: 0 },
};

/**
 * Normalizes blueprint values to the runtime shapes of src/core: 结构_科学数 -> {系数, 指数}; user structs with
 * mangled field names; FText -> {zh, en}; enums -> display name; object/class references -> asset paths; tags ->
 * strings (redirected); maps -> plain objects. Engine structs keep their field names.
 */
export function createValueNormalizer({ structDefs, enumDefs, redirect }) {
  const fields = new Map(Object.entries(structDefs).map(([n, d]) => [n, d.fields.map(f => [f.name, parseVarType(f.type)])]));
  const tag = t => redirect(typeof t === 'string' ? t : (t?.TagName ?? ''));

  function generic(v) {
    if (typeof v === 'string') return REF.test(v) ? assetPath(v) : v;
    if (Array.isArray(v)) return v.map(generic);
    if (v && typeof v === 'object') {
      if ('$enum' in v) return v.display;
      if ('TagName' in v && Object.keys(v).length === 1) return tag(v);
      if ('invariant' in v) return { zh: v.invariant ?? '', en: v.invariant ?? '' };
      if (typeof v.text === 'string' && 'key' in v) return { zh: v.text, en: v.en ?? v.text };
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, generic(x)]));
    }
    return v;
  }

  function zero(type) {
    switch (type.kind) {
      case 'prim':
        if (type.name === 'Bool') return false;
        if (type.name === 'Str') return '';
        if (type.name === 'Name') return 'None';
        if (type.name === 'Text') return { zh: '', en: '' };
        return 0;
      case 'enum': {
        const e = enumDefs[type.name]?.values.find(x => x.value === 0);
        return e ? e.display : 0;
      }
      case 'ref':
        return null;
      case 'array':
        return [];
      case 'map':
        return {};
      case 'struct':
        if (type.name === '结构_科学数') return { 系数: 0, 指数: 0 };
        if (structDefs[type.name]) return value(structDefs[type.name].defaults, type);
        return structuredClone(ENGINE_ZERO[type.name] ?? {});
    }
    throw new Error(`zero of ${JSON.stringify(type)}`);
  }

  function value(v, type) {
    if (v === undefined) return zero(type);
    switch (type.kind) {
      case 'prim':
        if (type.name === 'Text') return generic(v);
        return v;
      case 'enum':
        return v && typeof v === 'object' ? v.display : v;
      case 'ref':
        return typeof v === 'string' && REF.test(v) ? assetPath(v) : v === null ? null : generic(v);
      case 'array':
        return Array.isArray(v) ? v.map(x => value(x, type.item)) : generic(v);
      case 'map': {
        const pairs = Array.isArray(v) ? v.map(p => [p.key, p.value]) : Object.entries(v ?? {});
        const key = k => (type.key.kind === 'struct' && type.key.name === 'GameplayTag' ? tag(k) : typeof k === 'string' ? k : JSON.stringify(generic(k)));
        return Object.fromEntries(pairs.map(([k, x]) => [key(k), value(x, type.value)]));
      }
      case 'struct': {
        if (type.name === '结构_科学数') return { 系数: v.系数 ?? 0, 指数: v.指数 ?? 0 };
        if (type.name === 'GameplayTag') return tag(v);
        if (type.name === 'GameplayTagContainer') return Array.isArray(v) ? v.map(tag) : (v?.GameplayTags ?? []).map(tag);
        const fs_ = fields.get(type.name);
        if (fs_ && v && typeof v === 'object') return Object.fromEntries(fs_.map(([f, t]) => [mangle(f), value(v[f], t)]));
        return generic(v);
      }
    }
    throw new Error(`value of ${JSON.stringify(type)}`);
  }

  return { value, zero, generic, tag };
}

// ---- classes ---------------------------------------------------------------------------------------------------

/** CDO properties that are engine plumbing, not blueprint variables the logic reads. */
const SKIP_PROPS = new Set(['UberGraphFrame', 'OwnedGameplayTags', 'PrimaryActorTick', 'RootComponent']);
const isComponentVar = v => /InstancedReference/.test(v.flags ?? '') || /^Object<.*(Component|Timeline)(_C)?>$/.test(v.type);
// Timeline track and direction properties end in the timeline GUID; the timeline itself is in `timelines`.
const isPlumbing = name => name === 'UberGraphFrame' || name.startsWith('K2Node_') || name.startsWith('Temp_') || /_[0-9A-F]{32}$/.test(name);

const KIND_BY_ANCESTOR = [
  ['CatapultHero/BP/Skill/蓝图_能力', 'ability'],
  ['CatapultHero/BP/Skill/蓝图_发射物', 'projectile'],
  ['CatapultHero/BP/Actor/BP_Actor_Card', 'card'],
  ['CatapultHero/BP/Actor/BP_ManeActor', 'actor'],
  ['CatapultHero/BP/环境/装饰品/蓝图_装饰品', 'decoration'],
  ['CatapultHero/BP/动画/蓝图_动画结算', 'settlement'],
];
function kindOf(asset, chain) {
  const self = [asset, ...chain];
  if (self.some(a => a.startsWith('CatapultHero/BP/Skill/效果/可拾取物/'))) return 'pickup';
  for (const [a, k] of KIND_BY_ANCESTOR) if (self.includes(a)) return k;
  if (self.includes('CatapultHero/BP/Skill/蓝图_效果')) return 'effect';
  return 'other';
}

/** Component properties kept: scalars, short strings, references and small numeric structs (no collision setup). */
function componentProps(props, generic) {
  const out = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === 'BodyInstance' || k === 'OverrideParameters' || k === 'AttachParent' || k === 'RenderComponentRef') continue;
    if (v === null || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = generic(v);
    else if (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => typeof x === 'number')) out[k] = v;
  }
  return out;
}

/**
 * The manifest entries. `curves`: curve asset path -> normalized curve asset (data/curve-assets.ts);
 * `tableRows`: [[table name, row name, normalized row]] of every live row; `scoped`/`live`: reachable skill classes.
 */
export function buildClasses({ blueprints, vn, curves, tableRows, scoped, live, outNonSkill }) {
  const chainOf = bp => bp.parent_chain.filter(r => r.includes("'/Game/")).map(r => assetPath(r));
  const varsOf = new Map([...blueprints].map(([a, bp]) => [a, new Map(bp.variables.map(v => [v.name, v]))]));

  // live 'table:row' references per class asset path
  const rowsOf = new Map();
  for (const [t, r, row] of tableRows) {
    const seen = new Set();
    const visit = v => {
      if (typeof v === 'string') {
        if (blueprints.has(v) && !seen.has(v)) {
          seen.add(v);
          if (!rowsOf.has(v)) rowsOf.set(v, []);
          rowsOf.get(v).push(`${t}:${r}`);
        }
      } else if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') Object.values(v).forEach(visit);
    };
    visit(row);
  }

  const tagsOf = new Map();
  const tags = asset => {
    if (tagsOf.has(asset)) return tagsOf.get(asset);
    const bp = blueprints.get(asset);
    let t = [];
    if (bp) {
      const own = bp.cdo.properties.OwnedGameplayTags;
      const parent = chainOf(bp)[0];
      t = own !== undefined ? vn.value(own, { kind: 'struct', name: 'GameplayTagContainer' }) : parent ? tags(parent) : [];
    }
    tagsOf.set(asset, t);
    return t;
  };

  const scopedSet = new Set(scoped);
  const out = [];
  for (const [asset, bp] of blueprints) {
    const chain = chainOf(bp);
    const props = bp.cdo.properties;
    const own = bp.variables.filter(v => !isPlumbing(v.name) && !isComponentVar(v));
    const vars = {};
    for (const v of own) {
      const key = mangle(v.name);
      if (Object.hasOwn(vars, key)) throw new Error(`${asset}: variables collide on ${key}`);
      const raw = Object.hasOwn(props, v.name) ? props[v.name] : v.default;
      vars[key] = vn.value(raw, parseVarType(v.type));
    }
    // CDO overrides of variables an ancestor blueprint declares
    const overrides = {};
    for (const [k, raw] of Object.entries(props)) {
      if (SKIP_PROPS.has(k) || varsOf.get(asset).has(k)) continue;
      const decl = chain.map(a => varsOf.get(a)?.get(k)).find(Boolean);
      if (decl && !isComponentVar(decl) && !isPlumbing(k)) overrides[mangle(k)] = vn.value(raw, parseVarType(decl.type));
    }
    const timelines = {};
    for (const tl of bp.timelines) {
      const p = tl.properties ?? {};
      const tracks = {};
      for (const tr of p.FloatTracks ?? []) {
        const ref = tr.CurveFloat ? /'\/Game\/([^.']+)\.[^:']+:([^']+)'/.exec(tr.CurveFloat) ?? /'\/Game\/([^.']+)\.([^']+)'/.exec(tr.CurveFloat) : null;
        const curve = ref && curves[ref[1]]?.curves.find(c => c.name === ref[2]);
        if (!curve) throw new Error(`${asset}: timeline ${tl.name} track ${tr.TrackName}: curve ${tr.CurveFloat} not found`);
        tracks[tr.TrackName] = curve.FloatCurve;
      }
      const name = p.VariableName ?? tl.name.replace(/_Template$/, '');
      // SPEC-GAP: cooked timelines omit TimelineLength when it equals the engine default (5 s).
      timelines[name] = { length: p.TimelineLength ?? 5, tracks, loop: p.bLoop ?? false, autoPlay: p.bAutoPlay ?? false };
    }
    const components = {};
    for (const c of bp.components) components[c.variable] = { class: c.class, ...componentProps(c.properties, vn.generic) };
    for (const c of bp.default_subobjects) components[c.name] = { class: c.class, ...componentProps(c.properties, vn.generic) };
    for (const c of bp.component_overrides ?? []) {
      const name = c.variable ?? c.name;
      if (name) components[name] = { ...(components[name] ?? { inherited: true }), ...componentProps(c.properties, vn.generic) };
    }
    const isSkill = asset.includes('/BP/Skill/');
    out.push({
      path: asset,
      name: asset.slice(asset.lastIndexOf('/') + 1),
      parent: chain[0] ?? null,
      native: bp.parent_chain.at(-1)?.match(/'\/Script\/([^']+)'/)?.[1] ?? null,
      kind: kindOf(asset, chain),
      tags: tags(asset),
      vars,
      overrides,
      timelines,
      components,
      rows: rowsOf.get(asset) ?? [],
      reachable: isSkill ? scopedSet.has(asset) : !outNonSkill.test(asset),
      live: isSkill ? live.includes(asset) : !asset.includes('/过期/'),
    });
  }
  return out;
}

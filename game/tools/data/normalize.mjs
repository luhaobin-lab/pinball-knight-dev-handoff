// Pure normalization of the Ricochet Abyss Demo dump (D:/TAPTAPGAME_ref/dump; conventions in its REPORT.md) into
// the shapes src/content/demo serves. No file access here: import-demo.mjs reads and writes, and
// tests/content-import runs these same functions against the dump to prove the generated modules are complete.
//
// Normalization, driven by the field types the dump records for every struct:
// - FText {text, en, ns, key} | {invariant}  -> {zh, en}; en falls back to zh when the Demo has no translation
//   (that is what UE displays), invariant texts are the same in both languages, an empty text is {zh: '', en: ''}.
// - Object/Class reference "Class'/Game/Pkg.Obj'" -> asset path "Pkg" (package path minus /Game/); the object
//   name is appended (".Obj") only when it is not the package name (or its "_C" generated class).
// - User enum {$enum, name, value, display} -> its display name (demoEnums maps it back to the value).
// - 结构_科学数 {系数, 指数} -> {值, 系数, 指数}: 值 is computed exactly like 函数库_科学数.科学数变普通.
// - Map -> plain object (the dump writes empty maps as [] and struct-keyed maps as [{key, value}]);
//   GameplayTag {TagName} -> the tag string.

/** A field type of the dump: Bool, Int, Double, Str, Name, Text, Byte<枚举_X>, Struct<X>, Object<X>, Class<X>, Array<T>, Map<K, V>. */
export function parseType(text) {
  const m = /^(Array|Map|Struct|Object|Class|Byte)<(.+)>$/.exec(text);
  if (!m) {
    if (!PRIMITIVES.has(text)) throw new Error(`unknown field type "${text}"`);
    return { kind: 'prim', name: text };
  }
  const [, outer, inner] = m;
  switch (outer) {
    case 'Array':
      return { kind: 'array', item: parseType(inner) };
    case 'Map': {
      const [key, value] = splitTopLevel(inner);
      return { kind: 'map', key: parseType(key), value: parseType(value) };
    }
    case 'Struct':
      return { kind: 'struct', name: inner };
    case 'Byte':
      return { kind: 'enum', name: inner };
    default:
      return { kind: 'ref', class: inner };
  }
}

const IS_PRIMITIVE = {
  Bool: v => typeof v === 'boolean',
  Int: v => Number.isInteger(v),
  Double: v => typeof v === 'number' && Number.isFinite(v),
  Str: v => typeof v === 'string',
  Name: v => typeof v === 'string',
};
const PRIMITIVES = new Set([...Object.keys(IS_PRIMITIVE), 'Text']);

function splitTopLevel(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '<') depth++;
    else if (text[i] === '>') depth--;
    else if (text[i] === ',' && depth === 0) return [text.slice(0, i).trim(), text.slice(i + 1).trim()];
  }
  throw new Error(`cannot split map type "${text}"`);
}

/** 函数库_科学数.科学数变普通: 系数 × 10^指数, with a zero 系数 giving exactly 0. */
export function scientificValue(系数, 指数) {
  return 系数 === 0 ? 0 : 系数 * 10 ** 指数;
}

const REF = /^([A-Za-z0-9_]+)'(\/[^']+)'$/;

/** "Class'/Game/CatapultHero/X/Y.Y_C'" -> "CatapultHero/X/Y"; null stays null. */
export function assetPath(ref, where = '') {
  if (ref === null) return null;
  const m = typeof ref === 'string' ? REF.exec(ref) : null;
  if (!m) throw new Error(`${where}: not an object reference: ${JSON.stringify(ref)}`);
  const full = m[2];
  const dot = full.indexOf('.', full.lastIndexOf('/'));
  const pkg = dot < 0 ? full : full.slice(0, dot);
  const object = dot < 0 ? null : full.slice(dot + 1);
  const base = pkg.slice(pkg.lastIndexOf('/') + 1);
  const path = pkg.startsWith('/Game/') ? pkg.slice('/Game/'.length) : pkg;
  return object === null || object === base || object === `${base}_C` ? path : `${path}.${object}`;
}

/** Asset path -> the asset's name (its last segment), e.g. "CatapultHero/数据表/角色/数据表_玩家" -> "数据表_玩家". */
export const assetName = path => path.slice(path.lastIndexOf('/') + 1);

/** Engine structs that appear in the Demo's tables, with their fixed numeric fields. */
const NUMERIC_STRUCTS = {
  InputRange: ['Min', 'Max'],
  Vector: ['X', 'Y', 'Z'],
  Vector2D: ['X', 'Y'],
  Quat: ['X', 'Y', 'Z', 'W'],
};

/**
 * Normalizer over the dump's user structs and enums.
 * `structs`: name -> { fields: [{name, type}] } (type strings as in the dump); `enums`: name -> { values }.
 * `note(kind, where)` receives side observations: 'text-without-en'.
 */
export function createNormalizer({ structs, enums, note = () => {} }) {
  const fieldTypes = new Map();
  for (const [name, def] of Object.entries(structs)) fieldTypes.set(name, def.fields.map(f => [f.name, parseType(f.type)]));

  function value(v, type, where) {
    switch (type.kind) {
      case 'prim':
        return primitive(v, type.name, where);
      case 'enum':
        return enumDisplay(v, type.name, where);
      case 'ref':
        return assetPath(v, where);
      case 'array':
        if (!Array.isArray(v)) throw new Error(`${where}: expected an array`);
        return v.map((x, i) => value(x, type.item, `${where}[${i}]`));
      case 'map':
        return map(v, type, where);
      case 'struct':
        return struct(v, type.name, where);
    }
    throw new Error(`${where}: unhandled type ${JSON.stringify(type)}`);
  }

  function primitive(v, name, where) {
    if (name === 'Text') return text(v, where);
    if (!IS_PRIMITIVE[name](v)) throw new Error(`${where}: expected ${name}, got ${JSON.stringify(v)}`);
    return v;
  }

  function text(v, where) {
    if (v === null || typeof v !== 'object') throw new Error(`${where}: expected FText`);
    if ('invariant' in v) {
      expectKeys(v, ['invariant'], where);
      const s = v.invariant ?? '';
      return { zh: s, en: s };
    }
    if (typeof v.text !== 'string' || Object.keys(v).some(k => !['text', 'en', 'ns', 'key'].includes(k))) {
      throw new Error(`${where}: unexpected FText ${JSON.stringify(v)}`);
    }
    if (typeof v.en !== 'string') note('text-without-en', where);
    return { zh: v.text, en: v.en ?? v.text };
  }

  function enumDisplay(v, name, where) {
    const entry = enums[name]?.values.find(e => e.name === v?.name);
    if (v?.$enum !== name || !entry || entry.value !== v.value || entry.display !== v.display || entry.display === null) {
      throw new Error(`${where}: bad ${name} value ${JSON.stringify(v)}`);
    }
    return v.display;
  }

  function map(v, type, where) {
    const out = {};
    const put = (key, x) => {
      const k = mapKey(key, type.key, where);
      if (Object.hasOwn(out, k)) throw new Error(`${where}: duplicate map key ${k}`);
      out[k] = value(x, type.value, `${where}.${k}`);
    };
    if (Array.isArray(v)) {
      for (const pair of v) {
        expectKeys(pair, ['key', 'value'], where);
        put(pair.key, pair.value);
      }
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) put(k, x);
    } else {
      throw new Error(`${where}: expected a map`);
    }
    return out;
  }

  function mapKey(key, type, where) {
    const k = type.kind === 'struct' && type.name === 'GameplayTag' ? tag(key, where) : key;
    if (typeof k !== 'string' || (type.kind === 'prim' && !['Str', 'Name'].includes(type.name))) {
      throw new Error(`${where}: unsupported map key ${JSON.stringify(key)}`);
    }
    return safeKey(k, where);
  }

  function tag(v, where) {
    expectKeys(v, ['TagName'], where);
    if (typeof v.TagName !== 'string') throw new Error(`${where}: bad GameplayTag`);
    return v.TagName;
  }

  function struct(v, name, where) {
    if (name === 'GameplayTagContainer') {
      if (!Array.isArray(v) || v.some(t => typeof t !== 'string')) throw new Error(`${where}: bad GameplayTagContainer`);
      return [...v];
    }
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where}: expected struct ${name}`);
    if (name === '结构_科学数') {
      expectKeys(v, ['系数', '指数'], where);
      if (typeof v.系数 !== 'number' || !Number.isInteger(v.指数)) throw new Error(`${where}: bad 结构_科学数`);
      return { 值: scientificValue(v.系数, v.指数), 系数: v.系数, 指数: v.指数 };
    }
    const fields = fieldTypes.get(name);
    if (fields) {
      expectKeys(v, fields.map(([f]) => f), where);
      return Object.fromEntries(fields.map(([f, t]) => [f, value(v[f], t, `${where}.${f}`)]));
    }
    switch (name) {
      case 'DataTableRowHandle':
        expectKeys(v, ['DataTable', 'RowName'], where);
        if (typeof v.RowName !== 'string') throw new Error(`${where}: bad RowName`);
        return { DataTable: assetPath(v.DataTable, where), RowName: v.RowName };
      case 'GameplayTag':
        return tag(v, where);
      case 'Transform':
        expectKeys(v, ['Rotation', 'Translation', 'Scale3D'], where);
        return {
          Rotation: numeric(v.Rotation, 'Quat', `${where}.Rotation`),
          Translation: numeric(v.Translation, 'Vector', `${where}.Translation`),
          Scale3D: numeric(v.Scale3D, 'Vector', `${where}.Scale3D`),
        };
    }
    if (NUMERIC_STRUCTS[name]) return numeric(v, name, where);
    throw new Error(`${where}: unknown struct ${name}`);
  }

  function numeric(v, name, where) {
    expectKeys(v, NUMERIC_STRUCTS[name], where);
    for (const k of NUMERIC_STRUCTS[name]) if (typeof v[k] !== 'number') throw new Error(`${where}.${k}: expected a number`);
    return Object.fromEntries(NUMERIC_STRUCTS[name].map(k => [k, v[k]]));
  }

  return {
    value,
    /** A row (or a struct default) of user struct `name`. */
    struct: (v, name, where) => struct(v, name, where),
  };
}

function expectKeys(v, keys, where) {
  if (v === null || typeof v !== 'object') throw new Error(`${where}: expected an object with ${keys.join(', ')}`);
  const have = Object.keys(v);
  if (have.length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) {
    throw new Error(`${where}: expected fields [${keys.join(', ')}], got [${have.join(', ')}]`);
  }
}

/**
 * Object keys must keep the dump's order: JS objects move integer-like keys first, and "__proto__" is special.
 * Neither occurs in the Demo; refuse them rather than silently reorder.
 */
export function safeKey(key, where = '') {
  if (key === '__proto__' || /^(0|[1-9]\d*)$/.test(key)) throw new Error(`${where}: key "${key}" would not keep its order`);
  return key;
}

/** Untyped normalization (engine rows such as RichTextStyleRow, curve assets): object references become asset paths. */
function normalizeGeneric(v, where = '') {
  if (typeof v === 'string') return REF.test(v) ? assetPath(v, where) : v;
  if (Array.isArray(v)) return v.map((x, i) => normalizeGeneric(x, `${where}[${i}]`));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [safeKey(k, where), normalizeGeneric(x, `${where}.${k}`)]));
  }
  return v;
}

/** The struct name inside "UserDefinedStruct'/Game/.../结构_角色.结构_角色'" or "Class'/Script/UMG.RichTextStyleRow'". */
function rowStructName(ref) {
  const m = REF.exec(ref);
  if (!m) throw new Error(`bad row_struct ${ref}`);
  return m[2].slice(m[2].lastIndexOf('.') + 1);
}

/**
 * One dump table -> { asset, class, row_struct, rows } (composite tables additionally keep parent_tables and are
 * resolved from their parents by src/content/demo/composite.ts). Throws on anything it does not understand.
 */
export function normalizeTable(dumpTable, normalizer) {
  const name = assetName(dumpTable.asset);
  const rowStruct = rowStructName(dumpTable.row_struct);
  const rows = {};
  for (const [key, row] of Object.entries(dumpTable.rows)) {
    const where = `${name}#${key}`;
    rows[safeKey(key, where)] = rowStruct === 'RichTextStyleRow' ? normalizeGeneric(row, where) : normalizer.struct(row, rowStruct, where);
  }
  if (Object.keys(rows).length !== dumpTable.row_count) throw new Error(`${name}: row_count ${dumpTable.row_count} != ${Object.keys(rows).length}`);
  return {
    asset: assetPath(`DataTable'${dumpTable.asset}'`),
    class: dumpTable.class,
    row_struct: rowStruct,
    ...(dumpTable.parent_tables ? { parent_tables: dumpTable.parent_tables.map(p => assetPath(p, name)) } : {}),
    rows,
  };
}

// FRealCurve / FRichCurveKey defaults (UE 5.x); cooked curves omit them.
const CURVE_DEFAULTS = { DefaultValue: 3.4028235e38, PreInfinityExtrap: 'RCCE_Constant', PostInfinityExtrap: 'RCCE_Constant' };
const KEY_FIELDS = ['InterpMode', 'TangentMode', 'TangentWeightMode', 'Time', 'Value', 'ArriveTangent', 'ArriveTangentWeight', 'LeaveTangent', 'LeaveTangentWeight'];
const EXTRAPOLATION_PREFIX = 'ERichCurveExtrapolation::';

/** A dump FRichCurve -> { Keys, DefaultValue, PreInfinityExtrap, PostInfinityExtrap } with the engine defaults filled in. */
export function normalizeRichCurve(curve, where) {
  const known = ['Keys', 'DefaultValue', 'PreInfinityExtrap', 'PostInfinityExtrap'];
  const extra = Object.keys(curve).filter(k => !known.includes(k));
  if (extra.length) throw new Error(`${where}: unexpected curve fields ${extra.join(', ')}`);
  const keys = (curve.Keys ?? []).map((key, i) => {
    expectKeys(key, KEY_FIELDS, `${where}.Keys[${i}]`);
    return Object.fromEntries(KEY_FIELDS.map(f => [f, key[f]]));
  });
  const extrapolation = v => (v.startsWith(EXTRAPOLATION_PREFIX) ? v.slice(EXTRAPOLATION_PREFIX.length) : v);
  return {
    Keys: keys,
    DefaultValue: curve.DefaultValue ?? CURVE_DEFAULTS.DefaultValue,
    PreInfinityExtrap: extrapolation(curve.PreInfinityExtrap ?? CURVE_DEFAULTS.PreInfinityExtrap),
    PostInfinityExtrap: extrapolation(curve.PostInfinityExtrap ?? CURVE_DEFAULTS.PostInfinityExtrap),
  };
}

/**
 * One dump curve asset (dump/curves/**) -> { asset, curves: [...] }:
 * CurveTable -> { name, class, mode, rows }, CurveFloat -> { name, class, outer, FloatCurve },
 * CurveLinearColor -> { name, class, FloatCurves: [R, G, B, A] }.
 */
export function normalizeCurveAsset(dumpAsset) {
  const asset = assetPath(`Object'${dumpAsset.asset}'`);
  const curves = dumpAsset.curves.map(c => {
    const where = `${asset}:${c.name}`;
    switch (c.class) {
      case 'CurveTable':
        expectKeys(c, ['name', 'class', 'export_index', 'mode', 'rows'], where);
        return {
          name: c.name,
          class: c.class,
          mode: c.mode,
          rows: Object.fromEntries(Object.entries(c.rows).map(([k, v]) => [safeKey(k, where), normalizeRichCurve(v, `${where}#${k}`)])),
        };
      case 'CurveFloat':
        expectKeys(c, ['name', 'class', 'export_index', 'outer', 'FloatCurve'], where);
        return { name: c.name, class: c.class, outer: assetPath(c.outer, where), FloatCurve: normalizeRichCurve(c.FloatCurve, where) };
      case 'CurveLinearColor': {
        expectKeys(c, ['name', 'class', 'export_index', 'FloatCurves', 'properties'], where);
        const channels = [c.FloatCurves, c.properties['FloatCurves[1]'], c.properties['FloatCurves[2]'], c.properties['FloatCurves[3]']];
        if (Object.keys(c.properties).length !== 3 || channels.some(ch => ch === undefined)) throw new Error(`${where}: unexpected channels`);
        return { name: c.name, class: c.class, FloatCurves: channels.map((ch, i) => normalizeRichCurve(ch, `${where}[${i}]`)) };
      }
    }
    throw new Error(`${where}: unknown curve class ${c.class}`);
  });
  return { asset, curves };
}

/** One dump enum (dump/enums/**) -> { asset, cpp_form, values }. */
export function normalizeEnum(dumpEnum) {
  expectKeys(dumpEnum, ['asset', 'name', 'cpp_form', 'values'], dumpEnum.name);
  return {
    asset: assetPath(`Object'${dumpEnum.asset}'`),
    cpp_form: dumpEnum.cpp_form,
    values: dumpEnum.values.map(v => ({ name: v.name, value: v.value, display: v.display })),
  };
}

/** One dump user struct (dump/structs/**) -> { asset, fields: [{name, raw_name, type}], defaults } (defaults normalized). */
export function normalizeStruct(dumpStruct, normalizer) {
  expectKeys(dumpStruct, ['asset', 'name', 'guid', 'fields', 'defaults'], dumpStruct.name);
  return {
    asset: assetPath(`Object'${dumpStruct.asset}'`),
    fields: dumpStruct.fields.map(f => ({ name: f.name, raw_name: f.raw_name, type: f.type })),
    defaults: normalizer.struct(dumpStruct.defaults, dumpStruct.name, `${dumpStruct.name}.defaults`),
  };
}

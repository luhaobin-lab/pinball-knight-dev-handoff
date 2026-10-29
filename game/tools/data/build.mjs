// Builds the content of src/content/demo from the Demo dump: normalizes every table, curve, enum and struct,
// drops the rows the dump clearly marks as tests, flags kept rows that need care, and renders the files.
// Pure apart from reading the dump; import-demo.mjs writes (or checks) the files.
import { readDump } from './dump.mjs';
import { emitFiles } from './emit.mjs';
import { assetName, createNormalizer, normalizeCurveAsset, normalizeEnum, normalizeStruct, normalizeTable } from './normalize.mjs';

/** Tables and curve assets in a 过期 ("expired") folder are deprecated: kept as data, not exported from index.ts. */
const isDeprecated = asset => asset.split('/').includes('过期');

/** A row is a test row when its key says so (测试 = "test"); it is dropped unless a kept row references it. */
const TEST_MARK = '测试';
/** Designer notes the Demo stores as row names ("注意：…" = "Note: …", "提醒：…" = "Reminder: …", "---------"). */
const NOTE_ROW = /^(注意|提醒)[：:]|^-{3,}$/;
const TEST_TAGS = new Set(['Test', 'Tests']);

const TEST_ROW_REASON = 'the row key marks it as a test (测试) and no kept row references it';

/** Every value nested in `v` (depth first). */
function* walk(v) {
  yield v;
  if (Array.isArray(v)) for (const x of v) yield* walk(x);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* walk(x);
}

const isHandle = v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 2 && 'DataTable' in v && 'RowName' in v;

/** UCompositeDataTable: parents in order, a later parent's row replaces an earlier one but keeps its position. */
function mergeParentRows(parents) {
  return Object.assign({}, ...parents.map(p => p.rows));
}

export function buildDemoContent(dumpDir) {
  const dump = readDump(dumpDir);
  const enumDefs = Object.fromEntries(dump.enums.map(({ json }) => [json.name, json]));
  const structDefs = Object.fromEntries(dump.structs.map(({ json }) => [json.name, json]));
  let notes = [];
  const normalizer = createNormalizer({ structs: structDefs, enums: enumDefs, note: (kind, where) => notes.push({ kind, where }) });

  // 1. Normalize every table.
  const tables = new Map();
  for (const { source, json } of dump.datatables) {
    notes = [];
    const table = normalizeTable(json, normalizer);
    const name = assetName(table.asset);
    if (tables.has(name)) throw new Error(`duplicate table name ${name}`);
    // Notes are located as "<table>#<row>.<field>...", so row keys must not contain those separators.
    for (const key of Object.keys(table.rows)) if (/[.#[\]]/.test(key)) throw new Error(`${name}: row key "${key}" contains . # [ or ]`);
    const textsWithoutEn = new Map();
    for (const { where } of notes) {
      const key = where.slice(name.length + 1).split('.')[0];
      textsWithoutEn.set(key, (textsWithoutEn.get(key) ?? 0) + 1);
    }
    tables.set(name, { name, source, table, deprecated: isDeprecated(table.asset), dumpRows: json.row_count, textsWithoutEn });
  }
  const byAsset = new Map([...tables.values()].map(t => [t.table.asset, t]));
  const composites = [...tables.values()].filter(t => t.table.class === 'CompositeDataTable');
  const plain = [...tables.values()].filter(t => t.table.class !== 'CompositeDataTable');

  // 2. A composite table must equal its merged parents, otherwise it cannot be served as a view of them.
  for (const c of composites) {
    const parents = c.table.parent_tables.map(p => byAsset.get(p) ?? fail(`${c.name}: parent ${p} is not in the dump`));
    if (JSON.stringify(mergeParentRows(parents.map(p => p.table))) !== JSON.stringify(c.table.rows)) {
      throw new Error(`${c.name} differs from its merged parent tables`);
    }
  }

  // 3. Drop test rows nothing kept refers to (fixpoint: a kept row's references keep their targets).
  const refs = new Map();
  for (const t of plain) {
    for (const [key, row] of Object.entries(t.table.rows)) {
      const targets = new Set();
      for (const v of walk(row)) if (isHandle(v) && v.DataTable !== null) targets.add(`${assetName(v.DataTable)}#${v.RowName}`);
      refs.set(`${t.name}#${key}`, targets);
    }
  }
  const dropped = new Set([...refs.keys()].filter(id => id.slice(id.indexOf('#') + 1).includes(TEST_MARK)));
  for (let changed = true; changed; ) {
    changed = false;
    for (const [from, targets] of refs) {
      if (dropped.has(from)) continue;
      for (const to of targets) if (dropped.delete(to)) changed = true;
    }
  }

  // 4. Flag kept rows that need care.
  const deprecatedAssets = new Set([...tables.values()].filter(t => t.deprecated).map(t => t.table.asset));
  const allRows = new Set(refs.keys());
  const out = [];
  for (const t of plain) {
    const rows = {};
    const flags = {};
    const droppedHere = {};
    for (const [key, row] of Object.entries(t.table.rows)) {
      if (dropped.has(`${t.name}#${key}`)) {
        droppedHere[key] = TEST_ROW_REASON;
        continue;
      }
      rows[key] = row;
      const reasons = new Set();
      if (NOTE_ROW.test(key)) reasons.add('designer note used as a row name');
      for (const v of walk(row)) {
        if (isHandle(v) && v.DataTable !== null && v.RowName !== 'None') {
          const target = assetName(v.DataTable);
          if (!tables.has(target)) reasons.add(`references a table missing from the dump: ${v.DataTable}`);
          else if (!allRows.has(`${target}#${v.RowName}`)) reasons.add(`references missing row ${target}#${v.RowName}`);
        }
        if (typeof v === 'string' && deprecatedAssets.has(v) && !t.deprecated) reasons.add(`references deprecated table ${assetName(v)}`);
        if (typeof v === 'string' && TEST_TAGS.has(v)) reasons.add(`carries the ${v} gameplay tag`);
      }
      // Deprecated tables are full of untranslated texts; manifest.json counts them instead of flagging every row.
      const noEn = t.deprecated ? 0 : (t.textsWithoutEn.get(key) ?? 0);
      if (noEn) reasons.add(`${noEn} text${noEn > 1 ? 's' : ''} without English in the Demo (en repeats zh)`);
      if (reasons.size) flags[key] = [...reasons].join('; ');
    }
    out.push({ ...t, table: { ...t.table, rows }, flags, dropped: droppedHere });
  }
  const outByAsset = new Map(out.map(t => [t.table.asset, t]));
  for (const c of composites) {
    const parents = c.table.parent_tables.map(p => outByAsset.get(p).table);
    const merged = mergeParentRows(parents);
    const droppedHere = {};
    for (const key of Object.keys(c.table.rows)) if (!Object.hasOwn(merged, key)) droppedHere[key] = 'dropped from its parent table (test row)';
    out.push({ ...c, table: { ...c.table, rows: merged }, flags: {}, dropped: droppedHere });
  }
  out.sort((a, b) => (a.source < b.source ? -1 : 1));

  // 5. Curves, enums, structs.
  const curveAssets = dump.curves.map(({ source, json }) => {
    const asset = normalizeCurveAsset(json);
    return { source, ...asset, deprecated: isDeprecated(asset.asset) };
  });
  const enums = Object.fromEntries(dump.enums.map(({ json }) => [json.name, normalizeEnum(json)]));
  const structs = Object.fromEntries(dump.structs.map(({ json }) => [json.name, normalizeStruct(json, normalizer)]));

  // The manifests (tools/data/manifests.mjs) reuse the normalized tables and curves and the raw struct/enum definitions.
  return { ...emitFiles({ tables: out, curveAssets, enums, structs, enumDefs, structDefs, dumpDir }), tables: out, curveAssets, structDefs, enumDefs };
}

function fail(message) {
  throw new Error(message);
}

import { describe, expect, it } from 'vitest';
import manifestJson from '../../src/content/demo/manifest.json';
import { demoCurveAssets, demoEnums, demoStructs } from '../../src/content/demo/index.ts';
import type { DemoCurveTable, DemoTable } from '../../src/content/demo/index.ts';
import { buildDemoContent } from '../../tools/data/build.mjs';
import { DEFAULT_DUMP, dumpExists, readDump } from '../../tools/data/dump.mjs';
import { assetName, createNormalizer, normalizeCurveAsset, normalizeEnum, normalizeStruct, normalizeTable } from '../../tools/data/normalize.mjs';
import { compareGenerated } from '../../tools/data/output.mjs';

// Round trip: every table, row, curve, enum and struct of the dump is in src/content/demo (or listed as a dropped
// test row), normalized exactly as tools/data/normalize.mjs says, and the files are what the importer generates now.

const modules = import.meta.glob('../../src/content/demo/data/*.ts', { eager: true, import: 'default' });
const dataModule = (name: string): unknown => modules[`../../src/content/demo/data/${name}.ts`];

interface Manifest {
  tables: Record<string, { source: string; deprecated: boolean; dropped: Record<string, string> }>;
  curve_assets: Record<string, { source: string; module: string }>;
}
const manifest = manifestJson as unknown as Manifest;

/** JSON equality: the generated payload is JSON, so -0 reads back as 0 and only JSON-visible content counts. */
const sameJson = (actual: unknown, expected: unknown, label: string) => expect(JSON.stringify(actual), label).toBe(JSON.stringify(expected));

const haveDump = dumpExists();
const dump = haveDump ? readDump(DEFAULT_DUMP) : { datatables: [], curves: [], enums: [], structs: [] };
const normalizer = createNormalizer({
  structs: Object.fromEntries(dump.structs.map(f => [f.json.name, f.json])),
  enums: Object.fromEntries(dump.enums.map(f => [f.json.name, f.json])),
});

describe.skipIf(!haveDump)(`round trip against ${DEFAULT_DUMP}`, () => {
  it('covers all 49 tables (2546 rows), 32 curve assets, 23 enums and 45 structs', () => {
    expect(dump.datatables).toHaveLength(49);
    expect(dump.datatables.reduce((n, f) => n + f.json.row_count, 0)).toBe(2546);
    expect(Object.keys(manifest.tables).sort()).toEqual(dump.datatables.map(f => assetName(f.json.asset)).sort());
    expect(dump.curves).toHaveLength(32);
    expect(Object.keys(manifest.curve_assets)).toHaveLength(32);
    expect(Object.keys(demoEnums)).toHaveLength(23);
    expect(Object.keys(demoStructs)).toHaveLength(45);
  });

  for (const { source, json } of dump.datatables) {
    const name = assetName(json.asset);
    it(`${name}: every row is imported unchanged, in order, or listed as a dropped test row`, () => {
      const expected = normalizeTable(json, normalizer);
      const entry = manifest.tables[name]!;
      const table = dataModule(name) as DemoTable<unknown>;
      expect(table, `data/${name}.ts`).toBeDefined();
      expect(entry.source).toBe(source);
      expect([table.asset, table.class, table.row_struct]).toEqual([expected.asset, json.class, expected.row_struct]);
      expect(table.deprecated).toBe(json.asset.includes('/过期/'));
      expect(entry.deprecated).toBe(table.deprecated);

      const dropped = Object.keys(entry.dropped);
      for (const key of dropped) expect(key, `${name}#${key} dropped`).toContain('测试');
      const kept = Object.keys(expected.rows).filter(k => !dropped.includes(k));
      expect(Object.keys(table.rows)).toEqual(kept);
      expect(kept.length + dropped.length).toBe(json.row_count);
      const rows = table.rows as Readonly<Record<string, unknown>>;
      for (const key of kept) sameJson(rows[key], expected.rows[key], `${name}#${key}`);
      for (const key of Object.keys(table.flags)) expect(kept).toContain(key);
    });
  }

  for (const { source, json } of dump.curves) {
    it(`curves ${source}: imported unchanged`, () => {
      const expected = normalizeCurveAsset(json);
      const entry = manifest.curve_assets[expected.asset]!;
      expect(entry.source).toBe(source);
      if (entry.module === 'data/curve-assets.ts') {
        sameJson(demoCurveAssets[expected.asset]?.curves, expected.curves, expected.asset);
        expect(demoCurveAssets[expected.asset]?.deprecated).toBe(expected.asset.includes('/过期/'));
      } else {
        const [curve] = expected.curves;
        const table = dataModule(assetName(expected.asset)) as DemoCurveTable;
        expect([table.asset, table.name, table.class]).toEqual([expected.asset, curve!.name, curve!.class]);
        sameJson(table.rows, curve!.rows, expected.asset);
      }
    });
  }

  it('enums and structs are imported unchanged', () => {
    for (const { json } of dump.enums) sameJson(demoEnums[json.name as keyof typeof demoEnums], normalizeEnum(json), json.name);
    for (const { json } of dump.structs) sameJson(demoStructs[json.name as keyof typeof demoStructs], normalizeStruct(json, normalizer), json.name);
  });

  it('the generated files are up to date (node tools/data/import-demo.mjs --check)', () => {
    expect(compareGenerated(buildDemoContent(DEFAULT_DUMP).files)).toEqual({ changed: [], stale: [] });
  });
});

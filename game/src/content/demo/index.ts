/**
 * The Ricochet Abyss Demo's data, the single source of the game's numbers: every table, curve, enum and struct of
 * D:/TAPTAPGAME_ref/dump, imported by tools/data/import-demo.mjs (see src/content/README.md). Tables, row names
 * and field names keep the Demo's Chinese names so specs and the dump can be cross-referenced.
 *
 * Every table is its own module: import the tables you use by name and bundles keep only those. registry.ts (all
 * tables by asset path) is the opt-in exception for references that can point anywhere.
 */
import type { AssetPath, DataTableRowHandle, 结构_科学数, 结构_科学映射词条 } from './types.ts';

export * from './tables.ts';
export type * from './types.ts';

/** Anything with rows by name: a DemoTable, a DemoCompositeTable or a DemoCurveTable. */
export interface HasRows<Row, Key extends string> {
  readonly asset: AssetPath;
  readonly rows: Readonly<Record<Key, Row>>;
}

/** True if the table has a row with this name (dropped test rows do not exist). */
export function hasRow<Key extends string>(table: HasRows<unknown, Key>, key: string): key is Key {
  return Object.hasOwn(table.rows, key);
}

/** The row with this name, or undefined: for names read from data, e.g. a DataTableRowHandle.RowName. */
export function findRow<Row, Key extends string>(table: HasRows<Row, Key>, key: string): Row | undefined {
  return hasRow(table, key) ? table.rows[key] : undefined;
}

/** The row with this name; throws if there is none. */
export function row<Row, Key extends string>(table: HasRows<Row, Key>, key: string): Row {
  const found = findRow(table, key);
  if (found === undefined) throw new Error(`${table.asset} has no row "${key}"`);
  return found;
}

/** Row names in the Demo's order (the order GetDataTableRowNames returns, which the Demo's UI lists follow). */
export function rowNames<Key extends string>(table: HasRows<unknown, Key>): Key[] {
  return Object.keys(table.rows) as Key[];
}

/**
 * The row a DataTableRowHandle points at, looked up among `tables` by asset path; undefined for an empty handle
 * (DataTable null), a table not in the list (deprecated tables are never exported) or a missing row.
 */
export function resolveRowHandle<Row>(handle: DataTableRowHandle, tables: readonly HasRows<Row, string>[]): Row | undefined {
  const table = tables.find(t => t.asset === handle.DataTable);
  return table && findRow(table, handle.RowName);
}

/**
 * A 科学词条 attribute as its table stores it: the 来源映射 "" (base) source, the only source the Demo's tables
 * hold. Combining the sources a run adds is game logic (函数库_科学数.获取科学映射词条) and belongs in src/core.
 */
export function baseAttribute(attributes: Readonly<Record<string, 结构_科学映射词条>>, name: string): 结构_科学数 | undefined {
  return Object.hasOwn(attributes, name) ? attributes[name].来源映射[''] : undefined;
}

import type { DemoCompositeTable, DemoTable } from './types.ts';

/**
 * Resolves a CompositeDataTable from its parents the way UE's UCompositeDataTable builds its row map: parents in
 * order, a later parent's row replaces the same row of an earlier one and keeps the earlier position. A row's flag
 * comes from the parent that provides the row.
 */
export function mergeParents<Row, Key extends string>(
  meta: Omit<DemoCompositeTable<Row, Key>, 'rows' | 'flags'>,
  parents: readonly DemoTable<Row, string>[],
): DemoCompositeTable<Row, Key> {
  const rows: Record<string, Row> = {};
  const flags: Record<string, string> = {};
  for (const parent of parents) {
    for (const [key, row] of Object.entries(parent.rows)) {
      rows[key] = row;
      const flag = parent.flags[key];
      if (flag === undefined) delete flags[key];
      else flags[key] = flag;
    }
  }
  // The generated module names Key: the union of its parents' row names, which is exactly what was merged.
  return { ...meta, flags, rows } as DemoCompositeTable<Row, Key>;
}

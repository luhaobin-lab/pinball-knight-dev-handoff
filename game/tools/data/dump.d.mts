// Types for dump.mjs (used by tests/content-import).
import type { DumpCurveAsset, DumpEnum, DumpStruct, DumpTable } from './normalize.mjs';

export const DEFAULT_DUMP: string;
export function dumpExists(dumpDir?: string): boolean;

export interface DumpFile<T> {
  /** Path relative to the dump root, e.g. "datatables/CatapultHero/数据表/角色/数据表_玩家.json". */
  source: string;
  json: T;
}

export function readDump(dumpDir?: string): {
  datatables: DumpFile<DumpTable>[];
  curves: DumpFile<DumpCurveAsset>[];
  enums: DumpFile<DumpEnum>[];
  structs: DumpFile<DumpStruct>[];
};

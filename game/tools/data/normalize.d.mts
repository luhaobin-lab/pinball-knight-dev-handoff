// Types for normalize.mjs (used by tests/content-import).

export type DumpType =
  | { kind: 'prim'; name: 'Bool' | 'Int' | 'Double' | 'Str' | 'Name' | 'Text' }
  | { kind: 'enum'; name: string }
  | { kind: 'ref'; class: string }
  | { kind: 'array'; item: DumpType }
  | { kind: 'map'; key: DumpType; value: DumpType }
  | { kind: 'struct'; name: string };

export interface DumpStruct {
  asset: string;
  name: string;
  guid: string;
  fields: { name: string; raw_name: string; type: string; flags?: string }[];
  defaults: unknown;
}

export interface DumpEnum {
  asset: string;
  name: string;
  cpp_form: string;
  values: { name: string; value: number; display: string | null }[];
}

export interface DumpTable {
  asset: string;
  class: string;
  row_struct: string;
  row_count: number;
  parent_tables?: string[];
  rows: Record<string, unknown>;
}

export interface DumpCurveAsset {
  asset: string;
  curves: { name: string; class: string; [field: string]: unknown }[];
}

export interface NormalizedTable {
  asset: string;
  class: string;
  row_struct: string;
  parent_tables?: string[];
  rows: Record<string, unknown>;
}

export interface Normalizer {
  value(v: unknown, type: DumpType, where: string): unknown;
  struct(v: unknown, name: string, where: string): unknown;
}

export function parseType(text: string): DumpType;
export function scientificValue(系数: number, 指数: number): number;
export function assetPath(ref: string | null, where?: string): string | null;
export function assetName(path: string): string;
export function createNormalizer(options: {
  structs: Record<string, DumpStruct>;
  enums: Record<string, DumpEnum>;
  note?: (kind: 'text-without-en', where: string) => void;
}): Normalizer;
export function safeKey(key: string, where?: string): string;
export function normalizeTable(dumpTable: DumpTable, normalizer: Normalizer): NormalizedTable;
export function normalizeRichCurve(curve: object, where: string): unknown;
export function normalizeCurveAsset(dumpAsset: DumpCurveAsset): { asset: string; curves: { name: string; class: string; rows?: Record<string, unknown> }[] };
export function normalizeEnum(dumpEnum: DumpEnum): unknown;
export function normalizeStruct(dumpStruct: DumpStruct, normalizer: Normalizer): unknown;

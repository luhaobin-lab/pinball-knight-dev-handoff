// Types for skeleton.mjs (used by tests/content-bpkit).
export const CORE_BASES: Record<string, string>;
export function modulePath(asset: string, base?: string): string;
export function moduleSource(o: { asset: string; batch: string; classes: Readonly<Record<string, unknown>>; pseudoText: string; blueprint: unknown; root: string; base?: string }): string;
export function batchSource(existing: string | null, batchFile: string, file: string, name: string): string;
export function tsType(text: string): string;

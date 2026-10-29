/** Types of tools/gen/facade.mjs for the tests. */
export const MODULES: readonly string[];
export function mangle(name: string): string;
export interface PseudoFn { name: string; params: { name: string; type: string; out: boolean; ref: boolean; ret: boolean }[]; override: boolean; flags: string }
export function parsePseudo(file: string): { vars: { name: string; type: string; def: string }[]; fns: PseudoFn[]; overrides: Map<string, string> };
export interface ModelFn { demo: string; ts: string; module: string; params: { demo: string; ts: string }[]; outs: { demo: string; ts: string }[]; ret: { demo: string; ts: string } | null; ctx: boolean }
export interface ModelClass { name: string; file: string; parent?: string; library?: boolean; assetPath: string; vars: { demo: string; ts: string; def: string; raw: string }[]; fns: ModelFn[] }
export function buildModel(pseudoDir?: string): Map<string, ModelClass>;
export function generate(dump?: string): { model: Map<string, ModelClass>; files: Map<string, string> };
export const CLASSES: readonly { name: string; file: string; parent?: string; library?: boolean; widget?: boolean }[];
/** Widget function facades (src/core/bp/widgets.ts): only the functions fn-modules.json lists. */
export const WIDGETS: typeof CLASSES;

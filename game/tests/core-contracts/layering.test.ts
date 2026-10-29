import { describe, expect, it } from 'vitest';

/**
 * ARCHITECTURE §3.3 import rules (WAVE_A A01). Type-only imports of the API contracts (core/api/{types,commands,view,
 * events,compose}.ts) are allowed from every core layer: they are declarations, and the view slices systems return
 * are typed by them.
 */
const sources = import.meta.glob<string>(['../../src/**/*.ts'], { query: '?raw', import: 'default', eager: true });

const norm = (p: string): string => p.replace(/\\/g, '/');
function resolve(from: string, spec: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return parts.join('/');
}
const rel = (file: string): string => norm(file).replace(/^(\.\.\/)+src\//, 'src/');

type Rule = { from: RegExp; allow: RegExp[]; deny?: RegExp[] };
const CONTRACT_TYPES = /^src\/core\/api\/(types|commands|view|events|compose)\.ts$/;
const DEMO = /^src\/content\/demo\//;
const MATH = /^src\/core\/(math|rng)\//;
const RUNTIME = /^src\/core\/(sim|ability|bp|launch|text)\/|^src\/core\/rng\.ts$/;
const RULES: Rule[] = [
  { from: /^src\/core\/(math|rng)\//, allow: [MATH, DEMO] },
  { from: /^src\/core\/(sim|ability|bp|text)\//, allow: [MATH, RUNTIME, DEMO, /^src\/core\/sys\/index\.ts$/] },
  { from: /^src\/core\/api\//, allow: [/^src\/core\//, DEMO] },
  { from: /^src\/content\/bp\//, allow: [/^src\/core\/(sim|ability|bp|math|rng)\//, DEMO, /^src\/content\/bp\//] },
  // src/ui receives plain view models: never the core internals (the existing HUD uses core/rng.ts and core/launch curves).
  { from: /^src\/ui\//, allow: [/./], deny: [/^src\/core\/(sim|ability|bp|sys|math|text|api)\//, /^src\/content\/bp\//] },
  { from: /^src\/(game|debug|audio)\//, allow: [/./], deny: [/^src\/core\/(sim|ability|bp|sys|math|text)\//, /^src\/content\/bp\/(?!index\.ts$)/] },
];

function check(file: string, target: string, typeOnly: boolean): string | null {
  if (typeOnly && CONTRACT_TYPES.test(target)) return null;
  if (file === 'src/core/sys/index.ts') return null; // the system table imports every module
  if (/^src\/core\/sys\//.test(file)) {
    const own = file.match(/^src\/core\/sys\/([^/]+)\//)?.[1];
    if (/^src\/core\/sys\//.test(target)) {
      const other = target.match(/^src\/core\/sys\/([^/]+)\//)?.[1];
      return other === own ? null : `${file} imports another system's file ${target} (use the facade)`;
    }
    if ([MATH, RUNTIME, DEMO].some(r => r.test(target))) return null;
    return `${file} may not import ${target}`;
  }
  const rule = RULES.find(r => r.from.test(file));
  if (!rule) return null;
  if (rule.deny?.some(r => r.test(target))) return `${file} may not import ${target}`;
  return rule.allow.some(r => r.test(target)) ? null : `${file} may not import ${target}`;
}

describe('layering (ARCHITECTURE §3.3)', () => {
  it('finds the sources', () => {
    expect(Object.keys(sources).some(f => f.endsWith('/core/api/types.ts'))).toBe(true);
  });

  it('every import follows the layer rules', () => {
    const errors: string[] = [];
    for (const [path, raw] of Object.entries(sources)) {
      const file = rel(path);
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of code.matchAll(/^\s*(import|export)\s+(type\s+)?[^'";]*?\bfrom\s+['"]([^'"]+)['"]/gm)) {
        const spec = m[3];
        if (!spec.startsWith('.')) continue;
        const target = resolve(file, spec).replace(/(\.ts)?$/, '.ts');
        const e = check(file, target, Boolean(m[2]));
        if (e) errors.push(e);
      }
    }
    expect(errors).toEqual([]);
  });

  it('the core never imports src/content/bp', () => {
    for (const [path, raw] of Object.entries(sources)) {
      if (!rel(path).startsWith('src/core/')) continue;
      expect(/from\s+['"][^'"]*content\/bp\//.test(raw), rel(path)).toBe(false);
    }
  });
});

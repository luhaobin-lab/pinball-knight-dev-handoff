/**
 * The facade generator over all 19 Demo system classes and the widget function facades (WAVE_A A01 acceptance, R3). The pseudo-code is re-parsed
 * here with an independent reader, so a line the generator's parser skips or misreads fails a test:
 * - every `function` exists exactly once in its class (or library facade) and, for W2 modules, exactly once in its
 *   module's interface in systems.ts and in no other module;
 * - signatures: the world context first for library functions, inputs in pseudo order, `out` parameters returned as one
 *   object (plus `ReturnValue`), `[return]` as the return type;
 * - at run time every method delegates to its module with `self` / `ctx` first and passes the result through (present
 *   and engine are no-ops, dead ones call `world.unported`);
 * - every plain variable (Bool, numbers, Str, Name, Text, Vector, 科学数, RandomStream, TimerHandle) carries its pseudo `var` default, inherited CDO
 *   overrides included, and agrees with the content-bpkit class manifest.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import fnModules from '../../tools/gen/fn-modules.json';
import names from '../../tools/gen/names.json';
import { buildModel, CLASSES, mangle, WIDGETS } from '../../tools/gen/facade.mjs';
import { DEFAULT_DUMP, dumpExists } from '../../tools/data/dump.mjs';
import { MODULE_NAMES, type Systems } from '../../src/core/bp/systems.ts';
import type { BpObject } from '../../src/core/sim/object.ts';
import { demoClasses } from '../../src/content/demo/classes.ts';
import { blankDef, stubWorld } from '../fixtures/stub-world.ts';

const FN = fnModules as { files: Record<string, string>; modules: Record<string, Record<string, string>> };
const NAMES = names as Record<string, Record<string, string>>;
const join = (...parts: string[]): string => parts.join('/').replace(/\\/g, '/');
const dirname = (p: string): string => p.slice(0, p.lastIndexOf('/'));
const PSEUDO = join(DEFAULT_DUMP, 'blueprints-pseudo', 'CatapultHero');
const HAS_DUMP = dumpExists();
const SOURCES = import.meta.glob<string>(['../../src/core/**/*.ts'], { query: '?raw', import: 'default', eager: true });
const EXPORTS = import.meta.glob<Record<string, unknown>>(['../../src/core/sim/*.ts', '../../src/core/ability/*.ts', '../../src/core/bp/index.ts', '../../src/core/bp/widgets.ts'], { eager: true });
const W2 = new Set<string>(MODULE_NAMES);
/** The 19 system classes plus the widget function facades. */
const ALL = [...CLASSES, ...WIDGETS];

// ---------------------------------------------------------------------------------------------------------------------
// An independent pseudo reader

interface PParam { name: string; type: string; out: boolean; ret: boolean; ref: boolean; written: boolean }
interface PFn { name: string; params: PParam[] }
interface PVar { name: string; type: string; raw: string }

/** Splits at top-level `sep` (outside <>, [], {}, ()). */
function splitTop(s: string, sep = ','): string[] {
  const out: string[] = [];
  let depth = 0; let cur = '';
  for (const ch of s) {
    if ('<[{('.includes(ch)) depth++;
    if ('>]})'.includes(ch)) depth--;
    if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function reparse(cls: string): { fns: PFn[]; vars: PVar[]; overrides: Map<string, string> } {
  const text = readFileSync(join(PSEUDO, `${FN.files[cls]}.txt`), 'utf8');
  const fns: PFn[] = []; const vars: PVar[] = []; const overrides = new Map<string, string>();
  let inOverrides = false; let current: PFn | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (current) {
      if (line === '    }') { current = null; continue; }
      const w = /^ {8}(\S+) = /.exec(line);
      const p = w ? current.params.find(x => x.ref && x.name === w[1]) : undefined;
      if (p) p.written = true;
      continue;
    }
    if (line.startsWith('    // CDO overrides of inherited properties')) { inOverrides = true; continue; }
    if (inOverrides) {
      const m = /^ {4}\/\/ {3}(\S.*?) = (.*)$/.exec(line);
      if (m) { overrides.set(m[1], m[2]); continue; }
      inOverrides = false;
    }
    if (line.startsWith('    var ')) {
      const rest = line.slice(8);
      const eq = rest.indexOf(' = ');
      const decl = rest.slice(0, eq);
      const colon = decl.lastIndexOf(': ', decl.indexOf('<') < 0 ? decl.length : decl.indexOf('<'));
      vars.push({ name: decl.slice(0, colon), type: decl.slice(colon + 2), raw: rest.slice(eq + 3) });
      continue;
    }
    if (!line.startsWith('    function ')) continue;
    const body = line.slice(13).replace(/\s*\{\s*$/, '').replace(/\s*\/\/ overrides .*$/, '');
    if (!body.endsWith(')')) throw new Error(`${cls}: unreadable function line ${line}`);
    const open = body.lastIndexOf('(');
    const name = body.slice(0, open);
    if (name.startsWith('ExecuteUbergraph_')) { current = { name, params: [] }; continue; }
    const params = splitTop(body.slice(open + 1, -1)).map(p => {
      let s = p; const flags: string[] = [];
      for (let m = /^(.*) \[(out|ref|return)\]$/.exec(s); m; m = /^(.*) \[(out|ref|return)\]$/.exec(s)) { flags.push(m[2]); s = m[1]; }
      const c = s.indexOf(':');
      return { name: s.slice(0, c).trim(), type: s.slice(c + 1).trim(), out: flags.includes('out'), ret: flags.includes('return'), ref: flags.includes('ref'), written: false };
    });
    current = { name, params };
    fns.push(current);
  }
  // A widget facade declares only the functions other modules call (fn-modules.json).
  if (WIDGETS.some(w => w.name === cls)) return { fns: fns.filter(f => FN.modules[cls][f.name]), vars: [], overrides };
  return { fns, vars, overrides };
}

const tsFn = (cls: string, fn: string): string => NAMES[cls]?.[`fn:${fn}`] ?? mangle(fn);
const tsVar = (cls: string, v: string): string => NAMES[cls]?.[`var:${v}`] ?? mangle(v);
const inputs = (f: PFn): PParam[] => f.params.filter(p => !p.out && !p.ret && p.name !== '__WorldContext');
/** Outs as returned: [ref] scalars the body assigns come first (in-out), then the [out] parameters. */
const outs = (f: PFn): PParam[] => [
  ...f.params.filter(p => p.ref && p.written && /^(Bool|Int|Int64|Byte|Float|Double|Str|Name|Text)$|^Byte</.test(p.type)),
  ...f.params.filter(p => p.out),
];
/** A generated parameter name matches its Demo name up to the dedupe suffix (`_2`) and the unused prefix (`_`). */
const sameParam = (generated: string, demo: string): boolean => {
  const g = generated.replace(/^_(?=.)/, '');
  const d = mangle(demo);
  return g === d || generated === d || g.startsWith(`${d}_`) || generated.startsWith(`${d}_`);
};

// ---------------------------------------------------------------------------------------------------------------------
// Generated sources

interface Sig { name: string; params: string[]; ret: string }

/** Method signatures of one class body (`  [override ]name(params): R {`) or library facade (`  name(ctx…): R {`). */
function signatures(body: string): Sig[] {
  const out: Sig[] = [];
  for (const line of body.split('\n')) {
    const m = /^ {2}(?:override )?([^\s(:]+)\((.*)$/.exec(line);
    if (!m) continue;
    let depth = 1; let i = 0;
    for (; i < m[2].length && depth; i++) { if (m[2][i] === '(') depth++; if (m[2][i] === ')') depth--; }
    const params = splitTop(m[2].slice(0, i - 1)).map(p => p.slice(0, p.indexOf(':')).trim());
    const ret = m[2].slice(i).replace(/^: /, '').replace(/ \{$/, '');
    out.push({ name: m[1], params, ret });
  }
  return out;
}

function bodyOf(cls: string): string {
  const meta = ALL.find(c => c.name === cls);
  if (!meta) throw new Error(cls);
  const text = SOURCES[`../../${meta.file}`];
  const head = meta.library ? `export const ${cls} = {` : `export class ${cls} extends `;
  const start = text.indexOf(head);
  expect(start, `${cls} in ${meta.file}`).toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf(meta.library ? '\n};' : '\n}\n', start));
}

/** systems.ts: module → class → signatures. */
function systemsTable(): Map<string, Map<string, Sig[]>> {
  const text = SOURCES['../../src/core/bp/systems.ts'];
  const table = new Map<string, Map<string, Sig[]>>();
  for (const m of MODULE_NAMES) {
    const iface = `export interface ${m[0].toUpperCase()}${m.slice(1)}Fns {`;
    const start = text.indexOf(iface);
    const block = text.slice(start + iface.length, text.indexOf('\n}', start));
    const classes = new Map<string, Sig[]>();
    for (const part of block.split('\n  readonly ').slice(1)) {
      const cls = part.slice(0, part.indexOf('?: {'));
      const sigs = signatures(part.split('\n').slice(1).map(l => l.replace(/^ {4}([^\s(]+)\?\(/, '  $1(').replace(/;$/, ' {')).join('\n'));
      classes.set(cls, sigs);
    }
    table.set(m, classes);
  }
  return table;
}

const PARSED = HAS_DUMP ? new Map(ALL.map(c => [c.name, reparse(c.name)])) : new Map<string, ReturnType<typeof reparse>>();

// ---------------------------------------------------------------------------------------------------------------------

describe.skipIf(!HAS_DUMP)('facade generator over the 19 system classes and the widget facades (WAVE_A A01, R3)', () => {
  it('the independent reader finds the 719 functions the generator places', () => {
    let n = 0;
    for (const c of ALL) {
      const fns = PARSED.get(c.name)!.fns;
      if (!c.widget) n += fns.length;
      expect(fns.map(f => f.name).sort(), c.name).toEqual(Object.keys(FN.modules[c.name]).sort());
    }
    expect(n).toBe(719);
  });

  it('every function is declared exactly once in its class, under a collision-free name', () => {
    for (const c of ALL) {
      const pseudo = PARSED.get(c.name)!.fns.map(f => tsFn(c.name, f.name));
      expect(new Set(pseudo).size, `${c.name}: mangled names collide`).toBe(pseudo.length);
      const extra = c.name === '蓝图_动作游戏模式' ? ['openModal'] : [];
      expect(signatures(bodyOf(c.name)).map(s => s.name).sort(), c.name).toEqual([...pseudo, ...extra].sort());
    }
  });

  it('every W2 function is declared exactly once in its module interface and in no other', () => {
    const table = systemsTable();
    let declared = 0;
    for (const classes of table.values()) for (const sigs of classes.values()) declared += sigs.length;
    let expected = 0;
    for (const c of ALL) {
      for (const f of PARSED.get(c.name)!.fns) {
        const m = FN.modules[c.name][f.name];
        const name = tsFn(c.name, f.name);
        const homes = [...table].filter(([, classes]) => classes.get(c.name)?.some(s => s.name === name)).map(([mod]) => mod);
        if (W2.has(m)) {
          expected++;
          expect(homes, `${c.name}.${f.name}`).toEqual([m]);
          expect(table.get(m)!.get(c.name)!.filter(s => s.name === name), `${c.name}.${f.name}`).toHaveLength(1);
        } else {
          expect(['present', 'dead', 'engine', 'math'], `${c.name}.${f.name}: ${m}`).toContain(m);
          expect(homes, `${c.name}.${f.name} (${m}) must not be a module function`).toEqual([]);
        }
      }
    }
    expect(declared).toBe(expected);
  });

  it('signatures: context first, inputs in pseudo order, outs as one object, [return] as the type', () => {
    const table = systemsTable();
    for (const c of ALL) {
      const sigs = new Map(signatures(bodyOf(c.name)).map(s => [s.name, s]));
      for (const f of PARSED.get(c.name)!.fns) {
        const where = `${c.name}.${f.name}`;
        const sig = sigs.get(tsFn(c.name, f.name))!;
        const ins = inputs(f);
        let params = sig.params;
        if (c.library) {
          if (!c.widget) expect(f.params.some(p => p.name === '__WorldContext'), `${where}: library functions take __WorldContext`).toBe(true);
          expect(params[0], where).toMatch(/^_?ctx$/);
          params = params.slice(1);
        }
        expect(params.length, `${where}: ${params.join(', ')}`).toBe(ins.length);
        ins.forEach((p, i) => expect(sameParam(params[i], p.name), `${where}: param ${i} ${params[i]} vs ${p.name}`).toBe(true));
        const o = outs(f); const r = f.params.find(p => p.ret);
        if (o.length) {
          expect(sig.ret, where).toMatch(/^\{ .* \}$/);
          const fields = splitTop(sig.ret.slice(2, -2), ';').map(x => x.slice(0, x.indexOf(':')).trim());
          expect(fields.length, `${where}: ${sig.ret}`).toBe(o.length + (r ? 1 : 0));
          o.forEach((p, i) => expect(sameParam(fields[i], p.name), `${where}: out ${fields[i]} vs ${p.name}`).toBe(true));
          if (r) expect(fields.at(-1), where).toBe('ReturnValue');
        } else if (r) {
          expect(sig.ret, where).not.toBe('void');
        } else {
          expect(sig.ret, where).toBe('void');
        }
        const m = FN.modules[c.name][f.name];
        if (!W2.has(m)) continue;
        const s = table.get(m)!.get(c.name)!.find(x => x.name === sig.name)!;
        expect(s.params[0], where).toBe(c.library ? 'ctx' : 'self');
        expect(s.params.slice(1).map(p => p.replace(/^_/, '')), where).toEqual(params.map(p => p.replace(/^_/, '')));
        expect(s.ret, where).toBe(sig.ret);
      }
    }
  });

  it('every method delegates to its module with self / ctx first (present and engine are no-ops, dead ones are unported)', () => {
    const calls: { m: string; c: string; f: string; args: unknown[] }[] = [];
    const RESULT = { delegated: true };
    const proxy = (fn: (key: string) => unknown) => new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? fn(k) : undefined) });
    const systems = proxy(m => proxy(c => proxy(f => (...args: unknown[]) => { calls.push({ m, c, f, args }); return RESULT; }))) as Systems;
    const w = stubWorld({ systems });
    const ctx = new (exportOf('BP_ManeActor') as new (...a: unknown[]) => BpObject)(w, blankDef());
    let checked = 0;
    for (const c of ALL) {
      const target = c.library ? (exportOf(c.name) as Record<string, (...a: unknown[]) => unknown>)
        : new (exportOf(c.name) as new (...a: unknown[]) => Record<string, (...a: unknown[]) => unknown>)(w, blankDef());
      for (const f of PARSED.get(c.name)!.fns) {
        const m = FN.modules[c.name][f.name];
        if (m === 'math') continue; // real math (src/core/math), tested by core-math
        const name = tsFn(c.name, f.name);
        const where = `${c.name}.${f.name}`;
        const args = inputs(f).map((_, i) => `arg${i}`);
        calls.length = 0; w.unportedCalls.length = 0;
        const result = c.library ? target[name](ctx, ...args) : target[name](...args);
        if (W2.has(m)) {
          expect(calls, where).toEqual([{ m, c: c.name, f: name, args: [c.library ? ctx : target, ...args] }]);
          expect(result, where).toBe(RESULT);
        } else {
          expect(calls, where).toEqual([]);
          expect(w.unportedCalls, where).toEqual(m === 'dead' ? [`${c.name}.${name}`] : []);
        }
        checked++;
      }
    }
    expect(checked).toBe(708); // 719 minus the 19 函数库_科学数 functions (real math), plus 8 widget functions
  });

  it('every plain variable carries its pseudo default (inherited CDO overrides included) and agrees with the class manifest', () => {
    const w = stubWorld();
    const SKIP = /^(UberGraphFrame|K2Node_.*|Temp_.*)$|[0-9A-F]{32}$/;
    let checked = 0; let manifestChecked = 0;
    const declared = new Map<string, { cls: string; type: string }>();
    for (const c of CLASSES.filter(x => !x.library)) {
      const parsed = PARSED.get(c.name)!;
      const o = new (exportOf(c.name) as new (...a: unknown[]) => Record<string, unknown>)(w, blankDef()) as Record<string, unknown>;
      const manifest = demoClasses[`CatapultHero/${FN.files[c.name]}`]?.vars ?? {};
      const own = parsed.vars.filter(v => !SKIP.test(v.name)).map(v => ({ ...v, inherited: false }));
      const inherited = [...parsed.overrides].filter(([n]) => declared.has(n)).map(([n, raw]) => ({ name: n, type: declared.get(n)!.type, raw, inherited: true }));
      for (const v of [...own, ...inherited]) {
        const exp = expected(v.type, v.raw);
        if (exp === UNCHECKED) continue;
        const key = tsVar(v.inherited ? declared.get(v.name)!.cls : c.name, v.name);
        expect(o[key], `${c.name}.${v.name} = ${v.raw}`).toEqual(exp);
        checked++;
        if (!v.inherited && key in manifest && (typeof manifest[key] !== 'object')) {
          expect(o[key], `${c.name}.${v.name} vs classes.ts`).toEqual(manifest[key]);
          manifestChecked++;
        }
      }
      for (const v of own) declared.set(v.name, { cls: c.name, type: v.type });
    }
    expect(checked).toBeGreaterThanOrEqual(390);
    expect(manifestChecked).toBeGreaterThanOrEqual(330);
  });

  it('a name collision inside a class fails the generator (D11)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'facade-'));
    try {
      for (const c of ALL) {
        const to = join(dir, `${FN.files[c.name]}.txt`);
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(join(PSEUDO, `${FN.files[c.name]}.txt`), to);
      }
      const file = join(dir, `${FN.files.BP_Actor_Other}.txt`);
      const text = readFileSync(file, 'utf8').replace(/^( {4}var .*)$/m, '$1\n    var 弹性处理: Bool = <zero>');
      writeFileSync(file, text);
      expect(() => buildModel(dir)).toThrow(/BP_Actor_Other: var "弹性处理" collides with BP_ManeActor\.弹性处理/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('D11 mangling', () => {
  it('drops trailing symbols and replaces inner ones', () => {
    expect(mangle('是敌人？')).toBe('是敌人');
    expect(mangle('特性/天赋？')).toBe('特性_天赋');
    expect(mangle('添加装备掉落(旧)')).toBe('添加装备掉落_旧');
    expect(mangle('科学数乘除*/')).toBe('科学数乘除');
    expect(mangle('1号')).toBe('_1号');
  });
});

const UNCHECKED = Symbol('unchecked');

/** The runtime value of a plain pseudo default, or UNCHECKED for the types this test leaves to the struct tests. */
function expected(type: string, raw: string): unknown {
  if (!/^(Bool|Int|Int64|Float|Double|Str|Name|Text|Struct<(Vector|结构_科学数|RandomStream|TimerHandle)>)$/.test(type)) return UNCHECKED;
  const zero = raw === '<zero>';
  const v: unknown = zero ? null : JSON.parse(raw);
  switch (type) {
    case 'Bool': return zero ? false : v;
    case 'Int': case 'Int64': case 'Float': case 'Double': return zero ? 0 : v;
    case 'Str': return zero ? '' : v;
    case 'Name': return zero ? 'None' : v;
    case 'Text': {
      const t = (v ?? {}) as { invariant?: string; text?: string; en?: string };
      const s = t.invariant ?? t.text ?? '';
      return { zh: s, en: t.en ?? s };
    }
    case 'Struct<Vector>': { const p = (v ?? { X: 0, Y: 0, Z: 0 }) as { X: number; Y: number; Z: number }; return { x: p.X, y: p.Y, z: p.Z }; }
    case 'Struct<结构_科学数>': return v ?? { 系数: 0, 指数: 0 };
    case 'Struct<RandomStream>': return v ?? { InitialSeed: 0, Seed: 0 };
    case 'Struct<TimerHandle>': return ''; // the latent service's timer name
    default: return UNCHECKED;
  }
}

function exportOf(name: string): unknown {
  const meta = ALL.find(c => c.name === name)!;
  return EXPORTS[`../../${meta.file}`][name];
}

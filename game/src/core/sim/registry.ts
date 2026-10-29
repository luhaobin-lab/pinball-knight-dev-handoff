/**
 * Class lookup with stub fallback (ARCHITECTURE §4.12, §7.3). A path resolves to its registered module; a class with
 * no module becomes a runtime stub built from its manifest entry: it extends the nearest registered ancestor (the
 * parent's behaviour), carries the manifest tags (through `def`) and gets its own manifest variables as fields.
 * Stubs are counted in coverage; strict mode refuses them.
 */

export interface ResolvableDef {
  readonly path: string;
  readonly parent: string | null;
  readonly vars: Readonly<Record<string, unknown>>;
}

export type AnyCtor = (abstract new (...args: any[]) => unknown) & { readonly path: string };

export interface Resolved<C extends AnyCtor> {
  readonly ctor: C;
  readonly stub: boolean;
}

export interface ResolverDeps<C extends AnyCtor, D extends ResolvableDef> {
  get(path: string): C | undefined;
  def(path: string): D | undefined;
  /** The class a stub extends when no ancestor in the manifest is registered (by the def's kind). */
  fallback(def: D): C;
}

/** Deep copy of a manifest default so instances never share arrays or maps (CDO values are copied per instance). */
export function cloneDefault<T>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(cloneDefault) as T;
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, cloneDefault(x)])) as T;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = cloneDefault(x);
  return out as T;
}

export class ClassResolver<C extends AnyCtor, D extends ResolvableDef> {
  private readonly stubs = new Map<string, C>();

  private readonly deps: ResolverDeps<C, D>;

  constructor(deps: ResolverDeps<C, D>) {
    this.deps = deps;
  }

  isRegistered(path: string): boolean {
    return this.deps.get(path) !== undefined;
  }

  resolve(path: string): Resolved<C> | undefined {
    const real = this.deps.get(path);
    if (real) return { ctor: real, stub: false };
    const cached = this.stubs.get(path);
    if (cached) return { ctor: cached, stub: true };
    const def = this.deps.def(path);
    if (!def) return undefined;
    const base = def.parent ? (this.resolve(def.parent)?.ctor ?? this.deps.fallback(def)) : this.deps.fallback(def);
    const stub = makeStub(base, def);
    this.stubs.set(path, stub);
    return { ctor: stub, stub: true };
  }
}

function makeStub<C extends AnyCtor>(base: C, def: ResolvableDef): C {
  const Base = base as unknown as new (...args: unknown[]) => object;
  class Stub extends Base {
    static readonly path = def.path;
    constructor(...args: unknown[]) {
      super(...args);
      for (const [k, v] of Object.entries(def.vars)) (this as Record<string, unknown>)[k] = cloneDefault(v);
    }
  }
  Object.defineProperty(Stub, 'name', { value: `Stub(${def.path.slice(def.path.lastIndexOf('/') + 1)})` });
  return Stub as unknown as C;
}

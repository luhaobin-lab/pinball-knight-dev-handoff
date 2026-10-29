/**
 * Coverage counters (ARCHITECTURE §4.12, §10.3): which classes were spawned, which of them ran as manifest stubs, and
 * which facade functions or latent data were unported, with hit counts. The bot's report and wave B's `bp-fix`
 * input list are built from `report()`.
 */

export interface CoverageCounts {
  readonly classes: Readonly<Record<string, number>>;
  readonly stubs: Readonly<Record<string, number>>;
  readonly unported: Readonly<Record<string, number>>;
}

function bump(m: Map<string, number>, k: string): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

function sorted(m: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of [...m.keys()].sort()) out[k] = m.get(k)!;
  return out;
}

export class CoverageCounters {
  private readonly classMap = new Map<string, number>();
  private readonly stubMap = new Map<string, number>();
  private readonly unportedMap = new Map<string, number>();

  classHit(path: string): void { bump(this.classMap, path); }
  stubHit(path: string): void { bump(this.stubMap, path); }
  unportedHit(what: string): void { bump(this.unportedMap, what); }

  count(kind: keyof CoverageCounts, key: string): number {
    const m = kind === 'classes' ? this.classMap : kind === 'stubs' ? this.stubMap : this.unportedMap;
    return m.get(key) ?? 0;
  }

  /** Unported facade functions and stub classes in one map (World.coverage.counts): stubs as `stub <path>`. */
  combined(): ReadonlyMap<string, number> {
    const out = new Map(this.unportedMap);
    for (const [k, n] of this.stubMap) out.set(`stub ${k}`, n);
    return out;
  }

  report(): CoverageCounts {
    return { classes: sorted(this.classMap), stubs: sorted(this.stubMap), unported: sorted(this.unportedMap) };
  }
}

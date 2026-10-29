/**
 * `withSystems({ … })`: module doubles over the real system table (ARCHITECTURE §7.5). Each override replaces single
 * Demo functions per class; everything else stays the real module, so a test doubles only what it isolates.
 *
 *   createWorld({ content: registry, systems: withSystems({ damage: { BP_ManeActor: { 造成即时伤害: () => {} } } }) })
 */
import type { ModuleName, Systems } from '../../src/core/bp/systems.ts';
import { createSystems } from '../../src/core/sys/index.ts';

/** Per module, per class (or library), the Demo functions to replace. */
export type SystemOverrides = { [M in ModuleName]?: { [K in keyof Systems[M]]?: Partial<NonNullable<Systems[M][K]>> } };

type AnyTable = Record<string, unknown>;

/** The real modules with `o` merged in one level below each module (class / library tables) and at module level. */
export function withSystems(o: SystemOverrides = {}): Systems {
  const real = createSystems() as unknown as Record<string, AnyTable>;
  const out: Record<string, AnyTable> = { ...real };
  for (const [m, over] of Object.entries(o as Record<string, AnyTable | undefined>)) {
    if (!over) continue;
    const base = { ...(real[m] ?? {}) };
    for (const [k, v] of Object.entries(over)) {
      const cur = base[k];
      base[k] = cur && typeof cur === 'object' && v && typeof v === 'object' && !Array.isArray(v) ? { ...(cur as AnyTable), ...(v as AnyTable) } : v;
    }
    out[m] = base;
  }
  return out as unknown as Systems;
}

/** A no-op for any Demo function (`() => undefined`), for doubles that only need the call to succeed. */
export const noop = (): undefined => undefined;

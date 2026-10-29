/** Test classes and builders for the core-ability vectors (ability-framework §18). */
import { registry } from '../../src/content/bp/index.ts';
import type { BpCtor, ContentRegistry, DemoData } from '../../src/core/sim/types.ts';
import { demoData } from '../../src/core/sim/runtime.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { structOf } from '../../src/core/bp/structs.ts';
import type { 结构_技能, 结构_效果 } from '../../src/content/demo/types.ts';
import { makeRand15, randRangeOf, rand15, type Rand15 } from '../../src/core/rng/ue.ts';
import { combatFixture, type CombatFixtureOptions } from '../fixtures/index.ts';

/** The content registry plus test classes. */
export function contentWith(...classes: BpCtor[]): ContentRegistry {
  const m = new Map<string, BpCtor>(classes.map(c => [c.path, c]));
  return {
    get: p => m.get(p) ?? registry.get(p),
    get size() { return registry.size + m.size; },
    paths: () => [...registry.paths(), ...m.keys()],
  };
}

/** A record of hook calls shared by the test classes. */
export const calls: string[] = [];

/** An effect class with the given CDO tags that records its hooks; `onFire` runs inside 持续中触发. */
export function listener(name: string, tags: readonly string[], onFire?: (e: 蓝图_效果, tag: string) => void): BpCtor<蓝图_效果> {
  const C = class extends 蓝图_效果 {
    static override readonly path = `Test/${name}`;
    override ReceiveBeginPlay(): void {
      super.ReceiveBeginPlay();
      for (const t of tags) this.OwnedGameplayTags.add(t);
    }
    override 激活后触发(Debug: string): void { calls.push(`${name}.激活后触发(${Debug})`); }
    override 持续中触发(t: string): void {
      calls.push(`${name}.持续中触发(${t})`);
      onFire?.(this, t);
    }
    override 额外子触发(_x: unknown, n: number): void { calls.push(`${name}.额外子触发(${n})`); }
  };
  Object.defineProperty(C, 'name', { value: name });
  return C as unknown as BpCtor<蓝图_效果>;
}

/** A test active skill: 执行技能 records and ends the cast normally. */
export class 测试能力 extends 蓝图_能力 {
  static override readonly path = 'Test/测试能力';
  override 执行技能(是读档: boolean): void {
    calls.push(`执行技能(${是读档})`);
    this.释放结束(false);
  }
}

/** A 结构_技能 row: the struct default with overrides (能力 merged one level). */
export function skillRow(p: Partial<Omit<结构_技能, '能力'>> & { 能力?: Partial<结构_技能['能力']> } = {}): 结构_技能 {
  const d = structOf('结构_技能');
  return { ...d, ...p, 能力: { ...d.能力, ...(p.能力 ?? {}) } } as 结构_技能;
}

/** A 结构_效果 config (data shape). */
export function effectRow(p: Partial<结构_效果> = {}): 结构_效果 {
  return { ...structOf('结构_效果'), ...p };
}

/** Spawn an ability on `owner` as 添加技能 does (without routing) and initialise it. */
export function addSkill<T extends 蓝图_能力>(owner: BP_ManeActor, cls: BpCtor<T>, row: 结构_技能, o: { 唯一ID?: string; 能力名?: string; 等级?: number; active?: boolean } = {}): T {
  const w = owner.world;
  const a = w.spawn<T>(cls, x => {
    x.唯一ID = o.唯一ID ?? `${owner.唯一ID}//测试表//${o.能力名 ?? 'X'}`;
    x.能力名 = o.能力名 ?? 'X';
    x.拥有者 = owner;
    x.等级 = o.等级 ?? 1;
    x.种子 = owner.种子;
  });
  a.技能配置 = row;
  a.初始化();
  a.子初始化();
  a.K2_AttachToActor(owner);
  if (o.active ?? true) owner.拥有的主动能力.push(a);
  return a;
}

/** A Rand15 state whose next RandomIntegerInRange(0, 100) is `u`. */
export function stateForRoll(u: number, from = 1): number {
  for (let s = from; s < from + 5_000_000; s++) {
    const g = makeRand15(s);
    if (randRangeOf(rand15(g), 0, 100) === u) return s;
  }
  throw new Error(`no state for ${u}`);
}

/** How many rand15 draws took `before` to `after` (≤ 64). */
export function drawsBetween(before: number, after: Rand15): number {
  const g = makeRand15(before);
  for (let n = 0; n <= 64; n++) {
    if (g.state === after.state) return n;
    rand15(g);
  }
  return -1;
}

/** A fixture with the test classes registered; no enemies unless asked. */
export function fixture(o: CombatFixtureOptions & { classes?: BpCtor[] } = {}) {
  calls.length = 0;
  return combatFixture({ hero: '幽冥骑士', seed: 1, ...o, content: contentWith(测试能力, ...(o.classes ?? [])) });
}

/** demoData with extra tables (asset path → rows). */
export function dataWith(tables: Record<string, Record<string, unknown>>): DemoData {
  const base = demoData();
  return {
    ...base,
    table: asset => (Object.hasOwn(tables, asset) ? ({ asset, rows: tables[asset] } as never) : base.table(asset)),
  };
}

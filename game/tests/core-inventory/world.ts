/**
 * A minimal local World for core-inventory's tests (WAVE_A §1.4: a local double until wa/sim and wa/ability).
 * Deferred spawn with CDO defaults from the generated classes, IsValid / destroy, the real system table with optional
 * overrides, a recording Fx, Delay running at once, the RNG domains of core-math.
 */
import { demoClasses } from '../../src/content/demo/classes.ts';
import { demoTablesByAsset } from '../../src/content/demo/registry.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { createRngDomains } from '../../src/core/rng/domains.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { 修炼系统 } from '../../src/core/sim/cult.ts';
import { 蓝图_动作游戏模式 } from '../../src/core/sim/mode.ts';
import { BpObject, type Fx } from '../../src/core/sim/object.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import type { BpCtor, ClassDef, TextRef } from '../../src/core/sim/types.ts';
import type { World } from '../../src/core/sim/world.ts';
import { createSystems } from '../../src/core/sys/index.ts';
import { findRow } from '../../src/content/demo/index.ts';
import type { 结构_角色 } from '../../src/content/demo/types.ts';

export interface InvWorld extends World {
  readonly unportedCalls: string[];
  readonly headUps: { id: number; text: TextRef }[];
  readonly sounds: (string | null)[];
}

export function invWorld(overrides: Partial<Systems> = {}, registered: readonly BpCtor[] = []): InvWorld {
  const classes = new Map<string, BpCtor>(registered.map(c => [c.path, c]));
  let id = 0;
  const unportedCalls: string[] = [];
  const headUps: { id: number; text: TextRef }[] = [];
  const sounds: (string | null)[] = [];
  const noop = () => {};
  const fxFor = (o: BpObject): Fx => ({
    vfx: noop, sound: a => { sounds.push(a); }, shake: noop, flipbook: noop, flash: noop, headUp: (_on, t) => { headUps.push({ id: o.id, text: t }); },
    popup: noop, log: noop, ui: noop, bgm: noop,
  });
  const defOf = (path: string): ClassDef => (demoClasses[path] as unknown as ClassDef | undefined)
    ?? { path, name: path.split('/').pop()!, parent: null, kind: 'other', tags: [], vars: {}, timelines: {}, components: {}, rows: [], reachable: true };
  const w = {
    unportedCalls, headUps, sounds,
    sys: createSystems(overrides),
    strict: false,
    filter: 'all',
    rng: createRngDomains(1),
    nextId: () => ++id,
    bus: { fxFor, emit: noop, drain: () => [] },
    latent: {
      delay: (_o: BpObject, _n: string, _s: number, then: () => void) => then(), retriggerableDelay: noop, nextTick: noop, setTimer: noop,
      clearTimer: noop, isTimerActive: () => false, timeline: noop, playAnim: noop, setTickEnabled: noop,
    },
    unported: (what: string) => { unportedCalls.push(what); },
    isValid: (o: unknown) => o instanceof BpObject && o.valid,
    destroy: (o: BpObject) => { o.valid = false; },
    isPorted: () => false,
    isRowPorted: () => false,
    data: { table: (asset: string) => demoTablesByAsset[asset], classes: demoClasses, anims: {}, tags: [] },
    modal: { current: null, open: noop, answer: () => false, close: noop },
    spawn<T extends BpObject>(cls: BpCtor<T> | string, init?: (o: T) => void, at?: { x: number; y: number; z: number }): T {
      // A class path spawns its registered class, else a stub of the base effect class (the manifest's tags and vars).
      const C = (typeof cls === 'string' ? classes.get(cls) ?? 蓝图_效果 : cls) as unknown as new (w: World, d: ClassDef) => T;
      const o = new C(w as unknown as World, defOf(typeof cls === 'string' ? cls : cls.path));
      if (at) o.location = { ...at };
      init?.(o);
      o.ReceiveBeginPlay();
      return o;
    },
  } as Record<string, unknown>;
  const world = w as unknown as InvWorld;
  // The engine objects exist before any BeginPlay (core-sim constructs them; the boot is not under test here).
  w.mode = new (蓝图_动作游戏模式 as unknown as new (w: World, d: ClassDef) => 蓝图_动作游戏模式)(world, defOf(蓝图_动作游戏模式.path));
  w.cult = new (修炼系统 as unknown as new (w: World, d: ClassDef) => 修炼系统)(world, defOf(修炼系统.path));
  world.mode.修炼系统 = world.cult;
  world.cult.激活修炼系统();
  return world;
}

/**
 * A card without the kernel (no abilities): the row, 品质, the tags of the row on OwnedGameplayTags, 尺寸 from the tags
 * and 词条 from the row, then 升级此牌 (growth + price), unpicked and revealed.
 */
export function makeCard(w: World, name: string, 品质 = 1): BP_Actor_Card {
  const table = demoTablesByAsset['CatapultHero/数据表/合成数据表_修炼物品']!;
  const row = findRow(table as never, name) as 结构_角色;
  const c = w.spawn(BP_Actor_Card as unknown as BpCtor<BP_Actor_Card>, o => { o.角色配置 = row; o.名字 = name; o.品质 = 品质; o.已揭示 = true; });
  for (const t of row.标签) c.OwnedGameplayTags.add(t);
  c.尺寸 = row.标签.includes('可交互.修炼牌.小型') ? 1 : row.标签.includes('可交互.修炼牌.中型') ? 2 : 3;
  c.词条 = new Map(Object.entries(row.科学词条).map(([k, v]) => [k, { 计算类型: v.计算类型, 来源映射: new Map(Object.entries(v.来源映射).map(([s, x]) => [s, { 系数: x.系数, 指数: x.指数 }])) }]));
  w.cult.未拾取牌.push(c);
  c.升级此牌(true, false);
  return c;
}

/** Column contents, cell 0 first: the first character of each cell's card name, "." when empty. */
export function layout(w: World, grid: 'equip' | 'backpack'): string {
  const g = grid === 'equip' ? w.cult.修炼物品格_已装备! : w.cult.修炼物品格_在背包!;
  return g.格子实例数组.map(c => ((c as unknown as { 拥有的物品: BP_Actor_Card | null }).拥有的物品?.名字 ?? '.')[0]).join('');
}

/** A bare card (no row): a name, a size and tags; for placement tests. */
export function testCard(w: World, 名字: string, 尺寸: number, tags: readonly string[] = [], 品质 = 1): BP_Actor_Card {
  const c = w.spawn(BP_Actor_Card as unknown as BpCtor<BP_Actor_Card>, o => { o.名字 = 名字; o.尺寸 = 尺寸; o.品质 = 品质; o.已揭示 = true; });
  for (const t of tags) c.OwnedGameplayTags.add(t);
  return c;
}

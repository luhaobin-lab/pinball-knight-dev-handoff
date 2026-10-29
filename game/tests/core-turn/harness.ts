/**
 * The core-turn test harness: a real core-sim world (scheduler, latent nodes, settlements, modal service) with local
 * doubles for the modules that are not merged yet (WAVE_A §1.4): the effect lifecycle of core-ability (TURN-023/024),
 * the kernel math (计算除余数, 权重选取 …) and recording doubles for the facade calls the vectors observe.
 */
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { 计算除余数 } from '../../src/core/math/kismet.ts';
import { 效果配置From } from '../../src/core/bp/structs.ts';
import { 传统概率判断, 拆分权重数据表, 权重选取 } from '../../src/core/math/prob.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { createWorld, type SimWorld } from '../../src/core/sim/runtime.ts';
import type { BpCtor, ContentRegistry, Tag } from '../../src/core/sim/types.ts';
import { batches } from '../../src/content/bp/index.ts';
import { createRngDomains, type RngDomains } from '../../src/core/rng/domains.ts';
import { makeRand15, rand15, type Rand15 } from '../../src/core/rng/ue.ts';

/** A test effect: records its 持续中触发 and runs an optional hook. */
export class 测试效果 extends 蓝图_效果 {
  static override readonly path = 'Test/core-turn/测试效果';
  label = '';
  hook: ((tag: Tag) => void) | null = null;
  override 持续中触发(触发时机: Tag): void {
    calls(this.world).push(`${this.label}.持续中触发(${short(触发时机)})`);
    this.hook?.(触发时机);
  }
}

/** A test ability: records 释放开始 / 释放结束. */
export class 测试能力 extends 蓝图_能力 {
  static override readonly path = 'Test/core-turn/测试能力';
  label = '';
  onRelease: (() => void) | null = null;
  override 释放开始(): void { calls(this.world).push(`${this.label}.释放开始(吟唱=${this.吟唱.toFixed(4)})`); this.onRelease?.(); }
  override 释放结束(是打断: boolean): void { calls(this.world).push(`${this.label}.释放结束(${是打断})`); }
}

export const short = (t: Tag): string => t.replace('效果.时机.', '');

const callLogs = new WeakMap<object, string[]>();
export function calls(w: object): string[] {
  let l = callLogs.get(w);
  if (!l) callLogs.set(w, (l = []));
  return l;
}

const label = (o: { label?: string; 名字?: string; id: number }): string => o.label || o.名字 || `#${o.id}`;

/** The effect lifecycle of ability-framework as turn-flow states it (TURN-023, TURN-024): a double until wa/ability. */
export function abilityDouble(w: () => SimWorld): Partial<Systems['ability']> {
  return {
    蓝图_效果: {
      持续效果(self) {
        calls(self.world).push(`${label(self as 测试效果)}.持续效果()`);
        if (self.已销毁) return;
        if (self.持续回合 >= 0) { self.剩余回合 -= 1; self.已销毁 = Math.max(self.剩余回合, 0) === 0; }
        self.持续中触发(self.触发时机);
      },
      激活效果(self) {
        self.剩余回合 = self.持续回合 > -1 ? self.持续回合 + 1 : self.持续回合;
        self.激活后触发('');
      },
      持续中触发() {},
      激活后触发() {},
      销毁前触发() {},
      销毁后触发() {},
      销毁效果(self) {
        self.销毁前触发();
        self.已销毁 = true;
        const owner = self.拥有者;
        if (owner) { const i = owner.拥有的效果.indexOf(self); if (i >= 0) owner.拥有的效果.splice(i, 1); }
        self.销毁后触发();
        self.world.destroy(self);
      },
      ReceiveTick() {},
      ReceiveBeginPlay() {},
    },
    蓝图_能力: {
      释放开始() {}, 释放结束() {}, 子初始化() {}, 检查子条件() {}, 执行技能() {},
      // ABILIT-004 (the parts the turn machine reads): the row's 参数, 类型 and 效果
      初始化(self) {
        const row = self.技能配置;
        self.参数 = [...(row.参数 ?? [])].map(p => ({ ...p }));
        for (const t of row.类型 ?? []) self.类型.add(t);
        self.效果配置 = (row.能力?.效果 ?? []).map(效果配置From);
      },
    },
    BP_ManeActor: {
      打断技能(self, 结束行动) {
        calls(self.world).push(`${label(self)}.打断技能(${结束行动})`);
        if (结束行动) self.结束行动(null, '');
        if (self.world.isValid(self.当前能力)) self.当前能力.释放结束(true);
      },
    },
    函数库_工具: {
      清理已销毁效果(ctx, arr) {
        const owner = w().objects().find(x => (x as BP_ManeActor).拥有的效果 === arr) as BP_ManeActor | undefined;
        calls(ctx.world).push(`清理已销毁效果(${owner ? label(owner) : '?'})`);
        for (const e of [...arr]) if (e && w().isValid(e) && e.已销毁) e.销毁效果();
      },
      有对应标签效果(_ctx, arr, tag) { return { 存在: arr.some(e => e != null && w().isValid(e) && e.HasMatchingGameplayTag(tag)) }; },
      附加效果前处理() { return { 不需附加新效果: false, 效果实例: null }; },
      存在同类效果(_ctx, arr, cls) { const e = arr.find(x => x != null && w().isValid(x) && x.def.path === cls) ?? null; return { 存在相同被动: e !== null, 存在的效果: e }; },
      使目标执行自身技能(ctx, i, target) {
        calls(ctx.world).push(`使目标执行自身技能(${i}, ${target ? label(target) : 'None'})`);
        return { 技能实例: null, 条件通过: true, 完成释放: true };
      },
    },
    函数库_技能: {
      获取效果名(_ctx, _from, cls) { return { 效果名字: cls ?? '' }; },
      获取技能参数(_ctx, a, i) { return { 整数: false, 乘算: false, 参数值: a?.参数[i]?.初始值 ?? 0, 词条: '' }; },
    },
  };
}

export function kernelDouble(w: () => SimWorld): Partial<Systems['kernel']> {
  return {
    函数库_工具: {
      计算除余数: (_c, a, b, t) => 计算除余数(a, b, t),
      权重选取: (_c, ws, s) => ({ 选中的序号: 权重选取(ws, s as never) }),
      传统概率判断: (_c, p) => ({ 触发: 传统概率判断(p, w().rng.combat) }),
      拆分权重数据表: (_c, g) => 拆分权重数据表(g.map(x => ({ 权重: x.权重, 数据表行: x.数据表行 }))) as never,
      范围选取点: (c, _at, _a, _b, _d, n) => ({ 选到的点: Array.from({ length: n }, (_, i) => ({ x: (c.world.mode.当前房间中心.x) + 200 * (i + 1), y: 0, z: 0 })) }),
      销毁目标和子物体: (_c, o) => { if (o) w().destroy(o); },
    },
  };
}

export interface Harness {
  w: SimWorld;
  hero: BP_Actor_Player;
  calls: string[];
  effect(owner: BP_ManeActor, name: string, tags: Tag[], o?: { 持续回合?: number; hook?: (tag: Tag) => void }): 测试效果;
  enemy(name: string, o?: { 行动力?: number; 当前行动力?: number; boss?: boolean; elite?: boolean; field?: boolean; tags?: Tag[] }): BP_Actor_Other;
}

export function contentWith(...extra: BpCtor[]): ContentRegistry {
  const m = new Map<string, BpCtor>();
  for (const c of [...(batches['core-turn'] ?? []), ...extra]) m.set(c.path, c);
  return { get: p => m.get(p), get size() { return m.size; }, paths: () => [...m.keys()] };
}

/**
 * A Rand15 whose draws are scripted fractions f (k = ceil(f · 32767), so FRand(k) ≥ f by less than 1/32767), then the
 * real generator. rand15 reads, writes, then reads `state`: the write arms the next scripted k.
 */
export function scripted(fs: number[], seed = 1): Rand15 {
  const real = makeRand15(seed);
  let armed = 0;
  return {
    get state() { return armed; },
    set state(v: number) {
      const f = fs.shift();
      if (f === undefined) { real.state = v; armed = (rand15(real) << 16) >>> 0; return; }
      armed = (Math.ceil(f * 32767) << 16) >>> 0;
    },
  };
}

export function harness(o: { systems?: Partial<Systems>; seed?: number; strict?: boolean; level?: number[]; combat?: number[] } = {}): Harness {
  let world: SimWorld | null = null;
  const W = (): SimWorld => world as SimWorld;
  const base: Partial<Systems> = { ability: abilityDouble(W) as Systems['ability'], kernel: kernelDouble(W) as Systems['kernel'] };
  const systems: Partial<Systems> = { ...base, ...o.systems };
  // a module override keeps the base doubles of the classes it does not mention
  for (const k of ['ability', 'kernel'] as const) {
    if (o.systems?.[k] && o.systems[k] !== base[k]) (systems as Record<string, unknown>)[k] = { ...base[k], ...o.systems[k] };
  }
  const real = createRngDomains(o.seed ?? 1);
  const rng: RngDomains = Object.assign(Object.create(real) as RngDomains, {
    ...(o.level ? { level: scripted(o.level) } : {}),
    ...(o.combat ? { combat: scripted(o.combat) } : {}),
  });
  world = createWorld({ content: contentWith(测试效果, 测试能力), seed: o.seed ?? 1, systems, strict: o.strict ?? false, rng });
  const w = world;
  const hero = w.spawn(BP_Actor_Player, h => { h.名字 = '幽冥骑士'; h.OwnedGameplayTags.add('可交互.角色.玩家'); });
  w.mode.玩家角色 = hero;
  if (w.mode.玩家控制器) w.mode.玩家控制器.玩家角色 = hero;
  return {
    w, hero, calls: calls(w),
    effect(owner, name, tags, eo = {}) {
      const e = w.spawn(测试效果, x => { x.label = name; x.拥有者 = owner; x.持续回合 = eo.持续回合 ?? -1; });
      for (const t of tags) e.OwnedGameplayTags.add(t);
      e.hook = eo.hook ?? null;
      owner.拥有的效果.push(e);
      return e;
    },
    enemy(name, eo = {}) {
      const a = w.spawn(BP_Actor_Other, x => {
        x.名字 = name;
        x.行动力 = eo.行动力 ?? 100;
        x.当前行动力 = eo.当前行动力 ?? 0;
        x.是精英 = eo.elite ?? false;
        x.OwnedGameplayTags.add(eo.boss ? '可交互.角色.AI.仇恨.首领' : '可交互.角色.AI.仇恨');
        for (const t of eo.tags ?? []) x.OwnedGameplayTags.add(t);
      });
      if (eo.field) { w.mode.场上所有.push(a); w.mode.敌方场上.push(a); }
      return a;
    },
  };
}

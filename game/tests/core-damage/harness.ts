/**
 * Test harness of core-damage: the real world of core-sim (`createWorld`), the real `damage` module, and doubles for
 * every other module the pipeline calls through the facade (ability lifecycle, PRD, text, stats, kill hand-offs).
 * The doubles record their calls in `calls` so a test can assert arguments and order.
 */
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import type { 伤害, 效果配置 } from '../../src/core/bp/structs.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { sci, 科学数变普通, 科学数标准化, type 科学数 } from '../../src/core/math/sci.ts';
import type { 词条映射 } from '../../src/core/math/stats.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import type { BpObject } from '../../src/core/sim/object.ts';
import { createWorld, type SimWorld } from '../../src/core/sim/runtime.ts';
import type { AssetPath, ContentRegistry, HitResult, Tag, Vec3 } from '../../src/core/sim/types.ts';
import { damage } from '../../src/core/sys/damage/index.ts';
import { registry } from '../../src/content/bp/index.ts';

export type Call = { fn: string; args: unknown[] };

export interface Harness {
  w: SimWorld;
  calls: Call[];
  /** Scripted PRD results (FIFO); default: no success, counter unchanged. */
  prd: { 触发: boolean; 成功次数: number; 更新触发计数: number }[];
  /** Scripted 传统概率判断 results (FIFO); default false. */
  chance: boolean[];
  hero(stats?: Stats, hp?: number): BP_Actor_Player;
  enemy(stats?: Stats, hp?: number, tags?: Tag[]): BP_Actor_Other;
  card(stats?: Stats): BP_Actor_Card;
  skill(owner: BP_ManeActor | null, name?: string): 蓝图_能力;
  probe(owner: BP_ManeActor, tags: Tag[], onTrigger?: (e: 蓝图_效果, tag: Tag) => void): 蓝图_效果;
  named(fn: string): Call[];
  hp(a: BP_ManeActor): number;
  advance(seconds: number): void;
}

/** Stat rows: key → value (加算, one base source) or ['乘算' | '加算', [values…]]. */
export type Stats = Record<string, number | ['加算' | '乘算', number[]]>;

export function stats(s: Stats): 词条映射 {
  const m: 词条映射 = new Map();
  for (const [k, v] of Object.entries(s)) {
    const [mode, vals] = typeof v === 'number' ? (['加算', [v]] as const) : v;
    m.set(k, { 计算类型: mode, 来源映射: new Map(vals.map((x, i) => [i === 0 ? '' : `src${i}`, sci(x)])) });
  }
  return m;
}

export function dmg(p: Partial<伤害> & { 伤害数值?: 科学数 } = {}): Partial<伤害> {
  return p;
}

export const n = (v: 科学数): number => 科学数变普通(科学数标准化(v));

class Probe extends 蓝图_效果 {
  static override readonly path: AssetPath = 'tests/core-damage/Probe';
  onTrigger: ((e: 蓝图_效果, tag: Tag) => void) | null = null;
  override 持续中触发(t: Tag): void { this.onTrigger?.(this, t); }
  override 激活后触发(_d: string): void {}
  override 销毁前触发(): void {}
}
class TestSkill extends 蓝图_能力 { static override readonly path: AssetPath = 'tests/core-damage/Skill'; }

/** 科学数字缩写(v, 2) as DAMAGE-005 (the test double of the text module). */
export function abbreviate(v: 科学数, 小数位: number): string {
  const x = 科学数标准化(v);
  if (x.系数 === 0) return '0';
  const E = x.指数;
  const unit = ['', 'k', 'M', 'B', 'T'][Math.min(Math.trunc(E / 3), 4)];
  const shown = x.系数 * 10 ** (E <= 12 ? (E >= 0 ? E % 3 : E) : E - 12);
  const frac = E > 2 ? 小数位 - (E <= 12 ? E % 3 : 2) : 0;
  const f = 10 ** Math.max(frac, 0);
  const scaled = shown * f;
  const fl = Math.floor(scaled);
  const r = Math.abs(scaled - fl - 0.5) < 1e-9 ? (fl % 2 === 0 ? fl : fl + 1) : Math.round(scaled);
  return `${String(r / f)}${unit}`;
}

export function harness(over: Partial<Systems> = {}): Harness {
  const calls: Call[] = [];
  const rec = (fn: string, ...args: unknown[]): void => { calls.push({ fn, args }); };
  const prd: Harness['prd'] = [];
  const chance: boolean[] = [];
  const destroyEffect = (e: 蓝图_效果): void => {
    if (!e.valid) return;
    e.销毁前触发();
    const o = e.拥有者;
    if (o) { const i = o.拥有的效果.indexOf(e); if (i >= 0) o.拥有的效果.splice(i, 1); }
    e.world.destroy(e);
  };
  const doubles: Partial<Systems> = {
    ability: {
      蓝图_效果: {
        激活效果: (e: 蓝图_效果) => { rec('激活效果', e.def.name, e); e.激活后触发(''); },
        销毁效果: (e: 蓝图_效果) => { rec('销毁效果', e.def.name, e); destroyEffect(e); },
        持续中触发: (e: 蓝图_效果, t: Tag) => rec('持续中触发', e.def.name, t),
        激活后触发: () => {}, 销毁前触发: () => {}, ReceiveBeginPlay: () => {},
      },
      BP_ManeActor: { 附加效果后: (a: BP_ManeActor, e: 蓝图_效果 | null) => rec('附加效果后', a, e), 打断技能: (a: BP_ManeActor) => rec('打断技能', a) },
      函数库_工具: {
        附加效果前处理: (_c: BpObject, cfg: 效果配置) => { rec('附加效果前处理', cfg.效果类); return { 不需附加新效果: false, 效果实例: null }; },
        使目标执行自身技能: (_c: BpObject, i: number, t: BP_ManeActor | null) => { rec('使目标执行自身技能', i, t); return { 技能实例: null, 条件通过: false, 完成释放: false }; },
      },
      函数库_技能: { 获取效果名: (_c: BpObject, s: 蓝图_能力 | null, cls: AssetPath | null) => ({ 效果名字: `${s ? s.唯一ID : '空'}_${cls?.split('/').pop() ?? ''}` }) },
    } as Systems['ability'],
    kernel: {
      函数库_工具: {
        PRD概率判断_批量: (_c: BpObject, P: number, 计数: number, 次数: number) => { rec('PRD', P, 计数, 次数); return prd.shift() ?? { 触发: false, 成功次数: 0, 更新触发计数: 计数 }; },
        传统概率判断: (_c: BpObject, p: number) => { rec('传统概率判断', p); return { 触发: chance.shift() ?? false }; },
      },
      BP_ManeActor: { 关闭碰撞: (a: BP_ManeActor) => rec('关闭碰撞', a) },
    } as Systems['kernel'],
    launch: { BP_ManeActor: { 更新运动数据: () => {} } } as unknown as Systems['launch'],
    inventory: { BP_ManeActor: { 被抓起: () => {}, 被放下: () => {} } } as unknown as Systems['inventory'],
    text: { 函数库_科学数: { 科学数字缩写: (_c: BpObject, v: 科学数, d: number) => { const t = abbreviate(v, d); return { 值: { zh: t, en: t }, 单位: { zh: '', en: '' }, ReturnValue: { zh: t, en: t } }; } } } as Systems['text'],
    rating: {
      蓝图_动作游戏模式: { 更新回合战斗统计: (_m: unknown, ...a: unknown[]) => rec('更新回合战斗统计', ...a) },
      BP_ManeActor: { 更新角色战斗统计: (a: BP_ManeActor, name: string, v: 科学数) => rec('更新角色战斗统计', a, name, n(v)) },
    } as unknown as Systems['rating'],
    turn: {
      蓝图_动作游戏模式: {
        有角色死亡时: (_m: unknown, a: BP_ManeActor | null) => rec('有角色死亡时', a),
        从场上移出_碰撞: (_m: unknown, a: BP_ManeActor | null) => rec('从场上移出', a),
        添加到墓地: (_m: unknown, a: BP_ManeActor | null) => rec('添加到墓地', a),
        退出战斗状态: (_m: unknown, d: string) => rec('退出战斗状态', d),
        添加到延迟销毁: (_m: unknown, a: unknown) => rec('添加到延迟销毁', a),
      },
    } as unknown as Systems['turn'],
    talents: { 蓝图_动作游戏模式: { 增加经验: (_m: unknown, v: number, from: unknown) => rec('增加经验', v, from) } } as unknown as Systems['talents'],
    rewards: { BP_ManeActor: { 触发掉落: (a: BP_ManeActor) => rec('触发掉落', a) } } as unknown as Systems['rewards'],
    stamina: { BP_Actor_Player: { 精神系统: (_p: unknown, a: number, b: number, d: string) => rec('精神系统', a, b, d) } } as unknown as Systems['stamina'],
    physics: { BP_Actor_Other: { 物理终止检测: (a: BP_Actor_Other) => rec('物理终止检测', a) } } as unknown as Systems['physics'],
    damage,
    ...over,
  };
  const content: ContentRegistry = {
    get: (p: AssetPath) => (p === Probe.path ? (Probe as never) : p === TestSkill.path ? (TestSkill as never) : registry.get(p)),
    get size() { return registry.size + 2; },
    paths: () => [...registry.paths(), Probe.path, TestSkill.path],
  };
  const w = createWorld({ content, seed: 1, systems: doubles });
  const actor = <T extends BP_ManeActor>(ctor: new (...a: never[]) => T, s: Stats, hp: number, tags: Tag[], type: T['角色类型']): T => {
    const a = w.spawn(ctor as never, (x: T) => {
      x.词条 = stats(s);
      x.当前生命 = sci(hp);
      x.当前最大生命 = sci(hp);
      x.角色类型 = type;
      x.描述 = [{ zh: x.def.name, en: x.def.name }];
      for (const t of tags) x.OwnedGameplayTags.add(t);
    }) as T;
    return a;
  };
  let skillN = 0;
  const h: Harness = {
    w, calls, prd, chance,
    hero: (s = {}, hp = 150) => {
      const a = actor(BP_Actor_Player, { '强固减伤%': 0.5, '暴击伤害%': 2, ...s } as Stats, hp, ['可交互.角色.玩家'], '玩家');
      a.描述 = [{ zh: '幽冥骑士', en: 'Knight' }];
      w.mode.玩家角色 = a;
      return a;
    },
    enemy: (s = {}, hp = 30, tags = ['可交互.角色.AI.仇恨']) => {
      const a = actor(BP_Actor_Other, { '暴击伤害%': 1.5, ...s } as Stats, hp, tags, '深渊');
      a.描述 = [{ zh: '眼球', en: 'Eyeball' }];
      return a;
    },
    card: (s = {}) => {
      const a = actor(BP_Actor_Card, { '暴击伤害%': 2, ...s } as Stats, 1, ['可交互.修炼牌'], '修炼牌');
      a.描述 = [{ zh: '旧剑', en: 'Old Sword' }];
      return a;
    },
    skill: (owner, name = '技能') => w.spawn(TestSkill as never, (x: 蓝图_能力) => {
      x.拥有者 = owner; x.能力名 = name; x.唯一ID = `S${++skillN}`; x.额外描述 = [{ zh: name, en: name }];
    }) as 蓝图_能力,
    probe: (owner, tags, onTrigger) => {
      const e = w.spawn(Probe as never, (x: Probe) => { x.拥有者 = owner; x.onTrigger = onTrigger ?? null; }) as Probe;
      for (const t of tags) e.OwnedGameplayTags.add(t);
      owner.拥有的效果.push(e);
      return e;
    },
    named: fn => calls.filter(c => c.fn === fn),
    hp: a => n(a.当前生命),
    advance: s => w.clock.advance(s),
  };
  return h;
}

export function hitResult(actor: BpObject, at: Vec3): HitResult {
  return { actor, impactPoint: at, impactNormal: { x: 1, y: 0, z: 0 }, location: at, normal: { x: 1, y: 0, z: 0 }, blockingHit: true, time: 0, distance: 0 };
}

/**
 * Test harness for core-stamina: the real world (core-sim), the real ability and kernel modules (core-ability) and the
 * real stamina module and content classes, with doubles (`withSystems`) for the modules this card only calls: damage
 * (heal, death, log), text (科学数字缩写), save (保存精神状态), turn (执行AI行动), rewards (创建奖励, 增加金币/收入).
 */
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { fireLive, tickCopy } from '../../src/core/ability/dispatch.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { make效果配置, type 效果配置, type 治疗 } from '../../src/core/bp/structs.ts';
import { sciOf, 科学数乘除, 科学数变普通, type 科学数 } from '../../src/core/math/sci.ts';
import type { 词条映射 } from '../../src/core/math/stats.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { createWorld, type SimWorld } from '../../src/core/sim/runtime.ts';
import { TagSet } from '../../src/core/sim/tags.ts';
import type { AssetPath, Tag } from '../../src/core/sim/types.ts';
import { registry } from '../../src/content/bp/index.ts';
import type { PresentEvent } from '../../src/core/api/events.ts';
import type { 结构_技能 } from '../../src/content/demo/types.ts';
import { withSystems } from '../fixtures/systems.ts';

export const P = {
  玩家被动: 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_玩家被动',
  饥饱: 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱',
  疼痛: 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_疼痛',
  幸运: 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_幸运',
  光阴: 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_光阴',
  格挡: 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_格挡',
  闪避: 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_闪避',
  迷茫: 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_迷​茫',
  终级抉择: 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_终级抉择',
  临时属性: 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_临时属性（精神）',
  获得精神状态: 'CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_获得精神状态',
  恢复体力: 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_恢复体力',
  能力: 'CatapultHero/BP/Skill/蓝图_能力',
  效果: 'CatapultHero/BP/Skill/蓝图_效果',
} as const;

export interface Calls {
  heals: 治疗[]; deaths: { who: BP_ManeActor; 强行: boolean; 不触发: boolean }[]; logs: string[]; ai: number;
  saves: number; rewards: unknown[]; rewardRuns: number; gold: { 金币: boolean; v: number }[];
}

export interface Harness {
  w: SimWorld; hero: BP_Actor_Player; passive: 蓝图_效果; calls: Calls;
  events(kind?: PresentEvent['kind']): PresentEvent[];
  popups(): string[];
  /** SCM-051 steps 4–5: the hero pass over a copy (新一天时 → 持续效果), the cleanup, then 疲劳结算. */
  turnStart(): void;
  /** The 行动结束后 live walk of 结束行动 (TURN-049). */
  actionEnd(): void;
  /** A live 结束层时 dispatch (the floor end of the passive and the states). */
  floorEnd(): void;
  /** 修改体力点(整数, 0, hero, hero, ui). */
  change(v: number, ui?: boolean): void;
  find(path: AssetPath): 蓝图_效果 | undefined;
  /** Grant a 数据表_技能_精神状态 row directly through 获得精神状态. */
  grant(row: string): void;
  /** The next k draws of the combat Rand15 are exactly `ks`. */
  scriptCombat(...ks: number[]): void;
}

export const sci = (c: number, e = 0): 科学数 => ({ 系数: c, 指数: e });

function stat(m: 词条映射, name: string, 计算类型: '加算' | '乘算', base: 科学数): void {
  m.set(name, { 计算类型, 来源映射: new Map([['', base]]) });
}

/** The common setup of SCM §15: 幽冥骑士 at {1,2}/{1,2}, 消耗减免% 0, 弹射距离 500, caps 15 / 3, 生命 150. */
export function harness(o: { 当前魔力?: 科学数; 场上有敌人?: boolean } = {}): Harness {
  const calls: Calls = { heals: [], deaths: [], logs: [], ai: 0, saves: 0, rewards: [], rewardRuns: 0, gold: [] };
  const w = createWorld({
    content: registry, seed: 1, strict: false,
    systems: withSystems({
      damage: {
        BP_ManeActor: {
          获得治疗: (_a, h) => { calls.heals.push(h); },
          检查死亡: (a, 强行, 不触发) => { calls.deaths.push({ who: a, 强行, 不触发 }); },
        },
        函数库_战斗日志: {
          日志__获取角色名: () => ({ Output: { zh: '幽冥骑士', en: 'Knight' } }),
          日志__输出: (_c, t) => { calls.logs.push(t.zh); return null; },
        },
      },
      text: { 函数库_科学数: { 科学数字缩写: (_c, x) => { const t = String(halfEven(科学数变普通(x))); return { 值: { zh: t, en: t }, 单位: { zh: '', en: '' }, ReturnValue: { zh: t, en: t } }; } } },
      save: { BP_Actor_Player: { 保存精神状态: () => { calls.saves++; } } },
      turn: { 蓝图_动作游戏模式: { 执行AI行动: () => { calls.ai++; } } },
      rewards: {
        蓝图_动作游戏模式: {
          创建奖励: (m, 任务条) => {
            calls.rewards.push(任务条);
            const inst = m.world.spawn<蓝图_能力>(P.能力);
            inst.执行技能 = () => { calls.rewardRuns++; };
            return { 实例: inst };
          },
          增加金币_收入: (_m, 金币, _ui, v) => { calls.gold.push({ 金币, v }); },
        },
      },
    }),
  });
  const hero = w.spawn(BP_Actor_Player, h => {
    stat(h.词条, '魔力', '加算', sciOf(1, 2));
    stat(h.词条, '最大魔力', '加算', sciOf(1, 2));
    stat(h.词条, '消耗减免%', '乘算', sci(0));
    stat(h.词条, '弹射距离', '加算', sciOf(5, 2));
    stat(h.词条, '心流层上限', '加算', sciOf(1.5, 1));
    stat(h.词条, '闪避层上限', '加算', sciOf(3, 0));
    stat(h.词条, '生命', '加算', sciOf(1.5, 2));
    stat(h.词条, '额外生命%', '加算', sci(0));
    stat(h.词条, '最大生命', '加算', sciOf(1.5, 2));
    h.当前魔力 = o.当前魔力 ?? sciOf(1, 2);
    h.当前最大魔力 = sciOf(1, 2);
    h.魔力百分比 = 科学数变普通(科学数乘除(h.当前魔力, h.当前最大魔力, true));
    h.当前生命 = sciOf(1.5, 2);
    h.当前最大生命 = sciOf(1.5, 2);
    h.高度 = 56;
  });
  w.mode.玩家角色 = hero;
  w.mode.场上有敌人 = o.场上有敌人 ?? false;
  w.mode.当前环节 = '进行战斗';
  stat(w.mode.全局词条, '品质提升修正%', '加算', sci(0));
  w.mode.全局词条.set('幸运增益%', { 计算类型: '加算', 来源映射: new Map() });
  const passiveSkill = w.spawn<蓝图_能力>(P.能力, a => { a.唯一ID = '幽冥骑士/玩家被动'; a.能力名 = '玩家被动'; a.拥有者 = hero; });
  const passive = w.spawn<蓝图_效果>(P.玩家被动, e => { e.拥有者 = hero; e.释放者 = hero; e.来自技能 = passiveSkill; });
  hero.拥有的效果.push(passive);

  const live = (tag: Tag): void => fireLive(hero.拥有的效果, tag);
  const h: Harness = {
    w, hero, passive, calls,
    events: kind => w.events.drain().filter(e => !kind || e.kind === kind),
    popups: () => w.events.drain().flatMap(e => (e.kind === 'popup' ? [String(e.value)] : [])),
    turnStart() {
      tickCopy(hero.拥有的效果, '效果.时机.新一天时');
      for (const e of [...hero.拥有的效果]) if (w.isValid(e) && e.已销毁) e.销毁效果(); // 清理已销毁效果
      hero.疲劳结算();
    },
    actionEnd: () => live('效果.时机.行动结束后'),
    floorEnd: () => live('效果.时机.结束层时'),
    change(v, ui = false) {
      hero.world.sys.stamina.函数库_工具!.修改体力点!(hero, sciOf(v), sci(0), hero, hero, ui, { x: 0, y: 0, z: 0 });
    },
    find: path => hero.拥有的效果.find(e => e !== null && e.def.path === path) ?? undefined,
    grant: row => hero.获得精神状态(row, false),
    scriptCombat(...ks) {
      // rand15 reads state, writes the next state, then reads it again for k: serve a pre-state that yields q[n] on
      // the first read, the written state on the read after the write, and fall back to the LCG once q is spent.
      const inv = inverse(214013);
      const q = [...ks];
      const g = w.rng.combat as { state: number };
      let s = g.state;
      let post = false;
      Object.defineProperty(g, 'state', {
        configurable: true,
        get() {
          if (post) { post = false; return s; }
          return q.length > 0 ? Math.imul((((q[0]! << 16) >>> 0) - 2531011) >>> 0, inv) >>> 0 : s;
        },
        set(v: number) { if (q.length > 0) q.shift(); s = v >>> 0; post = true; },
      });
    },
  };
  return h;
}

function inverse(a: number): number {
  let x = a;
  for (let i = 0; i < 5; i++) x = Math.imul(x, (2 - Math.imul(a, x)) >>> 0);
  return x >>> 0;
}

/** CORE-M-041: 科学数字缩写(·, 0) rounds half to even. */
function halfEven(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** A card holding an item stat block (体力药剂: 魔力 1e1, 连击 1) with a 恢复体力 ability at a quality. */
export function potion(h: Harness, row: '使用恢复体力' | '怪兽肉', 品质: number, 魔力: 科学数): { card: BP_Actor_Card; a: 蓝图_能力 } {
  const card = h.w.spawn(BP_Actor_Card, c => {
    c.角色类型 = '修炼牌';
    stat(c.词条, '魔力', '加算', 魔力);
    stat(c.词条, '连击', '加算', sci(1));
  });
  const table = h.w.data.table('CatapultHero/数据表/技能/数据表_技能_修炼物品')!;
  const a = h.w.spawn<蓝图_能力>(P.恢复体力, x => {
    x.拥有者 = card; x.能力名 = row; x.唯一ID = `card/${row}`;
    x.等级 = 2 ** (品质 - 1); x.品质 = 品质;
  });
  a.技能配置 = table.rows[row] as 结构_技能;
  a.初始化();
  return { card, a };
}

export function cfgOf(path: AssetPath, p: Partial<效果配置> = {}): 效果配置 {
  return make效果配置({ 效果类: path, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: true, 检查效果名: false, 叠加上限: 1, ...p });
}

export { TagSet };

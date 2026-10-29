/**
 * Test world for core-rewards: the real `rewards` module plus local doubles for the modules it calls through the facade
 * (ability, inventory, craft, enchant, kernel, turn, talents, stamina, save, rating) until `wa/ability` and the other
 * systems land. Every double records its calls in `log` so the tests can check the order.
 */
import { registry } from '../../src/content/bp/index.ts';
import type { 结构_技能 } from '../../src/content/demo/types.ts';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { 参数From, 获取技能参数 } from '../../src/core/ability/params.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { 修炼物品格子组 } from '../../src/core/sim/cult-grid.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { createWorld, type SimWorld } from '../../src/core/sim/runtime.ts';
import { TagSet } from '../../src/core/sim/tags.ts';

export const REWARD_TABLE = 'CatapultHero/数据表/技能/数据表_技能_奖励';
export const PROP_TABLE = 'CatapultHero/数据表/技能/数据表_技能_道具';
export const OTHER_HEROES = ['可交互.角色.玩家.灵魂猎手', '可交互.角色.玩家.恶疫旅人', '可交互.角色.玩家.元素祭司'];

export interface RewardWorld {
  w: SimWorld;
  hero: BP_Actor_Player;
  log: string[];
  /** Spawns the ability of a skill row the way 创建奖励 does (row fields copied by the 初始化 double). */
  ability<T extends 蓝图_能力>(table: string, row: string, 等级?: number): T;
}

/** 蓝图_能力.初始化 double: copies the row fields reward code reads (ABILIT-004 subset). */
function initFromRow(a: 蓝图_能力): void {
  const r: 结构_技能 = a.技能配置;
  a.参数 = r.参数.map(p => ({ ...p }));
  a.类型 = new TagSet(r.类型);
  a.目标标签 = new TagSet(r.主条件.目标标签);
  a.排斥标签 = new TagSet(r.主条件.排斥标签);
  a.目标或_且 = r.主条件.目标或且;
  a.条件 = r.主条件;
  a.消耗 = r.消耗;
  a.单次级别上限 = r.单次级别上限;
}

export function rewardWorld(o: { seed?: number; systems?: Partial<Systems>; tasks?: { 未完成: boolean } } = {}): RewardWorld {
  const log: string[] = [];
  let w!: SimWorld;
  const systems: Partial<Systems> = {
    ability: {
      蓝图_能力: {
        初始化: initFromRow,
        子初始化: () => {},
        释放结束: a => { log.push(`释放结束:${a.能力名}`); },
        被选中: () => {},
      },
      蓝图_效果: {
        激活效果: e => { e.激活后触发(''); },
        销毁效果: e => { log.push(`销毁效果:${e.def.path.split('/').pop()}`); w.destroy(e); },
        激活后触发: () => {},
        持续中触发: () => {},
        销毁前触发: () => {},
        ReceiveBeginPlay: () => {},
      },
      函数库_技能: {
        获取技能参数: (_ctx, a, i, prev) => 获取技能参数({ 参数: (a?.参数 ?? []).map(参数From), 等级: a?.等级 ?? 1, 品质: a?.品质 ?? 1, 上一次等级: a?.上一次等级 ?? 0 }, i, prev),
        获取效果名: (_ctx, _a, cls) => ({ 效果名字: cls ?? '' }),
      },
      函数库_工具: {
        附加效果前处理: () => ({ 不需附加新效果: false, 效果实例: null }),
        选择角色作为目标: () => {},
      },
    },
    inventory: {
      修炼系统: {
        生成卡牌: (cult, _t, 名字, _p, _tag, 随机品质, 品质) => {
          const c = w.spawn(BP_Actor_Card, x => { x.名字 = 名字; x.品质 = 品质; });
          cult.未拾取牌.push(c);
          log.push(`生成卡牌:${名字}:${品质}:${随机品质 ? 'R' : 'F'}`);
          return { 卡牌实例: c };
        },
        获取牌: (cult, c) => {
          if (!c) return { 成功: false };
          cult.未拾取牌.splice(cult.未拾取牌.indexOf(c), 1);
          cult.背包里牌.push(c);
          log.push(`获取牌:${c.名字}`);
          return { 成功: true };
        },
        装备牌: (cult, c) => { cult.已装备牌.push(c); log.push(`装备牌:${c?.名字}`); },
        获取后触发: () => {},
      },
      修炼物品格子组: {
        整理并寻找可摆位置: () => ({ 找到了空间: true, 找到的起始格: null }),
        放入物品到指定格: () => {},
      },
      BP_Actor_Card: { 更新价格: () => {} },
    },
    craft: { 修炼系统: { 检查可合成牌: () => {} }, 函数库_工具: { 尝试合成材料: () => {} } },
    enchant: { BP_Actor_Card: { 添加附魔: c => { log.push(`添加附魔:${c.名字}`); } } },
    kernel: { 函数库_工具: { 销毁目标和子物体: (_ctx, t) => { if (t) w.destroy(t); } } },
    turn: {
      蓝图_动作游戏模式: {
        结束当前层: (_m, b) => { log.push(`结束当前层:${b}`); },
        进入战斗状态: () => { log.push('进入战斗状态'); },
      },
      BP_ManeActor: { 结束行动: () => { log.push('结束行动'); } },
    },
    talents: { 蓝图_动作游戏模式: { 增加经验: (_m, n) => { log.push(`增加经验:${n}`); } } },
    stamina: { BP_Actor_Player: { 精神系统: () => {} }, 函数库_工具: { 修改体力点: (_c, n) => { log.push(`修改体力点:${n.系数}`); } } },
    // Reward source now reads EMS through its facade; this isolated fixture supplies its previous run0 values.
    save: { GetCustomSave: () => ({ 轮回次数: 0, 已解锁机制: [] }), BP_Actor_Player: { 保存英雄信息: () => {} } } as typeof systems.save,
    tutorial: {}, // This reward-isolation fixture intentionally supplies no EMS/UI tutorial contract.
    rating: { 蓝图_动作游戏模式: { 更新轮回战斗统计: () => {}, 更新回合战斗统计: () => {} } },
    sim: { 蓝图_动作游戏模式: { 开始动画结算: () => { log.push('开始动画结算'); } } },
    ...o.systems,
  };
  w = createWorld({ content: registry, seed: o.seed ?? 7, systems });
  const hero = w.spawn(BP_Actor_Player);
  hero.非本英雄标签 = new TagSet(OTHER_HEROES);
  w.mode.玩家角色 = hero;
  w.cult.修炼物品格_已装备 = w.spawn(修炼物品格子组);
  w.cult.修炼物品格_在背包 = w.spawn(修炼物品格子组);
  if (o.tasks) w.mode.当前任务实例 = Object.assign(w.spawn(BP_Actor_Card), { 未完成: o.tasks.未完成 });
  const ability = <T extends 蓝图_能力>(table: string, row: string, 等级 = 1): T => {
    const cfg = (w.data.table(table)?.rows as Record<string, 结构_技能>)[row]!;
    const a = w.spawn<T>(cfg.能力.能力类!, x => { x.能力名 = row; x.拥有者 = hero; x.等级 = 1; x.品质 = 1; });
    a.技能配置 = cfg;
    a.等级 = 等级;
    a.初始化();
    return a;
  };
  return { w, hero, log, ability };
}

/** χ² statistic of observed counts against expected proportions (zero-weight cells must be empty). */
export function chiSquare(counts: readonly number[], weights: readonly number[]): { chi2: number; dof: number; zeroHits: number } {
  const n = counts.reduce((a, b) => a + b, 0);
  const W = weights.reduce((a, b) => a + b, 0);
  let chi2 = 0;
  let dof = -1;
  let zeroHits = 0;
  counts.forEach((c, i) => {
    const wgt = weights[i] ?? 0;
    if (wgt <= 0) { zeroHits += c; return; }
    const e = (n * wgt) / W;
    chi2 += ((c - e) ** 2) / e;
    dof++;
  });
  return { chi2, dof, zeroHits };
}

/** Upper 0.999 quantile of χ²(dof) (Wilson–Hilferty), a loose bound for seeded sampling tests. */
export function chi2Bound(dof: number): number {
  const z = 3.09;
  return dof * (1 - 2 / (9 * dof) + z * Math.sqrt(2 / (9 * dof))) ** 3;
}

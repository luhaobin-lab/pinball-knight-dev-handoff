/**
 * A talent test world: the real `talents` module and content registry, with local doubles for the ability, kernel, turn
 * and rewards functions the talent code calls (WAVE_A §1.4; replaced by tests/fixtures once `wa/ability` lands).
 */
import { registry } from '../../src/content/bp/index.ts';
import 合成数据表_技能 from '../../src/content/demo/data/合成数据表_技能.ts';
import 数据表_天赋_boss专属 from '../../src/content/demo/data/数据表_天赋_boss专属.ts';
import 数据表_天赋_专属 from '../../src/content/demo/data/数据表_天赋_专属.ts';
import 数据表_天赋_新新通用 from '../../src/content/demo/data/数据表_天赋_新新通用.ts';
import 数据表_玩家 from '../../src/content/demo/data/数据表_玩家.ts';
import { row, rowNames } from '../../src/content/demo/index.ts';
import type { 结构_技能 } from '../../src/content/demo/types.ts';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { 参数From, 获取技能参数 } from '../../src/core/ability/params.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { sciOf } from '../../src/core/math/sci.ts';
import { 词条映射From } from '../../src/core/math/stats.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { createWorld, type SimWorld } from '../../src/core/sim/runtime.ts';
import { TagSet } from '../../src/core/sim/tags.ts';
import type { BpObject } from '../../src/core/sim/object.ts';
import type { Tag } from '../../src/core/sim/types.ts';

export const HERO_TAGS: Record<string, Tag> = {
  幽冥骑士: '可交互.角色.玩家.幽冥骑士', 灵魂猎手: '可交互.角色.玩家.灵魂猎手', 恶疫旅人: '可交互.角色.玩家.恶疫旅人', 元素祭司: '可交互.角色.玩家.元素祭司',
};

/** The hero's 天赋池 as BP_ManeActor.初始化 L4345 builds it: the row names of its three 天赋表 tables, in order. */
export function talentPool(): string[] {
  return [...rowNames(数据表_天赋_新新通用), ...rowNames(数据表_天赋_专属), ...rowNames(数据表_天赋_boss专属)];
}

export interface TalentWorld {
  readonly w: SimWorld;
  readonly hero: BP_Actor_Player;
  /** turn double: calls in order, and how often 新回合后 opened. */
  readonly turnLog: string[];
  readonly 回合开始实例: BpObject[];
}

/** 蓝图_能力.初始化 double: the row fields the talent code reads (ABILIT-004 subset). */
function 初始化(a: 蓝图_能力): void {
  const row: 结构_技能 = a.技能配置;
  a.等级上限 = row.天赋上限;
  a.类型 = new TagSet(row.类型);
  a.排斥技能 = [...row.主条件.排斥技能];
  a.参数 = row.参数.map(p => ({ ...p })) as unknown as typeof a.参数;
  a.目标标签 = new TagSet(row.主条件.目标标签);
  a.排斥标签 = new TagSet(row.主条件.排斥标签);
  a.目标或_且 = row.主条件.目标或且;
  a.条件 = row.主条件;
  a.额外描述 = [...row.额外描述];
  a.原始描述 = row.描述;
}

/** `技能` extends the ability double's 函数库_技能 (e.g. 技能条件筛选物品); `systems` replaces whole modules. */
export function talentWorld(o: { hero?: string; seed?: number; systems?: Partial<Systems>; 技能?: NonNullable<Systems['ability']['函数库_技能']>; strict?: boolean; filter?: 'ported' | 'all' } = {}): TalentWorld {
  const turnLog: string[] = [];
  const 回合开始实例: BpObject[] = [];
  let w!: SimWorld;
  const ability: Systems['ability'] = {
    函数库_工具: {
      存在相同被动: (_c, hero, name) => {
        const a = hero?.拥有的被动能力.find(x => w.isValid(x) && x.能力名 === name) ?? hero?.拥有的主动能力.find(x => w.isValid(x) && x.能力名 === name) ?? null;
        return { 有存在: a !== null, 对应能力: a };
      },
      对应类型效果数量: (_c, arr, cls) => {
        const hits = arr.filter((e): e is 蓝图_效果 => w.isValid(e) && e.def.path === cls);
        return { 数量: hits.length, 实例组: hits };
      },
      附加效果前处理: () => ({ 不需附加新效果: false, 效果实例: null }),
      有对应标签效果: (_c, arr, tag) => ({ 存在: arr.some(e => w.isValid(e) && e.HasMatchingGameplayTag(tag)) }),
      选择角色作为目标: () => {},
    },
    函数库_技能: {
      获取技能参数: (_c, a, i, diff) => (a ? 获取技能参数({ 参数: a.参数.map(p => 参数From(p as never)), 等级: a.等级, 品质: a.品质, 上一次等级: a.上一次等级 }, i, diff) : { 整数: false, 乘算: false, 参数值: 0, 词条: '' }),
      获取效果名: (_c, _a, cls) => ({ 效果名字: cls ?? '' }),
      ...o.技能,
    },
    蓝图_能力: {
      初始化,
      子初始化: () => {},
      执行技能: () => {},
      释放结束: () => {},
      检查条件: a => { a.本技能可释放 = true; },
      检查子条件: () => {},
    },
    蓝图_效果: {
      激活效果: e => e.激活后触发(''),
      销毁效果: e => {
        e.销毁前触发();
        const list = e.拥有者?.拥有的效果;
        if (list) { const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); }
        w.destroy(e);
      },
      激活后触发: () => {},
      销毁前触发: () => {},
      持续中触发: () => {},
    },
  };
  const turn: Systems['turn'] = {
    蓝图_动作游戏模式: {
      加入回合开始: (mode, inst) => {
        turnLog.push('加入回合开始');
        if (mode.当前环节 === '回合开始' && inst && !回合开始实例.includes(inst)) 回合开始实例.push(inst);
      },
      // TURN-033, as the turn double: leave, purge, 升级玩家, then 新回合后 when nothing holds the barrier.
      退出回合开始: (mode, inst) => {
        turnLog.push('退出回合开始');
        const can = w.isValid(inst) ? 回合开始实例.includes(inst) : true;
        const i = inst ? 回合开始实例.indexOf(inst) : -1;
        if (i >= 0) 回合开始实例.splice(i, 1);
        for (let k = 回合开始实例.length - 1; k >= 0; k--) if (!w.isValid(回合开始实例[k])) 回合开始实例.splice(k, 1);
        const r = mode.玩家角色!.升级玩家();
        if (r.成功 || r.升级中 || 回合开始实例.length > 0 || !can || mode.当前环节 !== '回合开始') return;
        turnLog.push('新回合后');
      },
    },
  };
  const rewards: Systems['rewards'] = {
    蓝图_动作游戏模式: { 增加金币_收入: (mode, _a, _b, v) => { mode.金币 += v; } },
  };
  const kernel: Systems['kernel'] = {
    函数库_工具: { 销毁目标和子物体: (_c, t) => { if (t) w.destroy(t); } },
  };
  w = createWorld({ content: registry, seed: o.seed ?? 1, strict: o.strict ?? false, filter: o.filter ?? 'all', systems: { ability, turn, rewards, kernel, ...o.systems } });
  const heroName = o.hero ?? '幽冥骑士';
  const hero = w.spawn(BP_Actor_Player, h => {
    h.名字 = heroName;
    h.天赋池 = talentPool();
    h.非本英雄标签 = new TagSet(Object.entries(HERO_TAGS).filter(([k]) => k !== heroName).map(([, t]) => t));
    h.角色配置 = row(数据表_玩家, heroName);
    h.词条 = 词条映射From(h.角色配置.科学词条);
  });
  const mode = w.mode;
  mode.玩家角色 = hero;
  mode.全局词条 = 词条映射From(Object.fromEntries(['经验修正%', '品质提升修正%', '额外精英几率%', '材料掉落修正%', '刷新费用修正', '刷新次数修正'].map(k => [k, { 计算类型: '加算', 来源映射: { '': { 系数: 0, 指数: 0 } } }])) as never);
  mode.当前环节 = '回合开始';
  mode.金币 = 10;
  mode.当前任务实例 = w.spawn('CatapultHero/BP/Skill/Ability/Mission/BP_Mission'); // 未完成？ = true (CDO)
  return { w, hero, turnLog, 回合开始实例 };
}

/** A learned talent instance (as UI_天赋选项 L6266 creates it) of row `name` at `等级`. */
export function learn(t: TalentWorld, name: string, 等级 = 1): 蓝图_能力 {
  const row = 合成数据表_技能.rows[name as keyof typeof 合成数据表_技能.rows] as 结构_技能;
  const a = t.w.spawn<蓝图_能力>(row.能力.能力类!, x => { x.唯一ID = name; x.能力名 = name; x.拥有者 = t.hero; });
  a.技能配置 = row;
  a.等级 = 等级;
  a.初始化();
  t.hero.添加天赋(a, 等级, false, false);
  return a;
}

export const sci = sciOf;

/**
 * The ability half of 函数库_工具 and 函数库_技能 (WAVE_A Appendix W2; ability-framework §4.B, §4.D, §4.F).
 * Demo: CatapultHero/函数库/函数库_工具, CatapultHero/函数库/函数库_技能 (line numbers below are pseudo-file lines).
 */
import type { AbilityFns } from '../../bp/systems.ts';
import type { 效果配置 } from '../../bp/structs.ts';
import { 获取技能参数, 参数From } from '../../ability/params.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import { BP_Actor_Card } from '../../sim/card.ts';
import type { 修炼系统 } from '../../sim/cult.ts';
import type { BpObject } from '../../sim/object.ts';
import type { AssetPath } from '../../sim/types.ts';
import { TagSet } from '../../sim/tags.ts';
import { 函数库_工具 as Tools } from '../../bp/index.ts';
import { Array_Random } from '../../rng/ue.ts';
import { classOf, removeItem } from './util.ts';

type Effects = (蓝图_效果 | null)[];

/** GetClassDisplayName: the class's asset name (SPEC-GAP U5: the engine's exact string is unknown; equality is what matters). */
export function classDisplayName(cls: AssetPath | null): string {
  if (cls === null) return 'None';
  const i = cls.lastIndexOf('/');
  return i >= 0 ? cls.slice(i + 1) : cls;
}

/** Cast<BP_Actor_Card>. */
function asCard(o: BpObject | null | undefined): BP_Actor_Card | null {
  return o instanceof BP_Actor_Card ? o : null;
}

export const 函数库_工具: NonNullable<AbilityFns['函数库_工具']> = {
  // line 126: exact class, no IsValid test.
  对应类型效果数量(_ctx, 效果数组, 效果类) {
    let 数量 = 0;
    const 实例组: Effects = [];
    for (let i = 0; i < 效果数组.length; i++) {
      const e = 效果数组[i];
      if (classOf(e) === 效果类) {
        数量 += 1;
        if (!实例组.includes(e)) 实例组.push(e);
      }
    }
    return { 数量, 实例组 };
  },

  // line 325
  获取释放的角色(_ctx, 拥有者, 游戏模式) {
    const card = !!拥有者 && 拥有者.OwnedGameplayTags.hasAny(['可交互.修炼牌']);
    return { 释放的角色: card ? (游戏模式?.玩家角色 ?? null) : 拥有者 };
  },

  // line 375: no IsValid test (a destroyed entry still answers its tags).
  对应标签效果数量(_ctx, 效果数组, TagToCheck) {
    let 数量 = 0;
    for (let i = 0; i < 效果数组.length; i++) if (效果数组[i]?.HasMatchingGameplayTag(TagToCheck)) 数量 += 1;
    return { 数量 };
  },

  // line 478: over a copy, 销毁效果 on every valid flagged entry (ABILIT-046).
  清理已销毁效果(ctx, Array) {
    const copy = [...Array];
    for (let i = 0; i < copy.length; i++) {
      const e = copy[i];
      if (e && ctx.world.isValid(e) && e.已销毁) e.销毁效果();
    }
  },

  // line 975 (ABILIT-056): exchange sort on 来自技能.等级; descending swaps on ties too.
  排序效果(_ctx, InputPin, 正序) {
    for (let i = 0; i < InputPin.length; i++) {
      for (let j = i; j <= InputPin.length - 1; j++) {
        const greater = (InputPin[i]?.来自技能?.等级 ?? 0) > (InputPin[j]?.来自技能?.等级 ?? 0);
        if (正序 ? greater : !greater) {
          const t = InputPin[j];
          InputPin[j] = InputPin[i];
          InputPin[i] = t;
        }
      }
    }
  },

  // line 2044. QUIRK: 对应能力 is the last ability visited even when none matched.
  存在相同主动(_ctx, 角色目标, 名字) {
    return sameName(角色目标?.拥有的主动能力 ?? [], 名字);
  },

  // line 2081
  存在相同被动(_ctx, 角色目标, 名字) {
    return sameName(角色目标?.拥有的被动能力 ?? [], 名字);
  },

  // line 2118. QUIRK: 存在的效果 is the last valid entry visited even when none matched ("空效果" print not ported).
  存在同名效果(ctx, 效果数组, 效果名) {
    let 存在相同被动 = false;
    let 存在的效果: 蓝图_效果 | null = null;
    for (let i = 0; i < 效果数组.length && !存在相同被动; i++) {
      const e = 效果数组[i];
      if (!e || !ctx.world.isValid(e)) continue;
      存在的效果 = e;
      存在相同被动 = e.效果名字 === 效果名;
    }
    return { 存在相同被动, 存在的效果 };
  },

  // line 2159: exact class (a subclass does not match its parent, ABILIT-052); no IsValid test.
  存在同类效果(_ctx, 效果数组, 效果类) {
    let 存在相同被动 = false;
    let 存在的效果: 蓝图_效果 | null = null;
    for (let i = 0; i < 效果数组.length && !存在相同被动; i++) {
      存在的效果 = 效果数组[i] ?? null;
      存在相同被动 = classOf(存在的效果) === 效果类;
    }
    return { 存在相同被动, 存在的效果 };
  },

  // line 2196 (ABILIT-051…054)
  附加效果前处理(ctx, 结构_效果, 目标, 效果名) {
    return 附加效果前处理(ctx, 结构_效果, 目标, 效果名);
  },

  // line 2229
  有对应标签效果(ctx, 效果数组, TagToCheck) {
    let 存在 = false;
    for (let i = 0; i < 效果数组.length && !存在; i++) {
      const e = 效果数组[i];
      if (!e || !ctx.world.isValid(e)) continue;
      存在 = e.HasMatchingGameplayTag(TagToCheck);
    }
    return { 存在 };
  },

  // line 2784 (ABILIT-023)
  使目标执行自身技能(ctx, 技能序号, 目标, 不立刻执行) {
    const skill = 技能序号 === -1 || !目标 ? null : (目标.拥有的主动能力[技能序号] ?? null);
    if (!skill || !ctx.world.isValid(skill)) return { 技能实例: null, 条件通过: false, 完成释放: false }; // "没有对应技能"
    const r = execute(skill, 目标!, 不立刻执行);
    return { 技能实例: skill, ...r };
  },

  // line 2830
  使目标执行指定技能(ctx, 技能实例, 目标, 不立刻执行) {
    if (!技能实例 || !ctx.world.isValid(技能实例)) return { 条件通过: false, 完成释放: false };
    return execute(技能实例, 目标!, 不立刻执行);
  },

  // line 2964 (ABILIT-024)
  选择角色作为目标(ctx, 选择者) {
    if (!选择者) return;
    if (选择者.角色类型 === '玩家') 选择者.当前目标 = null;
    else 选择者.当前目标 = ctx.world.mode.玩家角色;
  },
};

function sameName(list: (蓝图_能力 | null)[], 名字: string): { 有存在: boolean; 对应能力: 蓝图_能力 | null } {
  let 有存在 = false;
  let 对应能力: 蓝图_能力 | null = null;
  for (let i = 0; i < list.length && !有存在; i++) {
    对应能力 = list[i] ?? null;
    有存在 = 对应能力?.能力名 === 名字;
  }
  return { 有存在, 对应能力 };
}

/** The shared core of 使目标执行自身技能 / 使目标执行指定技能. */
function execute(skill: 蓝图_能力, 目标: BP_ManeActor, 不立刻执行: boolean): { 条件通过: boolean; 完成释放: boolean } {
  skill.检查子条件();
  skill.检查条件();
  if (!(skill.本技能可释放 && 目标.动画可打断)) return { 条件通过: false, 完成释放: false }; // "技能不可释放！"
  目标.当前能力 = skill;
  目标.当前能力.被选中();
  if (不立刻执行) return { 条件通过: true, 完成释放: false };
  目标.当前能力.释放开始();
  return { 条件通过: true, 完成释放: true };
}

/** 附加效果前处理 (函数库_工具 line 2196): merge into an existing unique instance, or ask for a new one. */
export function 附加效果前处理(ctx: BpObject, s: 效果配置, 目标: BP_ManeActor | null, 效果名: string): { 不需附加新效果: boolean; 效果实例: 蓝图_效果 | null } {
  if (!s.唯一 || !目标) return { 不需附加新效果: false, 效果实例: null };
  const found = s.检查效果名 ? Tools.存在同名效果(ctx, 目标.拥有的效果, 效果名) : Tools.存在同类效果(ctx, 目标.拥有的效果, s.效果类);
  if (!found.存在相同被动 || !found.存在的效果) return { 不需附加新效果: false, 效果实例: null };
  // L160
  const e = found.存在的效果;
  e.更新时间(s);
  if (s.叠加上限 > 1) e.叠加层数 = Math.min(Math.max(e.叠加层数 + s.叠加层数, 1), s.叠加上限);
  return { 不需附加新效果: true, 效果实例: e };
}

/** 获取效果名 (函数库_技能 line 371, ABILIT-050): 唯一ID + "_" + class display name, "空_…" without a source ability. */
export function 获取效果名(ctx: BpObject, 来自技能: 蓝图_能力 | null, 效果类: AssetPath | null): string {
  const prefix = 来自技能 && ctx.world.isValid(来自技能) ? 来自技能.唯一ID : '空';
  return `${prefix}_${classDisplayName(效果类)}`;
}

export const 函数库_技能: NonNullable<AbilityFns['函数库_技能']> = {
  // line 8. Map_Find misses read 0.
  发射物数判断(_ctx, 游戏模式, 来自角色, 发射物名) {
    const cap = 游戏模式?.发射物上限数.get(发射物名) ?? 0;
    const cur = 游戏模式?.发射物当前数.get(`${来自角色?.唯一ID ?? ''}//${发射物名}`) ?? 0;
    return { 超出上限: cur >= cap };
  },

  // line 21
  添加发射物数(_ctx, 游戏模式, 来自角色, 发射物名, 添加数) {
    if (!游戏模式) return;
    const k = `${来自角色?.唯一ID ?? ''}//${发射物名}`;
    游戏模式.发射物当前数.set(k, (游戏模式.发射物当前数.get(k) ?? 0) + 添加数);
  },

  // line 33
  移除发射物数(_ctx, 游戏模式, 来自角色, 发射物名, 移除数) {
    if (!游戏模式) return;
    const k = `${来自角色?.唯一ID ?? ''}//${发射物名}`;
    游戏模式.发射物当前数.set(k, (游戏模式.发射物当前数.get(k) ?? 0) - 移除数);
  },

  // line 135 (ABILIT-037): 持续效果 减少数 times; reaching 0 only flags the cooldown (destroyed at the next cleanup).
  技能减少冷却(ctx, 能力, 减少数) {
    const cd = 能力?.冷却效果;
    if (!cd || !ctx.world.isValid(cd)) return;
    cd.触发时机 = '效果.时机.新一天时';
    for (let i = 0; i <= 减少数 - 1; i++) cd.持续效果();
  },

  // line 159: one unseeded Array_Random over the actives (combat domain, CORE-M-129).
  目标减少随机技能冷却(ctx, 目标, 减少数) {
    const list = 目标?.拥有的主动能力 ?? [];
    const i = Array_Random(ctx.world.rng.combat, list);
    Skills.技能减少冷却!(ctx, i >= 0 ? (list[i] ?? null) : null, 减少数);
  },

  // line 168
  判断原始标签并修改(_ctx, 目标, 来自技能, 移除_添加) {
    if (!目标 || !来自技能) return;
    const c = 来自技能.副条件[0];
    const key = c ? Object.keys(c.前置标签)[0] ?? '' : '';
    if (目标.角色配置.标签.some(t => key !== '' && (t === key || t.startsWith(`${key}.`)))) return;
    const before = new Map(目标.额外标签_存档);
    // L292 → L722 → L1000 → L1452 (push_flow order runs the removal loop first)
    for (const t of before.values()) 目标.OwnedGameplayTags.remove(t);
    if (移除_添加) 目标.额外标签_存档.set(来自技能.唯一ID, key);
    else 目标.额外标签_存档.delete(来自技能.唯一ID);
    for (const t of 目标.额外标签_存档.values()) 目标.OwnedGameplayTags.add(t);
    if (目标.额外标签_存档.size !== before.size) 目标.标签被修改后();
  },

  // line 239 (ABILIT-022)
  技能条件筛选物品(ctx, 修炼系统, 来自技能, 子条件序号) {
    if (!来自技能) return { 筛选后: [] };
    const main = 子条件序号 === -1;
    const sub = 来自技能.副条件[Math.max(子条件序号, 0)];
    const 需求空间 = main ? 来自技能.需求空间 : (sub?.需求空间 ?? '装备');
    const 目标或且 = main ? 来自技能.目标或_且 : (sub?.目标或且 ?? false);
    const 目标标签 = main ? 来自技能.目标标签 : new TagSet(sub?.目标标签 ?? []);
    const 排斥或且 = main ? 来自技能.排斥或_且 : (sub?.排斥或且 ?? false);
    const 排斥标签 = main ? 来自技能.排斥标签 : new TagSet(sub?.排斥标签 ?? []);
    const 需求唯一 = main ? 来自技能.需求唯一 : (sub?.['需求唯一？'] ?? false);
    const 需求位置 = main ? 来自技能.需求位置 : (sub?.需求位置 ?? '无');
    const r = Tools.筛选修炼物品(ctx, 修炼系统 as 修炼系统 | null, 需求空间, 目标或且, 目标标签, 排斥或且, 排斥标签, -1);
    if (!(r.是否存在 && (r.筛选后.length === 1 || !需求唯一))) return { 筛选后: [] }; // L2160
    const card = asCard(来自技能.拥有者);
    switch (需求位置) {
      case '自身': return { 筛选后: card ? [card] : [] }; // SPEC-GAP: a non-card owner leaves the out pin unset (empty here)
      case '上': return { 筛选后: [r.最上方] };
      case '下': return { 筛选后: [r.最下方] };
      case '所有': return { 筛选后: r.筛选后 };
      case '所有其他':
      case '随机': {
        const out = [...r.筛选后];
        if (card) removeItem(out, card);
        return { 筛选后: out };
      }
      case '相邻':
      case '上相邻':
      case '下相邻': {
        if (!card) return { 筛选后: [] };
        card.获取相邻牌(false, { x: 0, y: 0, z: 0 }, 目标标签, 目标或且);
        if (需求位置 === '相邻') return { 筛选后: card.相邻牌 };
        const n = 需求位置 === '上相邻' ? card.上方牌 : card.下方牌;
        return { 筛选后: n && ctx.world.isValid(n) ? [n] : [] };
      }
      default: return { 筛选后: [] }; // SPEC-GAP: 无 / 右 / 左 leave the out pin unset (empty here)
    }
  },

  // line 371
  获取效果名(ctx, 来自技能, 效果类) {
    return { 效果名字: 获取效果名(ctx, 来自技能, 效果类) };
  },

  // line 670: the arithmetic is core-math's (src/core/ability/params.ts).
  获取技能参数(_ctx, 技能实例, 参数序号, 上一级差值, Debug) {
    if (!技能实例) return { 整数: false, 乘算: false, 参数值: 0, 词条: '' };
    const src = { 参数: 技能实例.参数.map(参数From), 等级: 技能实例.等级, 品质: 技能实例.品质, 上一次等级: 技能实例.上一次等级 };
    return 获取技能参数(src, 参数序号, 上一级差值, Debug);
  },
};
const Skills = 函数库_技能;

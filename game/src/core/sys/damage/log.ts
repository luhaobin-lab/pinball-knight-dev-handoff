/**
 * Combat log: 输出受伤日志, 清空日志数据 (BP_ManeActor L377–L677) and 函数库_战斗日志 (日志//获取能力名, 日志//获取角色名,
 * 日志//输出). Draft damage-crit-weakspot DAMAGE-125…133.
 * The log entry (UI_日志词条) is a core record: creation emits a `log` event, a merge re-renders it with a `ui` update.
 */
import type { 蓝图_能力 } from '../../ability/ability.ts';
import { 函数库_科学数, 函数库_战斗日志 } from '../../bp/index.ts';
import { 科学数加减, type 科学数 } from '../../math/sci.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { BpObject } from '../../sim/object.ts';
import { TagSet } from '../../sim/tags.ts';
import type { FText, 枚举_伤害类型 } from '../../../content/demo/types.ts';
import { T, 即时受伤来源回合记录, 持续受伤来源回合记录, type 日志词条 } from './common.ts';

const EMPTY: FText = { zh: '', en: '' };

/** 科学数字缩写(v, 2) through the facade (module text), as plain text. */
export function abbreviate(ctx: BpObject, v: 科学数): FText {
  return 函数库_科学数.科学数字缩写(ctx, v, 2).ReturnValue;
}

const DOT: Partial<Record<枚举_伤害类型, { zh: string; en: string; app: { zh: string; en: string } }>> = {
  中毒: { zh: '<持续伤害>剧毒</>', en: '<持续伤害>Poison</>', app: { zh: '剧毒', en: ' Poison' } },
  流血: { zh: '<持续伤害>流血</>', en: '<持续伤害>Bleed</>', app: { zh: '流血', en: ' Bleed' } },
  燃烧: { zh: '<持续伤害>燃烧</>', en: '<持续伤害>Burn</>', app: { zh: '燃烧', en: ' Burn' } },
};

/** The bare DoT type label of the tick line; QUIRK: Array_Find −1 → Array_Get out of range → empty text. */
export function typeLabel(t: 枚举_伤害类型): FText {
  const d = DOT[t];
  return d ? { zh: d.zh, en: d.en } : EMPTY;
}

/** 日志//输出 with empty tag filters (every damage-module call site). */
export function 输出日志(ctx: BpObject, text: FText): 日志词条 | null {
  return 函数库_战斗日志.日志__输出(ctx, text, ctx, new TagSet(), new TagSet()) as 日志词条 | null;
}

/** DAMAGE-125…130 (L387–L677). */
export function 输出受伤日志(self: BP_ManeActor): void {
  const d = self.当前受伤数据;
  const records = 即时受伤来源回合记录(self);
  const rec = records.get(d.来自角色);
  // QUIRK (E-10, line 672): 科学数记录 is written on creation only, so later merges show first + latest hit.
  const shown = rec ? 科学数加减(rec.科学数记录, self.当前受伤数值, false) : self.当前受伤数值;
  const n = abbreviate(self, shown);
  const dotApp = (d.伤害类型 === '中毒' || d.伤害类型 === '流血' || d.伤害类型 === '燃烧') && d.伤害来源 !== '减益';
  const app = DOT[d.伤害类型]?.app;
  const zero: FText = dotApp && app
    ? { zh: `<持续伤害>${n.zh}${app.zh}</>`, en: `<持续伤害>${n.en}${app.en}</>` }
    : self.HasMatchingGameplayTag(T.玩家) ? { zh: `<玩家伤害>${n.zh}</>`, en: `<玩家伤害>${n.en}</>` } : { zh: `<即时伤害>${n.zh}</>`, en: `<即时伤害>${n.en}</>` };
  const one: FText = d.断开骨骼名 === '格挡' ? { zh: '（格挡）', en: '(Block)' } : d.断开骨骼名 === '闪避' ? { zh: '（闪避）', en: '(Dodge)' } : EMPTY;
  const victim = 函数库_战斗日志.日志__获取角色名(self, self).Output;
  const formA = d.伤害来源 === '环境' || (d.来自角色?.HasMatchingGameplayTag(T.修炼牌) ?? false);
  let text: FText;
  if (formA) {
    // QUIRK: 攻击者 for source 6 is the text at the index of 断开骨骼名 in ['地刺'] (empty for any other marker).
    const attacker = d.伤害来源 === '环境' ? (d.断开骨骼名 === '地刺' ? { zh: '地刺', en: 'Ground Spikes' } : EMPTY) : 函数库_战斗日志.日志__获取角色名(self, d.来自角色).Output;
    text = { zh: `<强调>${attacker.zh}</>对<强调>${victim.zh}</>造成了${zero.zh}伤害。${one.zh}`, en: `<强调>${attacker.en}</> dealt ${zero.en} Damage to <强调>${victim.en}</>.${one.en}` };
  } else {
    const skill = 函数库_战斗日志.日志__获取能力名(self, d.来自技能).Output;
    text = { zh: `<技能>“${skill.zh}”</>对<强调>${victim.zh}</>造成了${zero.zh}伤害。${one.zh}`, en: `<技能>“${skill.en}”</> dealt ${zero.en} Damage to <强调>${victim.en}</>.${one.en}` };
  }
  if (rec) {
    rec.文本 = text;
    self.fx.ui({ op: 'update', widget: 'UI_日志词条', data: { id: rec.id, rich: text.zh } }); // 激活词条()
    return;
  }
  const entry = 输出日志(self, text);
  if (entry) { entry.科学数记录 = shown; records.set(d.来自角色, entry); }
}

/** 清空日志数据 (L377): called at 退出战斗状态. */
export function 清空日志数据(self: BP_ManeActor): void {
  即时受伤来源回合记录(self).clear();
  持续受伤来源回合记录(self).clear();
}

export function 日志__获取能力名(_ctx: BpObject, 能力: 蓝图_能力 | null): { Output: FText } {
  return { Output: 能力 && 能力.valid ? 能力.额外描述[0] ?? EMPTY : EMPTY };
}

export function 日志__获取角色名(_ctx: BpObject, 角色: BP_ManeActor | null): { Output: FText } {
  return { Output: 角色?.描述[0] ?? EMPTY };
}

/**
 * 日志//输出: passes when (需求 empty or 输出者 has any of it) and (排除 empty or 输出者 has none of it); creates the
 * UI_日志词条, adds it to the combat log and returns it. The debug PrintText is dropped.
 */
export function 日志__输出(ctx: BpObject, 输出文本: FText, 输出者: BpObject | null, 标签需求: TagSet, 标签排除: TagSet): 日志词条 | null {
  const tags = 输出者?.OwnedGameplayTags;
  const need = tags ? tags.hasAny(标签需求.toArray()) : false;
  const excl = tags ? tags.hasAny(标签排除.toArray()) : false;
  if (!((need || 标签需求.size === 0) && (!excl || 标签排除.size === 0))) return null;
  const entry: 日志词条 = { id: ctx.world.nextId(), 文本: 输出文本, 科学数记录: { 系数: 0, 指数: 0 } };
  ctx.fx.log({ rich: 输出文本.zh });
  return entry;
}

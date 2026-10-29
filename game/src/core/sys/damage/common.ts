/**
 * Shared pieces of module `damage`: stat reads, the inline "spawn an effect on self" pattern the BP_ManeActor damage
 * functions repeat at every site, and the actor-side tables the generated declarations do not carry yet.
 * Sources: dump/blueprints-pseudo/CatapultHero/BP/Actor/BP_ManeActor.txt (受到即时伤害 L2766–L5822, 免疫处理 L525–L3227,
 * 受到持续伤害 L2934–L14189, 持续伤害生效 L3302–L10008); draft damage-crit-weakspot.
 */
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../bp/index.ts';
import { make效果配置, type 伤害, type 效果配置 } from '../../bp/structs.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import type { 科学数 } from '../../math/sci.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import { BP_Actor_Card } from '../../sim/card.ts';
import type { BpObject } from '../../sim/object.ts';
import type { AssetPath, Tag } from '../../sim/types.ts';

export const FX = 'CatapultHero/BP/Skill/效果/';
export const 效果 = {
  受伤: `${FX}蓝图_效果_受伤`,
  闪烁: `${FX}蓝图_效果_闪烁`,
  持续伤害: `${FX}蓝图_效果_持续伤害`,
  格挡: `${FX}蓝图_效果_格挡`,
  闪避: `${FX}蓝图_效果_闪避`,
  免疫抵消伤害时: `${FX}蓝图_效果_免疫抵消伤害时`,
  死亡特效: `${FX}玩家/蓝图_效果_死亡特效`,
  物品被使用: `${FX}道具/蓝图_效果_物品被使用`,
  弱点: `${FX}敌人/蓝图_效果_弱点`,
} as const satisfies Record<string, AssetPath>;

export const T = {
  玩家: '可交互.角色.玩家',
  仇恨: '可交互.角色.AI.仇恨',
  首领: '可交互.角色.AI.仇恨.首领',
  物品AI: '可交互.角色.AI.物品',
  有物理: '可交互.角色.AI.有物理',
  修炼牌: '可交互.修炼牌',
  免疫: '状态.免疫',
  减益: '效果.类型.减益',
} as const satisfies Record<string, Tag>;

/** 获取科学映射词条(词条, key).输出值 (absent → 0). */
export function stat(a: BP_ManeActor, key: string): 科学数 {
  return 获取科学映射词条(a.词条, key).输出值;
}

/** An effect list as the dispatch helpers take it (stale and null slots stay; the helpers IsValid each entry). */
export const live = (l: (蓝图_效果 | null)[]): 蓝图_效果[] => l as 蓝图_效果[];

/** UE struct assignment copies; our structs are plain objects. */
export function copy伤害(d: 伤害): 伤害 {
  return { ...d };
}

/** A 效果配置 literal as the blueprints build it (MakeStruct 结构_效果): 触发间隔 1, 叠加层数 1, not unique. */
export function cfg(效果类: AssetPath, 持续时间: number, 持续回合 = -1, 叠加上限 = 1): 效果配置 {
  return make效果配置({ 效果类, 持续时间, 触发间隔: 1, 持续回合, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限 });
}

export type AttachResult =
  | { readonly kind: 'gone' }                                   // self invalid or dead: the caller's failure exit
  | { readonly kind: 'merged'; readonly effect: 蓝图_效果 | null } // 附加效果前处理 says no new effect is needed
  | { readonly kind: 'failed' }                                 // "效果生成失败"
  | { readonly kind: 'new'; readonly effect: 蓝图_效果 };

export interface AttachOptions {
  /** 来自技能 written on the new effect and used for its name. */
  readonly 来自技能: 蓝图_能力 | null;
  /** 释放者 written on the new effect (omitted by some sites: left at its CDO default). */
  readonly 释放者?: BP_ManeActor | null;
  /** The object the site passes to GetObjectClass for the 装上/卸下 tags (None at several sites). */
  readonly classOf: BpObject | null;
  /** The sites test `IsValid(self) && (!checkDead || !self.死掉了？)` before applying. */
  readonly checkDead: boolean;
}

/**
 * The inline spawn the damage functions repeat (e.g. 受到即时伤害 L2766–L5822): 获取效果名, the self/dead guard,
 * 附加效果前处理, deferred spawn with 拥有者 / 释放者 / 来自技能 / 持续时长 / 触发间隔 / 持续回合 / 叠加层数 / 临时？ false,
 * 效果名字, the 装上/卸下 tags when GetObjectClass(classOf) is BP_Actor_Equip or BP_Actor_Card (else 能力.类型.天赋 for a
 * talent skill), AddUnique to 拥有的效果 and the attachment. Activation is left to the caller (its merged-instance branch
 * differs per site).
 */
export function attachEffect(self: BP_ManeActor, c: 效果配置, o: AttachOptions): AttachResult {
  const w = self.world;
  const { 效果名字 } = 函数库_技能.获取效果名(self, o.来自技能, c.效果类);
  if (!w.isValid(self) || (o.checkDead && self.死掉了)) return { kind: 'gone' };
  const pre = 函数库_工具.附加效果前处理(self, c, self, 效果名字);
  if (pre.不需附加新效果) return { kind: 'merged', effect: pre.效果实例 };
  if (!c.效果类) return { kind: 'failed' };
  const e = w.spawn<蓝图_效果>(c.效果类, x => {
    x.拥有者 = self;
    if (o.释放者 !== undefined) x.释放者 = o.释放者;
    x.来自技能 = o.来自技能;
    x.持续时长 = c.持续时间;
    x.触发间隔 = c.触发间隔;
    x.持续回合 = c.持续回合;
    x.叠加层数 = c.叠加层数;
    x.临时 = false;
  });
  if (!w.isValid(e)) return { kind: 'failed' };
  e.效果名字 = 效果名字;
  const cls = (o.classOf?.constructor as { path?: AssetPath } | undefined)?.path;
  if ((cls === BP_Actor_Card.path || cls === 'CatapultHero/BP/Actor/BP_Actor_Equip') && !e.临时) {
    e.OwnedGameplayTags.add('效果.时机.装上');
    e.OwnedGameplayTags.add('效果.时机.卸下');
  } else if (w.isValid(o.来自技能) && o.来自技能.是天赋) {
    e.OwnedGameplayTags.add('能力.类型.天赋');
  }
  if (!self.拥有的效果.includes(e)) self.拥有的效果.push(e);
  e.K2_AttachToActor(self);
  return { kind: 'new', effect: e };
}

/** The effect the site activates: the merged instance when 附加效果前处理 found one, else the new one. */
export function activated(r: AttachResult): 蓝图_效果 | null {
  return r.kind === 'new' || r.kind === 'merged' ? r.effect : null;
}

/** One record of 即时受伤来源回合记录: the UI_日志词条 the line lives in (文本 and 科学数记录 are its variables). */
export interface 日志词条 {
  readonly id: number;
  文本: { zh: string; en: string };
  科学数记录: 科学数;
}

/**
 * Actor variables of BP_ManeActor the generator skipped (widget-typed): 即时受伤来源回合记录 / 持续受伤来源回合记录
 * (BP_ManeActor L379). They live on the actor under their Demo names until core-contracts declares them.
 */
interface LogTables { 即时受伤来源回合记录?: Map<BP_ManeActor | null, 日志词条>; 持续受伤来源回合记录?: Map<BP_ManeActor | null, 日志词条> }
export function 即时受伤来源回合记录(a: BP_ManeActor): Map<BP_ManeActor | null, 日志词条> {
  const t = a as unknown as LogTables;
  return (t.即时受伤来源回合记录 ??= new Map());
}
export function 持续受伤来源回合记录(a: BP_ManeActor): Map<BP_ManeActor | null, 日志词条> {
  const t = a as unknown as LogTables;
  return (t.持续受伤来源回合记录 ??= new Map());
}

/** The location the popups and VFX use (the hit point when set, else the actor). */
export function popupAt(a: BP_ManeActor, d: 伤害): { x: number; y: number; z: number } {
  const p = d.击中点位置;
  return p.x === 0 && p.y === 0 && p.z === 0 ? a.K2_GetActorLocation() : p;
}

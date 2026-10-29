/**
 * Outgoing damage: 造成即时伤害, 造成持续伤害, 伤害加成, 计算基础伤害倍率, 会心判断, 会心触发 (BP_ManeActor) and the
 * BP_Actor_Card overrides. Draft damage-crit-weakspot DAMAGE-010…034; pseudo BP_ManeActor.txt lines 232–302, 760–852,
 * 1243–1298, 2776–2854, 3802–3882; BP_Actor_Card.txt L34086 / L34116.
 */
import type { 蓝图_能力 } from '../../ability/ability.ts';
import { fireLive } from '../../ability/dispatch.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import type { 伤害 } from '../../bp/structs.ts';
import { sciOf, 科学数乘除, 科学数加减, 科学数变普通, 科学数零, type 科学数 } from '../../math/sci.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { BpObject } from '../../sim/object.ts';
import type { 枚举_伤害来源, 枚举_伤害类型 } from '../../../content/demo/types.ts';
import { copy伤害, live, stat, T } from './common.ts';

/** DAMAGE-011 (L3802–L3882). */
export function 造成即时伤害(self: BP_ManeActor, 伤害数据: 伤害, 指定特效: boolean, 无法暴击: boolean): void {
  self.当前造伤数据 = copy伤害(伤害数据);
  if (!self.world.isValid(伤害数据.目标角色)) return; // line 3807
  fireLive(live(self.拥有的效果), '效果.时机.造成伤害前', e => { e.伤害数据 = copy伤害(self.当前造伤数据); }); // L126
  const d = self.当前造伤数据;
  const r = self.伤害加成(d.伤害来源, d.伤害类型, d.伤害数值, d.触发次数, d.来自技能, d.目标角色, 无法暴击); // L867
  const cur = self.当前造伤数据;
  // QUIRK (line 3830): the rebuilt struct forces 所需回合 = 3 whatever the caller passed.
  const out: 伤害 = { ...cur, 是暴击: r.暴击, 伤害数值: r.输出, 所需回合: 3 };
  self.当前造伤数据 = out;
  const target = out.目标角色;
  if (!target) return;
  const { 成功了 } = target.受到即时伤害(out, true, 指定特效); // line 3847
  if (!成功了) return;
  self.当前攻击命中 = self.攻击中;
  fireLive(live(self.拥有的效果), '效果.时机.造成伤害后', e => { e.伤害数据 = copy伤害(self.当前造伤数据); }); // L1779
}

/** DAMAGE-022 (L2776–L2854): the DoT variant; 来自发射物 forced to None, 所需回合 kept. */
export function 造成持续伤害(self: BP_ManeActor, 伤害数据: 伤害, 指定特效: boolean, 无法暴击: boolean): void {
  self.当前造伤数据 = copy伤害(伤害数据);
  fireLive(live(self.拥有的效果), '效果.时机.造成伤害前', e => { e.伤害数据 = copy伤害(self.当前造伤数据); });
  const d = self.当前造伤数据;
  const r = self.伤害加成(d.伤害来源, d.伤害类型, d.伤害数值, d.触发次数, d.来自技能, d.目标角色, 无法暴击); // L819
  const cur = self.当前造伤数据;
  self.当前造伤数据 = { ...cur, 是暴击: r.暴击, 伤害数值: r.输出, 来自发射物: null };
  const target = self.当前造伤数据.目标角色;
  if (!target) return;
  const { 成功了 } = target.受到持续伤害(self.当前造伤数据, 指定特效);
  if (!成功了) return;
  self.当前攻击命中 = self.攻击中;
  fireLive(live(self.拥有的效果), '效果.时机.造成伤害后', e => { e.伤害数据 = copy伤害(self.当前造伤数据); }); // L1726
}

const TYPE_BONUS: Readonly<Record<枚举_伤害类型, string | null>> = {
  物理: null, 流血: '流血伤害%', 中毒: '剧毒伤害%', 燃烧: null, 爆炸: '元素伤害%', 剑气: '元素伤害%', 电击: '元素伤害%', 抓钩: null,
};

/** DAMAGE-012/013/018 (L760–L818): crit roll first (and its triggers), then the four buckets. */
export function 伤害加成(
  self: BP_ManeActor, 伤害来源: 枚举_伤害来源, 伤害类型: 枚举_伤害类型, 基础值: 科学数, 触发次数: number,
  来自技能: 蓝图_能力 | null, 目标角色: BP_ManeActor | null, 无法暴击: boolean,
): { 输出: 科学数; 暴击: boolean } {
  let 会心次数 = 0;
  const 总次数 = 触发次数;
  if (无法暴击) {
    self.当前是暴击 = false;
  } else { // L2354
    const r = self.会心判断(总次数);
    self.当前是暴击 = r.触发;
    会心次数 = r.会心次数;
    // SPEC-GAP: 来自技能 None reads 能力名 as 'None' in UE; our debug string is 'None' too.
    if (self.当前是暴击) self.会心触发(会心次数, self, 来自技能?.能力名 ?? 'None');
  }
  // L98: buckets read after 会心触发, so a crit trigger can raise them for this hit (DAMAGE-033).
  const typeKey = TYPE_BONUS[伤害类型];
  const a4 = 科学数加减(typeKey ? stat(self, typeKey) : 科学数零, stat(self, '持续伤害%'), false); // DAMAGE-014
  const a2 = 目标角色?.是精英 ? stat(self, '精英伤害%') : 科学数零;
  const a3 = 伤害来源 === '投射物' ? stat(self, '投射伤害%') : 科学数零;
  const { 倍率值 } = self.计算基础伤害倍率([stat(self, '额外伤害%'), a2, a3, a4]);
  const normal = sciOf(总次数 - 会心次数, 0);
  const crits = sciOf(会心次数, 0);
  const mb = 科学数乘除(倍率值, 基础值, false);
  const mbc = 科学数乘除(mb, stat(self, '暴击伤害%'), false);
  const 输出 = 科学数加减(科学数乘除(crits, mbc, false), 科学数乘除(normal, mb, false), false);
  return { 输出, 暴击: self.当前是暴击 };
}

/** DAMAGE-017 (L821–L852): Π(1 + aᵢ) from 1. */
export function 计算基础伤害倍率(_self: BP_ManeActor, 倍率数组: 科学数[]): { 倍率值: 科学数 } {
  let m = sciOf(1, 0);
  for (let i = 0; i < 倍率数组.length; i++) m = 科学数乘除(科学数加减(倍率数组[i], sciOf(1, 0), false), m, false);
  return { 倍率值: m };
}

/** DAMAGE-026 (L1243–L1298): one PRD batch on the actor's 暴击保护计数, stats per crit. */
export function 会心判断(self: BP_ManeActor, 触发次数: number): { 触发: boolean; 会心次数: number } {
  let 会心次数统计 = 0;
  if (!(触发次数 > 0)) return { 触发: false, 会心次数: 0 };
  if (!(科学数变普通(stat(self, '暴击率%')) > 0)) return { 触发: false, 会心次数: 0 };
  if (科学数变普通(stat(self, '暴击率%')) >= 1) {
    会心次数统计 = 触发次数;
    self.暴击保护计数 = 1;
  } else { // L805
    const r = 函数库_工具.PRD概率判断_批量(self, 科学数变普通(stat(self, '暴击率%')), self.暴击保护计数, 触发次数);
    会心次数统计 = r.成功次数;
    self.暴击保护计数 = r.更新触发计数;
  }
  for (let i = 0; i <= 会心次数统计 - 1; i++) self.world.mode.更新回合战斗统计('触发会心', sciOf(1, 0), 25, 2, '速降衰减', ''); // L515
  if (!(会心次数统计 > 0)) return { 触发: false, 会心次数: 0 }; // L1086
  self.更新角色战斗统计('触发会心', sciOf(会心次数统计, 0));
  return { 触发: true, 会心次数: 会心次数统计 };
}

/** DAMAGE-030 (L232–L302): only item cards fire 有物品会心时 (player) and 自身会心时 (self). */
export function 会心触发(self: BP_ManeActor, 会心次数: number, 当前触发会心的牌: BP_ManeActor | null, _Debug: string): void {
  const cult = self.world.cult;
  cult.当前触发会心的牌 = 当前触发会心的牌;
  const card = cult.当前触发会心的牌;
  if (!(card?.HasMatchingGameplayTag(T.修炼牌) && 会心次数 > 0)) {
    // L1350: PrintString("错误触发会心//" + Debug), a debug print with no loc key; no trigger fires.
    return;
  }
  const hero = self.world.mode.玩家角色;
  if (hero) fireLive(live(hero.拥有的效果), '效果.时机.有物品会心时', e => { e.触发次数 = 会心次数; }); // L345
  fireLive(live(self.拥有的效果), '效果.时机.自身会心时', e => { e.触发次数 = 会心次数; }); // L1564
}

/** BP_Actor_Card L34116 / L34086. QUIRK: the card overrides call the parent with 无法暴击？ = false. */
export function card造成即时伤害(self: BP_Actor_Card, 伤害数据: 伤害, 指定特效: boolean, _无法暴击: boolean): void {
  造成即时伤害(self, 伤害数据, 指定特效, false);
}
export function card造成持续伤害(self: BP_Actor_Card, 伤害数据: 伤害, 指定特效: boolean, _无法暴击: boolean): void {
  造成持续伤害(self, 伤害数据, 指定特效, false);
}

/** 函数库_工具.计算暴击伤害 is an empty stub in the Demo (DAMAGE-150, [Tool] 2644–2647): outputs keep their defaults. */
export function 计算暴击伤害(_ctx: BpObject, _伤害来源: BP_ManeActor | null, _原始伤害: number): { 是暴击: boolean; 伤害值: number } {
  return { 是暴击: false, 伤害值: 0 };
}

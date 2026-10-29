/**
 * Damage over time: 受到持续伤害, 持续伤害生效, 结算持续伤害, 更新剩余持续伤害, 移除剩余持续伤害, 移除减益效果
 * (BP_ManeActor), 计算持续伤害详情 (BP_Actor_Player), 函数库_技能 查询持续伤害 / 判断目标可合并持续伤害.
 * Draft combat-statuses COMBAT-011/012/069…093; pseudo BP_ManeActor.txt lines 1016–1042, 1349–1400, 1693–1995,
 * 2145–2235, 2236–2775, 2693; BP_Actor_Player.txt 455–520; 函数库_技能.txt 121–133, 701–731.
 */
import type { 蓝图_能力 } from '../../ability/ability.ts';
import { fireLive } from '../../ability/dispatch.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import type { 伤害 } from '../../bp/structs.ts';
import { sciOf, 比较科学数_纯正, 科学数乘除, 科学数加减, 科学数零, 限制科学数, type 科学数 } from '../../math/sci.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { BpObject } from '../../sim/object.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { 枚举_伤害来源, 枚举_伤害类型, 结构_持续伤害 } from '../../../content/demo/types.ts';
import { attachEffect, cfg, copy伤害, live, stat, T, 效果 } from './common.ts';
import { abbreviate, typeLabel, 输出日志 } from './log.ts';

const 一 = sciOf(1, 0);

/** The variables of 蓝图_效果_持续伤害 this module reads (the class lives in content). */
export interface 持续伤害实例 extends 蓝图_效果 {
  持续伤害总值: 科学数; 新增值: 科学数; 类型: 枚举_伤害类型; 来源: 枚举_伤害来源; 每回合伤害: 科学数; 诞生数据: string;
  剩余伤害: 科学数; 可合并: boolean;
}
const asDot = (e: 蓝图_效果 | null | undefined): 持续伤害实例 | null => (e && '剩余伤害' in e ? (e as 持续伤害实例) : null);

/** COMBAT-011 (L2236–L2775). */
export function 受到持续伤害(self: BP_ManeActor, 伤害数据: 伤害, 指定特效: boolean): { 成功了: boolean } {
  const fail = { 成功了: false };
  if (self.死掉了) return fail;
  self.当前受伤数据 = copy伤害(伤害数据);
  fireLive(live(self.拥有的效果), '效果.时机.受到伤害前', e => { e.伤害数据 = copy伤害(self.当前受伤数据); }); // L93
  if (self.免疫处理().免疫了) return fail; // L834
  if (!self.闪避处理().闪避了) self.格挡处理(); // L887 / L2626
  self.当前受伤数值 = self.当前受伤数据.伤害数值; // L924
  if (!(self.当前受伤数值.系数 > 0)) return fail; // L2728
  self.输出受伤日志(); // COMBAT-082: before the reductions
  const f = 科学数乘除(科学数加减(一, stat(self, '伤害减免%'), true), 科学数加减(一, stat(self, '持续减免%'), true), false);
  self.当前受伤数值 = 科学数乘除(f, self.当前受伤数值, false);
  if (!(self.当前受伤数值.系数 > 0)) return fail; // L2744
  fireLive(live(self.拥有的效果), '效果.时机.受到伤害后', e => { e.伤害数据 = copy伤害(self.当前受伤数据); }); // L1885
  if (!self.HasMatchingGameplayTag(T.玩家)) self.当前受伤数据.来自角色?.更新角色战斗统计('造成伤害', self.当前受伤数据.伤害数值); // L11308
  // L2825
  if (self.当前受伤数据.所需回合 === -1) {
    self.失去生命_护甲(self.当前受伤数值, 科学数零, true);
  } else { // L6826
    const m = 函数库判断目标可合并持续伤害(self, self.world.mode, self, self.当前受伤数据.来自角色, self.当前受伤数据.来自技能, self.当前受伤数据.伤害类型);
    const found = asDot(m.找到的实例);
    if (m.找到了 && found) {
      found.新增值 = self.当前受伤数值;
      found.可合并 = true;
      found.激活效果('');
    } else { // L7093: a new instance with 释放者 = 来自角色, 来自技能 = 空技能
      const c = cfg(效果.持续伤害, -1, self.当前受伤数据.所需回合, 999);
      const r = attachEffect(self, c, { 来自技能: self.空技能, 释放者: self.当前受伤数据.来自角色, classOf: self.当前受伤数据.来自角色, checkDead: true });
      if (r.kind === 'gone') return fail;
      if (r.kind !== 'new' && r.kind !== 'merged') return fail;
      const inst = asDot(r.effect);
      if (!inst) return fail; // the Cast fails: pop_flow
      inst.诞生数据 = m.诞生数据;
      inst.新增值 = 比较科学数_纯正(self.当前受伤数值, sciOf(4, 0), false); // COMBAT-072: at least 4, only for new instances
      inst.来源 = self.当前受伤数据.伤害来源;
      inst.类型 = self.当前受伤数据.伤害类型;
      inst.可合并 = false;
      self.持续伤害实例映射.set(inst.诞生数据, inst);
      inst.激活效果('');
    }
  }
  // L2934: 闪烁 (no 攻击中 test here), then the hit VFX, then 受伤.
  // QUIRK: here 受伤 is spawned with 持续时间 −1, so its 受伤中？ gate stays closed until something destroys it.
  const d = self.当前受伤数据;
  const flash = attachEffect(self, cfg(效果.闪烁, -1), { 来自技能: d.来自技能, classOf: null, checkDead: true });
  if (flash.kind !== 'new') return fail;
  flash.effect.激活效果('');
  if (!指定特效) self.受击特效处理(d.击中点位置, d.击中点法线, d.伤害类型); // L11463
  const hurt = attachEffect(self, cfg(效果.受伤, -1), { 来自技能: d.来自技能, 释放者: d.来自角色, classOf: d.来自角色, checkDead: true });
  if (hurt.kind !== 'new') return fail;
  hurt.effect.激活效果('');
  return { 成功了: true };
}

/** COMBAT-078 (L1693–L1995): one tick of one type; no 受到伤害前/后, Shield applies. */
export function 持续伤害生效(self: BP_ManeActor, 当前受伤数据: 伤害): void {
  if (self.免疫处理().免疫了) return;
  self.当前受伤数据 = { ...当前受伤数据, 伤害来源: '减益', 是弱点: false, 所需回合: 3, 触发次数: 1 };
  self.当前受伤数值 = self.当前受伤数据.伤害数值;
  const n = abbreviate(self, self.当前受伤数值);
  const tag = self.HasMatchingGameplayTag(T.玩家) ? '玩家伤害' : '即时伤害';
  const who = self.描述[0] ?? { zh: '', en: '' };
  const label = typeLabel(self.当前受伤数据.伤害类型);
  输出日志(self, {
    zh: `<强调>${who.zh}</>失去了<${tag}>${n.zh}</>生命。（${label.zh}）`,
    en: `<强调>${who.en}</> lost <${tag}>${n.en}</> Health. (${label.en})`,
  });
  self.失去生命_护甲(self.当前受伤数值, 科学数零, true);
  if (!self.HasMatchingGameplayTag(T.玩家)) self.world.mode.更新回合战斗统计('生效持续伤害', self.当前受伤数值, 5, 5, '平滑衰减', ''); // L3694
  const d = self.当前受伤数据;
  const hurt = attachEffect(self, cfg(效果.受伤, 0.2), { 来自技能: d.来自技能, 释放者: d.来自角色, classOf: d.来自角色, checkDead: true });
  if (hurt.kind !== 'new') return;
  hurt.effect.激活效果('');
  if (self.攻击中) return;
  const flash = attachEffect(self, cfg(效果.闪烁, -1), { 来自技能: d.来自技能, 释放者: d.来自角色, classOf: d.来自角色, checkDead: true });
  if (flash.kind === 'new') flash.effect.激活效果('');
}

/** COMBAT-076 (L2693): tick every DoT instance, then deal the per-type sums capped by the overflow credit. */
export function 结算持续伤害(self: BP_ManeActor): void {
  const 临时 = self.剩余持续性伤害;
  fireLive(live(self.拥有的效果), '效果.时机.主动激活.结算持续伤害'); // L78
  const values = [...self.当前回合持续伤害结算.values()];
  for (let i = 0; i < values.length; i++) { // L829
    const cap = 科学数加减(临时, self.溢出的治疗量, true);
    const dmg = 比较科学数_纯正(values[i].伤害数值, cap, true);
    if (!(dmg.系数 > 0)) { self.移除剩余持续伤害(); break; } // L2290
    self.持续伤害生效({ ...values[i], 是弱点: false, 伤害数值: dmg, 触发次数: 1 });
  }
  self.当前回合持续伤害结算.clear(); // L2100
}

/** 更新剩余持续伤害 (L2145): 剩余持续性伤害 = Σ instances' 剩余伤害; the DoT bar refresh is presentation. */
export function 更新剩余持续伤害(self: BP_ManeActor): void {
  let sum = 科学数零;
  for (const e of [...self.持续伤害实例映射.values()]) {
    const d = asDot(e);
    if (d) sum = 科学数加减(d.剩余伤害, sum, false);
  }
  self.剩余持续性伤害 = sum;
  if (!self.HasMatchingGameplayTag(T.玩家)) return;
  // L475: 持续伤害栏 rebuilt from 计算持续伤害详情 and 总持续伤害映射 (UI).
  const hero = self as BP_Actor_Player;
  const r = hero.计算持续伤害详情();
  self.fx.ui({ op: 'update', widget: '持续伤害栏', data: { 剩余: r.剩余持续伤害, 下回合: r.下回合伤害, 类型: [...self.总持续伤害映射.keys()] } });
}

/** COMBAT-091 (L1016–L1042). */
export function 移除剩余持续伤害(self: BP_ManeActor): void {
  for (const e of [...self.持续伤害实例映射.values()]) e?.销毁效果();
  self.溢出的治疗量 = 科学数零; // L351
}

/** COMBAT-092 (L1349–L1400). */
export function 移除减益效果(self: BP_ManeActor): void {
  const snap = [...self.拥有的效果];
  for (let i = 0; i < snap.length; i++) {
    const e = snap[i];
    if (!self.world.isValid(e) || !e.HasMatchingGameplayTag(T.减益)) continue;
    e.触发时机 = T.减益;
    const k = self.拥有的效果.indexOf(e);
    if (k >= 0) self.拥有的效果.splice(k, 1);
    e.销毁效果();
  }
  self.总持续伤害映射.clear();
  self.当前回合持续伤害结算.clear();
  self.持续伤害实例映射.clear();
  self.更新剩余持续伤害(); // L803
}

/** BP_Actor_Player.计算持续伤害详情 (L455–L520). */
export function 计算持续伤害详情(self: BP_Actor_Player): { 剩余持续伤害: 科学数; 下回合伤害: 科学数 } {
  const 真实 = 科学数加减(self.剩余持续性伤害, self.溢出的治疗量, true);
  let next = 科学数零;
  for (const e of [...self.持续伤害实例映射.values()]) {
    const d = asDot(e);
    next = 科学数加减(d ? d.每回合伤害 : 科学数零, next, false);
  }
  return { 剩余持续伤害: 真实, 下回合伤害: 限制科学数(next, 科学数零, 真实) };
}

const 查询类型: readonly 枚举_伤害类型[] = ['中毒', '燃烧', '流血'];
const EMPTY_DOT: 结构_持续伤害 = { 粒子特效: null, 来源数: 0, 剩余值: { 系数: 0, 指数: 0, 值: 0 } };

/** 函数库_技能.查询持续伤害 (L121): '中毒' / '燃烧' / '流血' → 2 / 3 / 1; QUIRK: any other string reads type 0 (物理). */
export function 查询持续伤害(_ctx: BpObject, 目标: BP_ManeActor | null, 类型: string): { 值: 结构_持续伤害; 存在: boolean } {
  const i = (查询类型 as readonly string[]).indexOf(类型);
  const t: 枚举_伤害类型 = i >= 0 ? 查询类型[i] : '物理';
  const v = 目标?.总持续伤害映射.get(t);
  return { 值: v ?? EMPTY_DOT, 存在: v !== undefined };
}

/** 函数库_技能.判断目标可合并持续伤害 (L701): key = 总回合数 + "//" + type name; ignores the source. */
export function 函数库判断目标可合并持续伤害(
  _ctx: BpObject, 游戏模式: 蓝图_动作游戏模式 | null, 目标角色: BP_ManeActor | null, _来自角色: BP_ManeActor | null, _来自技能: 蓝图_能力 | null, 类型: 枚举_伤害类型,
): { 找到了: boolean; 找到的实例: 蓝图_效果 | null; 诞生数据: string } {
  const key = `${游戏模式?.总回合数 ?? 0}//${类型}`;
  const map = 目标角色?.持续伤害实例映射;
  if (map?.has(key)) return { 找到了: true, 找到的实例: map.get(key) ?? null, 诞生数据: key };
  return { 找到了: false, 找到的实例: null, 诞生数据: key };
}


/**
 * Kill resolution: 可死亡检查, 检查死亡 (BP_ManeActor Ubergraph L4510, BP_Actor_Card L37352), 角色死亡 (BP_ManeActor,
 * BP_Actor_Other L13199 → L8845 → L11091 → L13235, BP_Actor_Player L17521), 杀死敌人时, 终结目标, 生成弱点.
 * Draft damage-crit-weakspot DAMAGE-110…119, 141.
 */
import { fireLive } from '../../ability/dispatch.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 函数库_工具, 函数库_战斗日志 } from '../../bp/index.ts';
import { UI_主界面, UI_冒险结束统计页, UI_战斗结束统计页 } from '../../bp/widgets.ts';
import { sciOf, 科学数变普通 } from '../../math/sci.ts';
import { RandomFloatInRange, Array_Shuffle } from '../../rng/ue.ts';
import { BP_ManeActor } from '../../sim/actor.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { BP_Actor_Other } from '../../sim/other.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';
import { TagSet } from '../../sim/tags.ts';
import { attachEffect, cfg, live, stat, T, 效果 } from './common.ts';

/** DAMAGE-110 (L3088). */
export function 可死亡检查(self: BP_ManeActor): { 可死亡: boolean } {
  return { 可死亡: !self.死掉了 && self.当前生命.系数 <= 0 };
}

/** DAMAGE-111 (Ubergraph L4510 → L2283 → L3013 → L3046 → L3772). */
export function 检查死亡(self: BP_ManeActor, 强行死亡: boolean, 不触发时机: boolean): void {
  self.临时数组 = [...self.拥有的效果];
  if (!强行死亡) {
    if (!self.可死亡检查().可死亡) return;
    if (!不触发时机) fireLive(live(self.临时数组), '效果.时机.死亡前'); // L2283: over the copy
    if (!self.可死亡检查().可死亡) return; // L3013: a 死亡前 effect saved the actor
  }
  // L3046: destroy every 减益 of the snapshot.
  for (let i = 0; i < self.临时数组.length; i++) {
    const e = self.临时数组[i];
    if (!self.world.isValid(e) || !e.HasMatchingGameplayTag(T.减益)) continue;
    e.触发时机 = T.减益;
    e.销毁效果();
  }
  // L3772
  const mode = self.world.mode;
  mode.从场上移出_碰撞(self);
  mode.有角色死亡时(self);
  self.更新运动数据();
  self.打断技能(false);
  self.角色死亡();
  self.触发掉落();
}

/** BP_Actor_Card.检查死亡 (L37352): a card dies when forced or when its durability (词条 生命) is 0. */
export function card检查死亡(self: BP_Actor_Card, 强行死亡: boolean, 不触发时机: boolean): void {
  if (self.死掉了) return;
  if (!(强行死亡 || stat(self, '生命').系数 === 0)) return;
  const w = self.world;
  w.mode.有角色死亡时(self);
  self.战斗状态 = false; // L37336
  self.死掉了 = true; // L36882
  self.关闭碰撞();
  self.被抓起(true);
  const cult = w.cult;
  for (const list of [cult.已装备牌, cult.背包里牌, cult.未拾取牌]) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i] === self) list.splice(i, 1); // Array_RemoveItem removes all
  }
  w.mode.添加到延迟销毁(self);
  // Raw UG37266 is EX_LocalFinalFunction BP_ManeActor:被放下, not Card's virtual drop/re-equip path.
  BP_ManeActor.prototype.被放下.call(self, true);
  self.setTickEnabled(false);
  self.fx.ui({ op: 'update', widget: 'actor.hidden', data: { id: self.id, hidden: true } }); // SetActorHiddenInGame
  if (!不触发时机) fireLive(live(self.拥有的效果), '效果.时机.死亡前'); // L56
}

/** BP_ManeActor.角色死亡 is an empty event (L5560). */
export function 角色死亡(_self: BP_ManeActor): void {}

/** DAMAGE-116 (BP_Actor_Other L13199). */
export function other角色死亡(self: BP_Actor_Other): void {
  if (self.死掉了) return;
  const w = self.world;
  const mode = w.mode;
  self.战斗状态 = false;
  self.死掉了 = true; // L8845
  if (self.OwnedGameplayTags.hasAny([T.仇恨, T.物品AI])) {
    // SPEC-GAP: CORE-M-129 row 9 lists this draw (line 492) as `fx`; it sets EXP, so it uses `combat`.
    self.死亡产生经验 = 科学数变普通(stat(self, '经验')) * RandomFloatInRange(w.rng.combat, 0.8, 1.2);
    mode.增加经验(self.死亡产生经验, mode.玩家角色);
    const who = 函数库_战斗日志.日志__获取角色名(self, self).Output;
    const n = groupInt(self.死亡产生经验); // DAMAGE-006: Conv_DoubleToText, no fraction, grouping on
    const item = self.OwnedGameplayTags.hasAny([T.物品AI]);
    const custom = self.指定死亡文本;
    const text = custom.zh !== '' || custom.en !== '' ? custom : item
      ? { zh: `<强调>${who.zh}</>被使用了。（<经验>+${n}经验</>）`, en: `<强调>${who.en}</> was used. (<经验>+${n} EXP</>)` }
      : { zh: `<强调>${who.zh}</>死掉了。（<经验>+${n}经验</>）`, en: `<强调>${who.en}</> died. (<经验>+${n} EXP</>)` };
    函数库_战斗日志.日志__输出(self, text, null, new TagSet(), new TagSet());
  }
  // L11091
  self.更新外观数据();
  mode.添加到墓地(self);
  mode.退出战斗状态('');
  if (self.OwnedGameplayTags.hasAny([T.仇恨, T.物品AI]) && !self.HasMatchingGameplayTag(T.有物理)) {
    // LaunchCharacter (corpse knock-back, DAMAGE-117) is presentation: the death event carries it to the shell.
    self.fx.ui({ op: 'update', widget: 'actor.corpse', data: { id: self.id, speed: mode.玩家角色?.移动当前速度 ?? 0, dir: mode.玩家角色?.速度方向 ?? null } });
    self.物理终止检测();
    mode.更新回合战斗统计('击杀敌人', sciOf(1, 0), 65, 2, '速降衰减', '');
    const v = self.是精英 ? (self.HasMatchingGameplayTag(T.首领) ? -50 : -20) : -10;
    mode.玩家角色?.精神系统(Math.trunc(v / 2), Math.abs(v), '敌人死亡', false);
  } else if (self.OwnedGameplayTags.hasAny(['可交互.角色.AI.物品.玩家', '可交互.角色.AI.物品.不残留', '可交互.角色.AI.商品'])) { // L12531
    const r = attachEffect(self, cfg(效果.物品被使用, -1), { 来自技能: self.空技能, classOf: null, checkDead: true });
    if (r.kind === 'new') r.effect.激活效果('');
    else if (r.kind === 'merged') r.effect?.激活效果('');
  }
  // L13235: every BP_Actor_Other death closes the boss bar (E-19).
  self.fx.ui({ op: 'update', widget: 'UI_首领状态条', data: { anim: '关闭' } });
}

/** DAMAGE-118 (BP_Actor_Player L17521). */
export function player角色死亡(self: BP_Actor_Player): void {
  self.清理UI(false);
  self.死掉了 = true;
  // SetCapsuleHalfHeight / SetCapsuleRadius 80: the corpse collider (presentation only once dead).
  self.更新外观数据();
  self.关闭碰撞();
  self.fx.sound('CatapultHero/音效/音效_死亡', self.当前位置, { volume: 1.5, pitch: 1 });
  if (self.自杀) {
    UI_主界面.打开加载页(self, true, { zh: '我会回来的···', en: "I'll be back..." });
    // Player L17521 -> linkage 185: suicide skips the combat panel and opens the failed run summary.
    self.delay('Player L17521 suicide', 0.5, () => UI_冒险结束统计页.激活冒险统计页面(self, false));
    return;
  }
  self.fx.ui({ op: 'update', widget: '主界面', data: { anim: '回合统计结束' } });
  // QUIRK (L18443): the dead-owner guard is `if (!(false))`, so the effect spawns although 死掉了？ is set.
  const r = attachEffect(self, cfg(效果.死亡特效, -1), { 来自技能: self.空技能, 释放者: self, classOf: null, checkDead: false });
  if (r.kind === 'new') {
    r.effect.激活效果('');
    // Player L21053 plays the imported 0.75-game-second timeline; Finished L15 then waits 1.0 before Failure.
    // This completion is gameplay logic even though the timeline's values drive visual time dilation.
    self.world.bus.emit({ t: self.world.clock.now, kind: 'time.dilation', curve: 'death', from: self.world.clock.now });
    self.timeline('全局时间变速', 'PlayFromStart', {
      finished: () => self.delay('Player L15 death result', 1.0, () => {
        UI_战斗结束统计页.激活战斗统计页面(self, false, false);
        self.timeline('后期处理', 'PlayFromStart');
      }),
    });
  }
}

/** DAMAGE-114 (L1498–L1528). */
export function 杀死敌人时(self: BP_ManeActor, 当前杀死目标: BP_ManeActor | null): void {
  self.当前杀死目标 = 当前杀死目标;
  fireLive(live(self.拥有的效果), '效果.时机.击杀敌人时');
}

/** DAMAGE-119 (L5010–L5042): no callers in the Demo; ported as written. */
export function 终结目标(self: BP_ManeActor): void {
  self.终结目标_Q = false;
  const list = self.当前目标?.拥有的效果 ?? [];
  for (let i = 0; i < list.length; i++) {
    if ((list[i] as 蓝图_效果 | null)?.HasMatchingGameplayTag('状态.终结')) { self.终结目标_Q = true; break; }
  }
  if (self.终结目标_Q) 函数库_工具.使目标执行自身技能(self, 0, self, false);
}

/** DAMAGE-141 (BP_Actor_Other L14316): dormant in the Demo (no caller, empty base array). */
export function 生成弱点(self: BP_Actor_Other, 数量: number): void {
  Array_Shuffle(self.world.rng.combat, self.弱点位置基数); // CORE-M-129 row 10
  for (let i = 0; i <= 数量 - 1; i++) {
    const v = self.弱点位置基数[i] ?? 0; // Array_Get out of range → 0
    if (!self.弱点角度.includes(v)) self.弱点角度.push(v);
  }
  for (const angle of [...self.弱点角度]) {
    const r = attachEffect(self, { ...cfg(效果.弱点, -1, 0) }, { 来自技能: self.空技能, 释放者: self, classOf: null, checkDead: true });
    if (r.kind !== 'new') continue;
    (r.effect as 蓝图_效果 & { 弱点角度: number }).弱点角度 = angle;
    r.effect.激活效果('');
  }
}

/** Conv_DoubleToText(v, HalfToEven, grouping on, 0 fractional digits). */
function groupInt(v: number): string {
  const r = Math.round(v);
  const n = Math.abs(v % 1) === 0.5 ? (Math.floor(v) % 2 === 0 ? Math.floor(v) : Math.ceil(v)) : r;
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

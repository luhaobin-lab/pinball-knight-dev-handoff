/**
 * The player-turn input gate and the hero's interactions (turn-flow §4.5, TURN-041…046), the actor interface events
 * this module owns, and the module's commands, legal list and view slice (ARCHITECTURE §6.5).
 * Demo: 蓝图_主角色控制器 (输入_点击 Completed L8104 → L4635 → L4857 = 进行交互, 根据操作执行技能, 交互角色,
 * 交互到不可拾取物品, 交互到敌人/友军, 交互到有敌人角色), BP_ManeActor (玩家交互 L8254, 被揭示, 被复活/重置, the empty
 * 接口_工具 events), BP_Actor_Card (玩家交互), 蓝图_通用路口 (玩家交互 L3618), 函数库_技能.召唤角色到场上.
 */
import { BP_ManeActor } from '../../sim/actor.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { 蓝图_主角色控制器 } from '../../sim/controller.ts';
import type { 蓝图_通用路口 } from '../../sim/junction.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BP_Actor_Other } from '../../sim/other.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';
import { countdownEnd } from '../../sim/clock.ts';
import { structOf } from '../../bp/structs.ts';
import type { BpObject } from '../../sim/object.ts';
import type { AssetPath, Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import type { CommandHandlers } from '../../api/compose.ts';
import type { CommandResult, CommandSpec } from '../../api/commands.ts';
import type { ActorKind, ActorView, GameView, SkillPreview } from '../../api/view.ts';
import { 函数库_工具, 函数库_科学数 } from '../../bp/index.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { panelState } from './mission.ts';
import { fireLive, frame, isBoss, isHidden, isHostile, setHidden, valid } from './util.ts';

/** TURN-042 steps 3–5 (CTL L4857, the event 进行交互). */
export function 进行交互(self: 蓝图_主角色控制器): void {
  const mode = self.world.mode;
  if (!self.玩家可与环境交互) return;
  if (valid(self.world, self.当前交互对象) && self.目标可点击交互) { self.交互角色(); return; }
  if (!valid(self.world, mode.当前任务实例)) return;
  if (mode.当前环节 !== '交互场牌') return;
  self.根据操作执行技能();
}

/** TURN-043 (CTL ln 164). */
export function 根据操作执行技能(self: 蓝图_主角色控制器): void {
  const w = self.world;
  const hero = self.玩家角色 ?? w.mode.玩家角色;
  if (!hero) return;
  if (self.左_中_右键.x === 1) {
    if (hero.有选中主动技能) {
      const a = hero.当前能力;
      if (!a) return;
      a.检查子条件();
      if (!a.子条件通过) {
        const t = a.额外描述.length === 0 ? '还无法使用。' : (a.额外描述[1]?.zh ?? '');
        w.mode.fx.headUp(hero, { ns: '', key: t });
        return;
      }
      hero.释放技能中 = true;
      hero.有选中主动技能 = false;
      a.释放开始();
      hero.切换指示箭头(false, '实时方向', 320, [], [], structOf('结构_地形选取配置'), null);
      return;
    }
    // L834: the launch needs a valid preview circle 0 starting within 8 uu of the hero (LAUNCH-007).
    if (!launchStartOk(w, hero)) return;
    const r = 函数库_工具.使目标执行自身技能(self, 0, hero, false);
    if (r.条件通过 || w.mode.当前环节 !== '交互场牌') return;
    hero.打断当前动画(true); // L1482: TURN-053 (b)
    return;
  }
  if (hero.有选中主动技能) {
    hero.有选中主动技能 = false;
    hero.切换指示箭头(false, '固定方向', 60, [], [], structOf('结构_地形选取配置'), null);
  } // L525: right button cancels; 更新技能栏 is presentation
}

/**
 * 碰撞预览圈数组[0] valid and |当前起点位置 − 玩家位置| ≤ 8. SPEC-GAP: the preview circles are launch's (core-launch-sys);
 * while it keeps none, the core computes the preview from the hero's current position, so the start is the hero.
 */
function launchStartOk(w: World, hero: BP_ManeActor & { 碰撞预览圈数组?: (BpObject | null)[] }): boolean {
  const circles = hero.碰撞预览圈数组 ?? [];
  if (circles.length === 0) return true;
  const c0 = circles[0] as (BpObject & { 当前起点位置?: Vec3 }) | null;
  if (!valid(w, c0)) return false;
  const s = c0.当前起点位置 ?? c0.K2_GetActorLocation();
  const p = hero.K2_GetActorLocation();
  return Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) <= 8;
}

/** CTL 交互角色 (ln 414): blocked in phases 3 and 10; otherwise the target's 玩家交互 (接口_工具). */
export function 交互角色(self: 蓝图_主角色控制器): void {
  const p = self.world.mode.当前环节;
  if (p === '进行战斗' || p === '选择奖励') return;
  const t = self.当前交互对象 as (BpObject & { 玩家交互?(): void }) | null;
  if (valid(self.world, t) && typeof t.玩家交互 === 'function') t.玩家交互();
}

/** CTL 交互到不可拾取物品 (ln 343): the target releases its own skill 0 (TURN-046). */
export function 交互到不可拾取物品(self: 蓝图_主角色控制器): { 交互成功: boolean } {
  const t = self.当前交互角色;
  if (!t || t.死掉了) return { 交互成功: false };
  return { 交互成功: 函数库_工具.使目标执行自身技能(self, 0, t, false).条件通过 };
}

/** CTL 交互到敌人/友军 (ln 404): legacy grid flow (从场上移出（格子）is unreachable, TURN-113). */
export function 交互到敌人_友军(self: 蓝图_主角色控制器): void {
  const hero = self.玩家角色;
  self.最后交互格子 = self.当前交互角色?.所在格子 ?? null;
  if (!hero) return;
  hero.当前目标 = self.当前交互角色;
  self.world.mode.添加到战场(hero.当前目标);
}

/** CTL 交互到有敌人角色 (ln 333). */
export function 交互到有敌人角色(self: 蓝图_主角色控制器): void {
  const mode = self.world.mode;
  self.最后交互格子 = null;
  const t = self.当前交互角色;
  if (t) { mode.敌方场上 = t.拥有的敌人; t.拥有的敌人 = []; }
  mode.进入战斗状态();
}

/** BP_ManeActor 玩家交互 (L8254). */
export function 玩家交互(self: BP_ManeActor): void {
  const w = self.world;
  const ctl = w.mode.玩家控制器;
  if (!ctl) return;
  if (self.HasMatchingGameplayTag('可交互.角色.AI.商人')) return ctl.交互到商人();
  if (self.HasMatchingGameplayTag('可交互.角色.AI.商品')) return ctl.交互到商品();
  if (self.HasMatchingGameplayTag('可交互.角色.AI.物品.关卡')) {
    if (函数库_工具.获取鼠标位置迷雾信息(self).在迷雾中) return self.fx.headUp(self, { ns: '', key: '我看不清。' });
    ctl.交互到不可拾取物品();
    return;
  }
  if (!(isHostile(self) || self.HasMatchingGameplayTag('可交互.角色.AI.友善'))) return;
  if (w.mode.当前环节 === '交互场牌') ctl.根据操作执行技能();
}

/** BP_Actor_Card 玩家交互 (Card L37628). */
export function 玩家交互_牌(self: BP_Actor_Card): void {
  if (self.world.cult.背包关闭了) self.fx.headUp(self, { ns: '', key: '不能在战斗中调整物品位置。' });
}

/** 蓝图_通用路口 玩家交互 (JCT L3618): a junction waiting for a click is used. 交互路口 is map's (core-map). */
export function 玩家交互_路口(self: 蓝图_通用路口): void {
  if (!(self.未点击 && !self.直接交互)) return;
  self.交互路口();
}

/** BP_ManeActor 被揭示 (MA ln 4518): 被揭示时 on the actor's effects (live). */
export function 被揭示(self: BP_ManeActor): void {
  self.已揭示 = true;
  fireLive(self.world, self.拥有的效果, '效果.时机.被揭示时');
}

/** BP_ManeActor 被复活/重置 (L11806 → L11717). */
export function 被复活_重置(self: BP_ManeActor): void {
  self.死掉了 = false;
  self.移除减益效果();
  self.当前魔力 = { ...self.当前最大魔力 };
  self.当前生命 = { ...self.当前最大生命 };
  self.体力惩罚计数 = 0;
  self.当前护甲值 = { 系数: 0, 指数: 0 };
  self.溢出的治疗量 = { 系数: 0, 指数: 0 };
  self.重置外观();
  self.更新外观数据();
  const g = self.world.mode.墓地;
  for (let i = g.length - 1; i >= 0; i--) if (g[i] === self) g.splice(i, 1);
}

/** 函数库_技能.召唤角色到场上: a summon joins the field at once, visible or not, with no EXP and no price. */
export function 召唤角色到场上(ctx: BpObject, 游戏模式: 蓝图_动作游戏模式 | null, DataTable: AssetPath | null, RowName: string, 位置: Vec3, 开启碰撞: boolean, 默认隐藏: boolean, 是精英: boolean): { 有出生动画: boolean; 出生动画: AssetPath | null; 召唤出来的: BP_Actor_Other | null } {
  const mode = 游戏模式 ?? ctx.world.mode;
  const 成长率 = mode.获取当前层成长率(-1, 0).OutXY;
  const card = mode.生成角色(DataTable, RowName, { x: 0, y: 0, z: 0 }, 'None', 成长率, 是精英).卡牌实例;
  mode.添加到战场(card);
  if (!card) return { 有出生动画: false, 出生动画: null, 召唤出来的: null };
  card.材料掉落 = [];
  函数库_科学数.添加科学映射值(ctx, card.词条, '经验', '', { 系数: 0, 指数: 0 }, false);
  函数库_科学数.添加科学映射值(ctx, card.词条, '价格', '', { 系数: 0, 指数: 0 }, false);
  card.K2_SetActorLocation({ x: 位置.x, y: 位置.y, z: card.高度 });
  if (开启碰撞) card.开启碰撞();
  setHidden(ctx.world, card, 默认隐藏);
  card.已揭示 = true;
  card.更新外观数据();
  const anim = card.精灵动画序列[3] ?? null;
  return { 有出生动画: anim !== null, 出生动画: anim, 召唤出来的: card };
}

// ---------------------------------------------------------------------------------------------------------------
// Commands, legal, view (ARCHITECTURE §6.5)

const ok: CommandResult = { ok: true };
const no = (reason: string): CommandResult => ({ ok: false, reason });

/** Native library extension on the launch facade; keep turn independent of the launch module's implementation. */
interface CommandLaunchLibrary {
  UpdateLaunchPreview(hero: BP_Actor_Player, aim: { x: number; y: number }): unknown;
  CanRelease(hero: BP_ManeActor): boolean;
}

/** The actors a click can reach: the field, the environment interactables (junctions, chests), pickups. */
function clickables(w: World): BpObject[] {
  const m = w.mode;
  const out: BpObject[] = [];
  for (const list of [m.场上所有, m.环境交互物, m.场上可拾取物, m.当前房间实例?.房间装饰品 ?? []] as (BpObject | null)[][]) {
    for (const o of list) if (valid(w, o) && !out.includes(o) && clickable(w, o)) out.push(o);
  }
  const merchant=(m.商店 as (BpObject&{商人?:BpObject|null})|null)?.商人;
  if(merchant&&valid(w,merchant)&&!out.includes(merchant)&&clickable(w,merchant))out.push(merchant);
  return out;
}
function clickable(w: World, o: BpObject): boolean {
  const a = o as BpObject & { 死掉了?: boolean; 已消耗?: boolean; 玩家交互?(): void };
  if (typeof a.玩家交互 !== 'function' || a.死掉了 === true || a.已消耗===true || isHidden(o)) return false;
  // Source controller merchant interaction has a phase12 gate; spent goods are likewise inert.
  if(o.HasMatchingGameplayTag('可交互.角色.AI.商人'))return w.mode.当前环节==='进入商店';
  if(o.HasMatchingGameplayTag('可交互.角色.AI.商品'))return (w.mode.商店 as (BpObject&{可购买数量:number})|null)?.可购买数量!==0;
  if (o.HasMatchingGameplayTag('可交互.角色.AI.物品.关卡')) {
    if (!(o instanceof BP_ManeActor)) return true; // Original decorations implement 接口_工具 directly, without an ability slot.
    const prop = o as BP_ManeActor;
    const skill = prop.拥有的主动能力[0];
    // FT 使目标执行自身技能 L141: an uninterruptible target cannot cast. ABL L6631 rejects an owner already
    // casting; L15763's chant precedes that flag, so the live chant itself is also a pending interaction.
    // Do not call 检查条件 from legal(): that would consume the Demo's RNG on every query (TURN-031).
    return prop.动画可打断 && !prop.释放技能中 && !(valid(w, skill) && valid(w, skill.吟唱效果));
  }
  if (o.def.path === 'CatapultHero/BP/环境/蓝图_通用路口') return (o as 蓝图_通用路口).未点击 && !(o as 蓝图_通用路口).直接交互;
  void w;
  return false;
}

function inRoom(w: World): boolean {
  const p = w.mode.当前环节;
  return valid(w, w.mode.玩家角色) && p !== '进入营地' && p !== '选择地图' && p !== '死亡结算';
}

/**
 * Command input represents a player decision, not clicks swallowed while the Demo is building the room. TURN-002,
 * 012 and 039: settle the room/round before 等待玩家操作; the controller bit can still be true from the camp.
 * CTL 获取点击位置 ln 271–276 additionally refuses a target while the hero is releasing a skill.
 * Keep the lower-level 进行交互 event's original gates unchanged (TURN-042).
 */
function inputReady(w: World): boolean {
  const hero = w.mode.玩家角色;
  const p = w.mode.当前环节;
  return inRoom(w) && !!w.mode.玩家控制器?.玩家可与环境交互 && valid(w, hero) && !hero.死掉了 && !hero.释放技能中
    && p !== '创建房间' && p !== '回合开始' && p !== '回合结束' && !w.modal.current;
}

/**
 * ABL 检查条件 L5794 rejects a live cooldown; 释放开始 L15763 waits for the chant effect before the cast.
 * Ordinary 可控挥击 has a source 0.1 s cooldown (DT技能_默认). A very short/blocked path can finish first, so
 * CommandSpec must wait for that timed effect instead of promising another usable release at the same sim time.
 * Keep the low-level CTL failed-click branch intact; do not inspect cached 本技能可释放 or call RNG-bearing checks.
 */
function launchTimingReady(w: World, hero: BP_Actor_Player): boolean {
  if (hero.有选中主动技能) return true;
  // 函数库_工具.使目标执行自身技能 L141 requires 动画可打断. A short recoil can finish after the turn state
  // has reopened input; let its existing callback run before advertising another actionable launch.
  if (!hero.动画可打断) return false;
  const ability = hero.拥有的主动能力[0];
  if (!valid(w, ability)) return true; // Missing-skill handling remains the source controller's responsibility.
  if (valid(w, ability.吟唱效果)) return false;
  const cooldown = ability.冷却效果;
  return !(valid(w, cooldown) && cooldown.持续回合 < 0 && cooldown.持续时长 > 0);
}

/** UI_技能格 L3340: only the player's idle combat-input phase with enemies permits a slot press.
 * Keep legal/view pure: the actual press runs source 检查子条件/检查条件 via the tool facade, including its RNG.
 */
export function activeSlotReady(w: World, slot: number): boolean {
  const hero = w.mode.玩家角色, ability = hero?.拥有的主动能力[slot];
  return slot >= 1 && slot <= 4 && valid(w, hero) && valid(w, ability) && !hero.死掉了
    && w.mode.当前环节 === '交互场牌' && w.mode.场上有敌人 && !hero.释放技能中 && !hero.有选中主动技能
    && hero.动画可打断 && !valid(w, ability.冷却效果) && !valid(w, ability.吟唱效果);
}

export const commands: CommandHandlers = {
  'aim.release': (w, cmd) => {
    const ctl = w.mode.玩家控制器;
    const hero = w.mode.玩家角色;
    if (!ctl || !hero || !inRoom(w)) return no('no room');
    if (!inputReady(w)) return no('room input is busy');
    if (!launchTimingReady(w, hero)) return no('launch cooldown or chant is pending');
    if (!Number.isFinite(cmd.aim.x) || !Number.isFinite(cmd.aim.y)) return no('bad aim');
    if (hero.有选中主动技能) return commands['skill.target']!(w, { type: 'skill.target', at: cmd.aim });
    if (!hero.有选中主动技能 && w.mode.当前环节 === '交互场牌' && valid(w, w.mode.当前任务实例)) {
      // PL 实时检测 / PC 更新碰撞预览圈 populate the native paths before CTL 根据操作执行技能 L834 checks
      // circle 0 and its <= 8 uu start offset. Capture those paths for this release, using the same absolute aim
      // as game.preview. Hover previews remain pure: only an accepted release allocates the native surface ids.
      const native = (w.sys.launch as { readonly LaunchTrajectoryLibrary?: CommandLaunchLibrary }).LaunchTrajectoryLibrary;
      if (!native) { w.unported('launch.LaunchTrajectoryLibrary'); return no('launch native is unavailable'); }
      if (!native.UpdateLaunchPreview(hero, cmd.aim) || !native.CanRelease(hero)) return no('launch preview is not releasable');
    }
    // The release reaches the gate with no interactable under the cursor (TURN-042 step 4 not taken).
    const p = hero.K2_GetActorLocation();
    ctl.目标位置缓存 = { x: cmd.aim.x, y: cmd.aim.y, z: p.z };
    ctl.弹射计算起点 = p;
    ctl.弹射计算终点 = { x: cmd.aim.x, y: cmd.aim.y, z: p.z };
    const dx = cmd.aim.x - p.x, dy = cmd.aim.y - p.y, len = Math.hypot(dx, dy);
    ctl.弹射方向 = len > 0 ? { x: dx / len, y: dy / len, z: 0 } : { x: 1, y: 0, z: 0 };
    ctl.当前交互对象 = null;
    ctl.当前交互角色 = null;
    ctl.目标可点击交互 = false;
    ctl.左_中_右键 = { x: 1, y: 0 };
    const ordinary = !hero.有选中主动技能;
    const ability = hero.拥有的主动能力[0];
    const previousCooldown = ability?.冷却效果;
    ctl.进行交互();
    // ABL castBody creates the cooldown before executing the launch. Its countdown uses weak ReceiveTick;
    // a stationary launch may end before the source's 0.1 s expires. Keep this action's finite cooldown deadline
    // alive for runUntilInput, with no gameplay callback or frame skips. The cooldown owns/cancels this entry.
    const cooldown = ability?.冷却效果;
    if (ordinary && cooldown !== previousCooldown && valid(w, cooldown) && cooldown.持续回合 < 0 && cooldown.持续时长 > 0) {
      w.clock.at(countdownEnd(w.clock.now, cooldown.剩余时长), () => {}, cooldown);
    }
    return ok;
  },
  interact: (w, cmd) => {
    const ctl = w.mode.玩家控制器;
    if (!ctl || !inRoom(w)) return no('no room');
    if (!inputReady(w)) return no('room input is busy');
    const target = clickables(w).find(o => o.id === cmd.actor);
    if (!target) return no(`actor ${cmd.actor} is not clickable`);
    ctl.当前交互对象 = target;
    ctl.当前交互角色 = target as BP_ManeActor;
    ctl.吸附位置 = target.K2_GetActorLocation(); // CTL获取点击位置: actor command denotes its picked centre; fog samples this point.
    ctl.目标可点击交互 = true;
    ctl.左_中_右键 = { x: 1, y: 0 };
    ctl.进行交互();
    return ok;
  },
  'skill.press': (w, cmd) => {
    const ctl = w.mode.玩家控制器;
    if (!ctl || !inRoom(w)) return no('no room');
    if (!inputReady(w)) return no('room input is busy');
    if (!Number.isInteger(cmd.slot) || cmd.slot < 1 || cmd.slot > 4) return no('bad slot');
    if (!activeSlotReady(w, cmd.slot)) return no('skill slot is busy or cooling down');
    const skill = w.mode.玩家角色!.拥有的主动能力[cmd.slot]!;
    // 页面切换(0,true) closes presentation pages; command routing has already excluded any core modal.
    const result = 函数库_工具.使目标执行指定技能(ctl, skill, w.mode.玩家角色!, skill.HasMatchingGameplayTag('能力.时机.主动.不立刻释放'));
    return result.条件通过 ? ok : no('skill conditions failed');
  },
  'skill.target': (w, cmd) => {
    const ctl = w.mode.玩家控制器;
    if (!ctl || !inRoom(w)) return no('no room');
    if (!inputReady(w)) return no('room input is busy');
    if (!w.mode.玩家角色?.有选中主动技能) return no('no selected skill');
    if (!Number.isFinite(cmd.at.x) || !Number.isFinite(cmd.at.y)) return no('bad skill target');
    const preview = (w.sys.launch as { previewSkill?(w: World, aim: { x: number; y: number }): SkillPreview | null }).previewSkill?.(w, cmd.at);
    if (!preview) return no('skill indicator unavailable');
    ctl.目标位置缓存 = { ...preview.end };
    (w.sys.ability as { updateSkillIndicatorTarget?(hero: BP_ManeActor, at: Vec3): void }).updateSkillIndicatorTarget?.(w.mode.玩家角色, preview.end);
    const p = w.mode.玩家角色!.K2_GetActorLocation();
    const d = { x: cmd.at.x - p.x, y: cmd.at.y - p.y }, length = Math.hypot(d.x, d.y);
    ctl.目标位置向量 = length > 0 ? { x: d.x / length, y: d.y / length, z: 0 } : { x: 1, y: 0, z: 0 };
    ctl.左_中_右键 = { x: 1, y: 0 };
    ctl.根据操作执行技能();
    return ok;
  },
  'skill.cancel': w => {
    const ctl = w.mode.玩家控制器;
    if (!ctl) return no('no controller');
    if (!w.mode.玩家角色?.有选中主动技能) return no('no selected skill');
    ctl.左_中_右键 = { x: 0, y: 1 };
    ctl.根据操作执行技能();
    return ok;
  },
};

export function legal(w: World): CommandSpec[] {
  const out: CommandSpec[] = [];
  const panel = panelState(w.mode);
  if (panel && w.modal.current?.kind === 'panel') {
    out.push({ type: 'panel.continue' });
    if (panel.canRetry) out.push({ type: 'panel.retry' });
    return out;
  }
  const ctl = w.mode.玩家控制器;
  if (!ctl || !inputReady(w)) return out;
  const p = w.mode.当前环节;
  if (p === '交互场牌' && valid(w, w.mode.当前任务实例)) {
    const hero = w.mode.玩家角色;
    if (valid(w, hero) && !hero.有选中主动技能 && launchTimingReady(w, hero)) out.push({ type: 'aim.release' });
    const slots = [1, 2, 3, 4].filter(i => activeSlotReady(w, i));
    if (slots.length) out.push({ type: 'skill.press', params: { slot: slots } });
    if (hero?.有选中主动技能) out.push({ type: 'skill.target' }, { type: 'skill.cancel' });
  }
  if (p !== '进行战斗' && p !== '选择奖励') {
    const ids = clickables(w).map(o => o.id);
    if (ids.length) out.push({ type: 'interact', params: { actor: ids } });
  }
  return out;
}

function actorKind(a: BP_ManeActor): ActorKind {
  if (a.def.path === 'CatapultHero/BP/Actor/BP_Actor_Player') return 'hero';
  if (isBoss(a)) return 'boss';
  if (isHostile(a)) return 'enemy';
  return 'neutral';
}

const num = (s: { 系数: number; 指数: number }): number => 科学数变普通(s);

export function view(w: World): Partial<GameView> {
  const m = w.mode;
  const f = frame(m);
  const field: ActorView[] = [];
  const sourceShop=m.商店 as (BpObject&{商人:BP_ManeActor|null;商品映射:Map<BP_ManeActor,BpObject&{价格显示:boolean;价格:number}>})|null;
  const fieldActors=[...m.场上所有];
  for(const o of m.环境交互物)if(o instanceof BP_ManeActor&&!fieldActors.includes(o))fieldActors.push(o);
  if(sourceShop?.商人&&!fieldActors.includes(sourceShop.商人))fieldActors.push(sourceShop.商人);
  for (const a of fieldActors) {
    if (!valid(w, a)) continue;
    const intent = valid(w, a.当前能力) && isHostile(a)
      ? { skill: a.当前能力.能力名, target: a.当前目标?.id ?? null, text: a.当前能力.描述.zh }
      : null;
    field.push({
      id: a.id, row: a.名字, table: f.tableOf.get(a) ?? '', kind: actorKind(a),
      position: a.K2_GetActorLocation(), radius: a.宽度, height: a.高度, hidden: isHidden(a),
      hp: num(a.当前生命), maxHp: num(a.当前最大生命), armor: num(a.当前护甲值),
      intent, statuses: [], elite: a.是精英, boss: isBoss(a),
      ...(sourceShop?.商品映射.get(a)?.价格显示?{shopPrice:sourceShop.商品映射.get(a)!.价格,shopPriceAt:(()=>{const p=sourceShop.商品映射.get(a)!.K2_GetActorLocation();return{x:p.x-20.33075,y:p.y+16.081781,z:p.z+5.5};})()}:{}),
    });
  }
  for (const a of m.当前房间实例?.房间装饰品 ?? []) {
    if (!valid(w,a) || a instanceof BP_ManeActor || (!clickable(w,a)&&!(a.def.name==='蓝图_装饰品_地铺'&&(a as BpObject&{已消耗:boolean}).已消耗))) continue;
    field.push({id:a.id,row:a.def.name.replace('蓝图_装饰品_',''),table:'',kind:'neutral',position:a.K2_GetActorLocation(),radius:32,height:56,hidden:isHidden(a),hp:1,maxHp:1,armor:0,intent:null,statuses:[],elite:false,boss:false});
  }
  return {
    phase: m.当前环节,
    inputOpen: inputReady(w),
    field,
  };
}

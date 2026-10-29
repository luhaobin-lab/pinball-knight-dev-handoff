/**
 * The turn loop (turn-flow §4.2–§4.8): room ready, turn start with its five passes and the barrier, 新回合后 with the
 * gauge, the enemy-phase hook, action end and its barrier, entering and leaving combat, the round end and its
 * re-entrancy. Demo: 蓝图_动作游戏模式 (房间完毕触发时机 L22197, 新回合前 L21262, 新回合后 L22082, 执行AI行动 L19519 and
 * the functions 新回合触发时机, 加入/退出回合开始, 增长行动度, 进入战斗状态, 退出战斗状态, 等待玩家操作) and BP_ManeActor
 * (加入行动结束, 结束行动, 判断行动力, 添加行动力, 打断当前动画) and BP_Actor_Card (判断行动力, 结束行动).
 */
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BpObject } from '../../sim/object.ts';
import type { AssetPath } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { tutorialTip } from '../../sim/tutorial.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 函数库_工具, 函数库_科学数 } from '../../bp/index.ts';
import { Divide_IntInt, GridSnap_Float } from '../../math/kismet.ts';
import { RandomFloatInRange } from '../../rng/ue.ts';
import { missionCheck } from './mission.ts';
import { rewardHas } from './room.ts';
import { addUnique, fireLive, frame, print, removeItem, valid } from './util.ts';

const 地形_PATH: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_地形';
const 新一天时 = '效果.时机.新一天时';
const TURN_LOG = '<强调>———————————————————</>第<强调>{0}</>回合'; // 576B7E4D4F3A0AFFF61032B4E2DB3576

/** True when the object's class is `path` or derives from it (the manifest parent chain). */
export function isA(world: World, o: BpObject, path: AssetPath): boolean {
  for (let p: AssetPath | null = o.def.path; p; p = world.data.classes[p]?.parent ?? null) if (p === path) return true;
  return false;
}

/** TURN-014 (ubergraph L22197). */
export function 房间完毕触发时机(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  self.回合开始实例.length = 0;
  const tag = '效果.时机.房间完毕时';
  for (let i = 0; i < self.场上所有.length; i++) { // live L22289
    const a = self.场上所有[i];
    if (valid(w, a)) fireLive(w, a.拥有的效果, tag); // live L22478
  }
  if (valid(w, self.玩家角色)) fireLive(w, self.玩家角色.拥有的效果, tag); // live L23706
  self.nextTick('L24519', () => self.新回合前());
}

/** TURN-020 (ubergraph L21262). */
export function 新回合前(self: 蓝图_动作游戏模式): void {
  self.当前环节 = '回合开始';
  self.总回合数 += 1;
  self.当前层回合 += 1;
  self.fx.log({ rich: TURN_LOG.replace('{0}', String(self.总回合数)) });
  if (self.当前层回合 !== 1) self.抽取卡牌到场上_碰撞(10); // L12783: the refill is not awaited
  self.新回合触发时机(); // L12802
}

/** TURN-022: the five passes, then 退出回合开始(None). */
export function 新回合触发时机(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const hero = self.玩家角色;
  const 已触发效果: (蓝图_效果 | null)[] = [];
  // 1. decorations implementing 接口_工具
  const decos = self.当前房间实例?.房间装饰品 ?? [];
  for (let i = 0; i < decos.length; i++) {
    const d = decos[i] as (BpObject & { 新一天时?(): void }) | null;
    if (valid(w, d) && typeof d.新一天时 === 'function') d.新一天时();
  }
  // 2. 结算评分
  hero?.结算评分();
  // 3. equipped cards (live outer loop L560), over a copy of each card's effects
  const equipped = w.cult.已装备牌;
  for (let c = 0; c < equipped.length; c++) {
    const card = equipped[c];
    if (!valid(w, card)) continue;
    for (const e of [...card.拥有的效果]) {
      if (!valid(w, e) || !e.HasMatchingGameplayTag(新一天时)) continue;
      e.触发时机 = 新一天时;
      e.持续效果();
      addUnique(已触发效果, e);
    }
    函数库_工具.清理已销毁效果(self, card.拥有的效果);
    // the card UI refresh is presentation
  }
  // 4. hero effects (copy), then 疲劳结算
  if (valid(w, hero)) {
    for (const e of [...hero.拥有的效果]) {
      if (!valid(w, e) || !e.HasMatchingGameplayTag(新一天时) || 已触发效果.includes(e)) continue;
      e.触发时机 = 新一天时;
      e.持续效果();
      addUnique(已触发效果, e);
    }
    函数库_工具.清理已销毁效果(self, hero.拥有的效果);
    hero.疲劳结算();
  }
  // 5. field actors (live outer loop L3307), over a copy of each actor's effects; no 已触发效果 writes
  for (let i = 0; i < self.场上所有.length; i++) {
    const a = self.场上所有[i];
    if (!valid(w, a)) continue;
    for (const e of [...a.拥有的效果]) {
      if (!valid(w, e) || !e.HasMatchingGameplayTag(新一天时) || 已触发效果.includes(e)) continue;
      e.触发时机 = 新一天时;
      e.持续效果();
    }
    函数库_工具.清理已销毁效果(self, a.拥有的效果);
  }
  // 6. graveyard terrain (live outer loop L4707)
  for (let i = 0; i < self.墓地.length; i++) {
    const g = self.墓地[i];
    if (!valid(w, g)) continue;
    for (const e of [...g.拥有的效果]) {
      if (!valid(w, e) || !e.HasMatchingGameplayTag(新一天时) || !isA(w, e, 地形_PATH) || 已触发效果.includes(e)) continue;
      e.触发时机 = 新一天时;
      e.持续效果();
    }
    函数库_工具.清理已销毁效果(self, g.拥有的效果);
  }
  // 7. the game mode's own exit, once and synchronously (TURN-035)
  self.退出回合开始(null);
}

/** TURN-033 加入回合开始: registers only in phase 0. */
export function 加入回合开始(self: 蓝图_动作游戏模式, 实例: BpObject | null): void {
  if (self.当前环节 === '回合开始') addUnique(self.回合开始实例, 实例);
}

/** TURN-033 退出回合开始. */
export function 退出回合开始(self: 蓝图_动作游戏模式, 实例: BpObject | null): void {
  const w = self.world;
  const 可退出 = valid(w, 实例) ? self.回合开始实例.includes(实例) : true;
  removeItem(self.回合开始实例, 实例);
  for (const x of [...self.回合开始实例]) if (!valid(w, x)) removeItem(self.回合开始实例, x);
  const { 成功, 升级中 } = self.玩家角色 ? self.玩家角色.升级玩家() : { 成功: false, 升级中: false };
  if (成功 || 升级中 || self.回合开始实例.length > 0 || !可退出 || self.当前环节 !== '回合开始') {
    print(w, '退出回合开始失败');
    return;
  }
  self.新回合后();
}

/** TURN-036 (ubergraph L22082 → L20089): phase and gauge, then the mission check. Tutorial tips 1/2/5/9 are wave B. */
export function 新回合后(self: 蓝图_动作游戏模式): void {
  const p = self.当前环节;
  if (p !== '战斗统计' && p !== '选择地图' && p !== '选择路口' && p !== '进行战斗') {
    self.当前环节 = rewardHas(self, '能力.类型.奖励.是商店') || rewardHas(self, '能力.类型.奖励.休息') ? '进入商店' : '交互场牌';
    self.增长行动度(); // L12817
  }
  missionCheck(self); // L7541
  for(const tip of [1,2,5,9])tutorialTip(self.world,tip);
}

/** TURN-037 (GM ln 601). */
export function 增长行动度(self: 蓝图_动作游戏模式): void {
  self.可行动角色.length = 0;
  for (let i = 0; i < self.场上所有.length; i++) { // live L92
    const a = self.场上所有[i];
    if (!a) continue;
    a.添加行动力(false, 0, 1, false, true);
    a.判断行动力('');
  }
}

/** TURN-039. */
export function 等待玩家操作(self: 蓝图_动作游戏模式): void {
  if (self.玩家控制器) self.玩家控制器.玩家可与环境交互 = true;
}

/** TURN-045 (GM ln 4038). */
export function 进入战斗状态(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  if (self.当前环节 !== '交互场牌') return print(w, '没有敌人');
  self.当前环节 = '进行战斗';
  if (self.玩家控制器) self.玩家控制器.玩家可与环境交互 = false; // hover FX off: presentation
  const hero = self.玩家角色;
  if (hero) { hero.战斗状态 = true; hero.疲劳 = 0; }
  self.清理提示映射();
  self.回合评分计数.clear();
  self.回合战斗统计.clear();
  self.回合评分 = 0;
  for (let i = 0; i < self.可行动角色.length; i++) { // live
    const a = self.可行动角色[i];
    if (!a) continue;
    a.战斗状态 = true;
    a.疲劳 = 0;
  }
  const tag = '效果.时机.进入战斗时';
  if (valid(w, hero)) fireLive(w, hero.拥有的效果, tag); // live L1025
  for (let i = 0; i < self.场上所有.length; i++) { // live L1888
    const a = self.场上所有[i];
    if (!a) continue;
    a.更新外观数据();
    fireLive(w, a.拥有的效果, tag); // live L2168
  }
}

/** TURN-065…068 (GM ln 3935). */
export function 退出战斗状态(self: 蓝图_动作游戏模式, DeBug: string): void {
  const w = self.world;
  self.未疲劳计数 = 0;
  self.判断场上内容();
  for (let i = 0; i < self.场上所有.length; i++) { // live L106
    const a = self.场上所有[i];
    if (!a) continue;
    if (!(a.疲劳了 || a.死掉了)) self.未疲劳计数 += 1;
  }
  const hero = self.玩家角色;
  if (!(hero && self.当前环节 === '进行战斗' && self.未疲劳计数 === 0 && hero.疲劳了 && !hero.移动中 && !hero.死掉了)) {
    print(w, DeBug);
    return;
  }
  // TURN-066
  self.当前环节 = '回合结束';
  hero.战斗状态 = false;
  hero.结算持续伤害();
  hero.更新角色数据();
  hero.清空日志数据();
  if (hero.死掉了) return; // E-04
  for (const a of [...self.场上所有]) { // 临时结算数组 (copy)
    if (!a) continue;
    a.战斗状态 = false;
    if (!valid(w, a)) continue;
    a.结算持续伤害();
    if (!valid(w, a)) continue;
    a.更新角色数据();
    a.判断行动力('');
    a.清空日志数据();
  }
  if (self.回合战斗统计.size > 0) { // L2246
    hero.精神系统(0, Divide_IntInt(self.回合评分 - 150, 25), '战斗评分', false);
    // SPEC-GAP: the Demo reads the HUD's 评级文本 (written by rating); SSS iff 回合评分 ≥ 300 (TF-TV-17).
    self.更新轮回战斗统计('获得SSS', Math.min(Divide_IntInt(self.回合评分, 50), 6) === 6 ? 1 : 0);
    // 回合统计结束 animation: presentation
  }
  self.新回合前(); // L2231: synchronous
}

/** TURN-059 (ubergraph L19519 → L12847). The loop counter lives in the ubergraph frame (TURN-068). */
export function 执行AI行动(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  self.AI行动前();
  if (self.可行动角色.length === 0) return; // TURN-060: only the cast loop is skipped
  const f = frame(self);
  f.aiLoopCounter = 0;
  while (f.aiLoopCounter < self.可行动角色.length) { // live L12954
    const i = f.aiLoopCounter;
    const a = self.可行动角色[i];
    if (a && valid(w, a.当前能力)) {
      // CORE-M-129 row 34 (L5781): `level`. Drawn for every actor with an intent, including i = 0 and 无吟唱？ (TURN-059).
      const u = RandomFloatInRange(w.rng.level, 0.1, 0.25);
      a.当前能力.吟唱 = a.当前能力.无吟唱 ? 0 : i * u;
      a.当前能力.释放开始();
    } else if (a) {
      print(w, `${a.名字}无可释放能力`);
      // 切换指示箭头(false, …): presentation
      a.结束行动(null, '');
    }
    f.aiLoopCounter += 1;
  }
}

/** TURN-050 加入行动结束: registers only in phase 3. */
export function 加入行动结束(self: BP_ManeActor, 实例: BpObject | null): void {
  if (self.world.mode.当前环节 === '进行战斗') addUnique(self.行动结束实例, 实例);
}

/** TURN-049 (MA ln 4267). */
export function 结束行动(self: BP_ManeActor, 实例: BpObject | null, DeBug: string): void {
  const w = self.world;
  const 可退出 = valid(w, 实例) ? self.行动结束实例.includes(实例) : true;
  removeItem(self.行动结束实例, 实例);
  for (const x of [...self.行动结束实例]) if (!valid(w, x)) removeItem(self.行动结束实例, x); // 临时清理数值
  if (!(self.行动结束实例.length === 0 && 可退出)) return;
  self.移动中 = false;
  self.疲劳了 = true;
  self.当前行动力 = 函数库_工具.计算除余数(self, self.当前行动力, 0, 100).余数;
  self.反弹角度历史.length = 0;
  fireLive(w, self.拥有的效果, '效果.时机.行动结束后'); // live L848
  w.mode.退出战斗状态(`${self.名字}//${DeBug}`);
}

/** TURN-037 判断行动力 (MA ln 4551). */
export function 判断行动力(self: BP_ManeActor, _来源: string): void {
  const w = self.world;
  self.临时效果计数.length = 0;
  const 僵直 = 函数库_工具.有对应标签效果(self, self.拥有的效果, '状态.僵直').存在;
  self.疲劳了 = 僵直 || self.当前行动力 < 100;
  if (self.疲劳了 || self.HasMatchingGameplayTag('可交互.修炼牌')) removeItem(w.mode.可行动角色, self);
  else addUnique(w.mode.可行动角色, self);
  self.更新外观数据();
}

/** TURN-037 添加行动力 (MA ln 4574). Charge for items (charge-infuse-echocast) goes through the same function. */
export function 添加行动力(self: BP_ManeActor, 属性值_固定值: boolean, 固定值: number, 触发次数: number, 是灌注: boolean, 随机化: boolean): void {
  const w = self.world;
  if (!(self.当前行动力 < 100)) return;
  if (属性值_固定值) {
    self.当前行动力 += 固定值 * 触发次数;
  } else {
    const 僵直 = 函数库_工具.有对应标签效果(self, self.拥有的效果, '状态.僵直').存在;
    if (僵直 || self.行动力 === 0) return print(w, `${self.名字}行动力未添加`); // L902
    // L1238: CORE-M-129 row 16: `combat`. The U is drawn on this path even when 随机化？ is false.
    const u = RandomFloatInRange(w.rng.combat, 0.6, 1.0);
    const 加速 = 函数库_科学数.获取科学映射词条(self, self.词条, '加速冷却%').输出值;
    const base = self.行动力 * (函数库_科学数.科学数变普通(self, 加速).输出 + 1) * 触发次数;
    self.当前行动力 += 随机化 ? GridSnap_Float(base * u, 1) : base;
  }
  fireLive(w, self.拥有的效果, '效果.时机.获得行动力时'); // L223
  if (!是灌注) return; // L1825
  self.上次被灌注值 = 固定值 * 触发次数;
  self.fx.sound('CatapultHero/音效/音效_基础_灌注');
  for (let i = 0; i < self.拥有的效果.length; i++) { // live L2022
    const e = self.拥有的效果[i];
    if (!valid(w, e) || !e.HasMatchingGameplayTag('效果.时机.被灌注时')) continue;
    e.触发时机 = '效果.时机.被灌注时';
    e.触发次数 = 触发次数;
    e.持续中触发('效果.时机.被灌注时');
  }
  self.判断行动力('灌注');
}

/** TURN-053 (b): 打断当前动画 (MA L4334). The controller's StopMovement is out-of-combat movement (TURN-GAP-13). */
export function 打断当前动画(self: BP_ManeActor, 中断技能: boolean): void {
  if (!self.动画可打断) return;
  if (中断技能) {
    self.打断技能(true);
    self.打断蒙太奇();
  }
}

/** BP_Actor_Card.判断行动力 (Card L32066): the base judgement, then a full charge completes (charge-infuse-echocast). */
export function 判断行动力_牌(self: BP_Actor_Card, 来源: string): void {
  const w = self.world;
  判断行动力(self, 来源);
  if (self.疲劳了) return;
  const r = 函数库_工具.计算除余数(self, self.当前行动力, 0, 100);
  if (!r.超出阈值) return;
  w.cult.当前完成充能的牌 = self;
  w.cult.当前完成充能次数 = 函数库_工具.计算除余数(self, self.当前行动力, 0, 100).除数;
  self.当前行动力 = 函数库_工具.计算除余数(self, self.当前行动力, 0, 100).余数;
  for (let i = 0; i < self.拥有的效果.length; i++) { // live L30411
    const e = self.拥有的效果[i];
    if (!valid(w, e) || !e.HasMatchingGameplayTag('效果.时机.自身完成充能')) continue;
    e.触发时机 = '效果.时机.自身完成充能';
    e.触发次数 = w.cult.当前完成充能次数;
    e.持续中触发('效果.时机.自身完成充能');
  }
  self.结束行动(null, ''); // L31270
  self.更新角色战斗统计('完成充能', { 系数: w.cult.当前完成充能次数, 指数: 0 });
}

/** BP_Actor_Card.结束行动 (Card L32564) replaces the base: the hero's 有物品完成充能 effects fire (no barrier, no 退出战斗状态). */
export function 结束行动_牌(self: BP_Actor_Card, _实例: BpObject | null, _DeBug: string): void {
  const w = self.world;
  self.fx.sound('CatapultHero/音效/音效_基础_充能完毕');
  self.fx.flash(self, 0.2); // 卡牌信息UI.触发闪烁: SPEC-GAP the flash length is widget data
  const hero = w.mode.玩家角色;
  if (!valid(w, hero)) return;
  for (let i = 0; i < hero.拥有的效果.length; i++) { // live L32724
    const e = hero.拥有的效果[i];
    if (!valid(w, e) || !e.HasMatchingGameplayTag('效果.时机.有物品完成充能')) continue;
    e.触发时机 = '效果.时机.有物品完成充能';
    e.触发次数 = w.cult.当前完成充能次数;
    e.持续中触发('效果.时机.有物品完成充能');
  }
}

/**
 * Module `sim` (WAVE_A Appendix W2, card core-sim): 蓝图_动画结算 (the settlement trees, ARCHITECTURE §4.7,
 * TURN-012/013/050) and the game mode's 开始动画结算, 清理动画结算, 获取场景中物体, ReceiveBeginPlay, ReceiveTick.
 * Demo: dump/blueprints-pseudo/CatapultHero/BP/动画/蓝图_动画结算.txt (AS), BP/Actor/蓝图_动作游戏模式.txt (GM).
 */
import type { Systems } from '../../bp/systems.ts';
import { BP_ManeActor } from '../../sim/actor.ts';
import { Array_AddUnique, Array_RemoveItem, SetActorHiddenInGame } from '../../sim/engine.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import { 蓝图_动画结算 } from '../../sim/settlement.ts';
import { 蓝图_效果 } from '../../ability/effect.ts';

/** Tag of every character actor (AS ReceiveBeginPlay L3286). */
const TAG_CHARACTER = '可交互.角色';
const TAG_BOSS = '可交互.角色.AI.仇恨.首领';
const TAG_PICKED = '可交互.角色.AI.已拾取';

/** UE FMath::Clamp: NaN falls through to Max. */
function FClamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x < hi ? x : hi;
}

/** `结束结算` (AS L742): Delay(延迟) on the node's latch, then hand over to the parent (@30, ln 238–248). */
function 结束结算(self: 蓝图_动画结算): void {
  self.delay('L742', Math.fround(self.延迟), () => {
    const w = self.world;
    const parent = self.所在父结算;
    if (w.isValid(parent)) {
      Array_RemoveItem(parent.子动画结算, self);
      parent.激活子结算();
      if (self.有移动) return;
      self.结算结束判断(); // L213
      return;
    }
    self.结算结束判断(); // L198
  });
}

/** AS L607: a settlement without an animation object activates its children (a container), then ends itself. */
function asContainer(self: 蓝图_动画结算): void {
  self.激活子结算();
  self.结束结算();
}

/** `激活结算` (AS L4197 → L3910): register, then run the settlement's type (L830) or the container path. */
function 激活结算(self: 蓝图_动画结算): void {
  const mode = self.游戏模式 ?? self.world.mode;
  Array_AddUnique(mode.所有动画结算数组, self);
  if (!self.world.isValid(self.动画对象)) {
    self.有移动 = false; // L4040
    asContainer(self);
    return;
  }
  const actor = self.角色对象;
  switch (self.结算类型) {
    case '被揭示': // L1602
      self.有移动 = false;
      actor?.更新外观数据();
      self.结束结算();
      return;
    case '被激活': // L1101: a montage with no asset on the mesh; its callbacks only store the notify name.
      self.有移动 = false;
      actor?.更新外观数据();
      self.结束结算();
      return;
    case '到手中': // L1664
      actor?.OwnedGameplayTags.add(TAG_PICKED);
      self.移到目标地点(actor);
      self.结束结算();
      return;
    case '到战斗': // L1770 (TURN-012): fog, appearance animation (only a boss waits for it), unhide.
      到战斗(self);
      return;
    case '连击结算': { // L2992 → L636 → L15 (TURN-050): fire, release the barrier slot, then the delay.
      const effect = self.动画对象;
      if (effect instanceof 蓝图_效果) effect.额外子触发(self.连击结算数值, 1);
      const from = self.来自角色;
      if (self.world.isValid(from)) from.结束行动(self, '');
      self.结束结算();
      return;
    }
    case '材料飞翔': // L3126: the object is a UI_材料飞翔格 widget; widgets are not world objects in the port.
      // SPEC-GAP: UI_材料飞翔格.飞翔动画 is presentation; the shell plays it from this event.
      self.fx.ui({ op: 'open', widget: 'UI_材料飞翔格', data: { settlement: self.id } });
      self.结束结算();
      return;
    default:
      // QUIRK (L830): types 无 / 到掉落 / xxx with a valid object do nothing and never end.
      return;
  }
}

function 到战斗(self: 蓝图_动画结算): void {
  const actor = self.角色对象;
  if (!actor) return; // the Demo would fault on a None 角色对象 (accessed none): nothing runs.
  actor.迷雾展开();
  const seq = actor.精灵动画序列[3] ?? null;
  const boss = actor.HasMatchingGameplayTag(TAG_BOSS);
  if (!seq) {
    SetActorHiddenInGame(actor, false); // L2420
    self.结束结算(); // L228
    return;
  }
  if (boss) {
    // The boss waits for its appearance animation: OnCompleted (L228) ends the settlement; OnCancelled does nothing.
    self.playAnim(actor, seq, {
      completed: () => self.OnCompleted_A819C3EB4EC26796AD6AFF8BB3C3CE45(),
      cancelled: () => self.OnCancelled_A819C3EB4EC26796AD6AFF8BB3C3CE45(),
    });
    SetActorHiddenInGame(actor, false); // L2382
    return;
  }
  self.playAnim(actor, seq, {
    completed: () => self.OnCompleted_AC0529704FEF8F9932BAD1A9F7E5C38E(),
    cancelled: () => self.OnCancelled_AC0529704FEF8F9932BAD1A9F7E5C38E(),
  });
  SetActorHiddenInGame(actor, false); // L2950
  self.结束结算(); // L228
}

/** `激活子结算` (AS L383): the first child, or end. */
function 激活子结算(self: 蓝图_动画结算): void {
  if (self.子动画结算.length > 0) {
    const child = self.子动画结算[0];
    self.当前结算 = child;
    if (!child) return; // a None slot: UE would fault on the member access; nothing runs.
    child.所在父结算 = self;
    child.激活结算();
    return;
  }
  self.结束结算(); // L592
}

/** `结算结束判断` (AS ln 27–44, TURN-013). */
function 结算结束判断(self: 蓝图_动画结算): void {
  const mode = self.游戏模式 ?? self.world.mode;
  Array_RemoveItem(mode.所有动画结算数组, self);
  Array_AddUnique(mode.待销毁动画结算数组, self);
  if (mode.所有动画结算数组.length > 0) return;
  if (mode.当前环节 === '创建房间') mode.房间完毕触发时机();
  mode.清理动画结算(true);
}

/** `ReceiveBeginPlay` (AS L3286): the game mode, and the character the object is. */
function settlementBeginPlay(self: 蓝图_动画结算): void {
  self.游戏模式 = self.world.mode;
  const o = self.动画对象;
  if (!(o && o.HasMatchingGameplayTag(TAG_CHARACTER))) return;
  if (!(o instanceof BP_ManeActor)) return;
  self.角色对象 = o;
  self.当前位置 = { ...o.当前位置 };
  self.目标位置 = { ...o.目标位置 };
}

/** `移到目标地点` (AS L4056). */
function 移到目标地点(self: 蓝图_动画结算, 移动者: BP_ManeActor | null): void {
  if (!移动者) return;
  移动者.移动中 = true;
  移动者.抵达位置 = false;
  // QUIRK (L4056): B = 0, so the duration is FClamp(d / 0) = 1.0 s for any distance (and for d = 0: NaN → 1.0).
  self.移动所需时长 = self.计算移动所需时间(0);
  // SPEC-GAP: L3792 only initialises a Gate; nothing in the class ticks 移动位置更新 (the type 到手中 is unused in scope).
}

/** `计算移动所需时间` (AS): FClamp(|当前 − 目标| / B, 0.2, 1.0). */
function 计算移动所需时间(self: 蓝图_动画结算, B: number): number {
  const d = Math.hypot(self.当前位置.x - self.目标位置.x, self.当前位置.y - self.目标位置.y, self.当前位置.z - self.目标位置.z);
  return FClamp(d / B, 0.2, 1.0);
}

/** `判断当前游戏环节` (AS): a lone 被揭示 leaf in phase 揭示场牌 waits 1.0 s. */
function 判断当前游戏环节(self: 蓝图_动画结算): void {
  const parentChildren = self.所在父结算?.子动画结算.length ?? 0;
  if (self.world.mode.当前环节 === '揭示场牌' && self.结算类型 === '被揭示' && self.子动画结算.length === 0 && parentChildren === 1) {
    self.延迟 = 1.0;
  }
}

/** `开始动画结算` (GM UG L16764): reuse the running container (TURN-GAP-19) or spawn a new type-无 container. */
function 开始动画结算(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const cur = self.当前模式结算实例;
  if (w.isValid(cur)) {
    cur.子动画结算 = [...self.模式动画结算数组];
    cur.激活结算();
    return;
  }
  const s = w.spawn(蓝图_动画结算, x => {
    x.延迟 = 0;
    x.子动画结算 = [...self.模式动画结算数组];
    x.结算类型 = '无';
  });
  self.当前模式结算实例 = s;
  s.激活结算();
}

/** `清理动画结算(清除实例？)` (GM ln 3677–3704). */
function 清理动画结算(self: 蓝图_动作游戏模式, 清除实例: boolean): void {
  self.模式动画结算数组.length = 0;
  if (!清除实例) return;
  for (let i = 0; i < self.待销毁动画结算数组.length; i++) self.待销毁动画结算数组[i]?.K2_DestroyActor();
  self.待销毁动画结算数组.length = 0;
  self.出场动画结算数组.length = 0;
  self.友方动画结算数组.length = 0;
}

/**
 * `获取场景中物体` (GM): the level's camera, BGM manager, fog plane and main light. All presentation in the port:
 * the camera, fog and light belong to the shell; the BGM manager's 切换BGM状态(1) is the 主界面 track.
 */
function 获取场景中物体(self: 蓝图_动作游戏模式): void {
  self.fx.bgm('主界面');
}

/**
 * `ReceiveBeginPlay` (GM L27298 → L17493): the boot. Sequence branches run in this order: (1) settings, scene objects
 * and the main UI (L16494); (2) the 0.2 s delay (L18378, then a cursor-widget update: presentation); (3) the
 * cultivation system, the hero, the backpack and the save load (L17560).
 */
function modeBeginPlay(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  self.默认游戏设置();
  self.获取场景中物体();
  self.fx.ui({ op: 'open', widget: 'UI_主界面' });
  self.fx.ui({ op: 'update', widget: 'UI_主界面', data: { 打开加载页: false } });
  // SPEC-GAP: the save flag 重置房间？ lives in the save module; a fresh boot plays the splash (开屏动画).
  self.fx.ui({ op: 'update', widget: 'UI_主界面', data: { 开屏动画: true } });
  self.delay('L18378', 0.2, () => {}); // → @15: UI_光标.更新光标 (presentation)
  self.所有部位数组 = [...self.所有部位映射.keys()];
  const cult = w.cult;
  cult.location = { x: 250, y: 0, z: 0 };
  cult.ReceiveBeginPlay();
  self.修炼系统 = cult;
  cult.激活修炼系统();
  self.创建玩家角色并控制(self.当前英雄角色名);
  self.玩家角色?.激活角色(false);
  self.重置背包内容();
  // EMSAsyncLoadGame.AsyncLoadActors(1): completes asynchronously. SPEC-GAP: on the next frame; the save module's
  // handlers decide what a missing save means (the Demo's OnFailed path creates one).
  self.nextTick('L17560', () => self.OnCompleted_CA3908B4440EBB3BF905F9BD2B9266E2());
}

/** `ReceiveTick` (GM L19828): the per-turn timer (the phase debug string is not ported). */
function modeTick(self: 蓝图_动作游戏模式, DeltaSeconds: number): void {
  self.每回合计时 = Math.fround(DeltaSeconds) + self.每回合计时;
}

export const sim: Systems['sim'] = {
  蓝图_动画结算: {
    结算结束判断,
    计算移动所需时间,
    // SPEC-GAP: 移动位置更新 (curve-driven card flight of type 到手中) has no caller in scope.
    判断当前游戏环节,
    // The PlayMontage / PlayAnimation callbacks only store the notify name or do nothing (AS L243–L355, L3285, L4195/6).
    OnCancelled_AC0529704FEF8F9932BAD1A9F7E5C38E: () => {},
    OnCompleted_AC0529704FEF8F9932BAD1A9F7E5C38E: () => {},
    OnCancelled_A819C3EB4EC26796AD6AFF8BB3C3CE45: () => {},
    OnCompleted_A819C3EB4EC26796AD6AFF8BB3C3CE45: self => self.结束结算(), // L228
    OnNotifyEnd_CDB63FEA455F664F177D5798A56F282C: () => {},
    OnNotifyBegin_CDB63FEA455F664F177D5798A56F282C: () => {},
    OnInterrupted_CDB63FEA455F664F177D5798A56F282C: () => {},
    OnBlendOut_CDB63FEA455F664F177D5798A56F282C: () => {},
    OnCompleted_CDB63FEA455F664F177D5798A56F282C: () => {},
    激活子结算,
    结束结算,
    ReceiveBeginPlay: settlementBeginPlay,
    移到目标地点,
    激活结算,
  },
  蓝图_动作游戏模式: {
    获取场景中物体,
    清理动画结算,
    开始动画结算,
    ReceiveTick: modeTick,
    ReceiveBeginPlay: modeBeginPlay,
  },
};

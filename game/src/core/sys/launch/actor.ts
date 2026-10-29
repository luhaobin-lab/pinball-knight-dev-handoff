/**
 * BP_ManeActor's contact and attack functions and the 函数库_工具 bounce helpers (ARCHITECTURE Appendix B
 * "launch"): 手动触发碰撞 → 碰撞时 → 碰撞检测 → 弹性处理 (bump feedback, 反弹中), 发动攻击 → 进入攻击状态 →
 * 近战/远程捕获攻击目标, 退出攻击状态, the motion bookkeeping (更新运动数据, 结束移动判断, 计算移动所需时间) and the
 * reflection helpers (计算反弹角度, 避免循环反弹). Sources: dump/blueprints-pseudo/CatapultHero/BP/Actor/BP_ManeActor
 * and 函数库/函数库_工具; draft launch-movement LAUNCH-044…062.
 */
import type { HitResult, Rotator, Vec3 } from '../../sim/types.ts';
import type { BpObject } from '../../sim/object.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import type { 蓝图_发射物 } from '../../ability/projectile.ts';
import { makeHitResult, make伤害 } from '../../bp/structs.ts';
import { 函数库_技能, 函数库_工具 } from '../../bp/index.ts';
import { 获取科学映射词条, 科学映射原始值 } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { FTrunc, MapRangeClamped } from '../../math/kismet.ts';
import { Array_Random, RandomFloatInRange } from '../../rng/ue.ts';
import { bounceDirection, calculateDirection } from '../../launch/math.ts';
import { demoAnims } from '../../../content/demo/anims.ts';
import { applyEffect, effectStruct } from './apply.ts';
import { isDynamicMesh, tagsOf } from './native.ts';
import { 曲线表 } from '../../../content/demo/tables.ts';
import type { RichCurve } from '../../../content/demo/types.ts';
import { evalRichCurve, type RichKey } from '../../launch/curves.ts';
import { FRAME, countdownEnd } from '../../sim/clock.ts';
import type { CapsuleProfileState } from '../../sim/collision-profile.ts';
import type { World } from '../../sim/world.ts';
import type {HasSpriteFacing}from'../../sim/presentation-state.ts';

const T = {
  bouncy: '环境.房间.有弹性',
  hostile: '可交互.角色.AI.仇恨',
  friendly: '可交互.角色.AI.友善',
  player: '可交互.角色.玩家',
  aiItem: '可交互.角色.AI.物品',
  bouncing: '状态.反弹中',
} as const;
const PHASES_WITH_CONTACTS = new Set(['进行战斗', '交互场牌', '回合开始']);
export const 反弹中_PATH = 'CatapultHero/BP/Skill/效果/蓝图_效果_反弹中';
const ATTACK_NOTIFY = 'CatapultHero/BP/通知/动画攻击检测';

/** Live index loop over the owner's effects with a timing tag (the Demo's ForEach over 拥有的效果 + IsValid + tag). */
export function fireOwned(owner: BP_ManeActor, tag: string, set?: (e: 蓝图_效果) => void): void {
  const list = owner.拥有的效果;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || !owner.world.isValid(e) || !e.HasMatchingGameplayTag(tag)) continue;
    e.触发时机 = tag;
    set?.(e);
    e.持续中触发(tag);
  }
}

const sub3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
/** Vector_Normal2D(v, 0.0001). */
export function normal2D(v: Vec3): Vec3 {
  const l2 = v.x * v.x + v.y * v.y;
  if (l2 <= 0.0001) return { x: 0, y: 0, z: 0 };
  const l = Math.sqrt(l2);
  return { x: v.x / l, y: v.y / l, z: 0 };
}
/** RotateAngleAxis(v, deg, Z). */
export function rotateZ(v: Vec3, deg: number): Vec3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

/** 函数库_工具.判断目标可反弹 (ln 510–530): any of 有弹性/仇恨/玩家/AI.物品, or the class 蓝图_动态网格. */
export function canBounceOff(target: unknown): boolean {
  const tags = tagsOf(target);
  return (!!tags && tags.hasAny([T.bouncy, T.hostile, T.player, T.aiItem])) || isDynamicMesh(target);
}

/**
 * 函数库_工具.计算反弹角度 (ln 949–971): 入射 yaw a_in, 法线 yaw a_n (CalculateDirection, the Demo's yaw frame), 反弹 yaw
 * = (a_n − a_in) + a_n as a float; 保持方向？ returns the incoming rotator and the incoming direction turned by 180°.
 */
export function bounceAngle(法线方向: Vec3, 入射方向: Vec3, 保持方向: boolean): { 入射旋转体: Rotator; 反弹旋转体: Rotator; 反弹方向: Vec3 } {
  const aIn = calculateDirection(入射方向);
  const aN = calculateDirection(法线方向);
  const inRot: Rotator = { Pitch: 0, Yaw: aIn, Roll: 0 };
  const outRot: Rotator = { Pitch: 0, Yaw: Math.fround(aN - aIn + aN), Roll: 0 };
  const out = bounceDirection(法线方向, 入射方向);
  return {
    入射旋转体: inRot,
    反弹旋转体: 保持方向 ? inRot : outRot,
    反弹方向: 保持方向 ? rotateZ(入射方向, 180) : { x: out.x, y: out.y, z: 0 },
  };
}

/** 弹性处理's bump sound parameter: NormalizeToRange(FMax(当前物理速度, MapRangeClamped(移动当前速度, 3000, 6000, 2000, 3000)), 0, 2000). */
export const bumpSoundSpeed = (physicsSpeed: number, moveSpeed: number): number =>
  Math.max(physicsSpeed, MapRangeClamped(moveSpeed, 3000, 6000, 2000, 3000)) / 2000;

/**
 * The actor's attack sequence and its 动画攻击检测 window. Read from the anims manifest itself: world.data.anims (core-sim)
 * keeps only name / time / duration of each notify, not its class or its 检测间隔 (see the card's needs).
 */
function attackWindow(self: BP_ManeActor): { start: number; duration: number; interval: number } | null {
  for (const seq of self.动画配置.精灵动画序列) {
    if (!seq || !/_Attack$/.test(seq) || !Object.hasOwn(demoAnims, seq)) continue;
    const n = demoAnims[seq].notifies.find(x => x.class === ATTACK_NOTIFY);
    if (!n) continue;
    const interval = typeof n.检测间隔 === 'number' ? n.检测间隔 : notifyDefaultInterval(self);
    return { start: n.time ?? 0, duration: n.duration ?? 0, interval };
  }
  return null;
}

/** 动画攻击检测's class default 检测间隔 (0.24 s), for the sequences whose notify leaves the field at its default. */
function notifyDefaultInterval(self: BP_ManeActor): number {
  const v = self.world.data.classes[ATTACK_NOTIFY]?.vars.检测间隔;
  return typeof v === 'number' ? v : 0.24;
}

interface AttackWindowState { end: number | null; timer: number | null }
const windows = new WeakMap<BP_ManeActor, AttackWindowState>();

const MOVE_INTERP = { RCIM_Cubic: 'cubic', RCIM_Linear: 'linear', RCIM_Constant: 'constant', RCIM_None: 'constant' } as const;
const MOVE_WEIGHT = { RCTWM_WeightedNone: 'none', RCTWM_WeightedArrive: 'arrive', RCTWM_WeightedLeave: 'leave', RCTWM_WeightedBoth: 'both' } as const;
const moveCurves = new Map<string, readonly RichKey[]>(Object.entries(曲线表.rows).map(([name, c]) => [name, (c as RichCurve).Keys.map(k => ({
  time: k.Time, value: k.Value, interp: MOVE_INTERP[k.InterpMode], arriveTangent: k.ArriveTangent, leaveTangent: k.LeaveTangent,
  arriveTangentWeight: k.ArriveTangentWeight, leaveTangentWeight: k.LeaveTangentWeight, weightMode: MOVE_WEIGHT[k.TangentWeightMode],
}))]));
type BpMoving = BP_ManeActor & { ug_移到目标地点?: { 位移曲线: string; 高度曲线: string; 高度: number } };

/**
 * The AttackState of the actor's sprite AnimBP: the 动画攻击检测 notify state calls 近战捕获攻击目标 every 检测间隔
 * (when > 0) and 退出攻击状态 at its end.
 * SPEC-GAP: re-entering AttackState while a window is open (two hits within its length) ends the old notify state on
 * the next frame (PaperZD notify-state end on a state change; exact frame unknown); without an attack sequence the
 * window ends on the next frame.
 */
function openAttackWindow(self: BP_ManeActor): void {
  const clock = self.world.clock;
  let w = windows.get(self);
  if (!w) windows.set(self, (w = { end: null, timer: null }));
  if (w.end !== null) {
    clock.cancel(w.end);
    if (w.timer !== null) clock.cancel(w.timer);
    w.end = w.timer = null;
    clock.nextFrame(() => self.退出攻击状态(), self);
  }
  const win = attackWindow(self);
  const state = w;
  if (!win) {
    state.end = clock.nextFrame(() => { state.end = null; self.退出攻击状态(); }, self);
    return;
  }
  if (win.interval > 0) {
    const tick = (at: number): void => {
      state.timer = clock.at(at, () => {
        self.近战捕获攻击目标(0, self.当前命中目标);
        if (at + win.interval < clock.now + win.duration) tick(at + win.interval);
      }, self);
    };
    tick(clock.now + win.start + win.interval);
  }
  state.end = clock.at(clock.now + win.start + win.duration, () => {
    state.end = null;
    if (state.timer !== null) clock.cancel(state.timer);
    state.timer = null;
    self.退出攻击状态();
  }, self);
}

export const actorFns = {
  /** MA L4636/L4708: engine contact skips the controlled launch; its native follower emits the manual contact. */
  BndEvt__蓝图_角色_CapsuleComponent_K2Node_ComponentBoundEvent_1_ComponentHitSignature__DelegateSignature(
    self:BP_ManeActor,_component:unknown,_other:BpObject|null,_otherComp:unknown,_impulse:Vec3,hit:HitResult,
  ):void {
    if(self.HasMatchingGameplayTag('状态.可控弹射')||!self.world.isValid(self.游戏模式))return;
    self.手动触发碰撞(hit);
  },
  /** BP_ManeActor L4122 opens its ReceiveTick move gate; it does not replace the separate native launch follower. */
  移到目标地点(self: BP_ManeActor, 位移曲线: string, 高度曲线: string, 移动速度: number, 高度: number): void {
    self.移动当前速度 = 移动速度; self.移动中 = true; self.抵达位置 = false;
    self.移动所需时长 = self.计算移动所需时间(移动速度);
    (self as BpMoving).ug_移到目标地点 = { 位移曲线, 高度曲线, 高度 };
    self.setTickEnabled(true);
    // The finite action owns its completion; weak actor ticks alone must not make runUntilInput declare idle.
    self.world.clock.at(countdownEnd(self.world.clock.now, self.移动所需时长), () => {}, self);
  },
  /** MA ln4811 evaluates the two imported curves BEFORE adding this canonical frame's DeltaSeconds.
   * Source height offsets +X (screen up), not world Z. On arrival the final target is placed immediately.
   */
  移动位置更新(self: BP_ManeActor, 位移曲线: string, 高度曲线: string, 高度: number): void {
    const xy = moveCurves.get(位移曲线), height = moveCurves.get(高度曲线);
    if (!xy || !height) { self.world.unported(`BP mover missing curve ${位移曲线}/${高度曲线}`); return; }
    const t = Math.fround(self.移动当前时长 / self.移动所需时长);
    const alpha = Math.fround(evalRichCurve(xy, t)), lift = Math.fround(evalRichCurve(height, t));
    const start = self.当前位置, end = self.目标位置;
    const p = { x: start.x + (end.x - start.x) * alpha, y: start.y + (end.y - start.y) * alpha, z: start.z + (end.z - start.z) * alpha };
    self.速度方向 = normal2D(sub3(end, start));
    const z = self.高度 + (self.HasMatchingGameplayTag('可交互.修炼牌') ? p.z : 0);
    const move = (to: Vec3): void => {
      const from = self.K2_GetActorLocation(); self.K2_SetActorLocation(to);
      (self.world.sys.physics as { moveEffectOverlaps?(w: World, actor: BP_ManeActor, from: Vec3, to: Vec3): void }).moveEffectOverlaps?.(self.world, self, from, self.K2_GetActorLocation());
    };
    move({ x: p.x + lift * 高度, y: p.y, z });
    self.移动当前时长 += FRAME;
    self.抵达位置 = self.移动当前时长 >= self.移动所需时长;
    if (self.抵达位置) {
      // MA4860 differs from the ordinary MA4845 sample: the final placement sweeps the capsule.
      (self.world.sys.physics as { finalSweptMove(w:World,actor:BP_ManeActor,target:Vec3):unknown }).finalSweptMove(self.world,self,{x:end.x,y:end.y,z});
      delete (self as BpMoving).ug_移到目标地点;
    }
  },
  /** MA ln1483: explicit PhysicsOnly profile plus separate 不可阻挡 tag; query filters read the profile field. */
  切换穿透状态(self: BP_ManeActor, 开启: boolean): void {
    (self as BP_ManeActor & CapsuleProfileState).ug_碰撞配置 = 开启 ? '穿透状态' : 'Pawn';
    if (开启) self.OwnedGameplayTags.add('状态.不可阻挡'); else self.OwnedGameplayTags.remove('状态.不可阻挡');
  },
  /** ManeActor UG L12024 → L4774: 碰撞时 on own effects, 碰撞检测, 弹性处理 (gate: 层回合 > 0, alive, 环节 3/2/0). */
  手动触发碰撞(self: BP_ManeActor, 当前命中目标: HitResult): void {
    self.当前命中目标 = 当前命中目标;
    const mode = self.world.mode;
    if (!(mode.当前层回合 > 0 && !self.死掉了 && PHASES_WITH_CONTACTS.has(mode.当前环节))) return;
    self.当前碰到谁了 = (当前命中目标.actor as BpObject | null) ?? null;
    fireOwned(self, '效果.时机.碰撞时', e => { e.命中数据 = self.当前命中目标; });
    self.碰撞检测();
    self.弹性处理();
  },

  /** Empty in the Demo (ln 4970). */
  碰撞检测(_self: BP_ManeActor): void {},

  /** 弹性处理 (LAUNCH-048/049): bump feedback, then 反弹中 when the touched actor is bounceable. */
  弹性处理(self: BP_ManeActor): { 产生反弹: boolean } {
    const hit = self.当前碰到谁了;
    const tags = tagsOf(hit);
    const feedback = !!tags && tags.hasAny([T.bouncy, T.hostile, T.aiItem]);
    const blocked = self.OwnedGameplayTags.hasAny([T.aiItem, T.bouncing]);
    if ((feedback || isDynamicMesh(hit)) && !blocked && self.world.mode.当前环节 !== '创建房间') {
      // 反弹动画 restart and 音效_基础_普通撞; its Speed parameter is bumpSoundSpeed (presentation).
      self.fx.sound('CatapultHero/声音/音效_基础_普通撞', self.K2_GetActorLocation());
    }
    // L1226
    if (!(canBounceOff(hit) && !self.OwnedGameplayTags.hasAny([T.aiItem, T.bouncing]))) return { 产生反弹: false };
    const cfg = effectStruct(反弹中_PATH, 0.2, 1, -1, true);
    const name = 函数库_技能.获取效果名(self, self.空技能, cfg.效果类).效果名字;
    if (!self.world.isValid(self) || self.死掉了) return { 产生反弹: false };
    const { effect, refreshed } = applyEffect(self, { cfg, owner: self, 释放者: self, 来自技能: self.空技能, 效果名: name, classOf: self });
    if (refreshed || !effect) return { 产生反弹: false }; // L1910 / L5156
    // SPEC-GAP: GetPhysicsLinearVelocity of a controlled launch is not simulated; the core keeps 速度方向.
    self.反弹前方向 = { ...self.速度方向 };
    effect.命中数据 = self.当前命中目标;
    effect.激活效果('');
    return { 产生反弹: true };
  },

  /** 发动攻击 (ln 3165): remembers the ability, then 进入攻击状态. */
  发动攻击(self: BP_ManeActor, 当前攻击来自能力: 蓝图_能力 | null, 指定命中目标: HitResult, 远程: boolean): void {
    self.当前攻击来自能力 = 当前攻击来自能力;
    self.进入攻击状态(指定命中目标, 远程);
  },

  /** 进入攻击状态 (ln 4080): 攻击中, 发动攻击前 on own effects, AttackState, then the capture. */
  进入攻击状态(self: BP_ManeActor, 指定命中目标: HitResult, 远程: boolean): void {
    self.攻击中 = true;
    self.当前攻击命中 = false;
    self.动画可打断 = false;
    fireOwned(self, '效果.时机.发动攻击前');
    openAttackWindow(self);
    // QUIRK (L758): the ranged capture is passed an empty HitResult, not 指定命中目标.
    if (远程) self.远程捕获攻击目标(0, makeHitResult());
    else self.近战捕获攻击目标(0, 指定命中目标);
  },

  /** 退出攻击状态 (ln 4044): only while 攻击中; 发动攻击后 on own effects. */
  退出攻击状态(self: BP_ManeActor): void {
    if (!self.攻击中) return;
    self.攻击中 = false;
    self.动画可打断 = true;
    fireOwned(self, '效果.时机.发动攻击后');
  },

  /**
   * 近战捕获攻击目标 (ln 1103): 范围攻击？ abilities sphere-trace 攻击距离 around 当前位置 (ignoring the touched actor and
   * self) and add the hit target (AddUnique); others take the hit target only. Every living actor of another
   * 角色类型 with 仇恨/友善/玩家 takes 基础伤害 (来源 攻击, 类型 物理, 所需回合 3, 触发次数 1).
   */
  近战捕获攻击目标(self: BP_ManeActor, _DrawDebugType: number, 指定命中目标: HitResult): void {
    self.更新运动数据();
    const chosen = 指定命中目标.blockingHit ? 指定命中目标 : self.当前命中目标; // Temp_bool = bBlockingHit (L1120)
    const ability = self.当前攻击来自能力;
    let targets: unknown[];
    if (ability?.范围攻击) {
      const radius = 科学数变普通(科学映射原始值(self.词条, '攻击距离', false));
      const p = self.当前位置;
      const ignore = [self.当前碰到谁了, self].filter((x): x is BpObject => !!x);
      const hits = self.world.trace.sphere({ x: p.x, y: p.y, z: p.z - 100 }, { x: p.x, y: p.y, z: p.z + 100 }, Math.fround(radius), 'Pawn', ignore);
      targets = hits.map(h => h.actor);
      if (!targets.includes(chosen.actor)) targets.push(chosen.actor);
    } else targets = [chosen.actor];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i] as BP_ManeActor | null;
      if (!t || !self.world.isValid(t) || !('死掉了' in t)) continue;
      if (t.死掉了 || t.角色类型 === self.角色类型 || !t.OwnedGameplayTags.hasAny([T.hostile, T.friendly, T.player])) continue;
      self.造成即时伤害(make伤害({
        伤害来源: '攻击', 伤害类型: '物理', 不变速: false, 是暴击: false, 是弱点: false,
        伤害数值: 获取科学映射词条(self.词条, '基础伤害').输出值, 所需回合: 3, 触发次数: 1,
        来自技能: ability, 来自角色: self, 来自发射物: null, 目标角色: t,
      }), false, false);
    }
  },

  /**
   * 远程捕获攻击目标 (ln 855): 创建发射物组(1, true), then trunc(投射分裂) + 1 projectiles of the ability's 发射物[0]
   * toward the nearest 敌方场上 actor, each with 基础伤害, then 创建发射物.
   * SPEC-GAP: 扩散命中中心(target, 0, 0.65, 0) spread is not drawn; the arrows aim at the target's centre.
   */
  远程捕获攻击目标(self: BP_ManeActor, _DrawDebugType: number, _指定命中目标: HitResult): void {
    self.更新运动数据();
    self.创建发射物组(1, true);
    const ability = self.当前攻击来自能力;
    const split = (): number => FTrunc(科学数变普通(获取科学映射词条(self.词条, '投射分裂').输出值));
    for (let i = 0; i <= split(); i++) {
      const here = self.K2_GetActorLocation();
      const target = nearest(here, self.world.mode.敌方场上.filter((a): a is BP_ManeActor => !!a && self.world.isValid(a)));
      if (!target || !ability) continue;
      const spec = ability.发射物[0];
      if (!spec?.类型) continue;
      // SPEC-GAP: the spawn yaw (toward the target, fanned by (i − max(n − 1, 0)/2)·7.5°) is the projectile's
      // transform, which BpObject does not carry; core-physics aims 创建发射物 itself.
      const p = self.world.spawn<蓝图_发射物>(spec.类型, o => {
        o.来自角色 = self; o.来自技能 = ability; o.速度 = spec.速度; o.持续时长 = spec.持续时长; o.触发间隔 = spec.触发间隔;
      }, { x: here.x, y: here.y, z: 5 });
      p.伤害数值 = 获取科学映射词条(self.词条, '基础伤害').输出值;
      p.伤害类型 = '物理';
      self.创建发射物(p, 1, false);
    }
  },

  /** 更新运动数据 (ln 4870): 目标位置 from 当前目标 (when not casting), 当前位置 = location − (0, 0, 高度), distance, direction. */
  更新运动数据(self: BP_ManeActor): void {
    if (!self.释放技能中 && self.当前目标 && self.world.isValid(self.当前目标)) self.目标位置 = { ...self.当前目标.当前位置 };
    const p = self.K2_GetActorLocation();
    self.当前位置 = { x: p.x, y: p.y, z: p.z - self.高度 };
    const d = sub3(self.目标位置, self.当前位置);
    self.与目标距离 = Math.hypot(d.x, d.y, d.z);
    self.目标方向 = normal2D(d);
  },

  /** MA4134–4162: PaperFlipbook.X scale only; this is not ActorRotation or a physics transform. */
  更新朝向(self: BP_ManeActor): void {
    if(self.死掉了||函数库_工具.有对应标签效果(self,self.拥有的效果,'状态.僵直').存在
      ||self.HasMatchingGameplayTag('可交互.角色.AI.不可动')
      ||!self.OwnedGameplayTags.hasAny(['可交互.角色.AI.友善','可交互.角色.AI.仇恨','可交互.角色.玩家']))return;
    const d=normal2D(self.目标方向),axial=(d.x===1||d.x===-1)&&d.y===0;
    // This node uses MakeRotator(0,0,0), unlike the launch helper's one-degree roll coordinate convention.
    (self as BP_ManeActor&HasSpriteFacing).ug_spriteScaleX=axial||Math.atan2(d.y,d.x)<0?1:-1;
  },

  /** 结束移动判断 (ln 4727): 结束移动后 on own effects. */
  结束移动判断(self: BP_ManeActor): void {
    fireOwned(self, '效果.时机.结束移动后');
  },

  /** 计算移动所需时间 (ln 4715): FMax(|当前位置 − 目标位置| / 速度, 0.01). */
  计算移动所需时间(self: BP_ManeActor, 移动速度: number): number {
    const d = sub3(self.当前位置, self.目标位置);
    return Math.max(Math.hypot(d.x, d.y, d.z) / 移动速度, 0.01);
  },

  /**
   * 避免循环反弹 (ln 1045): an axis-aligned direction (|dot| ≥ 0.95 with X or Y) that reverses the last 反弹角度历史
   * entry (dot ≤ −0.95) off the room wall turns by a random ±45° (combat draw, always drawn: the select is pure).
   */
  避免循环反弹(self: BP_ManeActor, 输入角度: Vec3): { 输出角度: Vec3; 循环反弹: boolean; ReturnValue: string } {
    const axial = [{ x: 1, y: 0 }, { x: 0, y: 1 }].some(a => Math.abs(a.x * 输入角度.x + a.y * 输入角度.y) >= 0.95);
    const pick = [-45, 45][Array_Random(self.world.rng.combat, [-45, 45])];
    const hist = self.反弹角度历史;
    const last = hist.length ? hist[hist.length - 1] : { x: 0, y: 0, z: 0 };
    const reversing = 输入角度.x * last.x + 输入角度.y * last.y + 输入角度.z * last.z <= -0.95;
    const loop = reversing && isDynamicMesh(self.当前碰到谁了) && axial;
    return { 输出角度: loop ? rotateZ(输入角度, pick) : { ...输入角度 }, 循环反弹: loop, ReturnValue: '' };
  },
};

function nearest(from: Vec3, list: readonly BP_ManeActor[]): BP_ManeActor | null {
  let best: BP_ManeActor | null = null;
  let bestD = Infinity;
  for (const a of list) {
    const p = a.K2_GetActorLocation();
    const d = Math.hypot(p.x - from.x, p.y - from.y, p.z - from.z);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

export const toolFns = {
  /** FT ln1546: Y jitter, X jitter, then float angle; even zero rectangle ranges consume their source draws. */
  扩散命中中心(ctx: BpObject, 目标: BP_ManeActor | null, 指定位置: Vec3, 圆形范围: number, 矩形扩散: Vec3): Vec3 {
    const valid = 目标 && ctx.world.isValid(目标), radius = valid ? 目标.高度 * 圆形范围 : 圆形范围;
    const centre = valid ? 目标.K2_GetActorLocation() : 指定位置, rng = ctx.world.rng.combat;
    const y = RandomFloatInRange(rng, -矩形扩散.y, 矩形扩散.y), x = RandomFloatInRange(rng, -矩形扩散.x, 矩形扩散.x);
    const around = rotateZ({ x: radius, y: 0, z: 0 }, Math.fround(RandomFloatInRange(rng, -180, 180)));
    return { x: centre.x + around.x + x, y: centre.y + around.y + y, z: centre.z };
  },
  判断目标可反弹(_ctx: BpObject, 目标: BpObject | null): { 可反弹: boolean } {
    return { 可反弹: canBounceOff(目标) };
  },
  计算反弹角度(_ctx: BpObject, 法线方向: Vec3, 入射方向: Vec3, 保持方向: boolean) {
    return bounceAngle(法线方向, 入射方向, 保持方向);
  },
  /** ln 更新目标和自身运动数据: the target's, then the actor's own 更新运动数据. */
  更新目标和自身运动数据(_ctx: BpObject, 角色对象: BP_ManeActor | null): void {
    if (!角色对象) return;
    if (角色对象.当前目标 && 角色对象.world.isValid(角色对象.当前目标)) 角色对象.当前目标.更新运动数据();
    角色对象.更新运动数据();
  },
};

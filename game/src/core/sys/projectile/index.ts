/**
 * Module `projectile` (WAVE_A Appendix W2, card core-physics): the behaviour of 蓝图_发射物 (all 14 functions) and its
 * ProjectileMovement / 移动判断 components. Pseudo: dump/blueprints-pseudo/CatapultHero/BP/Skill/蓝图_发射物.txt;
 * draft ability-framework ABILIT-083…095, §7.3.
 *
 * Components as data on the projectile (part of the digest):
 * - `ProjectileMovement`: straight planar motion at `速度` along the actor forward (MaxSpeed 5000, gravity 0,
 *   bAutoActivate false), stepped by the scheduler at 1/120 s; it stops on the first blocking hit (房间地块 blocks the
 *   发射物 channel) and on StopSimulating, which broadcasts OnProjectileStop (UE semantics).
 * - `移动判断`: the overlap sphere (radius from the class manifest, base 24); Pawn overlaps begin once per contact.
 * The forward is `ActorRotation.Yaw` (deg, 0 = +x, towards +y), which the spawner sets (SPEC-GAP: BpObject has no
 * rotation yet; see the card's needs).
 *
 * `游戏模式` is set by the spawner's 创建发射物 (BP_ManeActor L1829) just before 激活发射物; a projectile activated
 * without it acts on None like the Demo (the barrier joins and the hero exclusions are skipped).
 */
import { 函数库_工具 } from '../../bp/index.ts';
import { makeHitResult } from '../../bp/structs.ts';
import type { ProjectileFns } from '../../bp/systems.ts';
import type { SysModule } from '../../api/compose.ts';
import { 蓝图_发射物 } from '../../ability/projectile.ts';
import { BP_ManeActor } from '../../sim/actor.ts';
import type { BpObject } from '../../sim/object.ts';
import type { HitResult, Rotator, Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import type { ProjectileView } from '../../api/view.ts';

/** ProjectileMovement.MaxSpeed (ABILIT-083). */
export const PROJECTILE_MAX_SPEED = 5000;
/** 移动判断.SphereRadius of the base class (ABILIT-083). */
export const BASE_SPHERE_RADIUS = 24;

export interface ProjectileMovementState {
  /** SetActive(true) after 激活发射物; false after StopSimulating. */
  active: boolean;
  /** UpdatedComponent is valid (cleared by StopSimulating). */
  updating: boolean;
  vx: number;
  vy: number;
  /** 移动判断.SetGenerateOverlapEvents. */
  overlaps: boolean;
  /** Ids of the actors 移动判断 currently overlaps (begin-overlap fires once per contact). */
  touching: number[];
}

type Shot = 蓝图_发射物 & {
  ProjectileMovement?: ProjectileMovementState; ActorRotation?: Rotator;
  ug_投射表现?: { startedAt: number; stoppedAt?: number };
};

export function movementOf(p: 蓝图_发射物): ProjectileMovementState {
  const o = p as Shot;
  if (!o.ProjectileMovement) o.ProjectileMovement = { active: false, updating: true, vx: 0, vy: 0, overlaps: false, touching: [] };
  return o.ProjectileMovement;
}

/** GetActorForwardVector (planar). */
export function forwardOf(p: 蓝图_发射物): Vec3 {
  const yaw = ((p as Shot).ActorRotation?.Yaw ?? 0) * (Math.PI / 180);
  return { x: Math.cos(yaw), y: Math.sin(yaw), z: 0 };
}

/** 移动判断.SphereRadius: the class manifest's component value, else the base 24. */
export function sphereRadiusOf(p: 蓝图_发射物): number {
  const r = p.def.components?.['移动判断']?.['SphereRadius'];
  return typeof r === 'number' ? r : BASE_SPHERE_RADIUS;
}

/** UProjectileMovementComponent::StopSimulating(hit): velocity 0, no updated component, OnProjectileStop(hit). */
export function StopSimulating(p: 蓝图_发射物, hit: HitResult): void {
  const m = movementOf(p);
  m.vx = 0;
  m.vy = 0;
  m.active = false;
  m.updating = false;
  p.BndEvt__蓝图_发射物_ProjectileMovement_K2Node_ComponentBoundEvent_0_OnProjectileStopDelegate__DelegateSignature(hit);
}

// ---------------------------------------------------------------- flight process

interface Flight { readonly shots: 蓝图_发射物[]; readonly process: { step(dt: number): void; active(): boolean } }
const flights = new WeakMap<World, Flight>();

function flightOf(world: World): Flight {
  let f = flights.get(world);
  if (f) return f;
  const shots: 蓝图_发射物[] = [];
  const flying = (p: 蓝图_发射物): boolean => p.valid && movementOf(p).active;
  f = {
    shots,
    process: {
      step: dt => {
        for (const p of [...shots]) if (flying(p)) fly(p, dt);
        for (let i = shots.length - 1; i >= 0; i--) if (!flying(shots[i]!)) shots.splice(i, 1);
      },
      active: () => shots.some(flying),
    },
  };
  flights.set(world, f);
  return f;
}

function launch(p: 蓝图_发射物): void {
  const f = flightOf(p.world);
  if (!f.shots.includes(p)) f.shots.push(p);
  p.world.clock.addProcess(f.process);
}

function fly(p: 蓝图_发射物, dt: number): void {
  const m = movementOf(p);
  const sp = Math.hypot(m.vx, m.vy);
  if (sp > PROJECTILE_MAX_SPEED) {
    m.vx *= PROJECTILE_MAX_SPEED / sp;
    m.vy *= PROJECTILE_MAX_SPEED / sp;
  }
  const from = p.K2_GetActorLocation();
  const to = { x: from.x + m.vx * dt, y: from.y + m.vy * dt, z: from.z };
  const hits = p.world.trace.sphere(from, to, sphereRadiusOf(p), '发射物', []);
  const now: number[] = [];
  let block: HitResult | null = null;
  for (const h of hits) {
    if (h.actor instanceof BP_ManeActor) {
      now.push(h.actor.id);
      continue;
    }
    if (h.blockingHit) { block = h; break; } // Non-actor overlap components do not stop ProjectileMovement.
  }
  p.K2_SetActorLocation(block ? { x: block.location.x, y: block.location.y, z: from.z } : to);
  const before = m.touching;
  m.touching = now;
  for (const h of hits) {
    if (!(h.actor instanceof BP_ManeActor)) { if (h.blockingHit) break; continue; }
    if (!m.active || !m.overlaps) break;
    if (before.includes(h.actor.id)) continue;
    p.BndEvt__蓝图_发射物_移动判断_K2Node_ComponentBoundEvent_4_ComponentBeginOverlapSignature__DelegateSignature(null, h.actor, null, 0, true, h);
  }
  if (block && m.active) {
    const settings = p.def.components?.ProjectileMovement;
    if (settings?.bShouldBounce !== true) { StopSimulating(p, block); return; }
    // Demo child component overrides: tornado .8 restitution/.1 friction; base/arrow never enter here.
    // UE documents restitution along the impact normal and friction on its tangent. This adapter handles the
    // constant-friction branch. SPEC-GAP: this binary's inherited bBounceAngleAffectsFriction, MinFrictionFraction,
    // BounceVelocityStopSimulatingThreshold and within-step multi-impact/sliding defaults are not in the dump.
    // No guessed low-speed threshold is introduced; source duration/safety timers still end every projectile.
    const n = block.normal, into = m.vx * n.x + m.vy * n.y;
    if (into < 0) {
      const bounce = typeof settings.Bounciness === 'number' ? settings.Bounciness : 0;
      const friction = typeof settings.Friction === 'number' ? settings.Friction : 0;
      const tangentX = m.vx - into * n.x, tangentY = m.vy - into * n.y;
      m.vx = tangentX * Math.max(0, 1 - friction) - into * n.x * Math.max(0, bounce);
      m.vy = tangentY * Math.max(0, 1 - friction) - into * n.y * Math.max(0, bounce);
    }
    const threshold = settings.BounceVelocityStopSimulatingThreshold;
    if (typeof threshold === 'number' && Math.hypot(m.vx, m.vy) < threshold) StopSimulating(p, block);
  }
}

// ---------------------------------------------------------------- 蓝图_发射物

/** The overlap's SweepResult (UBERGRAPH.K2Node_ComponentBoundEvent_SweepResult), kept per projectile. */
const sweepOf = new WeakMap<蓝图_发射物, HitResult>();

const 蓝图_发射物Fns: NonNullable<ProjectileFns['蓝图_发射物']> = {
  // line 47: runs once; releases the action end and the turn-start barrier (ABILIT-093).
  解除发射物等待(self) {
    if (self.已解除等待) return;
    self.已解除等待 = true;
    const src = self.行动结束源;
    if (self.world.isValid(src) && src.行动结束实例.includes(self)) src.结束行动(self, '');
    // L218
    const gm = self.游戏模式;
    if (self.world.isValid(gm) && gm.回合开始实例.includes(self)) gm.退出回合开始(self);
  },

  激活前触发() {},

  // line 81 (ABILIT-089)
  发射物命中(self) {
    const target = self.当前命中角色;
    const from = self.来自角色;
    const friendly = target?.角色类型 === from?.角色类型 || (target?.角色类型 === '玩家' && from?.角色类型 === '修炼牌');
    if (friendly) {
      self.触发发射物友方效果();
      return;
    }
    // L297
    self.剩余触发间隔 = self.触发间隔;
    self.触发发射物敌方效果();
  },

  发射物停下() {},
  触发发射物友方效果() {},
  触发发射物敌方效果() {},

  // L2021 (ABILIT-086)
  激活发射物(self) {
    if (self.已激活过 || self.已开始结束) return;
    // L2074
    self.已激活过 = true;
    (self as Shot).ug_投射表现 = { startedAt: self.world.clock.now };
    self.起始位置 = self.K2_GetActorLocation();
    self.剩余触发间隔 = 0;
    self.最大穿透次数 = 1;
    const fromPlayerSide = self.来自角色?.HasMatchingGameplayTag('可交互.修炼牌') || self.来自角色?.HasMatchingGameplayTag('可交互.角色.玩家');
    self.行动结束源 = fromPlayerSide ? (self.游戏模式?.玩家角色 ?? null) : self.来自角色;
    self.行动结束源?.加入行动结束(self);
    self.游戏模式?.加入回合开始(self);
    self.激活前触发();
    if (self.已开始结束) return;
    // L2563
    const timeout = Math.fround(Math.max(Math.max(self.安全超时秒数, 1.0), self.持续时长 + 1.0));
    self.setTimer('发射物安全超时', timeout, false, () => self.发射物安全超时());
    const f = forwardOf(self);
    const m = movementOf(self);
    m.vx = f.x * self.速度;
    m.vy = f.y * self.速度;
    m.active = true;
    m.updating = true;
    self.激活 = true;
    m.overlaps = true;
    // The actor ticks from BeginPlay in UE (BP ReceiveTick); before activation the tick only clamps 剩余触发间隔.
    self.setTickEnabled(true);
    launch(self);
  },

  // L3942
  BndEvt__蓝图_发射物_ProjectileMovement_K2Node_ComponentBoundEvent_0_OnProjectileStopDelegate__DelegateSignature(self, ImpactResult) {
    if (self.已开始结束) return;
    self.结束命中结果 = ImpactResult;
    stopSequence(self);
  },

  // L4356 (ABILIT-087)
  BndEvt__蓝图_发射物_移动判断_K2Node_ComponentBoundEvent_4_ComponentBeginOverlapSignature__DelegateSignature(self, _comp, OtherActor, _otherComp, _index, _fromSweep, SweepResult) {
    sweepOf.set(self, SweepResult);
    const notSource = OtherActor !== self.来自角色;
    const card = self.来自角色?.HasMatchingGameplayTag('可交互.修炼牌') ?? false;
    // Item shots pass through the hero.
    const notHero = OtherActor !== (self.游戏模式?.玩家角色 ?? null);
    if (!(self.激活 && notSource && (!card || notHero))) return;
    self.Other_Actor = OtherActor;
    // L4087: the tag interface (every BpObject has OwnedGameplayTags; static geometry is null).
    const other = OtherActor;
    const tagged = other !== null && (other.HasMatchingGameplayTag('可交互.角色.AI.仇恨') || other.HasMatchingGameplayTag('可交互.角色.玩家'));
    // L1200
    if (!(tagged && self.剩余触发间隔 === 0.0)) return;
    if (!self.范围检查) {
      // L1769: the direct hit.
      if (OtherActor instanceof BP_ManeActor) {
        self.当前命中角色 = OtherActor;
        self.Sweep_Result = SweepResult;
        self.发射物命中();
        self.当前穿透次数 = self.当前穿透次数 + 1;
        pierceCheck(self);
        return;
      }
      self.当前命中角色 = null; // L2009
      return;
    }
    // ABILIT-088: a sphere trace of radius 移动判断 × 1.1 at the projectile; every hit counts toward pierce.
    const ignore: (BpObject | null)[] = card ? [self.来自角色, self.游戏模式?.玩家角色 ?? null] : [self.来自角色];
    const { OutHits } = 函数库_工具.以目标为中心追踪(self, null, Math.fround(sphereRadiusOf(self) * 1.1), 3, 2, ignore, true, self.K2_GetActorLocation());
    // L1138 → L824: a live index loop over the trace result.
    for (let i = 0; i < OutHits.length; i++) {
      const h = OutHits[i]!;
      if (h.actor instanceof BP_ManeActor) {
        // L203
        self.当前命中角色 = h.actor;
        self.Sweep_Result = h;
        self.当前穿透次数 = self.当前穿透次数 + 1;
        self.发射物命中();
      } else {
        self.当前命中角色 = null; // L743
      }
    }
    pierceCheck(self);
  },

  // L4705 (ABILIT-091)
  ReceiveTick(self, DeltaSeconds) {
    self.剩余触发间隔 = Math.max(self.剩余触发间隔 - DeltaSeconds, 0);
    if (!(self.持续时长 !== -1.0 && self.激活)) return;
    self.持续时长 = self.持续时长 - DeltaSeconds;
    if (self.持续时长 <= 0.0) self.结束发射物();
  },

  // L5382 → L5104: a synthetic hit at the actor with normal (0, 0, 1).
  结束发射物(self) {
    if (self.已开始结束) return;
    const at = self.K2_GetActorLocation();
    self.结束命中结果 = makeHitResult({ blockingHit: false, time: 0, distance: 0, location: at, impactPoint: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, impactNormal: { x: 0, y: 0, z: 1 }, actor: null });
    stopSequence(self);
  },

  // L5397 → L5382
  发射物安全超时(self) {
    self.结束发射物();
  },

  // L5402: EndPlay(Destroyed) releases the waits (ABILIT-093).
  ReceiveEndPlay(self, EndPlayReason) {
    if (EndPlayReason !== 0) return;
    self.解除发射物等待();
  },
};

/** L967 (ABILIT-090): keep flying while pierce remains, else StopSimulating with the overlap's sweep. */
function pierceCheck(self: 蓝图_发射物): void {
  if (self.当前穿透次数 < self.最大穿透次数 || self.最大穿透次数 === -1) return;
  // L1092
  StopSimulating(self, sweepOf.get(self) ?? makeHitResult());
}

/** L3984 → L3054 (ABILIT-092): the stop sequence shared by OnProjectileStop, 结束发射物 and the safety timeout. */
function stopSequence(self: 蓝图_发射物): void {
  if (self.已开始结束) return;
  // L3999
  self.已开始结束 = true;
  const presentation = (self as Shot).ug_投射表现;
  if (presentation) presentation.stoppedAt = self.world.clock.now;
  self.激活 = false;
  self.clearTimer('发射物安全超时');
  movementOf(self).overlaps = false;
  // L3054
  if (movementOf(self).updating) StopSimulating(self, self.结束命中结果);
  // L3164
  const loc = self.结束命中结果.location;
  self.fx.vfx(self.停止特效, { x: loc.x, y: loc.y, z: 4.0 });
  // Niagara 生成速率 = 0: the trail stops emitting (presentation; the game layer ends the trail with the projectile).
  self.fx.sound(self.停止音效, loc, { volume: 1.3, pitch: 1.0 });
  self.发射物停下();
  self.delay('L3054', 0.5, () => {
    // Ubergraph entry 15
    if (self.world.isValid(self.来自技能)) self.来自技能.特殊结算(self);
    // L95
    self.解除发射物等待();
    self.delay('L95', 2.0, () => 函数库_工具.销毁目标和子物体(self, self));
  });
}

/** F-FIELD #20: preserve speed and the source's world-origin-dependent deflection formula. */
export function deflectInSphere(world: World, center: Vec3, radius: number, dt: number, ignore: readonly (蓝图_发射物 | null)[]): void {
  const objects = (world as World & { objects?(): readonly BpObject[] }).objects?.() ?? [];
  const normal = (x: number, y: number): [number, number] => {
    const n = x * x + y * y;
    return n > 0.0001 ? [x / Math.sqrt(n), y / Math.sqrt(n)] : [0, 0];
  };
  for (const p of objects) {
    if (!(p instanceof 蓝图_发射物) || !p.valid || ignore.includes(p)) continue;
    const at = p.K2_GetActorLocation();
    if (Math.hypot(at.x - center.x, at.y - center.y, at.z - center.z) > radius + sphereRadiusOf(p)) continue;
    const m = movementOf(p);
    const speed = Math.hypot(m.vx, m.vy), originDistance = Math.hypot(at.x, at.y, at.z);
    const [vx, vy] = normal(m.vx, m.vy), [towardX, towardY] = normal(center.x - at.x, center.y - at.y);
    const [x, y] = normal(vx * originDistance + towardX * (dt - originDistance) * 0.6, vy * originDistance + towardY * (dt - originDistance) * 0.6);
    m.vx = speed * x; m.vy = speed * y;
  }
}

/** Reading a view must not call movementOf(): that helper creates simulation state on unactivated objects. */
export function projectileView(world: World): ProjectileView[] {
  const objects = (world as World & { objects?(): readonly BpObject[] }).objects?.() ?? [];
  return objects.flatMap(object => {
    if (!(object instanceof 蓝图_发射物) || !object.valid || !object.已激活过) return [];
    const p = object as Shot, m = p.ProjectileMovement;
    return [{ id:p.id, cls:p.def.path, position:p.K2_GetActorLocation(), velocity:{x:m?.vx??0,y:m?.vy??0,z:0},
      yaw:p.ActorRotation?.Yaw??0, radius:sphereRadiusOf(p), active:p.激活, stopped:p.已开始结束,
      source:p.来自角色?.id??null, sourcePosition:p.来自角色?.K2_GetActorLocation()??null, ...p.ug_投射表现 }];
  });
}

export const projectile: SysModule & ProjectileFns & { deflectInSphere: typeof deflectInSphere } = {
  蓝图_发射物: 蓝图_发射物Fns, deflectInSphere, view: world => ({ projectiles: projectileView(world) }),
};

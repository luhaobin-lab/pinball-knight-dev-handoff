/**
 * The deterministic stand-in for Chaos on the Demo's physics movers (ARCHITECTURE §5.5; launch-movement §5.9, §J):
 * circle bodies (radius 宽度) moving in the plane against the room geometry and each other, through
 * `world.trace.sphere` (core-sim's traces over the src/core/launch geometry, so walls are the same as the hero's).
 *
 * - Restitution 1.0 and friction 0.4, both "Average" combined with the walls' 默认物理材质 (also 1.0 / 0.4).
 * - Stepped by the scheduler as a process at 1/120 s (the Demo's MaxSubstepDeltaTime 1/60 is a cap, not the step).
 * - The actor tick's 物理判断 (speed cap) runs at every canonical frame boundary for every tracked body.
 * - SPEC-GAP (LAUNCH-083, GAP-07, decision D5): the deceleration of physics movers is unknown and no capture of an
 *   enemy physics launch exists. Closest documented behaviour: Coulomb floor friction μ·g with the documented
 *   friction 0.4 and gravity 980 (`FLOOR_DECELERATION` = 392 uu/s²).
 * - Every contact fires the capsule's ComponentHit event on both actors (the event body, BP_ManeActor L4636, is
 *   the 碰撞时 / 弹性处理 path; it belongs to the actor's owners).
 */
import { BP_ManeActor } from '../../sim/actor.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';
import { makeHitResult } from '../../bp/structs.ts';
import type { BpObject } from '../../sim/object.ts';
import type { HitResult, Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { capsuleOf, collides, IsSimulatingPhysics, massOf, speedOf } from './capsule.ts';
import { moveEffectOverlaps } from './boss-overlap.ts';

export const RESTITUTION = 1.0;
export const FRICTION = 0.4;
/** SPEC-GAP (LAUNCH-083): μ (0.4) × |GravityZ| (980). */
export const FLOOR_DECELERATION = FRICTION * 980;
/** Bodies without a 宽度 (core-sim's trace default). */
export const DEFAULT_RADIUS = 28;
const MAX_HITS_PER_STEP = 4;

export interface Watcher {
  /** Runs at each frame boundary; returns false when done. */
  frame(): boolean;
}

interface Solver {
  readonly world: World;
  readonly bodies: BP_ManeActor[];
  readonly watchers: Watcher[];
  lastFrame: number;
  /** A moving substep owes its actor/effect observers one canonical frame, even when friction just zeroed it. */
  settleThroughFrame: number;
  readonly process: { step(dt: number): void; active(): boolean };
}

const solvers = new WeakMap<World, Solver>();

function solverOf(world: World): Solver {
  let s = solvers.get(world);
  if (s) return s;
  const self: Solver = {
    world,
    bodies: [],
    watchers: [],
    lastFrame: world.clock.frame,
    settleThroughFrame: world.clock.frame,
    process: {
      step: dt => stepSolver(self, dt),
      active: () => self.watchers.length > 0 || self.bodies.some(moving) || self.lastFrame < self.settleThroughFrame,
    },
  };
  solvers.set(world, self);
  return self;
}

const moving = (a: BP_ManeActor): boolean => {
  if (!a.valid || !IsSimulatingPhysics(a)) return false;
  const c = capsuleOf(a);
  return c.vx !== 0 || c.vy !== 0 || c.fx !== 0 || c.fy !== 0;
};

/** Registers a body with the world's solver (insertion order is the step order) and arms the process. */
export function track(world: World, a: BP_ManeActor): void {
  const s = solverOf(world);
  if (!s.bodies.includes(a)) s.bodies.push(a);
  world.clock.addProcess(s.process);
}

/** Runs `w.frame()` at every frame boundary until it returns false (the actor-tick checks such as 实时检测). */
export function watch(world: World, w: Watcher): void {
  const s = solverOf(world);
  s.watchers.push(w);
  world.clock.addProcess(s.process);
}

export function trackedBodies(world: World): readonly BP_ManeActor[] {
  return solverOf(world).bodies;
}

export const radiusOf = (a: BP_ManeActor): number => (a.宽度 > 0 ? a.宽度 : DEFAULT_RADIUS);

const isManeActor = (x: unknown): x is BP_ManeActor => x instanceof BP_ManeActor;

function stepSolver(s: Solver, dt: number): void {
  seedNearMissOverlaps(s);
  for (const a of [...s.bodies]) if (moving(a)) {
    // BP_ManeActor L4463 updates the cached speed at 60 Hz; 蓝图_效果_弹射 L1859/L2816 then ends the action.
    // Preserve that next ordinary frame after the last 120 Hz physics step, rather than idling between them.
    s.settleThroughFrame = s.world.clock.frame + 1;
    stepBody(s, a, dt);
  }
  const frame = s.world.clock.frame;
  if (frame !== s.lastFrame) {
    s.lastFrame = frame;
    // The actor tick (BP_ManeActor L4463: 物理判断 after the physics step).
    for (const a of [...s.bodies]) if (a.valid && IsSimulatingPhysics(a)) a.物理判断();
    for (let i = 0; i < s.watchers.length; i++) {
      if (!s.watchers[i]!.frame()) s.watchers.splice(i--, 1);
    }
  }
  for (let i = s.bodies.length - 1; i >= 0; i--) if (!s.bodies[i]!.valid) s.bodies.splice(i, 1);
}

function stepBody(s: Solver, a: BP_ManeActor, dt: number): void {
  const c = capsuleOf(a);
  const m = massOf(a);
  if (m > 0) {
    c.vx += (c.fx / m) * dt;
    c.vy += (c.fy / m) * dt;
  }
  c.fx = 0;
  c.fy = 0;
  // SPEC-GAP (LAUNCH-083): constant floor friction until rest.
  const sp = Math.hypot(c.vx, c.vy);
  if (sp > 0) {
    const k = Math.max(0, sp - FLOOR_DECELERATION * dt) / sp;
    c.vx *= k;
    c.vy *= k;
  }
  if (!collides(a)) {
    const p = a.K2_GetActorLocation();
    a.K2_SetActorLocation({ x: p.x + c.vx * dt, y: p.y + c.vy * dt, z: p.z });
    moveEffectOverlaps(s.world, a, p, a.K2_GetActorLocation());
    return;
  }
  let remaining = dt;
  const ignore: BpObject[] = [a];
  for (let n = 0; n < MAX_HITS_PER_STEP && remaining > 0 && (c.vx !== 0 || c.vy !== 0); n++) {
    const from = a.K2_GetActorLocation();
    const to = { x: from.x + c.vx * remaining, y: from.y + c.vy * remaining, z: from.z };
    const hit = firstBlocking(s.world, a, from, to, ignore);
    if (!hit) {
      a.K2_SetActorLocation(to);
      nearMissSegment(s, a, from, to);
      currencySegment(s, a, from, to);
      return;
    }
    const n2 = { x: hit.impactNormal.x, y: hit.impactNormal.y };
    const vn = c.vx * n2.x + c.vy * n2.y;
    if (hit.time === 0 && vn >= 0) {
      // Starting in contact and moving away: not blocking.
      if (isManeActor(hit.actor)) ignore.push(hit.actor);
      else { a.K2_SetActorLocation(to); nearMissSegment(s, a, from, to); currencySegment(s, a, from, to); return; }
      continue;
    }
    a.K2_SetActorLocation({ x: hit.location.x, y: hit.location.y, z: from.z });
    nearMissSegment(s, a, from, a.K2_GetActorLocation());
    currencySegment(s, a, from, a.K2_GetActorLocation());
    remaining *= 1 - hit.time;
    const other = isManeActor(hit.actor) && hit.actor.valid ? hit.actor : null;
    const impulse = respond(a, other, n2);
    fireHit(a, other, hit, impulse);
    if (other) {
      if (IsSimulatingPhysics(other)) track(s.world, other);
      fireHit(other, a, { ...hit, actor: a, impactNormal: { x: -n2.x, y: -n2.y, z: 0 }, normal: { x: -n2.x, y: -n2.y, z: 0 } }, impulse);
    }
  }
}

/** Engine overlap callbacks follow the moved segment before its blocking hit response. */
function currencySegment(s: Solver, actor: BP_ManeActor, from: Vec3, to: Vec3): void {
  moveEffectOverlaps(s.world, actor, from, to);
  if (actor !== s.world.mode.玩家角色) return;
  const launch = s.world.sys.launch as { consumeCurrencyAlongMove?(actor: BP_ManeActor, from: Vec3, to: Vec3): void };
  launch.consumeCurrencyAlongMove?.(actor, from, to);
}

type NearMissHero = BP_Actor_Player & { ug_nearMissOverlapIds?: number[] };
const nearbyActors = (s: Solver): BP_ManeActor[] => [...new Set([...s.world.mode.场上所有, ...s.bodies])]
  .filter((a): a is BP_ManeActor => a instanceof BP_ManeActor && a.valid && collides(a) && a !== s.world.mode.玩家角色);

/** Sphere on the hero versus the enemy's upright capsule; the hero collision width is not added twice. */
function overlapRadius(hero: BP_Actor_Player, other: BP_ManeActor, heroAt: Vec3, otherAt: Vec3): number {
  const sphere = Math.fround(hero.高度 * 1.4); // Player L16938: SetSphereRadius(float(高度 * 1.4), true)
  const r = radiusOf(other), cylinder = Math.max(other.高度, r) - r;
  const gap = Math.max(0, Math.abs(heroAt.z - otherAt.z) - cylinder);
  return gap > sphere + r ? -1 : Math.sqrt((sphere + r) ** 2 - gap ** 2);
}

/** Existing overlaps at the start of a physical step are not new BeginOverlap events (including spawn/teleport). */
function seedNearMissOverlaps(s: Solver): void {
  const hero = s.world.mode.玩家角色 as NearMissHero | null;
  if (!hero || !hero.valid || !collides(hero)) return;
  const h = hero.K2_GetActorLocation();
  hero.ug_nearMissOverlapIds = nearbyActors(s).filter(a => {
    const p = a.K2_GetActorLocation(), radius = overlapRadius(hero, a, h, p);
    return radius >= 0 && Math.hypot(p.x - h.x, p.y - h.y) <= radius;
  }).map(a => a.id);
}

/** Called only for segments the physics solver actually moved, never for preview or view/digest reads. */
function nearMissSegment(s: Solver, moved: BP_ManeActor, from: Vec3, to: Vec3): void {
  const hero = s.world.mode.玩家角色 as NearMissHero | null;
  if (!hero || !hero.valid || !collides(hero)) return;
  const actors = moved === hero ? nearbyActors(s) : [moved];
  for (const actor of actors) {
    if (actor === hero || !actor.valid || !collides(actor)) continue;
    const hp = hero.K2_GetActorLocation(), ap = actor.K2_GetActorLocation();
    const h0 = moved === hero ? from : hp, h1 = moved === hero ? to : hp;
    const a0 = moved === hero ? ap : from, a1 = moved === hero ? ap : to;
    const radius = overlapRadius(hero, actor, h1, a1);
    const ids = hero.ug_nearMissOverlapIds ??= [];
    const was = ids.includes(actor.id);
    const x = a0.x - h0.x, y = a0.y - h0.y;
    const dx = a1.x - h1.x - x, dy = a1.y - h1.y - y, d2 = dx * dx + dy * dy;
    const t = d2 > 0 ? Math.min(1, Math.max(0, -(x * dx + y * dy) / d2)) : 0;
    const touched = radius >= 0 && Math.hypot(x + t * dx, y + t * dy) <= radius;
    const inside = radius >= 0 && Math.hypot(a1.x - h1.x, a1.y - h1.y) <= radius;
    if (!was && touched) {
      hero.BndEvt__BP_Actor_Player_Sphere_K2Node_ComponentBoundEvent_1_ComponentBeginOverlapSignature__DelegateSignature(
        null, actor, null, 0, true, makeHitResult({ actor, location: a1, impactPoint: a1, blockingHit: false }),
      );
    }
    if (inside && !ids.includes(actor.id)) ids.push(actor.id);
    if (!inside) { const i = ids.indexOf(actor.id); if (i >= 0) ids.splice(i, 1); }
  }
}

function firstBlocking(world: World, a: BP_ManeActor, from: Vec3, to: Vec3, ignore: readonly BpObject[]): HitResult | null {
  const hits = world.trace.sphere(from, to, radiusOf(a), 'Pawn', ignore);
  for (const h of hits) {
    if (!h.blockingHit) continue; // Source overlap-only primitives are contacts, not blocking wall hits.
    if (isManeActor(h.actor) && (!h.actor.valid || !collides(h.actor))) continue;
    return h;
  }
  return null;
}

/**
 * Contact response along the normal n (pointing from the touched solid towards `a`). A static solid or a body that
 * does not simulate has infinite mass. Returns |normal impulse| (for the hit event's NormalImpulse).
 */
function respond(a: BP_ManeActor, other: BP_ManeActor | null, n: { x: number; y: number }): number {
  const ca = capsuleOf(a);
  const dynamic = other !== null && IsSimulatingPhysics(other);
  const cb = dynamic ? capsuleOf(other) : null;
  const vrel = (ca.vx - (cb?.vx ?? 0)) * n.x + (ca.vy - (cb?.vy ?? 0)) * n.y;
  if (vrel >= 0) return 0;
  const ma = massOf(a);
  const mb = dynamic ? massOf(other) : Infinity;
  const inv = 1 / ma + (Number.isFinite(mb) ? 1 / mb : 0);
  const j = (-(1 + RESTITUTION) * vrel) / inv;
  // Tangential friction impulse, capped at μ·j and at what stops the relative sliding.
  const tx = -n.y, ty = n.x;
  const vt = (ca.vx - (cb?.vx ?? 0)) * tx + (ca.vy - (cb?.vy ?? 0)) * ty;
  const jt = Math.sign(vt) * Math.min(FRICTION * j, Math.abs(vt) / inv);
  ca.vx += (j * n.x - jt * tx) / ma;
  ca.vy += (j * n.y - jt * ty) / ma;
  if (cb && Number.isFinite(mb)) {
    cb.vx -= (j * n.x - jt * tx) / mb;
    cb.vy -= (j * n.y - jt * ty) / mb;
  }
  return j;
}

function fireHit(self: BP_ManeActor, other: BP_ManeActor | null, hit: HitResult, impulse: number): void {
  const n = hit.impactNormal;
  self.BndEvt__蓝图_角色_CapsuleComponent_K2Node_ComponentBoundEvent_1_ComponentHitSignature__DelegateSignature(
    null, other, null, { x: n.x * impulse, y: n.y * impulse, z: 0 }, hit,
  );
}

/** Settled: true when the body is at rest (the Demo's movers end below 5 uu/s, LAUNCH-094). */
export const isAtRest = (a: BP_ManeActor): boolean => speedOf(a) < 5;

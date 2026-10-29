/**
 * The UE capsule body of a BP_ManeActor (`CapsuleComponent`: AddImpulse, AddForce, Get/SetPhysicsLinearVelocity,
 * SetMassOverrideInKg, LaunchCharacter) as plain data on the actor, so it is part of the digest
 * (src/core/sim/digest.ts walks own fields), like core-sim's engine state.
 *
 * SetSimulatePhysics / SetCollisionEnabled are written by the kernel's 开启碰撞 / 关闭碰撞 (core-ability) into
 * `可物理模拟` and `ug_碰撞开启`; this module only reads them.
 *
 * The planar frame is src/core/launch's (x east, y south; z up). The capsule's Z translation is locked
 * (launch-movement §5.9), so velocities are planar.
 */
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { Vec3 } from '../../sim/types.ts';

export interface CapsuleBody {
  /** Linear velocity in uu/s (z stays 0: Z translation locked). */
  vx: number;
  vy: number;
  /** SetMassOverrideInKg; null = the engine's own mass. */
  mass: number | null;
  /** AddForce accumulated for the next step, cleared after it (UE clears forces every substep). */
  fx: number;
  fy: number;
}

/** SPEC-GAP: the mass Chaos derives from the capsule volume is unknown; 更新角色质量 always overrides it. */
export const DEFAULT_MASS = 100;

type WithCapsule = BP_ManeActor & { CapsuleComponent?: CapsuleBody; ug_碰撞开启?: boolean };

export function capsuleOf(a: BP_ManeActor): CapsuleBody {
  const o = a as WithCapsule;
  if (!o.CapsuleComponent) o.CapsuleComponent = { vx: 0, vy: 0, mass: null, fx: 0, fy: 0 };
  return o.CapsuleComponent;
}

/** IsSimulatingPhysics: the kernel's 开启碰撞 sets it (not for 可交互.修炼牌 / 可交互.角色.AI.不可动). */
export function IsSimulatingPhysics(a: BP_ManeActor): boolean {
  return a.可物理模拟;
}

/** CollisionEnabled ≠ NoCollision (the CDO capsule collides until 关闭碰撞). */
export function collides(a: BP_ManeActor): boolean {
  return (a as WithCapsule).ug_碰撞开启 ?? true;
}

/** UE body mass in kg. */
export function massOf(a: BP_ManeActor): number {
  return capsuleOf(a).mass ?? DEFAULT_MASS;
}

export function SetMassOverrideInKg(a: BP_ManeActor, kg: number): void {
  capsuleOf(a).mass = Math.fround(kg);
}

/** UPrimitiveComponent::AddImpulse(bVelChange = false): Δv = I / mass, planar. No effect unless simulating. */
export function AddImpulse(a: BP_ManeActor, impulse: Vec3): void {
  if (!IsSimulatingPhysics(a)) return;
  const m = massOf(a);
  if (m <= 0) return;
  const c = capsuleOf(a);
  c.vx += impulse.x / m;
  c.vy += impulse.y / m;
}

/** UPrimitiveComponent::AddForce(bAccelChange = false): integrated over the next step. No effect unless simulating. */
export function AddForce(a: BP_ManeActor, force: Vec3): void {
  if (!IsSimulatingPhysics(a)) return;
  const c = capsuleOf(a);
  c.fx += force.x;
  c.fy += force.y;
}

/** GetPhysicsLinearVelocity: zero for a body that does not simulate. */
export function GetPhysicsLinearVelocity(a: BP_ManeActor): Vec3 {
  if (!IsSimulatingPhysics(a)) return { x: 0, y: 0, z: 0 };
  const c = capsuleOf(a);
  return { x: c.vx, y: c.vy, z: 0 };
}

export function SetPhysicsLinearVelocity(a: BP_ManeActor, v: Vec3): void {
  if (!IsSimulatingPhysics(a)) return;
  const c = capsuleOf(a);
  c.vx = v.x;
  c.vy = v.y;
}

/**
 * ACharacter::LaunchCharacter stores a pending launch velocity that only the CharacterMovement tick applies. The
 * ManeActor's CharMoveComp has bAutoActivate false and its tick disabled (launch-movement §5.9), so the call has no
 * effect (the corpse launch ENEMIE-087, the dead 冲击目标). SPEC-GAP: inferred from the component flags.
 */
export function LaunchCharacter(_a: BP_ManeActor, _v: Vec3): void {}

/** VSize(GetPhysicsLinearVelocity). */
export function speedOf(a: BP_ManeActor): number {
  const v = GetPhysicsLinearVelocity(a);
  return Math.hypot(v.x, v.y);
}

/** Vector_Normal2D(v, tolerance): the planar unit vector, zero when x² + y² ≤ tolerance. */
export function Normal2D(v: Vec3, tolerance = 1e-4): Vec3 {
  const s = v.x * v.x + v.y * v.y;
  if (s <= tolerance) return { x: 0, y: 0, z: 0 };
  const k = 1 / Math.sqrt(s);
  return { x: v.x * k, y: v.y * k, z: 0 };
}

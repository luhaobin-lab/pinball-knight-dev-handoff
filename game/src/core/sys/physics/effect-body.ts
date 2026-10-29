/** Independent root-sphere bodies for source effects. No ManeActor damage, attack or role semantics are attached.
 * Electric-ball radius32 is verified in this binary's USphereComponent ctor (0x14392c69c, field0x550).
 * SPEC-GAP: damping is integrated as linear drag at the existing120Hz simulation step; Chaos sleep, contact offsets
 * and exact constraint iteration order have no original trace. This is not bit-identical Chaos certification.
 */
import { BpObject } from '../../sim/object.ts';
import type { Vec3, HitResult } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { BP_ManeActor } from '../../sim/actor.ts';
import { RESTITUTION, FRICTION } from './solver.ts';
import { pickupBoxObjectType } from './pickup-box.ts';

export type SphereResponse = 'ignore' | 'overlap' | 'block';
export interface EffectSphereConfig {
  radius: number; mass: number; linearDamping: number;
  objectType: string; defaultResponse: SphereResponse; responses: Readonly<Record<string, SphereResponse>>;
}
export interface EffectSphereState extends EffectSphereConfig {
  enabled: boolean; simulating: boolean; vx: number; vy: number; fx: number; fy: number;
}
type SphereActor = BpObject & { ug_effectSphere?: EffectSphereState };
const objects = (w: World): readonly BpObject[] => (w as World & { objects?(): readonly BpObject[] }).objects?.() ?? [];
export const effectSphereState = (actor: BpObject): EffectSphereState | undefined => (actor as SphereActor).ug_effectSphere;

/** Component construction, separate from SetSimulatePhysics; QueryAndPhysics is already enabled before .8s. */
export function registerEffectSphere(actor: BpObject, config: EffectSphereConfig): void {
  if (effectSphereState(actor)) return;
  (actor as SphereActor).ug_effectSphere = { ...config, responses: { ...config.responses }, enabled: true,
    simulating: false, vx: 0, vy: 0, fx: 0, fy: 0 };
}
export function simulateEffectSphere(actor: BpObject, on: boolean): void {
  const state = effectSphereState(actor); if (!actor.valid || !state) return;
  state.simulating = on;
  if (on) { actor.K2_DetachFromActor(); arm(actor.world); } // UE SetSimulatePhysics detaches an attached simple body.
}
export function impulseEffectSphere(actor: BpObject, impulse: Vec3): void {
  const state = effectSphereState(actor); if (!actor.valid || !state?.simulating || !(state.mass > 0)) return;
  state.vx += impulse.x / state.mass; state.vy += impulse.y / state.mass; arm(actor.world); // locked Z and rotation
}
export function forceEffectSphere(actor: BpObject, force: Vec3): void {
  const state = effectSphereState(actor); if (!actor.valid || !state?.simulating) return;
  state.fx += force.x; state.fy += force.y; arm(actor.world);
}
const channelName = (channel: string): string => ({ '0': 'Visibility', '1': 'Camera', '2': 'mouse', '3': '可伤害', '4': '地形', '5': '物品', '6': '迷雾' }[channel] ?? channel);
export function effectSphereResponse(actor: BpObject, channel: string): SphereResponse {
  const state = effectSphereState(actor);
  return !actor.valid || !state?.enabled ? 'ignore' : state.responses[channelName(channel)] ?? state.defaultResponse;
}
/** Pure projection: querying/previewing/digesting never creates or steps physics state. */
export function effectBodyShapes(world: World, channel: string): { actor: BpObject; id: string; x: number; y: number; radius: number; blocking: boolean }[] {
  const rows = [];
  for (const actor of objects(world)) {
    const state = effectSphereState(actor), response = effectSphereResponse(actor, channel);
    if (!state || response === 'ignore') continue;
    const at = actor.K2_GetActorLocation();
    rows.push({ actor, id: `#${actor.id}`, x: at.x, y: at.y, radius: state.radius, blocking: response === 'block' });
  }
  return rows;
}

const processes = new WeakMap<World, { step(dt: number): void; active(): boolean }>();
const moving = (actor: BpObject): boolean => {
  const s = effectSphereState(actor);
  return actor.valid && !!s?.enabled && s.simulating && (s.vx !== 0 || s.vy !== 0 || s.fx !== 0 || s.fy !== 0);
};
function arm(world: World): void {
  let process = processes.get(world);
  if (!process) {
    process = { active: () => objects(world).some(moving), step: dt => { for (const actor of objects(world)) if (moving(actor)) stepBody(actor, dt); } };
    processes.set(world, process);
  }
  world.clock.addProcess(process);
}
function firstBlocking(actor: BpObject, from: Vec3, to: Vec3, ignore: readonly BpObject[]): HitResult | undefined {
  const s = effectSphereState(actor)!;
  return actor.world.trace.sphere(from, to, s.radius, s.objectType, ignore).find(hit => {
    if (!hit.blockingHit) return false;
    const kind = hit.actor instanceof BP_ManeActor ? 'Pawn' : hit.actor instanceof BpObject ? effectSphereState(hit.actor)?.objectType ?? pickupBoxObjectType(hit.actor) ?? 'WorldStatic' : 'WorldStatic';
    return effectSphereResponse(actor, kind) === 'block';
  });
}
function stepBody(actor: BpObject, dt: number): void {
  const s = effectSphereState(actor)!;
  s.vx += s.fx / s.mass * dt; s.vy += s.fy / s.mass * dt; s.fx = 0; s.fy = 0;
  // A linear damping coefficient is drag proportional to velocity. The exact UE5.7 discrete integration remains a gap.
  const drag = Math.max(0, 1 - s.linearDamping * dt); s.vx *= drag; s.vy *= drag;
  let remaining = dt; const ignore: BpObject[] = [actor];
  for (let i = 0; i < 4 && remaining > 0 && (s.vx !== 0 || s.vy !== 0); i++) { // same bounded contact loop as the actor solver
    const from = actor.K2_GetActorLocation(), to = { x: from.x + s.vx * remaining, y: from.y + s.vy * remaining, z: from.z };
    const hit = firstBlocking(actor, from, to, ignore);
    if (!hit) { actor.K2_SetActorLocation(to); return; }
    const n = hit.impactNormal, vn = s.vx * n.x + s.vy * n.y;
    if (hit.time === 0 && vn >= 0) { if (hit.actor instanceof BpObject) { ignore.push(hit.actor); continue; } actor.K2_SetActorLocation(to); return; }
    actor.K2_SetActorLocation({ x: hit.location.x, y: hit.location.y, z: from.z }); remaining *= 1 - hit.time;
    const other = hit.actor instanceof BpObject ? effectSphereState(hit.actor) : undefined;
    const dynamic = !!other?.simulating, invA = 1 / s.mass, invB = dynamic ? 1 / other.mass : 0;
    const rx = s.vx - (dynamic ? other.vx : 0), ry = s.vy - (dynamic ? other.vy : 0), relative = rx * n.x + ry * n.y;
    if (relative >= 0) continue;
    // Same source default material restitution1/friction.4 and normal/tangential impulse as solver.respond.
    const j = -(1 + RESTITUTION) * relative / (invA + invB), tx = -n.y, ty = n.x;
    const tangent = rx * tx + ry * ty, jt = Math.sign(tangent) * Math.min(FRICTION * j, Math.abs(tangent) / (invA + invB));
    s.vx += (j * n.x - jt * tx) * invA; s.vy += (j * n.y - jt * ty) * invA;
    if (dynamic) { other.vx -= (j * n.x - jt * tx) * invB; other.vy -= (j * n.y - jt * ty) * invB; }
    // Source ball has no ComponentHit handler; do not route this contact through BP_ManeActor's damage callbacks.
  }
}

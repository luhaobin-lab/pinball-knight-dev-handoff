/** Live terrain collision and the vertical axis-aligned box query used by F-FISSD L1903. */
import type { SolidBoxDef } from '../../launch/index.ts';
import { BP_ManeActor } from '../../sim/actor.ts';
import type { BpObject } from '../../sim/object.ts';
import type { HitResult, Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { collides } from './capsule.ts';
import { queryProfileEnabled } from '../../sim/collision-profile.ts';

type TerrainActor = BpObject & { ug_terrainCollision?: { enabled: boolean; half: Vec3 } };
const objects = (w: World): readonly BpObject[] => (w as World & { objects?(): readonly BpObject[] }).objects?.() ?? [];

export function setTerrainCollision(actor: BpObject, enabled: boolean, half: Vec3): void {
  (actor as TerrainActor).ug_terrainCollision = { enabled, half: { ...half } };
}

export function dynamicTerrainBoxes(world: World): SolidBoxDef[] {
  const result: SolidBoxDef[] = [];
  for (const actor of objects(world)) {
    const state = (actor as TerrainActor).ug_terrainCollision;
    if (!actor.valid || !state?.enabled) continue;
    const p = actor.K2_GetActorLocation(), h = state.half;
    result.push({ id: `terrain:${actor.id}`, minX: p.x - h.x, maxX: p.x + h.x, minY: p.y - h.y, maxY: p.y + h.y, tags: actor.OwnedGameplayTags.toArray() });
  }
  return result;
}

/** BoxTraceSingle (axis-aligned vertical sweep): rectangle-vs-capsule footprint, then vertical extent; id-order tie. */
export function boxTraceActors(world: World, from: Vec3, to: Vec3, half: Vec3, ignore: readonly (BpObject | null)[]): HitResult | null {
  let best: HitResult | null = null;
  for (const actor of objects(world)) {
    if (!(actor instanceof BP_ManeActor) || !actor.valid || !collides(actor) || !queryProfileEnabled(actor) || ignore.includes(actor)) continue;
    const p = actor.K2_GetActorLocation(), radius = actor.宽度 > 0 ? actor.宽度 : 28;
    const dx = Math.max(Math.abs(p.x - from.x) - half.x, 0), dy = Math.max(Math.abs(p.y - from.y) - half.y, 0);
    if (dx * dx + dy * dy > radius * radius) continue;
    const capHalf = Math.max(actor.高度, radius), capsuleCore = capHalf - radius;
    const roundedReach = Math.sqrt(Math.max(0, radius * radius - dx * dx - dy * dy));
    const lo = p.z - capsuleCore - roundedReach - half.z, hi = p.z + capsuleCore + roundedReach + half.z;
    const dz = to.z - from.z;
    const t = from.z >= lo && from.z <= hi ? 0 : dz > 0 ? (lo - from.z) / dz : dz < 0 ? (hi - from.z) / dz : Infinity;
    if (t < 0 || t > 1 || best && t >= best.time) continue;
    const at = { x: from.x, y: from.y, z: from.z + dz * t };
    best = { actor, location: at, impactPoint: at, normal: { x: 0, y: 0, z: dz >= 0 ? -1 : 1 }, impactNormal: { x: 0, y: 0, z: dz >= 0 ? -1 : 1 }, blockingHit: true, time: t, distance: Math.abs(dz) * t };
  }
  return best;
}

/** Sphere-vs-upright capsule on a vertical 可伤害 sweep; terrain must not occlude damageable actors. */
export function sphereTraceActors(world: World, from: Vec3, to: Vec3, radius: number, ignore: readonly (BpObject | null)[]): HitResult[] {
  const result: HitResult[] = [];
  for (const actor of objects(world)) {
    if (!(actor instanceof BP_ManeActor) || !actor.valid || !collides(actor) || !queryProfileEnabled(actor) || ignore.includes(actor)) continue;
    const p = actor.K2_GetActorLocation(), r = actor.宽度 > 0 ? actor.宽度 : 28;
    const x = from.x - p.x, y = from.y - p.y, planar2 = x * x + y * y, sum = radius + r;
    if (planar2 > sum * sum) continue;
    const extent = Math.sqrt(Math.max(0, sum * sum - planar2)) + Math.max(actor.高度 - r, 0);
    const lo = p.z - extent, hi = p.z + extent, dz = to.z - from.z;
    const t = from.z >= lo && from.z <= hi ? 0 : dz > 0 ? (lo - from.z) / dz : dz < 0 ? (hi - from.z) / dz : Infinity;
    if (t < 0 || t > 1) continue;
    const planar = Math.sqrt(planar2), nx = planar > 0 ? x / planar : 0, ny = planar > 0 ? y / planar : 0;
    const at = { x: from.x, y: from.y, z: from.z + dz * t };
    result.push({ actor, location: at, impactPoint: { x: p.x + nx * r, y: p.y + ny * r, z: p.z }, normal: { x: nx, y: ny, z: 0 }, impactNormal: { x: nx, y: ny, z: 0 }, blockingHit: true, time: t, distance: Math.abs(dz) * t });
  }
  return result.sort((a, b) => a.time - b.time);
}

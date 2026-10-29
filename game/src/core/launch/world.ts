/**
 * The launch's collision world: a top-down plane in uu (x east, y south = the renderer's z) holding the room
 * walls (a floor-cell grid), static solids (circles, boxes), dynamic bodies (the Demo's BP_ManeActors: enemies)
 * and pickups.
 *
 * Queries reproduce the UE sweep semantics the Demo's native code relies on (CollisionConversions.cpp,
 * native-trajectory §4) on ideal geometry: a hit's location is the probe centre at first contact (no pull-back);
 * a sweep that starts overlapping a solid reports `startPenetrating` with time 0, the minimum-translation normal
 * and its depth, whatever the direction of travel. Walls and boxes are infinitely tall prisms; bodies are upright
 * capsules standing on the floor, so a probe at another height touches them at a smaller planar distance.
 * SPEC-GAP: Chaos contact offsets and touching tolerances are unknown (native-trajectory U-04); ideal geometry
 * is what the spec's test vectors use.
 */
import { type Vec2, add, clamp, distance, dot, length, mul, sub, vec, ZERO } from './math.ts';
import { UU_PER_TILE } from './units.ts';

/** Gameplay tags the launch code tests (exact spelling matters; a container also matches parent tags). */
export const TAG = {
  bouncyRoom: '环境.房间.有弹性',
  roomWall: '环境.房间.墙壁',
  hostile: '可交互.角色.AI.仇恨',
  player: '可交互.角色.玩家',
  aiItem: '可交互.角色.AI.物品',
  slowPickup: '环境.类型.可拾取物.减速',
  environment: '可交互.角色.环境',
  pickup: '环境.类型.可拾取物',
} as const;

/** Class of the Demo's room-wall actor; 判断目标可反弹 accepts it by class. */
export const DYNAMIC_MESH_CLASS = '蓝图_动态网格_C';

/** FGameplayTagContainer::HasTag: the tag itself or any of its child tags in the container. */
export const hasTag = (tags: readonly string[], tag: string): boolean => tags.some(t => t === tag || t.startsWith(tag + '.'));

/**
 * Component family of an actor's blocking shape. The native leg-start recovery treats UE primitive components
 * (sphere, capsule, box) more leniently than meshes; the Demo's room walls are a single dynamic mesh
 * (蓝图_房间 spawns one 蓝图_动态网格: a box minus the extruded floor polygon, complex-as-simple collision).
 */
export type ShapeKind = 'mesh' | 'box' | 'sphere' | 'capsule';

export interface LaunchActor {
  readonly id: string;
  /**
   * `wall` = the room walls (one actor for the whole grid, like the Demo's single dynamic mesh), `solid` = a static
   * circle or box (decorations, air walls), `body` = a dynamic body (a BP_ManeActor: an enemy). Bodies get the
   * melee attack and the mirrored contact (launch-movement LAUNCH-054/057).
   */
  readonly kind: 'wall' | 'solid' | 'body';
  readonly shape: ShapeKind;
  readonly tags: readonly string[];
  readonly classes: readonly string[];
}

/**
 * Same format as src/procgen/architecture/layout.ts: 1 = floor, row-major `z * width + x`; cell (x, z) covers
 * tiles [x, x+1] × [z, z+1], i.e. uu [64x, 64x+64] × [64z, 64z+64] plus `origin` when present. Every other cell, and everything outside the
 * grid, is wall.
 */
export interface FloorGrid {
  readonly width: number;
  readonly depth: number;
  readonly cells: Uint8Array;
  /** World-space lower cell boundary in uu. Legacy reference rooms default to (0, 0). */
  readonly origin?: Vec2;
}

export interface SolidBoxDef {
  readonly id: string;
  /** Axis-aligned extent in uu. */
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  /** Rotation in radians about the unrotated box centre; source authored child airwalls use this exact OBB. */
  readonly angle?: number;
  /** Default [环境.房间.有弹性] (bounceable, like 蓝图_空气墙 and the bouncy decorations). */
  readonly tags?: readonly string[];
  /** Default 'box' (a UBoxComponent, like 蓝图_空气墙). */
  readonly shape?: 'box' | 'mesh';
}

export interface SolidCircleDef {
  readonly id: string;
  /** Centre and radius in uu. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /**
   * Default [环境.房间.有弹性] (a bouncy decoration: 棺材, 火盆, 罐子). Decorations tagged only 可交互.角色.环境
   * (弹力法阵, 解密柱子) still block but end the chain (launch-movement §5.10).
   */
  readonly tags?: readonly string[];
  /** Default 'sphere'. */
  readonly shape?: 'sphere' | 'mesh';
}

export interface BodyDef {
  readonly id: string;
  /** Centre in uu. */
  readonly x: number;
  readonly y: number;
  /** Capsule radius = the row's 宽度. */
  readonly radius: number;
  /** Capsule half-height = the row's 高度 (every Demo enemy row has 高度 = 宽度); default `radius`. */
  readonly halfHeight?: number;
  /**
   * The bounce flags, as the Demo's gameplay tags. Default [可交互.角色.AI.仇恨]: hostile (enemy marker, melee
   * target, hit-stop) and therefore bounceable. A body without any tag of 判断目标可反弹 ends the chain.
   */
  readonly tags?: readonly string[];
}

export interface GravityDef {
  readonly strength: number;
  readonly radius: number;
  readonly mode?: 'attract' | 'repel';
  readonly enabled?: boolean;
  /** Its pull ends once the preview passes the pickup; ULaunchGravitySourceComponent's default is true. */
  readonly disableAfterPreviewPickup?: boolean;
}

export interface PickupDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Radius of its 物品-channel overlap sphere (激活范围, template 50; SPEC-GAP U-11: runtime scale unknown). */
  readonly radius: number;
  readonly tags?: readonly string[];
  /** A 回弹漩涡 (蓝图_可拾取物_加速点) carries 弹射引力: Strength 1.4, Radius 500. */
  readonly gravity?: GravityDef;
}

/** ALaunchGravityPoint (supported by the native code; no shipped level places one). */
export interface GravityPointDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly strength?: number;
  readonly radius?: number;
  readonly mode?: 'attract' | 'repel';
  readonly enabled?: boolean;
}

/** Everything the launch collides with or steers by. All positions and sizes are in uu (src/core/launch/units.ts). */
export interface LaunchWorldDef {
  /** Room floor; every non-floor cell, and everything outside the grid, is wall. */
  readonly grid?: FloorGrid;
  /** Actor id of the walls (default 'walls'). */
  readonly wallId?: string;
  /** Tags of the wall actor (default none: walls bounce by class, like 蓝图_动态网格). */
  readonly wallTags?: readonly string[];
  readonly boxes?: readonly SolidBoxDef[];
  readonly circles?: readonly SolidCircleDef[];
  readonly bodies?: readonly BodyDef[];
  readonly pickups?: readonly PickupDef[];
  readonly gravityPoints?: readonly GravityPointDef[];
}

export interface Gravity {
  readonly strength: number;
  readonly radius: number;
  readonly mode: 'attract' | 'repel';
  readonly enabled: boolean;
  readonly disableAfterPreviewPickup: boolean;
}

export interface Pickup {
  readonly id: string;
  readonly position: Vec2;
  readonly radius: number;
  readonly tags: readonly string[];
  readonly gravity: Gravity | null;
}

export interface GravityPoint {
  readonly id: string;
  readonly position: Vec2;
  readonly strength: number;
  readonly radius: number;
  readonly mode: 'attract' | 'repel';
  readonly enabled: boolean;
}

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly angle?: number;
}

interface BoxSolid extends Box {
  readonly actor: LaunchActor;
}

/** A static cylinder (infinite axis) or a body's upright capsule (axis from zLow to zHigh). */
interface CircleSolid {
  readonly center: Vec2;
  readonly radius: number;
  readonly zLow: number;
  readonly zHigh: number;
  readonly actor: LaunchActor;
}

export interface LaunchWorld {
  readonly actors: ReadonlyMap<string, LaunchActor>;
  readonly grid: (FloorGrid & { readonly actor: LaunchActor }) | null;
  readonly boxes: readonly BoxSolid[];
  readonly circles: readonly CircleSolid[];
  readonly pickups: readonly Pickup[];
  readonly gravityPoints: readonly GravityPoint[];
}

/** The probe swept along a path: a sphere (halfHeight = radius) or an upright capsule, centred at height z. */
export interface Probe {
  readonly radius: number;
  readonly halfHeight: number;
  readonly z: number;
}

/** A blocking hit (the FHitResult fields the launch code reads). */
export interface Hit {
  readonly actor: LaunchActor;
  /** Fraction of the sweep; 0 for initial overlaps. */
  readonly time: number;
  /** Probe centre at contact. */
  readonly location: Vec2;
  /** Contact point on the solid's surface (planar projection). */
  readonly impactPoint: Vec2;
  /** Unit planar contact normal, pointing away from the solid (Normal = ImpactNormal on this geometry). */
  readonly normal: Vec2;
  readonly startPenetrating: boolean;
  readonly penetrationDepth: number;
  readonly traceStart: Vec2;
  readonly traceEnd: Vec2;
}

export interface PickupHit {
  readonly pickup: Pickup;
  readonly time: number;
  readonly location: Vec2;
}

/**
 * Starts within this distance of contact count as touching rather than penetrating, so the end of a leg (at
 * contact, up to rounding) never makes the next sweep start inside the solid it just touched.
 */
const PENETRATION_SLOP = 1e-6;

export function createLaunchWorld(def: LaunchWorldDef): LaunchWorld {
  const actors = new Map<string, LaunchActor>();
  const ids = new Set<string>();
  const claim = (id: string): void => {
    if (ids.has(id)) throw new Error(`launch world: duplicate id "${id}"`);
    ids.add(id);
  };
  const addActor = (actor: LaunchActor): LaunchActor => {
    claim(actor.id);
    actors.set(actor.id, actor);
    return actor;
  };
  const tagList = (tags: readonly string[]): readonly string[] => Object.freeze(tags.slice());

  let grid: LaunchWorld['grid'] = null;
  if (def.grid) {
    const g = def.grid;
    if (!Number.isInteger(g.width) || !Number.isInteger(g.depth) || g.width < 1 || g.depth < 1 || g.cells.length !== g.width * g.depth) {
      throw new Error(`launch world: invalid grid ${g.width}x${g.depth} with ${g.cells.length} cells`);
    }
    const actor = addActor({ id: def.wallId ?? 'walls', kind: 'wall', shape: 'mesh', tags: tagList(def.wallTags ?? []), classes: tagList([DYNAMIC_MESH_CLASS]) });
    grid = { width: g.width, depth: g.depth, cells: g.cells.slice(), ...(g.origin ? { origin: { ...g.origin } } : {}), actor };
  }

  const boxes = (def.boxes ?? []).map((b): BoxSolid => {
    if (!(b.minX < b.maxX && b.minY < b.maxY)) throw new Error(`launch world: box "${b.id}" is empty`);
    const actor = addActor({ id: b.id, kind: 'solid', shape: b.shape ?? 'box', tags: tagList(b.tags ?? [TAG.bouncyRoom]), classes: tagList([]) });
    return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, ...(b.angle ? { angle:b.angle } : {}), actor };
  });

  const circles: CircleSolid[] = [];
  for (const c of def.circles ?? []) {
    if (!(c.radius > 0)) throw new Error(`launch world: circle "${c.id}" needs a positive radius`);
    const actor = addActor({ id: c.id, kind: 'solid', shape: c.shape ?? 'sphere', tags: tagList(c.tags ?? [TAG.bouncyRoom]), classes: tagList([]) });
    circles.push({ center: vec(c.x, c.y), radius: c.radius, zLow: -Infinity, zHigh: Infinity, actor });
  }
  for (const b of def.bodies ?? []) {
    if (!(b.radius >= 0)) throw new Error(`launch world: body "${b.id}" needs a radius`);
    const actor = addActor({ id: b.id, kind: 'body', shape: 'capsule', tags: tagList(b.tags ?? [TAG.hostile]), classes: tagList([]) });
    // UE keeps a capsule's HalfHeight >= Radius; the capsule stands on the floor (actor Z = 高度).
    const halfHeight = Math.max(b.halfHeight ?? b.radius, b.radius);
    circles.push({ center: vec(b.x, b.y), radius: b.radius, zLow: b.radius, zHigh: 2 * halfHeight - b.radius, actor });
  }

  const pickups = (def.pickups ?? []).map((p): Pickup => {
    claim(p.id);
    const g = p.gravity;
    const gravity: Gravity | null = g
      ? { strength: g.strength, radius: g.radius, mode: g.mode ?? 'attract', enabled: g.enabled ?? true, disableAfterPreviewPickup: g.disableAfterPreviewPickup ?? true }
      : null;
    return { id: p.id, position: vec(p.x, p.y), radius: p.radius, tags: tagList(p.tags ?? [TAG.pickup]), gravity };
  });

  // ALaunchGravityPoint constructor defaults: Strength 1, Radius 600, Attract, enabled (exe@0x1445a6977–0x1445a6992).
  const gravityPoints = (def.gravityPoints ?? []).map((p): GravityPoint => {
    claim(p.id);
    return { id: p.id, position: vec(p.x, p.y), strength: p.strength ?? 1, radius: p.radius ?? 600, mode: p.mode ?? 'attract', enabled: p.enabled ?? true };
  });

  return { actors, grid, boxes, circles, pickups, gravityPoints };
}

// ---------------------------------------------------------------- shape primitives

interface Penetration {
  /** > 0 when overlapping; negative = separation. */
  readonly depth: number;
  readonly normal: Vec2;
  readonly impact: Vec2;
}

interface Entry {
  readonly t: number;
  readonly normal: Vec2;
  readonly impact: Vec2;
}

/** Contact geometry of a circle solid for one probe: planar contact distance from the vertical axis gap. */
interface CircleContact {
  readonly rho: number;
  readonly gap: number;
  readonly sum: number;
}

type Shape =
  | { readonly kind: 'box'; readonly box: Box; readonly actor: LaunchActor }
  | { readonly kind: 'circle'; readonly circle: CircleSolid; readonly contact: CircleContact; readonly actor: LaunchActor };

function boxPenetration(p: Vec2, b: Box, rho: number): Penetration {
  if(b.angle){
    const result=boxPenetration(boxLocal(p,b),{...b,angle:0},rho);
    return {...result,normal:boxRotate(result.normal,b.angle),impact:boxGlobal(result.impact,b)};
  }
  const q = vec(clamp(p.x, b.minX, b.maxX), clamp(p.y, b.minY, b.maxY));
  const gap = distance(p, q);
  if (gap > 0) return { depth: rho - gap, normal: mul(sub(p, q), 1 / gap), impact: q };
  // Centre inside the box: push out through the nearest face.
  const faces: readonly [number, Vec2, Vec2][] = [
    [p.x - b.minX, vec(-1, 0), vec(b.minX, p.y)],
    [b.maxX - p.x, vec(1, 0), vec(b.maxX, p.y)],
    [p.y - b.minY, vec(0, -1), vec(p.x, b.minY)],
    [b.maxY - p.y, vec(0, 1), vec(p.x, b.maxY)],
  ];
  let best = faces[0];
  for (const f of faces) if (f[0] < best[0]) best = f;
  return { depth: rho + best[0], normal: best[1], impact: best[2] };
}

const boxRotate=(p:Vec2,angle:number):Vec2=>{const c=Math.cos(angle),s=Math.sin(angle);return vec(p.x*c-p.y*s,p.x*s+p.y*c);};
function boxLocal(p:Vec2,b:Box):Vec2 {const centre=vec((b.minX+b.maxX)/2,(b.minY+b.maxY)/2);return add(centre,boxRotate(sub(p,centre),-(b.angle??0)));}
function boxGlobal(p:Vec2,b:Box):Vec2 {const centre=vec((b.minX+b.maxX)/2,(b.minY+b.maxY)/2);return add(centre,boxRotate(sub(p,centre),b.angle??0));}

function circlePenetration(p: Vec2, c: CircleSolid, contact: CircleContact): Penetration {
  const offset = sub(p, c.center);
  const planar = length(offset);
  const spatial = Math.sqrt(planar * planar + contact.gap * contact.gap);
  const normal = planar > 0 ? mul(offset, 1 / planar) : ZERO;
  return { depth: contact.sum - spatial, normal, impact: add(c.center, mul(offset, c.radius / Math.max(spatial, Number.MIN_VALUE))) };
}

const penetrationOf = (s: Shape, p: Vec2, probe: Probe): Penetration =>
  s.kind === 'box' ? boxPenetration(p, s.box, probe.radius) : circlePenetration(p, s.circle, s.contact);

/** Earliest t in [0, 1] at which a point moving a → a + d comes within rho of `center` (0 if already there). */
function circleEntryTime(a: Vec2, d: Vec2, center: Vec2, rho: number): number | null {
  const w = sub(a, center);
  const qa = dot(d, d);
  const qb = dot(w, d);
  if (qa === 0 || qb >= 0) return null;
  const qc = dot(w, w) - rho * rho;
  if (qc <= 0) return 0;
  const disc = qb * qb - qa * qc;
  if (disc < 0) return null;
  const t = qc / (Math.sqrt(disc) - qb);
  return t <= 1 ? t : null;
}

/** Time at which the moving point crosses `line` along one axis, if it lands within [lo, hi] on the other. */
function faceTime(line: number, origin: number, speed: number, lo: number, hi: number, crossOrigin: number, crossSpeed: number): number | null {
  const t = (line - origin) / speed;
  if (t < 0 || t > 1) return null;
  const cross = crossOrigin + crossSpeed * t;
  return cross >= lo && cross <= hi ? t : null;
}

/**
 * Earliest contact of the moving point with the box expanded by rho (faces, then corner circles); the minimum
 * over these candidates is the true first contact because each one is an upper bound on it.
 */
function boxEntry(a: Vec2, d: Vec2, b: Box, rho: number): Entry | null {
  if(b.angle){
    const result=boxEntry(boxLocal(a,b),boxRotate(d,-b.angle),{...b,angle:0},rho);
    return result?{...result,normal:boxRotate(result.normal,b.angle),impact:boxGlobal(result.impact,b)}:null;
  }
  const candidates: Entry[] = [];
  const at = (t: number): Vec2 => add(a, mul(d, t));
  const pushFace = (t: number | null, normal: Vec2, impact: (p: Vec2) => Vec2): void => {
    if (t !== null) candidates.push({ t, normal, impact: impact(at(t)) });
  };
  if (d.x > 0 && a.x < b.minX - rho) pushFace(faceTime(b.minX - rho, a.x, d.x, b.minY, b.maxY, a.y, d.y), vec(-1, 0), p => vec(b.minX, p.y));
  if (d.x < 0 && a.x > b.maxX + rho) pushFace(faceTime(b.maxX + rho, a.x, d.x, b.minY, b.maxY, a.y, d.y), vec(1, 0), p => vec(b.maxX, p.y));
  if (d.y > 0 && a.y < b.minY - rho) pushFace(faceTime(b.minY - rho, a.y, d.y, b.minX, b.maxX, a.x, d.x), vec(0, -1), p => vec(p.x, b.minY));
  if (d.y < 0 && a.y > b.maxY + rho) pushFace(faceTime(b.maxY + rho, a.y, d.y, b.minX, b.maxX, a.x, d.x), vec(0, 1), p => vec(p.x, b.maxY));
  for (const corner of [vec(b.minX, b.minY), vec(b.maxX, b.minY), vec(b.minX, b.maxY), vec(b.maxX, b.maxY)]) {
    const t = circleEntryTime(a, d, corner, rho);
    if (t === null) continue;
    const off = sub(at(t), corner);
    candidates.push({ t, normal: mul(off, 1 / Math.max(length(off), Number.MIN_VALUE)), impact: corner });
  }
  let best: Entry | null = null;
  for (const c of candidates) if (!best || c.t < best.t) best = c;
  return best;
}

/** First contact of a probe moving a → a + d with a shape it does not already overlap (`start` = its state at a). */
function entryOf(s: Shape, a: Vec2, d: Vec2, probe: Probe, start: Penetration): Entry | null {
  // Touching at the start: a hit at time 0 only when moving into the shape (shapes are convex).
  if (start.depth >= 0) return dot(d, start.normal) < 0 ? { t: 0, normal: start.normal, impact: start.impact } : null;
  if (s.kind === 'box') return boxEntry(a, d, s.box, probe.radius);
  const t = circleEntryTime(a, d, s.circle.center, s.contact.rho);
  if (t === null) return null;
  const pen = circlePenetration(add(a, mul(d, t)), s.circle, s.contact);
  return { t, normal: pen.normal, impact: pen.impact };
}

function circleContact(probe: Probe, c: CircleSolid): CircleContact | null {
  const reach = probe.halfHeight - probe.radius;
  const gap = Math.max(0, Math.max(probe.z - reach, c.zLow) - Math.min(probe.z + reach, c.zHigh));
  const sum = probe.radius + c.radius;
  if (!(gap < sum)) return null;
  return { rho: gap === 0 ? sum : Math.sqrt(sum * sum - gap * gap), gap, sum };
}

/** Every blocking shape that might touch the probe around the segment a → b, in tie-break order. */
function solidsNear(world: LaunchWorld, a: Vec2, b: Vec2, probe: Probe, ignore: ReadonlySet<string>): Shape[] {
  const shapes: Shape[] = [];
  const g = world.grid;
  if (g && !ignore.has(g.actor.id)) {
    const r = probe.radius;
    const ox = g.origin?.x ?? 0, oy = g.origin?.y ?? 0;
    // Cells outside the grid are wall; one ring of them keeps a probe inside the room.
    const cx0 = Math.max(Math.floor((Math.min(a.x, b.x) - r - ox) / UU_PER_TILE), -1);
    const cx1 = Math.min(Math.floor((Math.max(a.x, b.x) + r - ox) / UU_PER_TILE), g.width);
    const cy0 = Math.max(Math.floor((Math.min(a.y, b.y) - r - oy) / UU_PER_TILE), -1);
    const cy1 = Math.min(Math.floor((Math.max(a.y, b.y) + r - oy) / UU_PER_TILE), g.depth);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (cx >= 0 && cy >= 0 && cx < g.width && cy < g.depth && g.cells[cy * g.width + cx] === 1) continue;
        const box = { minX: ox + cx * UU_PER_TILE, minY: oy + cy * UU_PER_TILE, maxX: ox + (cx + 1) * UU_PER_TILE, maxY: oy + (cy + 1) * UU_PER_TILE };
        shapes.push({ kind: 'box', box, actor: g.actor });
      }
    }
  }
  for (const box of world.boxes) if (!ignore.has(box.actor.id)) shapes.push({ kind: 'box', box, actor: box.actor });
  for (const circle of world.circles) {
    if (ignore.has(circle.actor.id)) continue;
    const contact = circleContact(probe, circle);
    if (contact) shapes.push({ kind: 'circle', circle, contact, actor: circle.actor });
  }
  return shapes;
}

// ---------------------------------------------------------------- world queries

/**
 * UWorld::SweepSingleByChannel on the blocking channel: the deepest initial overlap if the probe starts inside
 * something, else the first blocking hit of the probe moving a → b. Ties keep the first shape in the order
 * walls, boxes, circles, bodies.
 */
export function sweepProbe(world: LaunchWorld, a: Vec2, b: Vec2, probe: Probe, ignore: ReadonlySet<string>): Hit | null {
  const d = sub(b, a);
  const shapes = solidsNear(world, a, b, probe, ignore);
  const starts = shapes.map(s => penetrationOf(s, a, probe));
  let deepest = -1;
  for (let i = 0; i < shapes.length; i++) {
    if (starts[i].depth > PENETRATION_SLOP && (deepest < 0 || starts[i].depth > starts[deepest].depth)) deepest = i;
  }
  if (deepest >= 0) {
    const pen = starts[deepest];
    return { actor: shapes[deepest].actor, time: 0, location: a, impactPoint: pen.impact, normal: pen.normal, startPenetrating: true, penetrationDepth: pen.depth, traceStart: a, traceEnd: b };
  }
  let first: Entry | null = null;
  let firstActor: LaunchActor | null = null;
  for (let i = 0; i < shapes.length; i++) {
    const e = entryOf(shapes[i], a, d, probe, starts[i]);
    if (e && (!first || e.t < first.t)) {
      first = e;
      firstActor = shapes[i].actor;
    }
  }
  if (!first || !firstActor) return null;
  const location = first.t === 0 ? a : add(a, mul(d, first.t));
  return { actor: firstActor, time: first.t, location, impactPoint: first.impact, normal: first.normal, startPenetrating: false, penetrationDepth: 0, traceStart: a, traceEnd: b };
}

/** UWorld::OverlapBlockingTestByChannel: does a probe at p overlap any blocking shape? */
export function probeOverlaps(world: LaunchWorld, p: Vec2, probe: Probe, ignore: ReadonlySet<string>): boolean {
  return solidsNear(world, p, p, probe, ignore).some(s => penetrationOf(s, p, probe).depth > PENETRATION_SLOP);
}

/** SweepMultiByChannel on 物品 with Sphere(radius): every pickup the sweep enters or starts in, by time. */
export function sweepPickups(world: LaunchWorld, a: Vec2, b: Vec2, radius: number, ignore: ReadonlySet<string>): PickupHit[] {
  const d = sub(b, a);
  const qa = dot(d, d);
  const hits: PickupHit[] = [];
  for (const pickup of world.pickups) {
    if (ignore.has(pickup.id)) continue;
    const rr = pickup.radius + radius;
    const w = sub(a, pickup.position);
    let t = 0;
    if (dot(w, w) >= rr * rr) {
      if (qa === 0) continue;
      const qb = 2 * dot(w, d);
      const disc = qb * qb - 4 * qa * (dot(w, w) - rr * rr);
      if (disc < 0) continue;
      t = (-qb - Math.sqrt(disc)) / (2 * qa);
      if (t < 0 || t > 1) continue;
    }
    hits.push({ pickup, time: t, location: add(a, mul(d, t)) });
  }
  // SPEC-GAP: the Demo sorts with an unstable introsort (U-05), so its tie order is unknown; ties keep definition order.
  return hits.sort((x, y) => x.time - y.time);
}

/** OverlapMultiByChannel on 物品 with Sphere(radius) at p. */
export function overlappingPickups(world: LaunchWorld, p: Vec2, radius: number, ignore: ReadonlySet<string>): Pickup[] {
  return world.pickups.filter(k => !ignore.has(k.id) && distance(p, k.position) < k.radius + radius);
}

/** fn@0x1445affc0: a pickup whose enabled gravity source stops pulling once the preview passes it. */
export const isPreviewGravityPickup = (p: Pickup): boolean => !!p.gravity && p.gravity.enabled && p.gravity.disableAfterPreviewPickup;

/** A source steering the path (FLaunchGravitySource). */
export interface GravitySource {
  readonly position: Vec2;
  readonly mode: 'attract' | 'repel';
  readonly strength: number;
  readonly radius: number;
  /** Actor (pickup or gravity point) that owns the source. */
  readonly sourceId: string;
  readonly disableAfterPreviewPickup: boolean;
}

/** GatherGravitySources (NATIVE-045/046): gravity points first, then enabled pickup sources. */
export function gatherGravitySources(world: LaunchWorld): GravitySource[] {
  const out: GravitySource[] = [];
  for (const p of world.gravityPoints) {
    if (p.enabled && p.radius > 0 && p.strength > 0) {
      out.push({ position: p.position, mode: p.mode, strength: p.strength, radius: p.radius, sourceId: p.id, disableAfterPreviewPickup: false });
    }
  }
  for (const k of world.pickups) {
    const g = k.gravity;
    if (g && g.enabled && Number.isFinite(g.strength) && Number.isFinite(g.radius) && g.strength > 0 && g.radius > 0) {
      out.push({ position: k.position, mode: g.mode, strength: g.strength, radius: g.radius, sourceId: k.id, disableAfterPreviewPickup: g.disableAfterPreviewPickup });
    }
  }
  return out;
}

/**
 * The native side of the hero launch (the Demo's C++ LaunchTrajectoryLibrary and the preview circles 碰撞预览圈 /
 * LaunchPreviewPathComponent / ULaunchPathFollowerComponent), on top of the pure planner in src/core/launch.
 *
 * - Preview: the circles are built from the current room and field (`buildLaunchWorld`) with
 *   `computeLaunchPreview`; nothing here draws randomness (CORE-M-127), so `PreviewLaunch` is the aim display and
 *   `UpdateLaunchPreview` stores the same circles on the hero for the release (碰撞预览圈数组, TURN-043).
 * - Playback: `StartLegacyPreviewLeg` / `WaitForLegacyLaunchLeg` / `AdvanceLegacyPreviewPlayback` replay the stored
 *   circles' paths exactly (launch-movement LAUNCH-028…042, NATIVE-083); leg ends are clock entries at their game
 *   times and the hero's location follows the leg curve through a clock process.
 *
 * Native component state lives in a side table keyed by the actor (the Demo keeps it in C++ components, not in
 * blueprint variables). Content reaches these functions through `world.sys.launch.LaunchTrajectoryLibrary`.
 */
import type { ClassDef, HitResult, Vec3 } from '../../sim/types.ts';
import { BpObject } from '../../sim/object.ts';
import type { World } from '../../sim/world.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';
import { TagSet } from '../../sim/tags.ts';
import { isHiddenInGame } from '../../sim/engine.ts';
import { makeHitResult } from '../../bp/structs.ts';
import { 函数库_技能 } from '../../bp/index.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import {
  aimVector, computeLaunchPreview, createLaunchWorld, legDuration, planLaunch, samplePlayback,
  type BodyDef, type FloorGrid, type Hit, type LaunchPlayback, type LaunchPreview, type PlaybackLeg,
  type PreviewCircle, type SolidBoxDef, type SolidCircleDef, type PickupDef, type LaunchWorld,
} from '../../launch/index.ts';
import { sweepPickups, sweepProbe } from '../../launch/world.ts';
import { CURVE_MAIN_LEG, CURVE_TERMINAL_LEG } from '../../launch/curves.ts';
import { isPlayablePath } from '../../launch/path.ts';
import type { RoomPlan } from '../../api/view.ts';

export const DYNAMIC_MESH_PATH = 'CatapultHero/BP/环境/蓝图_动态网格';
const SURFACE_PATH = 'CatapultHero/BP/环境/蓝图_装饰品';
const TAG_CONTROLLED = '状态.可控弹射';
/** StartLegacyPreviewLeg refuses a leg whose path starts farther than this from the actor (exe@1445b24a7). */
const MAX_START_OFFSET = 8;

/** One 碰撞预览圈 as the blueprints read it. */
export interface PreviewCircleView {
  readonly 序号: number;
  readonly 当前起点位置: Vec3;
  readonly 当前终点位置: Vec3;
  readonly 反弹方向: Vec3;
  readonly OutHit: HitResult;
  /** LaunchPreviewPathComponent.bUsesDeferredGravityBounce. */
  readonly bUsesDeferredGravityBounce: boolean;
  readonly 有加速: boolean;
}

/** The ported 接口_拾取物, reached structurally so core never imports content modules. */
export interface NativePickup extends BpObject {
  readonly 初始化完毕: boolean;
  readonly 已拾取: boolean;
  readonly 拾取半径: number;
  readonly 未激活特效开启?: boolean;
  readonly 弹射引力?: { readonly bEnabled: boolean; readonly Strength: number; readonly Radius: number };
  玩家重叠(actor: BpObject): void;
  进入待拾取触发(circle: { 有加速: boolean }): void;
  移除待拾取触发(): void;
}

/** Player-passive vortices live in the hero's effects; other pickup sources may also register on the mode. */
export function livePickups(world: World): NativePickup[] {
  const unique = new Set<BpObject>([...(world.mode.玩家角色?.拥有的效果 ?? []), ...world.mode.场上可拾取物].filter((o): o is BpObject => o !== null));
  return [...unique].filter((o): o is NativePickup => {
    const p = o as Partial<NativePickup>;
    return world.isValid(o) && o.HasMatchingGameplayTag('环境.类型.可拾取物') && p.初始化完毕 === true && p.已拾取 === false
      && !isHiddenInGame(o) && typeof p.玩家重叠 === 'function';
  });
}

/** 蓝图_货币 implements a different overlap event, has no pickup tag and has no gravity or bounce credit. */
export interface CurrencyPickup extends BpObject {
  readonly 初始化完毕: boolean;
  开始重叠(actor: BpObject): void;
}
const CURRENCY_PATH = 'CatapultHero/BP/Skill/效果/可拾取物/蓝图_货币';
export function liveCurrencyPickups(world: World): CurrencyPickup[] {
  return world.mode.场上可拾取物.filter((o): o is CurrencyPickup =>
    !!o && world.isValid(o) && o.def.path === CURRENCY_PATH && typeof (o as Partial<CurrencyPickup>).开始重叠 === 'function');
}

/** Actual capsule motion across the source root Box(8,8,16), including shards spawned after the aim was computed.
 * No preview bookkeeping: currency's pending-pickup interface is empty (L808/809), with no gravity/extra bounce.
 * Existing overlaps do not re-enter after initialization; the original BeginOverlap has to happen after Delay .3.
 * SPEC-GAP: currency's scatter remains the explicitly approximate placement in rewards/drops.ts, not Chaos motion.
 */
export function consumeCurrencyAlongMove(actor: BP_ManeActor, from: Vec3, to: Vec3): void {
  const world = actor.world;
  if (actor !== world.mode.玩家角色 || !world.isValid(actor) || (actor as BP_ManeActor & { ug_碰撞开启?: boolean }).ug_碰撞开启 === false) return;
  if (from.x === to.x && from.y === to.y && from.z === to.z) return;
  const hits: { pickup: CurrencyPickup; time: number }[] = [];
  for (const pickup of liveCurrencyPickups(world)) {
    const p = pickup.K2_GetActorLocation();
    const box = pickup.def.components.Box?.BoxExtent as { X: number; Y: number; Z: number } | undefined;
    const half = box ?? { X: 8, Y: 8, Z: 16 }; // 蓝图_货币 Box CDO; root-component world position is actor location.
    const r = actor.宽度, cylinder = Math.max(actor.高度, r) - r;
    const gap = Math.max(0, Math.abs(from.z - p.z) - cylinder - half.Z);
    if (gap > r) continue;
    const radius = Math.sqrt(r * r - gap * gap);
    const dx = Math.max(Math.abs(from.x - p.x) - half.X, 0), dy = Math.max(Math.abs(from.y - p.y) - half.Y, 0);
    if (dx * dx + dy * dy <= radius * radius) continue; // Still overlapping: no fresh BeginOverlap.
    const shape = createLaunchWorld({ boxes: [{ id: String(pickup.id), minX: p.x - half.X, maxX: p.x + half.X,
      minY: p.y - half.Y, maxY: p.y + half.Y, tags: [] }] });
    const hit = sweepProbe(shape, from, to, { radius, halfHeight: radius, z: 0 }, new Set());
    if (hit) hits.push({ pickup, time: hit.time });
  }
  // The overlap callbacks follow movement order; equal-time shards retain their source array order.
  hits.sort((a, b) => a.time - b.time);
  for (const { pickup } of hits) if (world.isValid(pickup)) pickup.开始重叠(actor);
}

interface Follower {
  readonly path: PlaybackLeg['path'];
  readonly terminal: boolean;
  readonly deferredGravity: boolean;
  readonly speed: number;
  readonly start: number;
  readonly duration: number;
  requester: BpObject | null;
  entry: number | null;
  finished: boolean;
  advanced: boolean;
}

interface NativeState {
  /** The circles the release replays (碰撞预览圈数组 / 显示的碰撞预览圈数组 at the release). */
  preview: LaunchPreview | null;
  /** Hit actor of every LaunchActor id of that preview. */
  actors: Map<string, BpObject>;
  index: number;
  follower: Follower | null;
  /** The launch as planned at its start (view.launch), and its start time. */
  planned: LaunchPlayback | null;
  startedAt: number;
  process: { step(dt: number): void; active(): boolean } | null;
  /** The cached item-channel geometry belongs to this release, like the cached main/terminal paths. */
  pickupWorld: LaunchWorld | null;
  presenting: boolean;
}

const states = new WeakMap<BpObject, NativeState>();
/** Surface objects per world, keyed by 'walls' or by a solid's index, place and tags (a new room, new solids). */
const surfaceCache = new WeakMap<World, Map<string, BpObject>>();

function stateOf(actor: BpObject): NativeState {
  let s = states.get(actor);
  if (!s) {
    s = { preview: null, actors: new Map(), index: 0, follower: null, planned: null, startedAt: 0, process: null, pickupWorld: null, presenting: false };
    states.set(actor, s);
  }
  return s;
}

const v3 = (p: { x: number; y: number }, z = 0): Vec3 => ({ x: p.x, y: p.y, z });

/** A static blocking actor the room geometry has but the world has no object for (walls, plan solids). */
class LaunchSurface extends BpObject {
  static override readonly path = SURFACE_PATH;
}

function surfaceDef(path: string, tags: readonly string[]): ClassDef {
  return { path, name: path.slice(path.lastIndexOf('/') + 1), parent: null, kind: 'other', tags, vars: {}, timelines: {}, components: {}, rows: [], reachable: true };
}

/** The object a launch actor id stands for: the room wall (蓝图_动态网格), a plan solid, or a field actor. */
function surfaceFor(world: World, key: string, path: string, tags: readonly string[]): BpObject {
  let m = surfaceCache.get(world);
  if (!m) surfaceCache.set(world, (m = new Map()));
  let o = m.get(key);
  if (!o) {
    o = new LaunchSurface(world, world.data.classes[path] ?? surfaceDef(path, tags));
    for (const t of tags) o.OwnedGameplayTags.add(t);
    m.set(key, o);
  }
  return o;
}

/** The current room plan (core-map's view.room; wave B core-room). */
function roomPlanOf(world: World): RoomPlan | null {
  return world.sys.room.view?.(world).room ?? world.sys.map.view?.(world).room ?? null;
}

/**
 * The launch's collision world from the room plan and the field: floor cells, plan solids, and every valid, living
 * actor of 场上所有 except `self` as a body (radius 宽度, half-height 高度, its owned tags).
 * `surfaces` maps the walls and plan solids to their hit objects; those allocate world ids (part of the digest), so
 * the aim display (`PreviewLaunch`) builds without them and only the release (`UpdateLaunchPreview`) creates them.
 * The real player passive places 回弹漩涡 each kill-mission turn (TURN-025); their native gravity and item sphere
 * come from the pickup's source components. This snapshot lets combat-entry disable live gravity without changing
 * the trajectory the player just previewed.
 */
export function buildLaunchWorld(world: World, self: BpObject, surfaces = true) {
  const actors = new Map<string, BpObject>();
  const plan = roomPlanOf(world);
  let grid: FloorGrid | undefined;
  const circles: SolidCircleDef[] = [];
  const boxes: SolidBoxDef[] = [];
  if (plan) {
    const cells = new Uint8Array(plan.cols * plan.rows);
    for (const [c, r] of plan.cells) if (c >= 0 && r >= 0 && c < plan.cols && r < plan.rows) cells[r * plan.cols + c] = 1;
    if(!plan.authoredBoundary)grid = { width: plan.cols, depth: plan.rows, cells, origin: plan.origin };
    plan.solids.forEach((s, i) => {
      const id = `solid:${i}`;
      if (surfaces) actors.set(id, surfaceFor(world, `${id}@${s.at.x},${s.at.y}:${s.tags.join('|')}`, SURFACE_PATH, s.tags));
      if (s.kind === 'circle') circles.push({ id, x: s.at.x, y: s.at.y, radius: s.radius ?? 0, tags: s.tags });
      else {
        const h = s.half ?? { x: 0, y: 0 };
        boxes.push({ id, minX: s.at.x - h.x, minY: s.at.y - h.y, maxX: s.at.x + h.x, maxY: s.at.y + h.y,angle:s.angle,tags: s.tags });
      }
    });
  }
  if (surfaces) actors.set('walls', surfaceFor(world, 'walls', DYNAMIC_MESH_PATH, []));
  const bodies: BodyDef[] = [];
  for (const a of world.mode.场上所有) {
    if (!a || a === self || !world.isValid(a) || a.死掉了) continue;
    const id = `actor:${a.id}`;
    actors.set(id, a);
    const p = a.K2_GetActorLocation();
    bodies.push({ id, x: p.x, y: p.y, radius: a.宽度, halfHeight: a.高度 || a.宽度, tags: a.OwnedGameplayTags.toArray() });
  }
  const pickups: PickupDef[] = livePickups(world).map(p => {
    const at = p.K2_GetActorLocation();
    const id = `pickup:${p.id}`;
    actors.set(id, p);
    const g = p.弹射引力;
    return { id, x: at.x, y: at.y, radius: p.拾取半径, tags: p.OwnedGameplayTags.toArray(),
      ...(g ? { gravity: { enabled: g.bEnabled, strength: g.Strength, radius: g.Radius, disableAfterPreviewPickup: true } } : {}) };
  });
  return { launchWorld: createLaunchWorld({ grid, circles, boxes, bodies, pickups }), actors };
}

/** The hero's launch values: 宽度, 高度, 最大疲劳, 弹射距离 and the slot-0 skill's 参数[1] 碰撞墙壁触发？. */
function heroStats(hero: BP_ManeActor) {
  const skill = hero.拥有的主动能力[0] ?? null;
  const wall = skill ? 函数库_技能.获取技能参数(hero, skill, 1, false, '').参数值 === 1 : false;
  return {
    width: hero.宽度,
    height: hero.高度,
    maxBounces: hero.最大疲劳,
    launchDistance: 科学数变普通(获取科学映射词条(hero.词条, '弹射距离').输出值),
    wallTriggered: wall,
  };
}

function previewFor(hero: BP_ManeActor, aim: { x: number; y: number }, surfaces: boolean) {
  const { launchWorld, actors } = buildLaunchWorld(hero.world, hero, surfaces);
  const origin = hero.K2_GetActorLocation();
  const preview = computeLaunchPreview(launchWorld, origin, aimVector(origin, aim), { hero: heroStats(hero) });
  return { preview, actors, launchWorld };
}

function hitResultOf(hit: Hit | null, actors: ReadonlyMap<string, BpObject>, z: number): HitResult {
  if (!hit) return makeHitResult();
  return makeHitResult({
    actor: actors.get(hit.actor.id) ?? null,
    impactPoint: v3(hit.impactPoint, z),
    impactNormal: v3(hit.normal),
    location: v3(hit.location, z),
    normal: v3(hit.normal),
    blockingHit: true,
    time: hit.time,
  });
}

function circleView(c: PreviewCircle, actors: ReadonlyMap<string, BpObject>, z: number): PreviewCircleView {
  return {
    序号: c.index,
    当前起点位置: v3(c.start, z),
    当前终点位置: v3(c.end, z),
    反弹方向: v3(c.bounceDirection),
    OutHit: hitResultOf(c.hit, actors, z),
    bUsesDeferredGravityBounce: c.deferredGravityBounce,
    有加速: c.deferredGravityBounce || c.pendingGravityBounces > 0, // TRAJEC-024.7 native resolve; hooks clear per update.
  };
}

/** Real follower movement crosses the item-channel spheres, not just a guessed end-of-leg pickup list. */
function consumeAlongMove(actor: BP_ManeActor, from: Vec3, to: Vec3): void {
  (actor.world.sys.physics as { moveEffectOverlaps?(w: World, actor: BP_ManeActor, from: Vec3, to: Vec3): void }).moveEffectOverlaps?.(actor.world, actor, from, to);
  consumeCurrencyAlongMove(actor, from, to);
  const s = states.get(actor);
  if (!s?.pickupWorld || actor !== actor.world.mode.玩家角色 || actor.world.mode.当前环节 !== '进行战斗') return;
  // Actual 激活范围 overlaps the hero's capsule (宽度), while computeLaunchPreview keeps PC L1802's 0.95 probe.
  // Passive-generated pickups and the hero have the same centre height; their projected overlap is this circle sweep.
  for (const hit of sweepPickups(s.pickupWorld, from, to, actor.宽度, new Set())) {
    const p = s.actors.get(hit.pickup.id) as NativePickup | undefined;
    if (p && actor.world.isValid(p) && !p.已拾取 && !isHiddenInGame(p)) p.玩家重叠(actor);
  }
}

function finishLeg(actor: BP_ManeActor, f: Follower, reached: boolean): void {
  f.finished = true;
  f.entry = null;
  actor.移动中 = false;
  actor.抵达位置 = reached;
  actor.移动当前时长 = 0;
  if (!reached) actor.移动当前速度 = 0;
  const end = f.path.points[f.path.points.length - 1].location;
  const from = actor.K2_GetActorLocation();
  const z = actor.K2_GetActorLocation().z;
  actor.K2_SetActorLocation(v3(end, z));
  consumeAlongMove(actor, from, v3(end, z));
  if (reached) actor.结束移动判断();
}

/** The follower's clock process: the actor's location follows the leg curve while a leg plays (re-added per leg). */
function ensureProcess(world: World, actor: BP_ManeActor, s: NativeState): void {
  s.process ??= {
    active: () => !!s.follower && !s.follower.finished && world.isValid(actor),
    step: () => {
      const f = s.follower;
      if (!f || f.finished) return;
      const leg: PlaybackLeg = {
        index: 0, terminal: f.terminal, path: f.path, curve: f.terminal ? CURVE_TERMINAL_LEG : CURVE_MAIN_LEG,
        fatigue: 0, speed: f.speed, start: 0, duration: f.duration, end: f.duration, contact: null,
      };
      const end = f.path.points[f.path.points.length - 1].location;
      const sample = samplePlayback({ origin: end, legs: [leg], contacts: [], duration: f.duration, end, fatigue: 0, complete: true, movementRange: 0 }, world.clock.now - f.start);
      const from = actor.K2_GetActorLocation();
      actor.K2_SetActorLocation(v3(sample.position, actor.K2_GetActorLocation().z));
      consumeAlongMove(actor, from, actor.K2_GetActorLocation());
    },
  };
  world.clock.addProcess(s.process);
}

/** LaunchTrajectoryLibrary and the preview circles (see the file comment). */
export const LaunchTrajectoryLibrary = {
  /** The aim display: the chain a release at `aim` (uu) would play. Pure: no state, no ids, no randomness. */
  PreviewLaunch(hero: BP_ManeActor, aim: { x: number; y: number }): LaunchPreview | null {
    if (!hero.world.isValid(hero)) return null;
    return previewFor(hero, aim, false).preview;
  },

  /** Builds the circles for `aim` and stores them on the hero (碰撞预览圈数组, 显示的碰撞预览圈数组, 最终弹射值). */
  UpdateLaunchPreview(hero: BP_Actor_Player, aim: { x: number; y: number }): LaunchPreview | null {
    if (!hero.world.isValid(hero)) return null;
    const { preview, actors, launchWorld } = previewFor(hero, aim, true);
    const s = stateOf(hero);
    s.preview = preview;
    s.actors = actors;
    s.pickupWorld = launchWorld;
    hero.最终弹射值 = preview.finalLaunchValue;
    // PL 添加待拾取物 + PC last-circle 清除待拾取物 (TRAJEC-051..054). Full pure hover previews never mutate these
    // objects. At release perform the source hooks once, then clear them at the completed chain boundary.
    for (const circle of [...preview.legs, ...(preview.next ? [preview.next] : [])]) {
      const flags = { 有加速: false };
      for (const id of circle.pickups) {
        const p = actors.get(id) as NativePickup | undefined;
        if (!p || typeof p.进入待拾取触发 !== 'function') continue;
        if (!hero.将拾取的加速物.includes(p)) hero.将拾取的加速物.push(p);
        p.进入待拾取触发(flags);
      }
    }
    for (const p of hero.将拾取的加速物 as NativePickup[]) p.移除待拾取触发();
    hero.将拾取的加速物.length = 0;
    return preview;
  },

  /** TURN-043: circle 0 exists and starts within 8 uu of the hero. */
  CanRelease(hero: BP_ManeActor): boolean {
    const p = stateOf(hero).preview;
    const c = p?.legs[0];
    if (!c) return false;
    const h = hero.K2_GetActorLocation();
    return Math.hypot(c.start.x - h.x, c.start.y - h.y) <= MAX_START_OFFSET;
  },

  /** len(显示的碰撞预览圈数组). */
  DisplayedCircleCount(hero: BpObject): number {
    return stateOf(hero).preview?.legs.length ?? 0;
  },

  /** 碰撞预览圈数组[i] (displayed circles, then the first hidden one); null when out of range. */
  PreviewCircle(hero: BpObject, i: number): PreviewCircleView | null {
    const s = stateOf(hero);
    const p = s.preview;
    if (!p) return null;
    const c = i < p.legs.length ? p.legs[i] : i === p.legs.length ? p.next : null;
    return c ? circleView(c, s.actors, hero.K2_GetActorLocation().z) : null;
  },

  /** 记录碰撞点 input: the ends of the displayed legs (preview.collisionPoints). */
  CollisionPoints(hero: BpObject): Vec3[] {
    const p = stateOf(hero).preview;
    return p ? p.collisionPoints.map(q => v3(q)) : [];
  },

  ResetLegacyPreviewPlayback(actor: BpObject): void {
    const s = stateOf(actor);
    s.index = 0;
    s.follower = null;
    s.planned = s.preview ? planLaunch(s.preview) : null;
    s.startedAt = actor.world.clock.now;
    s.presenting = false;
  },

  GetLegacyPreviewPlaybackIndex(actor: BpObject): number {
    return stateOf(actor).index;
  },

  /**
   * StartLegacyPreviewLeg (LAUNCH-032): replays circle `circle`'s main path (or, terminal, the chain's terminal path).
   * Fails when the path is missing or unplayable, the speed is not positive, or the actor is > 8 uu from its start.
   */
  StartLegacyPreviewLeg(actor: BP_ManeActor, circle: number, speed: number, curveRow: string, terminal: boolean): boolean {
    const world = actor.world;
    const s = stateOf(actor);
    const p = s.preview;
    const c = p?.legs[circle];
    if (!p || !c || !world.isValid(actor)) return false;
    const path = terminal ? p.terminal?.path : c.path;
    if (!path || !isPlayablePath(path) || !(speed > 0) || !Number.isFinite(speed)) return false;
    const here = actor.K2_GetActorLocation();
    const first = path.points[0].location;
    if (Math.hypot(first.x - here.x, first.y - here.y) > MAX_START_OFFSET) return false;
    void curveRow; // 可控反弹曲线 / 可控终末确定曲线: chosen by `terminal` (src/core/launch/curves.ts)
    const duration = legDuration(path.totalDistance, speed);
    const last = path.points[path.points.length - 1].location;
    actor.移动当前速度 = speed;
    actor.目标位置 = v3(last, actor.目标位置.z);
    actor.移动所需时长 = duration;
    actor.移动当前时长 = 0;
    actor.移动中 = true;
    actor.抵达位置 = false;
    s.follower = { path, terminal, deferredGravity: !terminal && c.deferredGravityBounce, speed, start: world.clock.now, duration, requester: null, entry: null, finished: false, advanced: false };
    // The ordinary shell uses the same lifecycle as the source follower. Hover/reset/failed legs emit nothing.
    // Presentation only: this does not schedule work or alter the source movement/attack timing.
    if (actor === world.mode.玩家角色 && !s.presenting && !terminal && circle === 0) {
      s.presenting = true;
      world.bus.emit({ t: world.clock.now, kind: 'launch.start', hero: actor.id, at: { ...here }, direction: v3(c.direction) });
    }
    ensureProcess(world, actor, s);
    return true;
  },

  /** The latent wait: `then(bReachedEnd)` when the current leg ends (LAUNCH-035/037). */
  WaitForLegacyLaunchLeg(requester: BpObject, actor: BP_ManeActor, then: (reachedEnd: boolean) => void): void {
    const world = actor.world;
    const f = stateOf(actor).follower;
    if (!f || f.finished) { then(false); return; }
    f.requester = requester;
    f.entry = world.clock.at(f.start + f.duration, () => {
      finishLeg(actor, f, true);
      const s = stateOf(actor), c = !f.terminal ? s.planned?.contacts.find(c => c.leg === s.index) : null;
      if (c && actor === world.mode.玩家角色 && s.presenting) world.bus.emit({ t: world.clock.now, kind: 'launch.contact', hero: actor.id, index: c.index, contact: c.kind,
        actor: c.hit ? s.actors.get(c.hit.actor.id)?.id ?? null : null, at: actor.K2_GetActorLocation(),
        normal: c.hit ? v3(c.hit.normal) : { x: 0, y: 0, z: 0 }, speed: f.speed, reacts: c.reacts });
      then(true);
    }, requester);
  },

  /** AdvanceLegacyPreviewPlayback (LAUNCH-036): once per finished main leg; 疲劳 += 1 unless it was a gravity bounce. */
  AdvanceLegacyPreviewPlayback(actor: BP_ManeActor): void {
    const s = stateOf(actor);
    const f = s.follower;
    if (!f || f.terminal || !f.finished || f.advanced) return;
    f.advanced = true;
    if (!f.deferredGravity) actor.疲劳 = actor.疲劳 + 1;
    s.index += 1;
  },

  /** CancelLegacyLaunchLeg (LAUNCH-071): only for the requester that owns the leg. */
  CancelLegacyLaunchLeg(actor: BP_ManeActor, requester: BpObject): void {
    const s = stateOf(actor);
    const f = s.follower;
    s.planned = null;
    if (!f || (f.requester !== null && f.requester !== requester)) return;
    if (s.presenting) {
      s.presenting = false;
      actor.world.bus.emit({ t: actor.world.clock.now, kind: 'launch.end', hero: actor.id, at: actor.K2_GetActorLocation() });
    }
    if (f.entry !== null) actor.world.clock.cancel(f.entry);
    f.entry = null;
    f.finished = true;
    actor.移动中 = false;
    actor.抵达位置 = true;
    actor.移动当前速度 = 0;
    actor.移动当前时长 = 0;
    actor.移动所需时长 = 0;
    actor.目标位置 = actor.K2_GetActorLocation();
    actor.OwnedGameplayTags.remove(TAG_CONTROLLED);
  },

  /** The launch in progress as planned at its start (view.launch), null at rest. */
  ActiveLaunch(actor: BpObject): { playback: LaunchPlayback; startedAt: number } | null {
    const s = states.get(actor);
    return s?.planned ? { playback: s.planned, startedAt: s.startedAt } : null;
  },
};

export type LaunchNative = typeof LaunchTrajectoryLibrary;

/** True for the room-wall actor (GetObjectClass == 蓝图_动态网格_C). */
export const isDynamicMesh = (o: unknown): boolean => o instanceof BpObject && o.def.path === DYNAMIC_MESH_PATH;

/** Tags of an object behind GameplayTagAssetInterface; null when it has none. */
export const tagsOf = (o: unknown): TagSet | null => (o instanceof BpObject ? o.OwnedGameplayTags : null);

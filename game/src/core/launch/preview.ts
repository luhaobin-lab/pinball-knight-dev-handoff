/**
 * The preview chain the Demo computes while aiming (Blueprint 碰撞预览圈 driving the native "legacy" helpers,
 * native-trajectory §5.5/5.6, trajectory-preview §4): one circle per leg. Each leg is a MaxBounces-0 path from
 * the previous end along the bounce direction, stopping at the first contact or after the Launch Distance.
 * A circle stays in the chain (可反弹？) while the Bounce Limit lasts or a gravity credit pays for an air end;
 * the last displayed circle adds the terminal leg. Launching replays exactly these paths (playback.ts).
 *
 * The Demo updates one circle per frame step with one-frame lags (a new circle's first leg is 320 uu; 剩余长度
 * reads the next circle's previous-frame 长度). This computes the steady state those updates converge to while
 * the aim is held, which is what a released launch replays.
 */
import {
  type Vec2,
  add,
  bounceDirection,
  distance,
  f32,
  isFiniteVec,
  length,
  mul,
  nearlyZero,
  safeNormal2D,
  snapAimDirection,
  snapToGrid,
  sub,
  ZERO,
} from './math.ts';
import { buildLeg, INVALID_PATH, isStationaryCollision, type LegResult, type Trajectory } from './path.ts';
import { type HeroLaunchStats, LAUNCH_RULES, STARTER_HERO } from './settings.ts';
import {
  DYNAMIC_MESH_CLASS,
  gatherGravitySources,
  type GravitySource,
  hasTag,
  type Hit,
  isPreviewGravityPickup,
  type LaunchActor,
  type LaunchWorld,
  overlappingPickups,
  sweepPickups,
  sweepProbe,
  TAG,
} from './world.ts';

/** What the end marker of a leg shows: enemy contact = dashed ring, wall/other contact = dot + arc, none = dot. */
export type MarkerKind = 'enemy' | 'wall' | 'none';

/** One preview circle: one leg of the launch. */
export interface PreviewCircle {
  /** 序号. */
  readonly index: number;
  /** 当前起点位置: the hero for circle 0, else the previous circle's end. */
  readonly start: Vec2;
  /** 目标位置向量: unit direction of the leg. */
  readonly direction: Vec2;
  /** The native main path (MainPath), starting 0.05 uu along `direction`; invalid when the native build failed. */
  readonly path: Trajectory;
  /** The guide line as drawn (chevrons): the path's points, [start, end] without a path, empty when stationary. */
  readonly line: readonly Vec2[];
  /** 当前终点位置: the hero centre at the leg end, where its marker sits and the next leg starts. */
  readonly end: Vec2;
  /** 长度: arc length of the leg. */
  readonly length: number;
  /** The leg's blocking hit (Out Hit when bBlockingHit), else null. */
  readonly hit: Hit | null;
  readonly marker: MarkerKind;
  /** 反弹方向: direction of the next leg (mirror reflection on contact, end tangent in the air). */
  readonly bounceDirection: Vec2;
  /** 可反弹？: the leg ends in a bounce, so the chain continues. */
  readonly bounceable: boolean;
  /** Shown while aiming and replayed by the launch (可反弹？ || 序号 == 0). */
  readonly displayed: boolean;
  /** The bounce was paid by a gravity credit (an air end after a 回弹漩涡). */
  readonly deferredGravityBounce: boolean;
  /** OrdinaryBounceCount after this circle: Bounce Limit spent so far. */
  readonly ordinaryBounces: number;
  /** PendingGravityBounces after this circle: unspent gravity credits. */
  readonly pendingGravityBounces: number;
  /** PredictedPickups: ids of the pickups the leg passes, in order. */
  readonly pickups: readonly string[];
}

export interface PreviewTerminal {
  /** The last displayed circle's end. */
  readonly start: Vec2;
  /** That circle's bounce direction. */
  readonly direction: Vec2;
  /** 剩余长度 (= 最终弹射值): the length the terminal leg may travel. */
  readonly maxLength: number;
  readonly path: Trajectory;
  /** The terminal guide line (empty when stationary). */
  readonly line: readonly Vec2[];
  /** ActualEnd: where the hero stops. */
  readonly end: Vec2;
}

/** Offsets of the travelling highlight along the chain (PulseSegmentStart/Length; NATIVE-076/077). */
export interface PulseLayout {
  readonly mainSegments: readonly { readonly start: number; readonly length: number }[];
  /** Chain distance of each displayed circle's marker (where its flash triggers). */
  readonly markerDistances: readonly number[];
  /** Drawn with PulseReverse = 1. */
  readonly terminalSegment: { readonly start: number; readonly length: number } | null;
  readonly totalLength: number;
}

export interface LaunchPreview {
  readonly hero: HeroLaunchStats;
  /** Hero position the chain was built from. */
  readonly origin: Vec2;
  /** Circle 0's direction after the whole-degree snap. */
  readonly aim: Vec2;
  /** Displayed circles 0..K: the main legs the launch replays. */
  readonly legs: readonly PreviewCircle[];
  /** The first hidden circle; its 长度 sets the terminal length. */
  readonly next: PreviewCircle | null;
  /** The terminal leg after the last displayed circle; null when it cannot be built. */
  readonly terminal: PreviewTerminal | null;
  /** 最终弹射值: the last displayed circle's 剩余长度. */
  readonly finalLaunchValue: number;
  /** 反弹次数: index of the last main leg (= legs.length − 1). */
  readonly bounceCount: number;
  /** 记录碰撞点: the ends of the displayed legs (input of the 乱舞 / Movement Range stat). */
  readonly collisionPoints: readonly Vec2[];
  readonly pulse: PulseLayout;
}

export interface PreviewOptions {
  readonly hero?: HeroLaunchStats;
  /** Actors the traces ignore (the hero itself, if it is part of the world). */
  readonly ignore?: Iterable<string>;
}

/**
 * 判断目标可反弹 (函数库_工具 ln 510–530): any of 环境.房间.有弹性, 可交互.角色.AI.仇恨, 可交互.角色.玩家,
 * 可交互.角色.AI.物品, or the class 蓝图_动态网格_C.
 */
export const canBounceOff = (actor: LaunchActor | null): boolean =>
  !!actor &&
  ([TAG.bouncyRoom, TAG.hostile, TAG.player, TAG.aiItem].some(t => hasTag(actor.tags, t)) || actor.classes.includes(DYNAMIC_MESH_CLASS));

/** 可交互.角色.AI.仇恨: the enemy marker (碰撞预览圈 L4510), the melee target and the hit-stop trigger. */
export const isHostile = (actor: LaunchActor | null): boolean => !!actor && hasTag(actor.tags, TAG.hostile);

/**
 * 目标位置向量 from a cursor point (蓝图_主角色控制器 设置指引点向量 ln 214–222): the cursor snapped to the 4-uu
 * grid, minus the hero.
 */
export const aimVector = (origin: Vec2, cursor: Vec2): Vec2 => sub(snapToGrid(cursor, LAUNCH_RULES.cursorGrid), origin);

/** Bounce bookkeeping a circle hands to the next one (ULaunchPreviewPathComponent fields). */
export interface BounceBudget {
  /** OrdinaryBounceCount. */
  readonly ordinary: number;
  /** PendingGravityBounces. */
  readonly pending: number;
  /** bBounceResolved (+0x159): the native resolve ran on a valid main path. */
  readonly resolved: boolean;
  /** 可反弹？. */
  readonly bounceable: boolean;
}

export interface BounceResolution extends BounceBudget {
  readonly deferred: boolean;
}

/**
 * ResolveLegacyPreviewBounce (fn@0x1445b1810, NATIVE-064). `previous` is null for circle 0. Without a valid
 * main path the legacy fallback applies and the counters stay reset (BuildLegacyPreviewMain cleared them).
 */
export function resolveLegacyPreviewBounce(input: {
  readonly mainPathValid: boolean;
  readonly lastPointCollision: boolean;
  readonly gravityPickups: number;
  readonly wallBounceAllowed: boolean;
  readonly index: number;
  readonly maxBounces: number;
  readonly previous: BounceBudget | null;
}): BounceResolution {
  const { index, maxBounces } = input;
  if (!input.mainPathValid) {
    const bounceable = input.wallBounceAllowed && index >= 0 && Number.isFinite(maxBounces) && index < maxBounces;
    return { ordinary: 0, pending: 0, resolved: false, bounceable, deferred: false };
  }
  const prev = input.previous;
  const inherit = !prev || (prev.resolved && prev.bounceable);
  let ordinary = inherit && prev ? prev.ordinary : 0;
  let pending = inherit && prev ? prev.pending : 0;
  const cap = LAUNCH_RULES.maxPendingGravityBounces;
  pending = Math.min(Math.max(Math.min(Math.max(input.gravityPickups, 0), cap) + pending, 0), cap);
  let bounceable = false;
  let deferred = false;
  if (inherit && index >= 0 && index <= LAUNCH_RULES.maxBounceIndex && Number.isFinite(maxBounces) && maxBounces >= 0) {
    if (input.lastPointCollision) {
      if (input.wallBounceAllowed && ordinary < maxBounces) {
        ordinary++;
        bounceable = true;
      }
    } else if (pending > 0) {
      pending--;
      deferred = true;
      bounceable = true;
    }
  }
  return { ordinary, pending, resolved: true, bounceable, deferred };
}

/** 剩余长度 (计算总长度 L612): the next circle's 长度 after a bounce, else at most 96 uu of it. */
export const terminalLength = (bounceable: boolean, nextLength: number): number =>
  bounceable ? nextLength : Math.min(LAUNCH_RULES.terminalCap, nextLength);

/** CanGrowLegacyPreviewChain (NATIVE-063): 1 ≤ count ≤ 63 and (no previous circle, or either one bounces). */
export const canGrowLegacyPreviewChain = (count: number, selfBounceable: boolean, previousBounceable: boolean | null): boolean =>
  count >= 1 && count <= LAUNCH_RULES.maxGrowCount && (previousBounceable === null || selfBounceable || previousBounceable);

/**
 * GetLegacyPreviewOutgoingVector (NATIVE-068): `legacy` (the reflection, or the leg direction) unless the main
 * path ends in the air, where the end tangent wins; without a path, a gravity pickup bends it to start → end.
 */
export function legacyOutgoingVector(path: Trajectory, gravityPickupSeen: boolean, start: Vec2, end: Vec2, legacy: Vec2): Vec2 {
  if (!path.valid) {
    if (gravityPickupSeen && isFiniteVec(start) && isFiniteVec(end)) {
      const v = safeNormal2D(sub(end, start));
      if (!nearlyZero(v)) return v;
    }
    return legacy;
  }
  const pts = path.points;
  const n = pts.length;
  if (n < 2 || pts[n - 1].collision) return legacy;
  for (let i = n - 2; i >= 0; i--) {
    const v = safeNormal2D(sub(pts[n - 1].location, pts[i].location));
    if (!nearlyZero(v)) return v;
  }
  return legacy;
}

/** GetLegacyPreviewIncomingVector (NATIVE-067): last segment, pointing backwards; zero below 2 points. */
export function legacyIncomingVector(path: Trajectory): Vec2 {
  const pts = path.points;
  return pts.length >= 2 ? sub(pts[pts.length - 2].location, pts[pts.length - 1].location) : ZERO;
}

interface Context {
  readonly world: LaunchWorld;
  readonly hero: HeroLaunchStats;
  readonly ignore: ReadonlySet<string>;
  readonly sources: readonly GravitySource[];
  readonly gravityPickups: ReadonlySet<string>;
}

/** CollectIgnoredPickupSources (fn@0x1445ae740, NATIVE-055): earlier circles' gravity pickups and those at the start. */
function ignoredPickupSources(ctx: Context, earlier: ReadonlySet<string>, start: Vec2, radius: number): Set<string> {
  const out = new Set([...earlier].filter(id => ctx.gravityPickups.has(id)));
  for (const p of overlappingPickups(ctx.world, start, Math.max(radius, 1), new Set())) if (isPreviewGravityPickup(p)) out.add(p.id);
  return out;
}

/**
 * Legacy::BuildLeg with its chain lookups (NATIVE-054…056): sources whose pickups the chain already passed stop
 * pulling (`picked`), earlier gravity pickups are skipped by the item scan (`earlier`), and recovery only escapes
 * the owner circle's last contact.
 */
function chainLeg(ctx: Context, start: Vec2, delta: Vec2, dist: number, radius: number, picked: ReadonlySet<string>, earlier: ReadonlySet<string>, owner: PreviewCircle | null): LegResult {
  const last = owner && owner.path.valid && owner.path.points.length > 0 ? lastPoint(owner.path) : null;
  return buildLeg(ctx.world, start, delta, dist, radius, {
    z: ctx.hero.height,
    sources: ctx.sources.filter(g => !(g.disableAfterPreviewPickup && picked.has(g.sourceId))),
    ignore: ctx.ignore,
    extraIgnore: ignoredPickupSources(ctx, earlier, start, radius),
    departure: last && last.collision && last.hit ? last.hit.actor.id : null,
  });
}

/** CollectChainPickups: the PredictedPickups of the first `count` circles. */
const chainPickups = (circles: readonly PreviewCircle[], count: number): Set<string> => new Set(circles.slice(0, count).flatMap(c => c.pickups));

const lineOf = (path: Trajectory): Vec2[] => (isStationaryCollision(path) ? [] : path.points.map(p => p.location));
const lastPoint = (path: Trajectory) => path.points[path.points.length - 1];
const mainPathValid = (path: Trajectory): boolean => path.valid && path.points.length >= 2;

/** Computes the preview chain for an aim vector (cursor − hero; circle 0 snaps it to whole degrees). */
export function computeLaunchPreview(world: LaunchWorld, origin: Vec2, aim: Vec2, options: PreviewOptions = {}): LaunchPreview {
  const hero = options.hero ?? STARTER_HERO;
  const ctx: Context = {
    world,
    hero,
    ignore: new Set(options.ignore ?? []),
    sources: gatherGravitySources(world),
    gravityPickups: new Set(world.pickups.filter(isPreviewGravityPickup).map(p => p.id)),
  };
  const radius = f32(hero.width * LAUNCH_RULES.probeRadiusFactor);
  const aimDir = snapAimDirection(aim, LAUNCH_RULES.aimSnapDegrees);
  const circles: PreviewCircle[] = [];

  for (let index = 0; ; index++) {
    const prev = index > 0 ? circles[index - 1] : null;
    const direction = prev ? prev.bounceDirection : aimDir;
    const start = prev ? prev.end : origin;
    // 碰撞预览圈 L1802: the trace starts 0.05 uu along the leg and runs 捕获距离 = 弹射距离.
    const traceStart = add(start, mul(direction, LAUNCH_RULES.startOffset));
    const traceEnd = add(traceStart, mul(direction, hero.launchDistance));
    const delta = sub(traceEnd, traceStart);
    const earlier = chainPickups(circles, index);
    const leg = chainLeg(ctx, traceStart, delta, f32(length(delta)), radius, earlier, earlier, prev);

    let path = INVALID_PATH;
    let hit: Hit | null;
    let end: Vec2;
    let pickups: string[];
    if (leg.ok) {
      path = leg.path;
      const last = lastPoint(path);
      hit = last.collision ? last.hit : null;
      end = last.location;
      pickups = leg.itemHits.map(h => h.pickup.id);
    } else {
      // BuildLegacyPreviewMain failed and cleared MainPath (exe@0x1445a8623–0x1445a8652); the Blueprint falls back
      // to plain sphere traces (拾取物判断 L1623, L2892).
      hit = sweepProbe(world, traceStart, traceEnd, { radius, halfHeight: radius, z: hero.height }, ctx.ignore);
      end = hit ? hit.location : traceEnd;
      const skip = ignoredPickupSources(ctx, earlier, traceStart, radius);
      pickups = sweepPickups(world, traceStart, traceEnd, radius, ctx.ignore).map(h => h.pickup.id).filter(id => !skip.has(id));
    }
    // SPEC-GAP: the Demo marks a hidden circle's pickups only while it is not the last circle of its array
    // (拾取物判断 L617), which depends on circles left over from longer chains; every circle marks them here. It
    // changes nothing the launch uses: a hidden circle's pickups never reach a displayed circle or the terminal.
    pickups = [...new Set(pickups)];

    const blocking = hit !== null;
    const arc = path.valid ? path.totalDistance : 0;
    const longEnough = arc > LAUNCH_RULES.arcLengthThreshold;
    // Out Hit.TraceStart: the native hit's own sweep step, else the leg's trace start.
    const hitTraceStart = hit ? hit.traceStart : traceStart;
    const incoming = longEnough ? legacyIncomingVector(path) : sub(hitTraceStart, end);
    const reflected = hit ? bounceDirection(hit.normal, incoming) : direction;
    const gravitySeen = pickups.some(id => ctx.gravityPickups.has(id));
    const hitActor = hit ? hit.actor : null;
    const resolution = resolveLegacyPreviewBounce({
      mainPathValid: mainPathValid(path),
      lastPointCollision: mainPathValid(path) && lastPoint(path).collision,
      gravityPickups: pickups.filter(id => ctx.gravityPickups.has(id)).length,
      // 计算总长度 L1133/L612; 有减速？ is never set (TRAJEC-014), so its term is dropped.
      wallBounceAllowed: canBounceOff(hitActor) && (prev ? prev.bounceable : true) && blocking,
      index,
      maxBounces: hero.maxBounces,
      previous: prev ? { ordinary: prev.ordinaryBounces, pending: prev.pendingGravityBounces, resolved: mainPathValid(prev.path), bounceable: prev.bounceable } : null,
    });
    const displayed = resolution.bounceable || index === 0;
    circles.push({
      index,
      start,
      direction,
      path,
      line: path.valid ? lineOf(path) : [start, end],
      end,
      length: longEnough ? arc : distance(hitTraceStart, end),
      hit,
      marker: !blocking ? 'none' : isHostile(hitActor) ? 'enemy' : 'wall',
      bounceDirection: legacyOutgoingVector(path, gravitySeen, start, end, reflected),
      bounceable: resolution.bounceable,
      displayed,
      deferredGravityBounce: resolution.deferred,
      ordinaryBounces: resolution.ordinary,
      pendingGravityBounces: resolution.pending,
      pickups,
    });
    if (!displayed || !canGrowLegacyPreviewChain(index + 1, resolution.bounceable, prev ? prev.bounceable : null)) break;
  }

  const legs = circles.filter(c => c.displayed);
  const last = legs[legs.length - 1];
  // 计算总长度 L612: next = 碰撞预览圈数组[min(序号 + 1, len − 1)].
  const next = circles[Math.min(last.index + 1, circles.length - 1)];
  const remaining = terminalLength(last.bounceable, next.length);
  const terminal = buildTerminal(ctx, last, f32(remaining), chainPickups(circles, last.index + 1), chainPickups(circles, last.index));

  return {
    hero,
    origin,
    aim: aimDir,
    legs,
    next: next === last ? null : next,
    terminal,
    finalLaunchValue: remaining,
    bounceCount: legs.length - 1,
    collisionPoints: legs.map(c => c.end),
    pulse: pulseLayout(legs, terminal),
  };
}

/** BuildLegacyPreviewTerminal (NATIVE-062): one leg from the last end along its bounce direction, radius 宽度. */
function buildTerminal(ctx: Context, owner: PreviewCircle, maxLength: number, picked: ReadonlySet<string>, earlier: ReadonlySet<string>): PreviewTerminal | null {
  const leg = chainLeg(ctx, owner.end, owner.bounceDirection, maxLength, ctx.hero.width, picked, earlier, owner);
  if (!leg.ok) return null;
  return {
    start: owner.end,
    direction: safeNormal2D(owner.bounceDirection),
    maxLength,
    path: leg.path,
    line: lineOf(leg.path),
    end: lastPoint(leg.path).location,
  };
}

/** RegisterPulseLine lengths and the root's chain offsets (main lines visible; the terminal follows its owner). */
function pulseLayout(legs: readonly PreviewCircle[], terminal: PreviewTerminal | null): PulseLayout {
  const mainSegments: { start: number; length: number }[] = [];
  const markerDistances: number[] = [];
  let offset = 0;
  for (const c of legs) {
    // Without a valid main path the Demo draws a synthetic straight path start → end (NATIVE-072).
    const len = c.path.valid ? Math.max(0, c.path.totalDistance) : distance(c.start, c.end);
    mainSegments.push({ start: offset, length: len });
    markerDistances.push(offset + len);
    offset += len;
  }
  const terminalSegment = terminal ? { start: offset, length: Math.max(0, terminal.path.totalDistance) } : null;
  return { mainSegments, markerDistances, terminalSegment, totalLength: offset + (terminalSegment ? terminalSegment.length : 0) };
}

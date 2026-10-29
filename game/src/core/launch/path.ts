/**
 * The native launch-path builder: ULaunchTrajectoryLibrary::BuildTrajectory → Launch::BuildPathCore
 * (fn@0x1445a9900), plus gravity steering, the bounce filter and the trajectory sampler. Rule ids NATIVE-xxx
 * refer to spec-drafts/native-trajectory.md §5. The probe is swept step by step; each step is a single sweep,
 * so nothing can tunnel through a solid whatever the leg length or playback speed.
 */
import {
  type Vec2,
  add,
  clamp,
  distance,
  dot,
  EPS,
  f32,
  isFiniteVec,
  mul,
  nearlyZero,
  reflect,
  rotate,
  safeNormal2D,
  sub,
  wrap180,
} from './math.ts';
import {
  type GravitySource,
  type Hit,
  type LaunchActor,
  type LaunchWorld,
  type Pickup,
  type Probe,
  type ShapeKind,
  hasTag,
  isPreviewGravityPickup,
  probeOverlaps,
  sweepPickups,
  sweepProbe,
  TAG,
} from './world.ts';

/** ELaunchPathStopReason (InvalidInput 0, DistanceExhausted 1, Collision 2, Stuck 3, PointLimit 4). */
export type StopReason = 'invalid-input' | 'distance-exhausted' | 'collision' | 'stuck' | 'point-limit';

/** FLaunchPathPoint. */
export interface PathPoint {
  readonly location: Vec2;
  /** Cumulative path length at this point (f32). */
  readonly distance: number;
  /** The path's bounce count when the point was appended. */
  readonly legIndex: number;
  readonly collision: boolean;
  readonly bounce: boolean;
  readonly hit: Hit | null;
}

/** FLaunchTrajectory. */
export interface Trajectory {
  readonly points: readonly PathPoint[];
  readonly totalDistance: number;
  readonly bounceCount: number;
  readonly stopReason: StopReason;
  readonly valid: boolean;
  readonly stationaryCollision: boolean;
}

/**
 * FLaunchPathSettings. The collision channel (default 3 = Visibility) is implicit: every solid of the launch
 * world blocks it and pickups answer only the item channel.
 */
export interface PathSettings {
  readonly distancePerLeg: number;
  readonly maxBounces: number;
  readonly stepDistance: number;
  readonly maxPoints: number;
  readonly probeRadius: number;
  readonly probeHalfHeight: number;
  readonly useSphereProbe: boolean;
  readonly bounceTags: readonly string[];
  readonly neverBounceTags: readonly string[];
  readonly additionalBounceClasses: readonly string[];
  readonly maxTurnDegreesPerStep: number;
  readonly bounceSeparation: number;
}

/** Member initialisers written by the BuildTrajectory exec thunk (exe@0x144593a21–0x144593a80, NT-V01). */
export const DEFAULT_PATH_SETTINGS: PathSettings = Object.freeze({
  distancePerLeg: 1000,
  maxBounces: 0,
  stepDistance: 20,
  maxPoints: 2048,
  probeRadius: 80,
  probeHalfHeight: 80,
  useSphereProbe: false,
  bounceTags: [],
  neverBounceTags: [],
  additionalBounceClasses: [],
  maxTurnDegreesPerStep: 15,
  bounceSeparation: 2,
});

/** The parameters BuildPathCore derives from its settings (NATIVE-005/011/027). */
export interface EffectivePathParams {
  readonly radius: number;
  readonly halfHeight: number;
  readonly maxPoints: number;
  readonly step: number;
  readonly maxBounces: number;
  readonly maxTurn: number;
  readonly separation: number;
}

export function effectivePathParams(s: PathSettings): EffectivePathParams {
  const radius = Math.max(f32(s.probeRadius), 1);
  return {
    radius,
    halfHeight: s.useSphereProbe ? radius : Math.max(f32(s.probeHalfHeight), radius),
    maxPoints: clamp(Math.trunc(s.maxPoints), 2, 4096),
    step: Math.max(Math.min(f32(s.stepDistance), 200), 1),
    maxBounces: clamp(Math.trunc(s.maxBounces), 0, 32),
    maxTurn: clamp(f32(s.maxTurnDegreesPerStep), 0, 90),
    separation: Math.max(Math.min(f32(s.bounceSeparation), 10), 0),
  };
}

/** Limits of the leg-start recovery for a probe of this radius against this component family (NATIVE-016). */
export function recoveryLimits(radius: number, shape: ShapeKind): { maxExit: number; outwardThreshold: number; penetrationLimit: number } {
  const primitive = shape !== 'mesh';
  return {
    maxExit: primitive ? Math.max(Math.min(f32(radius * f32(1.5)), 96), 12) : Math.min(f32(radius * f32(0.25)), 12),
    outwardThreshold: primitive ? f32(-1e-4) : f32(0.25),
    penetrationLimit: Math.min(f32(radius * f32(0.1)), 4),
  };
}

const DEFAULT_BOUNCE_TAGS = [TAG.bouncyRoom, TAG.hostile, TAG.player, TAG.aiItem];

/** Launch::ShouldBounceOffActor (NATIVE-040…042): only used by in-path bounces (MaxBounces > 0). */
export function shouldBounceOffActor(actor: LaunchActor, s: PathSettings): boolean {
  const never = s.neverBounceTags.length > 0 ? s.neverBounceTags.some(t => hasTag(actor.tags, t)) : hasTag(actor.tags, TAG.slowPickup);
  if (never) return false;
  if (s.additionalBounceClasses.some(c => actor.classes.includes(c))) return true;
  const bounce = s.bounceTags.length > 0 ? s.bounceTags : DEFAULT_BOUNCE_TAGS;
  return bounce.some(t => hasTag(actor.tags, t));
}

/** Launch::SteerByGravity (NATIVE-031…036): turns the heading toward (or away from) the sources, ≤ maxTurn°. */
export function steerByGravity(pos: Vec2, d: Vec2, stepLen: number, sources: readonly GravitySource[], maxTurn: number): Vec2 {
  let ax = 0;
  let ay = 0;
  for (const g of sources) {
    if (!Number.isFinite(g.strength) || !Number.isFinite(g.radius) || !(g.radius > 0) || !(g.strength > 0)) continue;
    const dx = g.position.x - pos.x;
    const dy = g.position.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= EPS || dist >= g.radius) continue;
    const t = 1 - dist / g.radius;
    const signed = g.mode === 'repel' ? -t : t;
    const w = (3 - (t + t)) * t * (g.strength * signed);
    ax += (1 / dist) * dx * w;
    ay += (1 / dist) * dy * w;
  }
  if (nearlyZero({ x: ax, y: ay })) return d;
  const k = f32(f32(stepLen) * f32(0.01));
  const nv = safeNormal2D({ x: d.x + ax * k, y: d.y + ay * k });
  if (nearlyZero(nv)) return d;
  const delta = clamp(wrap180(Math.atan2(nv.y, nv.x) * 57.295779513082323 - Math.atan2(d.y, d.x) * 57.295779513082323), -maxTurn, maxTurn);
  return safeNormal2D(rotate(d, delta * 0.017453292519943295));
}

/** An item hit recorded by the item phase (FHitResult copy with Distance = path distance + 2). */
export interface ItemRecord {
  readonly pickup: Pickup;
  readonly time: number;
  readonly location: Vec2;
  readonly distance: number;
}

export interface PathOptions {
  /** Height of the probe centre (Start.Z); the Demo traces at the hero's 高度. Default 0. */
  readonly z?: number;
  readonly sources?: readonly GravitySource[];
  /** ActorsToIgnore, plus the WorldContext actor (NATIVE-006). */
  readonly ignore?: Iterable<string>;
}

/** What Legacy::BuildLeg looks up in the preview chain; the chain (preview.ts) fills these in. */
export interface LegOptions extends PathOptions {
  /** Gravity pickups the item scan skips (CollectIgnoredPickupSources, NATIVE-055). */
  readonly extraIgnore?: ReadonlySet<string>;
  /** Actor the path departs from (the owner circle's last contact); recovery only escapes that one (NATIVE-016/056). */
  readonly departure?: string | null;
}

/** Arguments BuildTrajectory leaves null and Legacy::BuildLeg fills in (NATIVE-001, NATIVE-057). */
export interface PathCoreOptions extends LegOptions {
  /** Run the 物品 item phase: record pickup hits and truncate at gravity pickups (NATIVE-008/020/021). */
  readonly itemPhase?: boolean;
  /** Capture the first blocking hit at the start, for the stationary conversion (NATIVE-018/019/058). */
  readonly captureFirstHit?: boolean;
}

export interface PathCoreResult {
  readonly trajectory: Trajectory;
  /** The native debug text (never shown in game). */
  readonly debug: string;
  readonly recoveries: number;
  readonly itemHits: readonly ItemRecord[];
  readonly firstHit: Hit | null;
}

interface MutablePoint {
  location: Vec2;
  distance: number;
  legIndex: number;
  collision: boolean;
  bounce: boolean;
  hit: Hit | null;
}

const point = (location: Vec2, dist: number, legIndex: number, hit: Hit | null = null): MutablePoint =>
  ({ location, distance: dist, legIndex, collision: hit !== null, bounce: false, hit });

/** Exit offsets tried by the leg-start recovery, in order (exe@0x1445aa736–0x1445aa794). */
const EXIT_OFFSETS = [0.5, 1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96];

/** Launch::BuildPathCore (NATIVE-002…030). */
export function buildPathCore(world: LaunchWorld, start: Vec2, direction: Vec2, s: PathSettings, o: PathCoreOptions = {}): PathCoreResult {
  const points: MutablePoint[] = [];
  const itemHits: ItemRecord[] = [];
  let D = safeNormal2D(direction);
  const legDistance = f32(s.distancePerLeg);
  const finish = (stopReason: StopReason, total: number, bounceCount: number, debug: string, recoveries: number, firstHit: Hit | null): PathCoreResult => ({
    trajectory: { points, totalDistance: total, bounceCount, stopReason, valid: points.length > 0, stationaryCollision: false },
    debug,
    recoveries,
    itemHits,
    firstHit,
  });
  if (nearlyZero(D) || !isFiniteVec(start) || !Number.isFinite(legDistance) || !(legDistance > 0)) {
    return finish('invalid-input', 0, 0, 'invalid input', 0, null);
  }

  const p = effectivePathParams(s);
  const probe: Probe = { radius: p.radius, halfHeight: p.halfHeight, z: o.z ?? 0 };
  const ignore = new Set(o.ignore ?? []);
  const itemIgnore = new Set(ignore); // copied before the extra ignores below (NATIVE-007)
  const extraIgnore = o.extraIgnore ?? new Set<string>();
  const sources = o.sources ?? [];
  let local = sources;
  if (o.itemPhase) {
    for (const g of sources) if (g.disableAfterPreviewPickup) ignore.add(g.sourceId);
    for (const id of extraIgnore) ignore.add(id);
  }

  let firstHit: Hit | null = null;
  let recoveries = 0;
  let debug = '';
  let departure = o.departure ?? null;
  const seen = new Set<string>();
  points.push(point(start, 0, 0));
  let pos = start;
  let legStart = true;
  let shortImpacts = 0;
  let remaining = legDistance;
  let total = f32(0);
  let recoveryAdvance = 0;
  let bounceCount = 0;
  let stop: StopReason | null = null;

  for (;;) {
    if (!(remaining > EPS)) {
      stop = 'distance-exhausted';
      break;
    }
    const stepLen = f32(Math.min(remaining, p.step));
    D = steerByGravity(pos, D, stepLen, local, p.maxTurn);
    const end = add(pos, mul(D, stepLen));
    let hit = sweepProbe(world, pos, end, probe, ignore);
    let stopPos = hit ? hit.location : end;
    let advanced = f32(distance(stopPos, pos));
    let recovered = false;

    if (hit) {
      const n = safeNormal2D(hit.normal);
      const outward = f32(dot(n, D));
      const legStartContact = legStart && advanced < 0.5 && outward >= f32(-1e-4);
      if (hit.startPenetrating || legStartContact) {
        const comp = hit.actor;
        const sameDeparture = departure === null || departure === comp.id;
        const lim = recoveryLimits(p.radius, comp.shape);
        const depthOk = !hit.startPenetrating || hit.penetrationDepth <= lim.penetrationLimit;
        let ok = false;
        let why: string;
        if (legStart && depthOk && sameDeparture && !nearlyZero(n) && outward >= lim.outwardThreshold) {
          why = 'no-safe-exit';
          const exitIgnore = new Set(ignore).add(comp.id);
          let tried = false;
          for (const raw of [...EXIT_OFFSETS, Math.min(lim.maxExit, remaining)]) {
            const offset = f32(raw);
            if (!(offset > EPS && offset <= lim.maxExit && offset <= remaining)) continue;
            tried = true;
            const candidate = add(pos, mul(D, offset));
            const exitHit = sweepProbe(world, pos, candidate, probe, exitIgnore);
            if (exitHit) {
              if (o.captureFirstHit && total <= EPS) firstHit = exitHit;
              why = `exit-sweep-blocked-by=${exitHit.actor.id} offset=${offset.toFixed(2)}`;
              const partial = f32(distance(exitHit.location, pos));
              if (!exitHit.startPenetrating && partial > EPS) {
                stopPos = exitHit.location;
                advanced = partial;
                hit = exitHit;
                ok = true;
                recoveryAdvance = partial;
                recoveries++;
              }
              break;
            }
            if (probeOverlaps(world, candidate, probe, ignore)) {
              why = `candidate-still-overlapping offset=${offset.toFixed(2)}`;
              continue;
            }
            stopPos = candidate;
            advanced = offset;
            hit = null;
            ok = true;
            recoveryAdvance = offset;
            recoveries++;
            break;
          }
          if (!tried) why = 'no-exit-offset-fits-leg-or-radius';
        } else {
          why = legStart ? 'direction-not-outward' : 'not-leg-start';
          if (legStart && !depthOk) why = 'contact-too-deep';
          if (legStart && !sameDeparture) why = 'different-departure-component';
        }
        if (!ok) {
          if (o.captureFirstHit && total <= EPS && firstHit === null && hit) firstHit = hit;
          stop = 'stuck';
          debug = `leg-start recovery=${why}`;
          break;
        }
        recovered = true;
      }
    }

    if (o.itemPhase && advanced > EPS) {
      for (const h of sweepPickups(world, pos, stopPos, p.radius, itemIgnore)) {
        const id = h.pickup.id;
        if (seen.has(id)) continue;
        seen.add(id);
        if (extraIgnore.has(id)) continue;
        const along = clamp(h.time, 0, 1);
        const d = f32(along * advanced);
        itemHits.push({ pickup: h.pickup, time: h.time, location: h.location, distance: f32(f32(d + total) + 2) });
        if (isPreviewGravityPickup(h.pickup)) {
          local = local.filter(g => !(g.disableAfterPreviewPickup && g.sourceId === id));
          if (f32(d + EPS) < advanced) {
            stopPos = add(pos, mul(sub(stopPos, pos), along));
            advanced = d;
            hit = null;
          }
          break;
        }
      }
    }

    const appended = point(stopPos, f32(advanced + total), bounceCount, hit);
    points.push(appended);
    remaining = f32(remaining - advanced);
    total = f32(advanced + total);
    pos = stopPos;

    if (recovered && !hit && f32(advanced + EPS) < recoveryAdvance) {
      // A gravity pickup cut a recovery step short: still at the leg start (NATIVE-023).
      legStart = true;
      recoveryAdvance = 0;
      shortImpacts = 0;
    } else {
      legStart = false;
      if (!hit) {
        recoveryAdvance = 0;
        shortImpacts = 0;
      } else {
        const n = safeNormal2D(hit.normal);
        if (bounceCount >= p.maxBounces || nearlyZero(n) || !shouldBounceOffActor(hit.actor, s)) {
          stop = 'collision';
          break;
        }
        shortImpacts++;
        appended.bounce = true;
        if (shortImpacts > 3 && advanced < f32(p.radius * f32(0.1))) {
          stop = 'stuck';
          debug = 'repeated short impacts';
          break;
        }
        D = safeNormal2D(reflect(D, n));
        if (nearlyZero(D)) {
          stop = 'stuck';
          debug = 'reflection produced zero direction';
          break;
        }
        bounceCount++;
        departure = hit.actor.id;
        legStart = true;
        recoveryAdvance = 0;
        remaining = legDistance; // the leftover of the previous leg is lost (NATIVE-027)
        if (p.separation > 0 && points.length < p.maxPoints) {
          pos = add(pos, mul(n, p.separation));
          total = f32(p.separation + total);
          points.push(point(pos, total, bounceCount));
          remaining = f32(remaining - p.separation);
        }
      }
    }
    if (points.length >= p.maxPoints) {
      stop ??= 'point-limit';
      break;
    }
  }
  return finish(stop ?? 'point-limit', total, bounceCount, debug, recoveries, firstHit);
}

/** ULaunchTrajectoryLibrary::BuildTrajectory (NATIVE-001): the core without the item phase. */
export function buildTrajectory(world: LaunchWorld, start: Vec2, direction: Vec2, settings: PathSettings = DEFAULT_PATH_SETTINGS, options: PathOptions = {}): Trajectory {
  return buildPathCore(world, start, direction, settings, options).trajectory;
}

/** Settings of one legacy preview leg (exe@0x1445a8f9b–0x1445a902a, NATIVE-053): a MaxBounces-0 sphere probe. */
export function legacyLegSettings(distance: number, radius: number): PathSettings {
  const r = f32(radius);
  return {
    ...DEFAULT_PATH_SETTINGS,
    distancePerLeg: distance,
    maxBounces: 0,
    stepDistance: Math.max(Math.min(f32(r * f32(0.25)), 20), 5),
    maxPoints: 4096,
    probeRadius: r,
    probeHalfHeight: r,
    useSphereProbe: true,
    maxTurnDegreesPerStep: 15,
    bounceSeparation: 2,
  };
}

export interface LegResult {
  /** BuildLeg's result: the path may be shown and replayed (NATIVE-059). */
  readonly ok: boolean;
  readonly path: Trajectory;
  readonly itemHits: readonly ItemRecord[];
}

/** A path that was never built (BuildLeg rejected its inputs). */
export const INVALID_PATH: Trajectory = Object.freeze({ points: [], totalDistance: 0, bounceCount: 0, stopReason: 'invalid-input', valid: false, stationaryCollision: false });

/**
 * Legacy::BuildLeg (fn@0x1445a8d90, NATIVE-052…059): one leg from `start` along `delta` for `distance` with a
 * sphere probe of `radius`, the item phase on, and a start blocked by a solid turned into a stationary collision.
 */
export function buildLeg(world: LaunchWorld, start: Vec2, delta: Vec2, distance: number, radius: number, o: LegOptions = {}): LegResult {
  const dir = safeNormal2D(delta);
  const r = f32(radius);
  if (!isFiniteVec(start) || nearlyZero(dir) || !Number.isFinite(distance) || !(f32(distance) > EPS) || !Number.isFinite(r) || !(r > 0)) {
    return { ok: false, path: INVALID_PATH, itemHits: [] };
  }
  const core = buildPathCore(world, start, dir, legacyLegSettings(distance, r), { ...o, itemPhase: true, captureFirstHit: true });
  let path = core.trajectory;
  const first = core.firstHit;
  if (path.stopReason === 'stuck' && path.valid && path.points.length === 1 && path.totalDistance <= EPS && first) {
    // Blocked immediately at the start (NATIVE-058).
    const hit: Hit = { ...first, location: start, traceStart: start, traceEnd: add(start, mul(dir, distance)) };
    path = {
      points: [path.points[0], { location: start, distance: 0, legIndex: 0, collision: true, bounce: false, hit }],
      totalDistance: path.totalDistance,
      bounceCount: 0,
      stopReason: 'collision',
      valid: true,
      stationaryCollision: true,
    };
  }
  return { ok: isPlayablePath(path), path, itemHits: core.itemHits };
}

/** FLaunchTrajectory::IsStationaryCollision (fn@0x1445b0040): "blocked immediately at the start". */
export function isStationaryCollision(t: Trajectory): boolean {
  if (!t.valid || !t.stationaryCollision || t.stopReason !== 'collision' || t.points.length !== 2 || t.totalDistance !== 0) return false;
  const [p0, p1] = t.points;
  return p1.collision && p1.location.x === p0.location.x && p1.location.y === p0.location.y;
}

/** The test BuildLeg and StartLegacyPreviewLeg apply before a path may be shown or replayed (NATIVE-059/090). */
export function isPlayablePath(t: Trajectory): boolean {
  if (!t.valid || t.points.length < 2 || !Number.isFinite(t.totalDistance)) return false;
  return t.totalDistance > EPS ? t.stopReason !== 'stuck' && t.stopReason !== 'point-limit' : isStationaryCollision(t);
}

/** ULaunchTrajectoryLibrary::SampleTrajectory (NATIVE-087): location and segment direction at a path distance. */
export function sampleTrajectory(t: Trajectory, at: number): { location: Vec2; direction: Vec2 } | null {
  const n = t.points.length;
  if (!t.valid || n === 0) return null;
  if (n === 1) return { location: t.points[0].location, direction: { x: 0, y: 0 } };
  const d = clamp(at, 0, t.totalDistance);
  let lo = 1;
  let hi = n - 1;
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (d <= t.points[mid].distance) hi = mid;
    else lo = mid + 1;
  }
  const a = t.points[lo - 1];
  const b = t.points[lo];
  const seg = f32(b.distance - a.distance);
  const u = seg > EPS ? clamp(f32(f32(d - a.distance) / seg), 0, 1) : 1;
  return { location: add(a.location, mul(sub(b.location, a.location), u)), direction: safeNormal2D(sub(b.location, a.location)) };
}

import { describe, expect, it } from 'vitest';
import { vec } from '../../src/core/launch/math.ts';
import {
  buildLeg,
  buildPathCore,
  buildTrajectory,
  DEFAULT_PATH_SETTINGS,
  effectivePathParams,
  legacyLegSettings,
  recoveryLimits,
  sampleTrajectory,
  shouldBounceOffActor,
  steerByGravity,
  type Trajectory,
} from '../../src/core/launch/path.ts';
import { createLaunchWorld, gatherGravitySources, type GravitySource, type LaunchActor, TAG } from '../../src/core/launch/world.ts';
import { settings, wallAboveY, wallAtLeast, wallAtMost, wallBelowY, xs } from './fixtures.ts';

const EMPTY = createLaunchWorld({});
const BOUNCY = [TAG.bouncyRoom];
const east = vec(1, 0);
const west = vec(-1, 0);
const diag = vec(0.70710678, 0.70710678);
const wallWorld = (x: number, tags: readonly string[] = BOUNCY, shape: 'box' | 'mesh' = 'box') => createLaunchWorld({ boxes: [wallAtLeast('wall', x, { tags, shape })] });
const sphere10 = { stepDistance: 20, probeRadius: 10, useSphereProbe: true };
const closeAll = (got: readonly number[], want: readonly number[], tolerance = 1e-6): void => {
  expect(got).toHaveLength(want.length);
  got.forEach((v, i) => expect(Math.abs(v - want[i]), `index ${i}: ${v} vs ${want[i]}`).toBeLessThanOrEqual(tolerance));
};

describe('settings and limits (§14.1)', () => {
  it('NT-V01: FLaunchPathSettings member initialisers', () => {
    expect(DEFAULT_PATH_SETTINGS).toEqual({
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
  });

  it('NT-V02: BuildPathCore clamps its parameters', () => {
    const p = effectivePathParams(settings({ probeRadius: 0.25, maxPoints: 1, stepDistance: 1000, maxBounces: 99, maxTurnDegreesPerStep: 120, bounceSeparation: 50, probeHalfHeight: 0 }));
    expect(p).toEqual({ radius: 1, halfHeight: 1, maxPoints: 2, step: 200, maxBounces: 32, maxTurn: 90, separation: 10 });
  });

  it('NT-V03: legacy step = clamp(0.25 · radius, 5, 20) in float', () => {
    expect([45.6, 10, 16, 30, 200].map(r => legacyLegSettings(100, r).stepDistance)).toEqual([11.399999618530273, 5, 5, 7.5, 20]);
    expect(legacyLegSettings(100, 53.2)).toMatchObject({ maxBounces: 0, maxPoints: 4096, useSphereProbe: true, maxTurnDegreesPerStep: 15, bounceSeparation: 2 });
  });

  it('NT-V04: leg-start recovery limits per component family', () => {
    const cases: [number, 'box' | 'mesh' | 'sphere' | 'capsule', number, number][] = [
      [40, 'box', 60, -1e-4],
      [40, 'mesh', 10, 0.25],
      [4, 'sphere', 12, -1e-4],
      [100, 'capsule', 96, -1e-4],
      [100, 'mesh', 12, 0.25],
    ];
    for (const [r, shape, maxExit, threshold] of cases) {
      const lim = recoveryLimits(r, shape);
      expect(lim.maxExit).toBe(maxExit);
      expect(lim.outwardThreshold).toBeCloseTo(threshold, 9);
    }
    expect(recoveryLimits(10, 'box').penetrationLimit).toBeCloseTo(1, 6);
    expect(recoveryLimits(45, 'box').penetrationLimit).toBe(4);
  });
});

describe('path scenes (§14.2)', () => {
  it('NT-V05: free flight, steps of 20', () => {
    const t = buildTrajectory(EMPTY, vec(0, 0), east, settings({ distancePerLeg: 100, stepDistance: 20, probeRadius: 80 }));
    expect(xs(t.points)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(t.points.map(p => p.distance)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(t.points.map(p => p.legIndex)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(t.points.some(p => p.collision)).toBe(false);
    expect(t).toMatchObject({ stopReason: 'distance-exhausted', bounceCount: 0, totalDistance: 100, valid: true });
  });

  it('NT-V06: the last step is the remainder', () => {
    const t = buildTrajectory(EMPTY, vec(0, 0), east, settings({ distancePerLeg: 50, stepDistance: 20 }));
    expect(xs(t.points)).toEqual([0, 20, 40, 50]);
    expect(t.stopReason).toBe('distance-exhausted');
  });

  it('NT-V07: point limit', () => {
    const t = buildTrajectory(EMPTY, vec(0, 0), east, settings({ distancePerLeg: 100, stepDistance: 20, maxPoints: 3 }));
    expect(xs(t.points)).toEqual([0, 20, 40]);
    expect(t).toMatchObject({ stopReason: 'point-limit', totalDistance: 40 });
  });

  it('NT-V08: PointLimit is tested before DistanceExhausted', () => {
    const t = buildTrajectory(EMPTY, vec(0, 0), east, settings({ distancePerLeg: 100, stepDistance: 20, maxPoints: 6 }));
    expect(xs(t.points)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(t).toMatchObject({ stopReason: 'point-limit', totalDistance: 100 });
  });

  it('NT-V09: step clamped to 200', () => {
    const t = buildTrajectory(EMPTY, vec(0, 0), east, settings({ distancePerLeg: 500, stepDistance: 1000 }));
    expect(xs(t.points)).toEqual([0, 200, 400, 500]);
  });

  it('NT-V10: invalid inputs', () => {
    for (const [dir, distancePerLeg] of [[vec(0, 0), 1000], [east, 0], [vec(5e-5, 5e-5), 100], [east, Number.NaN]] as const) {
      const t = buildTrajectory(EMPTY, vec(0, 0), dir, settings({ distancePerLeg }));
      expect(t).toMatchObject({ points: [], stopReason: 'invalid-input', valid: false });
    }
    expect(buildTrajectory(EMPTY, vec(Number.POSITIVE_INFINITY, 0), east).stopReason).toBe('invalid-input');
  });

  it('NT-V11: bounce, separation, full leg reset', () => {
    const t = buildTrajectory(wallWorld(55), vec(0, 0), east, settings({ ...sphere10, distancePerLeg: 100, maxBounces: 1 }));
    expect(xs(t.points)).toEqual([0, 20, 40, 45, 43, 23, 3, -17, -37, -55]);
    expect(t.points.map(p => p.distance)).toEqual([0, 20, 40, 45, 47, 67, 87, 107, 127, 145]);
    expect(t.points.map(p => p.legIndex)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    expect(t.points.map((p, i) => (p.collision ? i : -1)).filter(i => i >= 0)).toEqual([3]);
    expect(t.points[3]).toMatchObject({ bounce: true, location: { x: 45, y: 0 } });
    expect(t).toMatchObject({ stopReason: 'distance-exhausted', bounceCount: 1, totalDistance: 145 });
  });

  it('NT-V12: MaxBounces 0 stops at the wall', () => {
    const t = buildTrajectory(wallWorld(55), vec(0, 0), east, settings({ ...sphere10, distancePerLeg: 100, maxBounces: 0 }));
    expect(xs(t.points)).toEqual([0, 20, 40, 45]);
    expect(t.points[3]).toMatchObject({ collision: true, bounce: false });
    expect(t).toMatchObject({ stopReason: 'collision', bounceCount: 0, totalDistance: 45 });
  });

  it('NT-V13: the default never-bounce tag wins', () => {
    const t = buildTrajectory(wallWorld(55, [TAG.bouncyRoom, TAG.slowPickup]), vec(0, 0), east, settings({ ...sphere10, distancePerLeg: 100, maxBounces: 1 }));
    expect(xs(t.points)).toEqual([0, 20, 40, 45]);
    expect(t).toMatchObject({ stopReason: 'collision', bounceCount: 0 });
  });

  it('NT-V14: an untagged wall does not bounce', () => {
    const t = buildTrajectory(wallWorld(55, []), vec(0, 0), east, settings({ ...sphere10, distancePerLeg: 100, maxBounces: 1 }));
    expect(xs(t.points)).toEqual([0, 20, 40, 45]);
    expect(t.stopReason).toBe('collision');
  });

  it('NT-V15: a child tag bounces', () => {
    const t = buildTrajectory(wallWorld(55, [`${TAG.bouncyRoom}.子`]), vec(0, 0), east, settings({ ...sphere10, distancePerLeg: 100, maxBounces: 1 }));
    expect(xs(t.points)).toEqual([0, 20, 40, 45, 43, 23, 3, -17, -37, -55]);
    expect(t).toMatchObject({ stopReason: 'distance-exhausted', bounceCount: 1 });
  });

  it('NT-V16: corridor zigzag', () => {
    const world = createLaunchWorld({ boxes: [wallAboveY('top', 50), wallBelowY('bottom', -50)] });
    const t = buildTrajectory(world, vec(0, 0), diag, settings({ ...sphere10, distancePerLeg: 200, maxBounces: 3 }));
    expect(t.points).toHaveLength(25);
    const hits = t.points.map((p, i) => ({ p, i })).filter(h => h.p.collision);
    expect(hits.map(h => h.i)).toEqual([3, 10, 17, 24]);
    closeAll(hits.flatMap(h => [h.p.location.x, h.p.location.y]), [40, 40, 118, -40, 196, 40, 274, -40], 1e-4);
    closeAll(hits.map(h => h.p.distance), [56.568542, 168.877197, 281.185852, 393.494507], 1e-4);
    expect(hits.map(h => h.p.bounce)).toEqual([true, true, true, false]);
    expect(hits.map(h => h.p.legIndex)).toEqual([0, 1, 2, 3]);
    closeAll([4, 11, 18].flatMap(i => [t.points[i].location.x, t.points[i].location.y]), [40, 38, 118, -38, 196, 38], 1e-4);
    expect(t).toMatchObject({ stopReason: 'collision', bounceCount: 3 });
    expect(t.totalDistance).toBeCloseTo(393.494507, 4);
  });

  it('NT-V17: the separation point is skipped at the point limit', () => {
    const t = buildTrajectory(wallWorld(55), vec(0, 0), east, settings({ ...sphere10, distancePerLeg: 100, maxBounces: 1, maxPoints: 4 }));
    expect(xs(t.points)).toEqual([0, 20, 40, 45]);
    expect(t.points[3].bounce).toBe(true);
    expect(t).toMatchObject({ bounceCount: 1, stopReason: 'point-limit' });
  });

  it('NT-V18: repeated short impacts are stuck', () => {
    const world = createLaunchWorld({ boxes: [wallAboveY('top', 11.3), wallBelowY('bottom', -11.3)] });
    const r = buildPathCore(world, vec(0, 0), diag, settings({ ...sphere10, distancePerLeg: 200, maxBounces: 8 }));
    const t = r.trajectory;
    closeAll(t.points.flatMap(p => [p.location.x, p.location.y]), [0, 0, 1.3, 1.3, 1.3, -0.7, 1.9, -1.3, 1.9, 0.7, 2.5, 1.3, 2.5, -0.7, 3.1, -1.3], 1e-6);
    closeAll(t.points.map(p => p.distance), [0, 1.838478, 3.838478, 4.687006, 6.687006, 7.535534, 9.535534, 10.384062], 1e-6);
    expect(t.points.map((p, i) => (p.collision ? i : -1)).filter(i => i >= 0)).toEqual([1, 3, 5, 7]);
    expect(t.points.map((p, i) => (p.bounce ? i : -1)).filter(i => i >= 0)).toEqual([1, 3, 5, 7]);
    expect(t).toMatchObject({ bounceCount: 3, stopReason: 'stuck' });
    expect(r.debug).toMatch(/^repeated short impacts/);
  });

  it('NT-V19: leg-start recovery out of a box', () => {
    const r = buildPathCore(wallWorld(55), vec(45.7, 0), west, settings({ ...sphere10, distancePerLeg: 50 }));
    closeAll(xs(r.trajectory.points), [45.7, 44.7, 24.7, 4.7, -4.3], 1e-9);
    expect(r.trajectory.points.map(p => p.distance)).toEqual([0, 1, 21, 41, 50]);
    expect(r.trajectory.points.some(p => p.collision)).toBe(false);
    expect(r.recoveries).toBe(1);
    expect(r.trajectory.stopReason).toBe('distance-exhausted');
  });

  it('NT-V20: too deep to recover', () => {
    const r = buildPathCore(wallWorld(55), vec(46.5, 0), west, settings({ ...sphere10, distancePerLeg: 50 }));
    expect(xs(r.trajectory.points)).toEqual([46.5]);
    expect(r.trajectory).toMatchObject({ stopReason: 'stuck', valid: true });
    expect(r.debug).toBe('leg-start recovery=contact-too-deep');
  });

  it('NT-V21: moving into the wall is not outward', () => {
    const r = buildPathCore(wallWorld(55), vec(45.7, 0), east, settings({ ...sphere10, distancePerLeg: 50 }));
    expect(xs(r.trajectory.points)).toEqual([45.7]);
    expect(r.trajectory.stopReason).toBe('stuck');
    expect(r.debug).toBe('leg-start recovery=direction-not-outward');
  });

  it('NT-V22: sliding along a box tries every offset up to MaxExit', () => {
    const r = buildPathCore(wallWorld(55), vec(45.5, 0), vec(0, 1), settings({ ...sphere10, distancePerLeg: 50 }));
    expect(xs(r.trajectory.points)).toEqual([45.5]);
    expect(r.trajectory.stopReason).toBe('stuck');
    expect(r.debug).toBe('leg-start recovery=candidate-still-overlapping offset=15.00');
  });

  it('NT-V23: a mesh needs a more outward direction', () => {
    const r = buildPathCore(wallWorld(55, BOUNCY, 'mesh'), vec(45.5, 0), vec(0, 1), settings({ ...sphere10, distancePerLeg: 50 }));
    expect(xs(r.trajectory.points)).toEqual([45.5]);
    expect(r.debug).toBe('leg-start recovery=direction-not-outward');
  });

  const twoWalls = () => createLaunchWorld({ boxes: [wallAtLeast('wall', 55), wallAtMost('wall2', 35.4)] });

  it('NT-V24: a blocked exit sweep is a partial exit', () => {
    const r = buildPathCore(twoWalls(), vec(45.7, 0), west, settings({ ...sphere10, distancePerLeg: 50, maxBounces: 0 }));
    closeAll(xs(r.trajectory.points), [45.7, 45.4], 1e-9);
    closeAll(r.trajectory.points.map(p => p.distance), [0, 0.3], 1e-6);
    expect(r.trajectory.points[1].hit?.actor.id).toBe('wall2');
    expect(r.recoveries).toBe(1);
    expect(r.trajectory.stopReason).toBe('collision');
  });

  it('NT-V25: a bounce back into the departure wall is a different departure', () => {
    const r = buildPathCore(twoWalls(), vec(45.7, 0), west, settings({ ...sphere10, distancePerLeg: 50, maxBounces: 1 }));
    closeAll(xs(r.trajectory.points), [45.7, 45.4, 47.4], 1e-9);
    closeAll(r.trajectory.points.map(p => p.distance), [0, 0.3, 2.3], 1e-6);
    expect(r.trajectory.points.map(p => p.legIndex)).toEqual([0, 0, 1]);
    expect(r.trajectory).toMatchObject({ bounceCount: 1, stopReason: 'stuck' });
    expect(r.debug).toBe('leg-start recovery=different-departure-component');
  });
});

describe('legacy legs and pickups (§14.3)', () => {
  const vortex = (x: number, y: number) =>
    createLaunchWorld({ pickups: [{ id: '加速点', x, y, radius: 50, gravity: { strength: 1.4, radius: 500 } }] });
  const legIn = (world: ReturnType<typeof createLaunchWorld>, start = vec(0, 0), dist = 300, radius = 10) =>
    buildLeg(world, start, east, dist, radius, { sources: gatherGravitySources(world) });

  it('NT-V26: a legacy main leg stops at the wall, steps of 5', () => {
    const leg = buildLeg(wallWorld(52.5), vec(0, 0), east, 100, 10);
    expect(xs(leg.path.points)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 42.5]);
    expect(leg.path.points[9]).toMatchObject({ collision: true, bounce: false });
    expect(leg.path).toMatchObject({ stopReason: 'collision', totalDistance: 42.5 });
    expect(leg.ok).toBe(true);
  });

  it('NT-V27: a blocked start becomes a stationary collision', () => {
    const leg = buildLeg(wallWorld(55), vec(46.5, 0), west, 50, 10);
    expect(xs(leg.path.points)).toEqual([46.5, 46.5]);
    expect(leg.path.points.map(p => p.distance)).toEqual([0, 0]);
    expect(leg.path.points[1].collision).toBe(true);
    expect(leg.path.points[1].hit?.traceEnd).toEqual({ x: -3.5, y: 0 });
    expect(leg.path).toMatchObject({ stopReason: 'collision', stationaryCollision: true });
    expect(leg.ok).toBe(true);
  });

  it('NT-V28: float step accumulation', () => {
    const leg = buildLeg(EMPTY, vec(0, 0), east, 500, 45.6);
    const pts = leg.path.points;
    expect(pts).toHaveLength(45);
    expect(leg.path).toMatchObject({ stopReason: 'distance-exhausted', totalDistance: 500 });
    expect(pts[44].location.x).toBeCloseTo(500.000166, 4);
    expect(pts[43].distance).toBeCloseTo(490.199829, 4);
  });

  it('NT-V29: a gravity pickup truncates its step and stops pulling', () => {
    const leg = legIn(vortex(202, 0));
    expect(leg.itemHits.map(h => [h.pickup.id, h.distance])).toEqual([['加速点', 144]]);
    expect(leg.path.points[29]).toMatchObject({ location: { x: 142, y: 0 }, distance: 142 });
    expect(leg.path.points).toHaveLength(62);
    expect(leg.path).toMatchObject({ stopReason: 'distance-exhausted', totalDistance: 300 });
  });

  it('NT-V30: the path bends toward the source until it is picked', () => {
    const leg = legIn(vortex(202, 30));
    const pts = leg.path.points;
    expect(leg.itemHits[0].distance).toBeCloseTo(147.144867, 4);
    closeAll([pts[29].location.x, pts[29].location.y, pts[29].distance], [144.188706, 13.411459, 145], 1e-4);
    closeAll([pts[30].location.x, pts[30].location.y, pts[30].distance], [144.33112, 13.437987, 145.144867], 1e-4);
    closeAll([pts[61].location.x, pts[61].location.y], [296.567499, 41.796355], 1e-4);
    expect(pts).toHaveLength(62);
    expect(leg.path.totalDistance).toBeCloseTo(300, 4);
  });

  it('NT-V31: a deceleration pickup is only listed', () => {
    const world = createLaunchWorld({ pickups: [{ id: 'dec', x: 202, y: 0, radius: 50, tags: [TAG.slowPickup] }] });
    const leg = legIn(world);
    expect(leg.itemHits.map(h => [h.pickup.id, h.distance])).toEqual([['dec', 144]]);
    expect(leg.path.points).toHaveLength(61);
    expect(leg.path.stopReason).toBe('distance-exhausted');
  });

  it('NT-V63: item distance = clamp(Time) · Advanced + Total + 2', () => {
    const world = createLaunchWorld({ pickups: [{ id: 'p', x: 270, y: 0, radius: 50 }] });
    const r = buildPathCore(world, vec(0, 0), east, settings({ ...sphere10, distancePerLeg: 300 }), { itemPhase: true });
    expect(r.itemHits.map(h => h.distance)).toEqual([212]);
  });

  it('rejects what Legacy::BuildLeg rejects', () => {
    expect(buildLeg(EMPTY, vec(0, 0), vec(0, 0), 100, 10).ok).toBe(false);
    expect(buildLeg(EMPTY, vec(0, 0), east, 0, 10).ok).toBe(false);
    expect(buildLeg(EMPTY, vec(0, 0), east, 100, 0).ok).toBe(false);
  });
});

describe('gravity steering (§14.4)', () => {
  const source = (x: number, y: number, strength = 1.4, radius = 500, mode: 'attract' | 'repel' = 'attract'): GravitySource => ({
    position: vec(x, y),
    mode,
    strength,
    radius,
    sourceId: 's',
    disableAfterPreviewPickup: false,
  });
  const steer = (sources: GravitySource[], stepLen = 10, maxTurn = 15) => steerByGravity(vec(0, 0), east, stepLen, sources, maxTurn);

  it('NT-V32: attract, 4.22°', () => {
    const d = steer([source(100, 100)]);
    expect(d.x).toBeCloseTo(0.997285609, 8);
    expect(d.y).toBeCloseTo(0.073630254, 8);
    expect((Math.atan2(d.y, d.x) * 180) / Math.PI).toBeCloseTo(4.222524008, 6);
  });

  it('NT-V33: the turn is clamped to 15°', () => {
    const d = steer([source(0, 50, 100)], 20);
    expect(d.x).toBeCloseTo(0.965925826, 8);
    expect(d.y).toBeCloseTo(0.258819045, 8);
  });

  it('NT-V34: repel', () => {
    const d = steer([source(100, 100, 1.4, 500, 'repel')]);
    expect(d.x).toBeCloseTo(0.996269359, 8);
    expect(d.y).toBeCloseTo(-0.086298117, 8);
  });

  it('NT-V35/V36/V37/V38: no turn out of range, straight ahead, symmetric, or with MaxTurn 0', () => {
    expect(steer([source(600, 0)])).toEqual(east);
    expect(steer([source(202, 0)])).toEqual(east);
    expect(steer([source(0, 100), source(0, -100)])).toEqual(east);
    expect(steer([source(0, 50, 100)], 20, 0)).toEqual(east);
  });

  it('NT-V66: gravity points first, then enabled pickup sources', () => {
    const world = createLaunchWorld({
      gravityPoints: [{ id: 'gp0', x: 0, y: 0, strength: 0 }, { id: 'gp1', x: 0, y: 0 }],
      pickups: [
        { id: 'off', x: 0, y: 0, radius: 50, gravity: { strength: 1.4, radius: 500, enabled: false } },
        { id: 'on', x: 0, y: 0, radius: 50, gravity: { strength: 1.4, radius: 500 } },
      ],
    });
    expect(gatherGravitySources(world).map(s => [s.sourceId, s.strength, s.radius, s.disableAfterPreviewPickup])).toEqual([
      ['gp1', 1, 600, false],
      ['on', 1.4, 500, true],
    ]);
  });
});

describe('bounce filter and sampling (§14.6, §14.8)', () => {
  const actor = (tags: string[]): LaunchActor => ({ id: 'a', kind: 'solid', shape: 'box', tags, classes: [] });

  it('NT-V64: ShouldBounceOffActor', () => {
    const cases: [string[], string[], boolean][] = [
      [[TAG.bouncyRoom], [], true],
      [[TAG.hostile], [], true],
      [[TAG.player], [], true],
      [[`${TAG.aiItem}.关卡`], [], true],
      [[TAG.pickup], [], false],
      [[TAG.bouncyRoom, TAG.slowPickup], [], false],
      [[], [], false],
      [['X'], ['X'], true],
      [[TAG.bouncyRoom], ['Y'], false],
    ];
    for (const [tags, bounceTags, want] of cases) expect(shouldBounceOffActor(actor(tags), settings({ bounceTags }))).toBe(want);
  });

  it('NT-V49: SampleTrajectory', () => {
    const point = (x: number, distance: number) => ({ location: vec(x, 0), distance, legIndex: 0, collision: false, bounce: false, hit: null });
    const t: Trajectory = { points: [point(0, 0), point(10, 10), point(10, 10), point(30, 30)], totalDistance: 30, bounceCount: 0, stopReason: 'distance-exhausted', valid: true, stationaryCollision: false };
    expect([20, 10, -5, 100, 5].map(d => sampleTrajectory(t, d)?.location.x)).toEqual([20, 10, 0, 30, 5]);
    for (const d of [20, 10, -5, 100, 5]) expect(sampleTrajectory(t, d)?.direction).toEqual({ x: 1, y: 0 });
    expect(sampleTrajectory({ ...t, valid: false }, 5)).toBeNull();
  });
});

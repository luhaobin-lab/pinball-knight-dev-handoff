import { describe, expect, it } from 'vitest';
import { length, sub, vec } from '../../src/core/launch/math.ts';
import { INVALID_PATH, type Trajectory } from '../../src/core/launch/path.ts';
import {
  aimVector,
  type BounceBudget,
  canBounceOff,
  canGrowLegacyPreviewChain,
  computeLaunchPreview,
  isHostile,
  legacyIncomingVector,
  legacyOutgoingVector,
  resolveLegacyPreviewBounce,
  terminalLength,
} from '../../src/core/launch/preview.ts';
import { LAUNCH_RULES, SOUL_HUNTER, STARTER_HERO } from '../../src/core/launch/settings.ts';
import { createLaunchWorld, DYNAMIC_MESH_CLASS, type LaunchActor, TAG } from '../../src/core/launch/world.ts';
import { boxRoom } from './fixtures.ts';

const path = (points: [number, number][], lastCollision: boolean): Trajectory => ({
  points: points.map(([x, y], i) => ({ location: vec(x, y), distance: i, legIndex: 0, collision: lastCollision && i === points.length - 1, bounce: false, hit: null })),
  totalDistance: points.length - 1,
  bounceCount: 0,
  stopReason: lastCollision ? 'collision' : 'distance-exhausted',
  valid: true,
  stationaryCollision: false,
});

/** ResolveLegacyPreviewBounce on a circle whose native main path is valid. */
const resolve = (o: { collision: boolean; allowed?: boolean; index?: number; max?: number; gravity?: number; previous?: BounceBudget | null }) =>
  resolveLegacyPreviewBounce({
    mainPathValid: true,
    lastPointCollision: o.collision,
    gravityPickups: o.gravity ?? 0,
    wallBounceAllowed: o.allowed ?? false,
    index: o.index ?? 0,
    maxBounces: o.max ?? 4,
    previous: o.previous ?? null,
  });
const budget = (ordinary: number, pending = 0, bounceable = true): BounceBudget => ({ ordinary, pending, resolved: true, bounceable });

describe('bounce bookkeeping (§14.5, LM-TV-11…18, TRAJEC-V05…V10)', () => {
  it('NT-V39/V40: a contact spends one ordinary bounce if allowed', () => {
    expect(resolve({ collision: true, allowed: true, max: 3 })).toMatchObject({ bounceable: true, ordinary: 1, pending: 0, deferred: false });
    expect(resolve({ collision: true, allowed: false, max: 3 })).toMatchObject({ bounceable: false, ordinary: 0 });
  });

  it('NT-V41/V42: an air end spends a gravity credit', () => {
    expect(resolve({ collision: false, gravity: 1, max: 3 })).toMatchObject({ bounceable: true, pending: 0, deferred: true });
    expect(resolve({ collision: false, max: 3 })).toMatchObject({ bounceable: false, deferred: false });
  });

  it('NT-V43, LM-TV-16, TRAJEC-V10: index 62 and -1 never bounce', () => {
    expect(resolve({ collision: true, allowed: true, index: 62, max: 100 }).bounceable).toBe(false);
    expect(resolve({ collision: true, allowed: true, index: -1, max: 100 }).bounceable).toBe(false);
    expect(resolve({ collision: true, allowed: true, index: 61, max: 100 }).bounceable).toBe(true);
  });

  it('NT-V44: counters pass down while every circle bounced', () => {
    const b = resolve({ collision: true, allowed: true, index: 1, max: 3, previous: budget(2) });
    expect(b).toMatchObject({ bounceable: true, ordinary: 3 });
    expect(resolve({ collision: true, allowed: true, index: 2, max: 3, previous: b })).toMatchObject({ bounceable: false, ordinary: 3 });
    expect(resolve({ collision: true, allowed: true, index: 2, max: 3, previous: { ...b, bounceable: false } })).toMatchObject({ bounceable: false, ordinary: 0 });
  });

  it('NT-V45, LM-TV-18, TRAJEC-V06: the legacy fallback without a main path', () => {
    const fallback = (allowed: boolean, index: number, maxBounces: number) =>
      resolveLegacyPreviewBounce({ mainPathValid: false, lastPointCollision: false, gravityPickups: 0, wallBounceAllowed: allowed, index, maxBounces, previous: null }).bounceable;
    expect([fallback(true, 2, 3), fallback(true, 3, 3), fallback(false, 0, 3), fallback(true, -1, 3)]).toEqual([true, false, false, false]);
    expect([fallback(true, 3, 4), fallback(true, 4, 4), fallback(true, 0, 0), fallback(true, 0, Number.NaN)]).toEqual([true, false, false, false]);
  });

  it('LM-TV-11/12/15: the limit is a double compared with <', () => {
    expect(resolve({ collision: true, allowed: true, index: 3, max: 4, previous: budget(3) })).toMatchObject({ bounceable: true, ordinary: 4 });
    expect(resolve({ collision: true, allowed: true, index: 4, max: 4, previous: budget(4) })).toMatchObject({ bounceable: false, ordinary: 4 });
    expect(resolve({ collision: true, allowed: true, index: 4, max: 4.5, previous: budget(4) })).toMatchObject({ bounceable: true, ordinary: 5 });
  });

  it('LM-TV-13/14: credits survive contacts and pay for an air end', () => {
    expect(resolve({ collision: true, allowed: false, index: 1, previous: budget(0, 2) })).toMatchObject({ bounceable: false, pending: 2, deferred: false });
    expect(resolve({ collision: false, gravity: 1, index: 2, previous: budget(2) })).toMatchObject({ bounceable: true, pending: 0, deferred: true, ordinary: 2 });
  });

  it('TRAJEC-V07/V09: the ss2 chain and a credit carried over a contact', () => {
    const chain = (legs: { collision: boolean; allowed: boolean; gravity: number }[]) => {
      const out: ReturnType<typeof resolve>[] = [];
      legs.forEach((l, index) => out.push(resolve({ ...l, index, previous: index > 0 ? out[index - 1] : null })));
      return out;
    };
    const ss2 = chain([
      { collision: true, allowed: true, gravity: 0 },
      { collision: true, allowed: true, gravity: 0 },
      { collision: false, allowed: false, gravity: 1 },
      { collision: true, allowed: true, gravity: 0 },
      { collision: false, allowed: false, gravity: 0 },
    ]);
    expect(ss2.map(r => r.bounceable)).toEqual([true, true, true, true, false]);
    expect(ss2.map(r => r.ordinary)).toEqual([1, 2, 2, 3, 3]);
    expect(ss2.map(r => r.deferred)).toEqual([false, false, true, false, false]);
    const v09 = chain([
      { collision: true, allowed: true, gravity: 1 },
      { collision: false, allowed: false, gravity: 0 },
      { collision: false, allowed: false, gravity: 0 },
    ]);
    expect(v09.map(r => [r.bounceable, r.pending, r.ordinary, r.deferred])).toEqual([[true, 1, 1, false], [true, 0, 1, true], [false, 0, 1, false]]);
  });

  it('LM-TV-09, TRAJEC-V04: 剩余长度', () => {
    expect([terminalLength(false, 300), terminalLength(false, 50), terminalLength(true, 420), terminalLength(true, 432)]).toEqual([96, 50, 420, 432]);
  });

  it('NT-V46, TRAJEC-V05: CanGrowLegacyPreviewChain', () => {
    expect([
      canGrowLegacyPreviewChain(0, true, null),
      canGrowLegacyPreviewChain(1, false, null),
      canGrowLegacyPreviewChain(63, false, null),
      canGrowLegacyPreviewChain(64, true, true),
      canGrowLegacyPreviewChain(5, false, false),
      canGrowLegacyPreviewChain(5, false, true),
      canGrowLegacyPreviewChain(63, true, false),
    ]).toEqual([false, true, true, false, false, true, true]);
  });

  it('NT-V47, TRAJEC-V29: incoming and outgoing vectors', () => {
    const legacy = vec(0, 1);
    expect(legacyIncomingVector(path([[0, 0], [5, 0], [10, 0]], false))).toEqual({ x: -5, y: 0 });
    expect(legacyOutgoingVector(path([[0, 0], [5, 0], [10, 0]], false), false, vec(0, 0), vec(10, 0), legacy)).toEqual({ x: 1, y: 0 });
    expect(legacyOutgoingVector(path([[0, 0], [10, 0], [10, 0]], false), false, vec(0, 0), vec(10, 0), legacy)).toEqual({ x: 1, y: 0 });
    expect(legacyOutgoingVector(path([[0, 0], [10, 0]], true), false, vec(0, 0), vec(10, 0), legacy)).toBe(legacy);
    expect(legacyOutgoingVector(path([[0, 0], [6, 8]], false), false, vec(0, 0), vec(6, 8), vec(1, 0))).toEqual({ x: 0.6000000000000001, y: 0.8 });
    expect(legacyIncomingVector(INVALID_PATH)).toEqual({ x: 0, y: 0 });
  });

  it('without a path, a gravity pickup bends the outgoing vector to start → end', () => {
    expect(legacyOutgoingVector(INVALID_PATH, true, vec(0, 0), vec(0, 5), vec(1, 0))).toEqual({ x: 0, y: 1 });
    expect(legacyOutgoingVector(INVALID_PATH, false, vec(0, 0), vec(0, 5), vec(1, 0))).toEqual({ x: 1, y: 0 });
  });
});

describe('targets (LM-TV-20, TRAJEC-V15)', () => {
  const actor = (tags: string[], classes: string[] = [], kind: LaunchActor['kind'] = 'solid'): LaunchActor => ({ id: 'a', kind, shape: 'box', tags, classes });

  it('判断目标可反弹', () => {
    expect([
      canBounceOff(actor([], [DYNAMIC_MESH_CLASS])),
      canBounceOff(actor([TAG.bouncyRoom, TAG.roomWall])),
      canBounceOff(actor([`${TAG.hostile}.首领`], [], 'body')),
      canBounceOff(actor([TAG.environment])),
      canBounceOff(actor([`${TAG.aiItem}.关卡`])),
      canBounceOff(actor([`${TAG.player}.灵魂猎手`], [], 'body')),
      canBounceOff(null),
    ]).toEqual([true, true, true, false, true, true, false]);
  });

  it('only 可交互.角色.AI.仇恨 (or a child) is hostile', () => {
    expect([isHostile(actor([`${TAG.hostile}.噩梦`])), isHostile(actor([TAG.bouncyRoom])), isHostile(null)]).toEqual([true, false, false]);
  });
});

/** A 30 × 8 tile corridor; aimed 60° down-right from (3, 4.5) every main leg ends on a wall (468.3 uu apart). */
const NARROW = createLaunchWorld({ grid: boxRoom(30, 8) });
const NARROW_HERO = vec(192, 288);
const NARROW_AIM = vec(0.5, Math.sqrt(3) / 2);

describe('the preview chain', () => {
  it('LM-TV-05 shape: the knight shows circles 0..3; circle 4 sets the terminal length', () => {
    const p = computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM);
    expect(p.legs.map(c => c.index)).toEqual([0, 1, 2, 3]);
    expect(p.legs.map(c => c.marker)).toEqual(['wall', 'wall', 'wall', 'wall']);
    expect(p.legs.map(c => c.ordinaryBounces)).toEqual([1, 2, 3, 4]);
    expect(p.bounceCount).toBe(3);
    expect(p.next).toMatchObject({ index: 4, marker: 'wall', bounceable: false, displayed: false });
    expect(p.finalLaunchValue).toBe(p.next!.length);
    expect(p.terminal!.start).toBe(p.legs[3].end);
    expect(p.terminal!.direction).toEqual(p.legs[3].bounceDirection);
    expect(p.terminal!.maxLength).toBeCloseTo(468.296, 3);
    // the terminal starts at the end itself (circle 4 starts 0.05 uu further) and its probe is the full 宽度 56,
    // so it stops 2.8 uu (perpendicular) before circle 4's 53.2-uu probe
    expect(p.terminal!.path.stopReason).toBe('collision');
    expect(p.terminal!.path.totalDistance).toBeCloseTo(p.next!.length + LAUNCH_RULES.startOffset - 2.8 / Math.sin(Math.PI / 3), 3);
    expect(p.collisionPoints).toEqual(p.legs.map(c => c.end));
  });

  it('each leg starts 0.05 uu along its direction from the previous end and runs 弹射距离', () => {
    const p = computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM);
    expect(p.legs[0].start).toBe(NARROW_HERO);
    p.legs.forEach((c, i) => {
      if (i > 0) {
        expect(c.start).toBe(p.legs[i - 1].end);
        expect(c.direction).toBe(p.legs[i - 1].bounceDirection);
      }
      const first = c.path.points[0].location;
      expect(length(sub(first, c.start))).toBeCloseTo(LAUNCH_RULES.startOffset, 9);
      expect(c.line[0]).toBe(first);
      expect(c.line[c.line.length - 1]).toBe(c.end);
      expect(c.length).toBe(c.path.totalDistance);
      expect(c.path.stopReason).toBe('collision');
    });
    expect(p.legs[0].length).toBeCloseTo((522.8 - 288 - 0.05 * Math.sin(Math.PI / 3)) / Math.sin(Math.PI / 3), 3);
  });

  it('LM-TV-06: the hunter shows circles 0..4', () => {
    const p = computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM, { hero: SOUL_HUNTER });
    expect(p.legs.map(c => c.index)).toEqual([0, 1, 2, 3, 4]);
    expect(p.next?.index).toBe(5);
  });

  it('TRAJEC-V08: MaxBounces 2 shows circles 0..1', () => {
    const p = computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM, { hero: { ...STARTER_HERO, maxBounces: 2 } });
    expect(p.legs.map(c => c.index)).toEqual([0, 1]);
    expect(p.terminal!.start).toBe(p.legs[1].end);
    expect(p.finalLaunchValue).toBe(p.next!.length);
  });

  it('LM-TV-19, TRAJEC-V19: MaxBounces 0 shows circle 0 and caps the terminal at 96 in the reflected direction', () => {
    const p = computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM, { hero: { ...STARTER_HERO, maxBounces: 0 } });
    expect(p.legs).toHaveLength(1);
    expect(p.bounceCount).toBe(0);
    expect(p.legs[0]).toMatchObject({ marker: 'wall', bounceable: false, displayed: true, ordinaryBounces: 0 });
    expect(p.next!.length).toBeGreaterThan(96);
    expect(p.finalLaunchValue).toBe(96);
    expect(p.terminal!.direction.y).toBeLessThan(0);
    expect(p.terminal!.path.totalDistance).toBe(96);
  });

  it('E-4: circle 0 in the air shows a dot and slides at most 96 straight on', () => {
    const world = createLaunchWorld({ grid: boxRoom(40, 40) });
    const p = computeLaunchPreview(world, vec(1280, 1280), vec(1, 0));
    expect(p.legs).toHaveLength(1);
    expect(p.legs[0]).toMatchObject({ marker: 'none', hit: null, bounceable: false });
    expect(p.legs[0].length).toBe(500);
    expect(p.terminal!.direction.x).toBeCloseTo(1, 12);
    expect(p.terminal!.path.totalDistance).toBe(96);
  });

  it('marks enemy contacts with the dashed ring', () => {
    const p0 = computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM);
    const c0 = p0.legs[0];
    const at = vec(c0.end.x + c0.bounceDirection.x * 200, c0.end.y + c0.bounceDirection.y * 200);
    const world = createLaunchWorld({ grid: boxRoom(30, 8), bodies: [{ id: 'eye', ...at, radius: 40 }] });
    const p = computeLaunchPreview(world, NARROW_HERO, NARROW_AIM);
    expect(p.legs.map(c => c.marker)).toEqual(['wall', 'enemy', 'wall', 'wall']);
    expect(p.legs[1].hit?.actor).toMatchObject({ id: 'eye', kind: 'body' });
    // a body capsule 40 tall at a probe 56 high: planar contact at √(93.2² − 16²) = 91.82
    expect(length(sub(p.legs[1].end, at))).toBeCloseTo(Math.sqrt(93.2 ** 2 - 16 ** 2), 3);
  });

  it('E-04: a decoration that does not bounce ends the chain; the terminal runs into it', () => {
    const p0 = computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM);
    const c0 = p0.legs[0];
    const at = vec(c0.end.x + c0.bounceDirection.x * 200, c0.end.y + c0.bounceDirection.y * 200);
    const world = createLaunchWorld({ grid: boxRoom(30, 8), circles: [{ id: 'array', ...at, radius: 40, tags: [TAG.environment] }] });
    const p = computeLaunchPreview(world, NARROW_HERO, NARROW_AIM);
    expect(p.legs).toHaveLength(1);
    expect(p.next).toMatchObject({ marker: 'wall', bounceable: false });
    expect(p.next!.hit?.actor.id).toBe('array');
    expect(p.finalLaunchValue).toBe(p.next!.length);
    expect(p.terminal!.path.points[p.terminal!.path.points.length - 1].hit?.actor.id).toBe('array');
  });

  it('a 回弹漩涡 on the leg grants a free bounce at the air end', () => {
    const world = createLaunchWorld({ grid: boxRoom(14, 10), pickups: [{ id: 'vortex', x: 400, y: 384, radius: 50, gravity: { strength: 1.4, radius: 500 } }] });
    const p = computeLaunchPreview(world, vec(160, 384), vec(1, 0));
    expect(p.legs.map(c => [c.marker, c.bounceable, c.deferredGravityBounce, c.ordinaryBounces, c.pickups])).toEqual([
      ['none', true, true, 0, ['vortex']],
      ['wall', true, false, 1, []],
    ]);
    expect(p.legs[1].direction.x).toBeCloseTo(1, 12);
    expect(p.next).toMatchObject({ marker: 'none', bounceable: false });
  });

  it('a start deep inside a wall is a stationary collision that still bounces', () => {
    const world = createLaunchWorld({ grid: boxRoom(20, 20) });
    const p = computeLaunchPreview(world, vec(94, 640), vec(1, 0));
    const c0 = p.legs[0];
    expect(c0.path).toMatchObject({ stationaryCollision: true, stopReason: 'collision', totalDistance: 0 });
    expect(c0).toMatchObject({ marker: 'wall', length: 0, line: [], bounceable: true });
    // a zero incoming vector reads as the Demo's +X: out = 2·a_n = 180°, screen down
    expect(c0.bounceDirection.x).toBeCloseTo(0, 12);
    expect(c0.bounceDirection.y).toBeCloseTo(1, 12);
  });

  it('falls back to plain traces when the native leg fails (point limit)', () => {
    const p = computeLaunchPreview(createLaunchWorld({}), vec(0, 0), vec(1, 0), { hero: { ...STARTER_HERO, launchDistance: 60000 } });
    const c0 = p.legs[0];
    expect(c0.path.valid).toBe(false);
    expect(c0).toMatchObject({ marker: 'none', bounceable: false, length: 60000 });
    expect(c0.line).toEqual([c0.start, c0.end]);
    expect(c0.end.x).toBeCloseTo(60000.05, 6);
  });

  it('LAUNCH-022: no circle past 序号 61 bounces, whatever the Bounce Limit', () => {
    const p = computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM, { hero: { ...STARTER_HERO, maxBounces: 100 } });
    expect(p.legs).toHaveLength(62);
    expect(p.legs.every(c => c.marker === 'wall' && c.bounceable)).toBe(true);
    expect(p.next).toMatchObject({ index: 62, bounceable: false });
    expect(p.legs[61].ordinaryBounces).toBe(62);
  });

  it('ignores the actors it is told to (the hero, when it is part of the world)', () => {
    const world = createLaunchWorld({ grid: boxRoom(30, 8), bodies: [{ id: 'hero', ...NARROW_HERO, radius: 56 }] });
    const blocked = computeLaunchPreview(world, NARROW_HERO, NARROW_AIM);
    expect(blocked.legs[0].path.stationaryCollision).toBe(true);
    expect(blocked.legs[0].hit?.actor.id).toBe('hero');
    const clear = computeLaunchPreview(world, NARROW_HERO, NARROW_AIM, { ignore: ['hero'] });
    expect(clear).toEqual(computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM));
  });

  it('aimVector snaps the cursor to the 4-uu grid', () => {
    expect(aimVector(vec(100, 100), vec(205.9, 97.9))).toEqual({ x: 104, y: -4 });
  });

  it('TRAJEC-V12: pulse offsets accumulate the displayed main lengths', () => {
    const p = computeLaunchPreview(NARROW, NARROW_HERO, NARROW_AIM);
    const lengths = p.legs.map(c => c.path.totalDistance);
    let offset = 0;
    p.pulse.mainSegments.forEach((s, i) => {
      expect(s.start).toBeCloseTo(offset, 9);
      expect(s.length).toBe(lengths[i]);
      offset += lengths[i];
      expect(p.pulse.markerDistances[i]).toBeCloseTo(offset, 9);
    });
    expect(p.pulse.terminalSegment).toEqual({ start: offset, length: p.terminal!.path.totalDistance });
    expect(p.pulse.totalLength).toBeCloseTo(offset + p.terminal!.path.totalDistance, 9);
  });
});

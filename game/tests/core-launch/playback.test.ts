import { describe, expect, it } from 'vitest';
import { CURVE_MAIN_LEG, CURVE_TERMINAL_LEG, type RichKey } from '../../src/core/launch/curves.ts';
import { length, sub, vec } from '../../src/core/launch/math.ts';
import { buildTrajectory } from '../../src/core/launch/path.ts';
import {
  contactAttack,
  type LaunchContact,
  type LaunchPlayback,
  legDuration,
  mainLegSpeed,
  movementRange,
  planLaunch,
  samplePlayback,
  terminalLegSpeed,
} from '../../src/core/launch/playback.ts';
import { computeLaunchPreview } from '../../src/core/launch/preview.ts';
import { SOUL_HUNTER, STARTER_HERO } from '../../src/core/launch/settings.ts';
import { createLaunchWorld } from '../../src/core/launch/world.ts';
import { boxRoom, settings } from './fixtures.ts';

const NARROW_HERO = vec(192, 288);
const NARROW_AIM = vec(0.5, Math.sqrt(3) / 2);
/** The 30 × 8 corridor with an enemy in the way of leg 1 (preview.test.ts): wall, enemy, wall, wall, wall… */
function enemyCorridor() {
  const bare = computeLaunchPreview(createLaunchWorld({ grid: boxRoom(30, 8) }), NARROW_HERO, NARROW_AIM);
  const c0 = bare.legs[0];
  const at = vec(c0.end.x + c0.bounceDirection.x * 200, c0.end.y + c0.bounceDirection.y * 200);
  return createLaunchWorld({ grid: boxRoom(30, 8), bodies: [{ id: 'eye', ...at, radius: 40 }] });
}

/** A straight 1000-uu path played as a single leg with the given curve and speed (NT-V52/V53). */
function straightLeg(curve: readonly RichKey[], speed: number): LaunchPlayback {
  const path = buildTrajectory(createLaunchWorld({}), vec(0, 0), vec(1, 0), settings({ distancePerLeg: 1000, stepDistance: 20 }));
  const duration = legDuration(path.totalDistance, speed);
  const leg = { index: 0, terminal: false, path, curve, fatigue: 0, speed, start: 0, duration, end: duration, contact: null };
  return { origin: vec(0, 0), legs: [leg], contacts: [], duration, end: vec(1000, 0), fatigue: 1, complete: true, movementRange: 0 };
}

describe('speeds and durations', () => {
  it('LM-TV-01…04, NT-V55: main legs min(2000 + 300·疲劳, 6000), terminal 0.3 × the last', () => {
    expect([0, 3, 13, 14, 20].map(mainLegSpeed)).toEqual([2000, 2900, 5900, 6000, 6000]);
    expect(terminalLegSpeed(2900)).toBe(870);
    expect(terminalLegSpeed(3200)).toBe(960);
    expect(terminalLegSpeed(3000)).toBe(900);
  });

  it('LM-TV-10, NT-V56, TRAJEC-V20: max(L / v, 0.01) in float', () => {
    expect(legDuration(1000, 2000)).toBe(0.5);
    expect(legDuration(500, 2000)).toBe(0.25);
    expect(legDuration(500, 870)).toBeCloseTo(0.574713, 6);
    expect(legDuration(500, 3500)).toBeCloseTo(0.142857, 6);
    expect(legDuration(5, 2000)).toBeCloseTo(0.01, 9);
    expect(legDuration(0.002, 6000)).toBeCloseTo(0.01, 9);
  });

  it('NT-V52: 可控反弹曲线 progress over a 0.5 s leg', () => {
    const p = straightLeg(CURVE_MAIN_LEG, 2000);
    const got = [0.125, 0.25, 0.375, 0.5].map(t => samplePlayback(p, t).position.x);
    [340.47406, 643.028992, 883.935242, 1000].forEach((want, i) => expect(Math.abs(got[i] - want)).toBeLessThan(1e-4));
  });

  it('NT-V53: 可控终末确定曲线 progress at 600 uu/s', () => {
    const p = straightLeg(CURVE_TERMINAL_LEG, 600);
    expect(p.legs[0].duration).toBeCloseTo(1.6666666, 6);
    const got = [0.5, 1, 1.5, 2].map(t => samplePlayback(p, t).position.x);
    [580.489807, 877.951843, 993.314636, 1000].forEach((want, i) => expect(Math.abs(got[i] - want)).toBeLessThan(1e-4));
  });

  it('velocity is the curve slope × Total / Duration along the path', () => {
    const p = straightLeg(CURVE_MAIN_LEG, 2000);
    const s0 = samplePlayback(p, 0);
    expect(s0.velocity.x).toBeCloseTo((1.4182245 * 1000) / 0.5, 2);
    expect(s0.velocity.y).toBe(0);
    for (const t of [0.05, 0.2, 0.35]) {
      const h = 1e-4;
      const fd = (samplePlayback(p, t + h).position.x - samplePlayback(p, t - h).position.x) / (2 * h);
      expect(samplePlayback(p, t).velocity.x).toBeCloseTo(fd, -1);
    }
    expect(samplePlayback(p, 0.4999).velocity).toEqual({ x: 0, y: 0 });
  });
});

describe('the launch a preview plays', () => {
  it('LM-TV-05: the knight bounces wall, enemy, wall, wall at 2000/2300/2600/2900, glides at 870', () => {
    const preview = computeLaunchPreview(enemyCorridor(), NARROW_HERO, NARROW_AIM);
    const p = planLaunch(preview);
    expect(p.complete).toBe(true);
    expect(p.legs.map(l => [l.terminal, l.speed, l.fatigue])).toEqual([
      [false, 2000, 0],
      [false, 2300, 1],
      [false, 2600, 2],
      [false, 2900, 3],
      [true, 870, 4],
    ]);
    expect(p.legs.map(l => l.curve)).toEqual([CURVE_MAIN_LEG, CURVE_MAIN_LEG, CURVE_MAIN_LEG, CURVE_MAIN_LEG, CURVE_TERMINAL_LEG]);
    expect(p.fatigue).toBe(4);
    expect(p.contacts.map(c => [c.leg, c.kind, c.bounce, c.reacts, c.speed])).toEqual([
      [0, 'wall', 'ordinary', true, 2000],
      [1, 'enemy', 'ordinary', true, 2300],
      [2, 'wall', 'ordinary', true, 2600],
      [3, 'wall', 'ordinary', true, 2900],
    ]);
    expect(p.legs[4].path).toBe(preview.terminal!.path);
    expect(p.end).toEqual(preview.terminal!.end);
    // legs run back to back
    p.legs.forEach((l, i) => {
      expect(l.path).toBe(i < 4 ? preview.legs[i].path : preview.terminal!.path);
      expect(l.start).toBe(i === 0 ? 0 : p.legs[i - 1].end);
      expect(l.duration).toBe(legDuration(l.path.totalDistance, l.speed));
      if (l.contact) expect(l.contact.time).toBe(l.end);
    });
    expect(p.duration).toBe(p.legs[4].end);
  });

  it('LM-TV-06: the hunter plays five main legs, 2000…3200, glides at 960', () => {
    const p = planLaunch(computeLaunchPreview(createLaunchWorld({ grid: boxRoom(30, 8) }), NARROW_HERO, NARROW_AIM, { hero: SOUL_HUNTER }));
    expect(p.legs.map(l => l.speed)).toEqual([2000, 2300, 2600, 2900, 3200, 960]);
    expect(p.contacts).toHaveLength(5);
  });

  it('LM-TV-17, NT-V58: a gravity bounce does not tire the hero', () => {
    const world = createLaunchWorld({ grid: boxRoom(14, 10), pickups: [{ id: 'vortex', x: 400, y: 384, radius: 50, gravity: { strength: 1.4, radius: 500 } }] });
    const p = planLaunch(computeLaunchPreview(world, vec(160, 384), vec(1, 0)));
    expect(p.legs.map(l => [l.speed, l.fatigue])).toEqual([[2000, 0], [2000, 0], [600, 1]]);
    expect(p.contacts.map(c => [c.kind, c.bounce, c.hit?.actor.id ?? null])).toEqual([['gravity', 'gravity', null], ['wall', 'ordinary', 'walls']]);
    expect(p.fatigue).toBe(1);
  });

  it('LM-TV-19: with MaxBounces 0 the contact is processed but not counted', () => {
    const p = planLaunch(computeLaunchPreview(createLaunchWorld({ grid: boxRoom(30, 8) }), NARROW_HERO, NARROW_AIM, { hero: { ...STARTER_HERO, maxBounces: 0 } }));
    expect(p.legs.map(l => [l.terminal, l.speed])).toEqual([[false, 2000], [true, 600]]);
    expect(p.contacts.map(c => [c.kind, c.bounce])).toEqual([['wall', 'none']]);
    expect(p.legs[1].path.totalDistance).toBe(96);
  });

  it('E-4: an air end makes no contact', () => {
    const p = planLaunch(computeLaunchPreview(createLaunchWorld({ grid: boxRoom(40, 40) }), vec(1280, 1280), vec(1, 0)));
    expect(p.contacts).toEqual([]);
    expect(p.legs.map(l => l.speed)).toEqual([2000, 600]);
  });

  it('a stationary main leg holds still for 0.01 s, then contacts', () => {
    const preview = computeLaunchPreview(createLaunchWorld({ grid: boxRoom(20, 20) }), vec(94, 640), vec(1, 0));
    const p = planLaunch(preview);
    const leg0 = p.legs[0];
    expect(leg0.duration).toBeCloseTo(0.01, 9);
    const start = preview.legs[0].path.points[0].location;
    for (const t of [0, 0.005, 0.0099]) expect(samplePlayback(p, t)).toEqual({ position: start, velocity: { x: 0, y: 0 }, leg: 0 });
    expect(p.contacts[0]).toMatchObject({ leg: 0, kind: 'wall', bounce: 'ordinary', time: leg0.end });
  });

  it('stops before a displayed circle that has no playable path', () => {
    const preview = computeLaunchPreview(createLaunchWorld({}), vec(0, 0), vec(1, 0), { hero: { ...STARTER_HERO, launchDistance: 60000 } });
    const p = planLaunch(preview);
    expect(p).toMatchObject({ complete: false, legs: [], contacts: [], duration: 0, end: vec(0, 0) });
    expect(samplePlayback(p, 1).position).toEqual({ x: 0, y: 0 });
  });

  it('samples rest before and after the launch', () => {
    const p = planLaunch(computeLaunchPreview(enemyCorridor(), NARROW_HERO, NARROW_AIM));
    expect(samplePlayback(p, -0.1)).toEqual({ position: NARROW_HERO, velocity: { x: 0, y: 0 }, leg: -1 });
    expect(samplePlayback(p, Number.NaN).leg).toBe(-1);
    expect(samplePlayback(p, p.duration)).toEqual({ position: p.end, velocity: { x: 0, y: 0 }, leg: p.legs.length });
    expect(samplePlayback(p, 99).position).toBe(p.end);
    // the first sample sits on the first point, the 0.05-uu start offset away from the hero
    expect(length(sub(samplePlayback(p, 0).position, NARROW_HERO))).toBeCloseTo(0.05, 4);
  });
});

describe('contact consequences', () => {
  const contacts = (heroStats = STARTER_HERO): readonly LaunchContact[] =>
    planLaunch(computeLaunchPreview(enemyCorridor(), NARROW_HERO, NARROW_AIM, { hero: heroStats })).contacts;

  it('LM-TV-21/22: the knight attacks hostile bodies only', () => {
    expect(contacts().map(c => contactAttack(c, STARTER_HERO))).toEqual([null, 'melee', null, null]);
  });

  it('LM-TV-23/24: the hunter fires on walls and not on enemies', () => {
    const hunter = contacts(SOUL_HUNTER);
    expect(hunter[1].kind).toBe('enemy');
    expect(hunter.map(c => contactAttack(c, SOUL_HUNTER))).toEqual(['ranged', null, 'ranged', 'ranged', 'ranged']);
  });

  it('a gravity bounce never attacks', () => {
    const gravity: LaunchContact = { index: 0, leg: 0, time: 0.25, position: vec(0, 0), kind: 'gravity', hit: null, bounce: 'gravity', reacts: true, speed: 2000 };
    expect(contactAttack(gravity, STARTER_HERO)).toBeNull();
    expect(contactAttack(gravity, SOUL_HUNTER)).toBeNull();
  });

  it('LM-TV-43/44: 乱舞 spread score', () => {
    expect(movementRange([vec(0, 0), vec(300, 0), vec(300, 400)])).toBe(75);
    expect(movementRange([vec(0, 0), vec(100, 0)])).toBe(11);
    expect(movementRange([vec(5, 5)])).toBe(0);
    expect(movementRange([])).toBe(0);
  });

  it('the launch scores the preview\'s collision points', () => {
    const preview = computeLaunchPreview(enemyCorridor(), NARROW_HERO, NARROW_AIM);
    expect(planLaunch(preview).movementRange).toBe(movementRange(preview.collisionPoints));
  });
});

import { describe, expect, it } from 'vitest';
import { computeLaunchPreview, planLaunch, STARTER_HERO, tilePointToUu, type Vec2 } from '../../src/core/launch/index.ts';
import { 数据表_敌人_普通 } from '../../src/content/demo/index.ts';
import { aimOf, aimScore, bestAim, sweepAngle } from '../../src/game/auto-aim';
import { PREVIEW_MARKS, stations } from '../../src/game/launch-preview';
import { clientToInternal, internalToFloor } from '../../src/game/pointer';
import { HERO_START, ROOM_ENEMIES, roomBodies, roomSolids, roomWorld } from '../../src/game/reference-room';
import { demoBody, STAND_IN } from '../../src/game/roster';
import { northstarSpec } from '../../src/procgen/architecture/northstar';

const spec = northstarSpec('ns-1');
const world = roomWorld(spec.layout, roomSolids(spec), roomBodies());
const hero = tilePointToUu(HERO_START.x, HERO_START.z);
const hp = new Map(ROOM_ENEMIES.map((e, i) => [`enemy-${i}`, e.hp]));

describe('reference room for the launch', () => {
  it('collides with each small fry at the 宽度 of the Demo row it stands in for (SPEC-GAP until G3)', () => {
    for (const [kind, row] of Object.entries(STAND_IN)) {
      const a = 数据表_敌人_普通.rows[row].属性;
      expect(demoBody(kind as keyof typeof STAND_IN)).toEqual({ width: a.宽度, height: a.高度 });
    }
    expect(roomBodies().map(b => b.body.width)).toEqual([54, 54, 40, 55, 44, 44]);
  });

  it('turns the pillars, urns and candle mound into bouncy circles', () => {
    const solids = roomSolids(spec);
    expect(solids).toHaveLength(6);
    expect(solids[0]).toEqual({ id: 'solid-0', x: 7.93 * 64, y: 3.73 * 64, radius: 0.6 * 64 });
  });
});

describe('scripted shot', () => {
  const deg = bestAim(world, hero, hp);
  const preview = computeLaunchPreview(world, hero, aimOf(deg), { hero: STARTER_HERO });

  it('is a whole degree into the upper room', () => {
    expect(Number.isInteger(deg)).toBe(true);
    expect(aimOf(deg).y).toBeLessThanOrEqual(-0.35);
  });

  it('hits enemies with every bounce the knight has, and the launch replays its contacts', () => {
    expect(preview.legs).toHaveLength(STARTER_HERO.maxBounces);
    expect(preview.legs.filter(l => l.marker === 'enemy').length).toBeGreaterThanOrEqual(2);
    const launch = planLaunch(preview);
    expect(launch.complete).toBe(true);
    expect(launch.contacts.map(c => c.leg)).toEqual(preview.legs.map(l => l.index));
    expect(launch.end).toEqual(preview.terminal!.end);
  });

  it('scores no worse than any other whole degree', () => {
    const best = aimScore(preview, hp, 0);
    for (let d = 0; d < 360; d += 7) {
      if (aimOf(d).y > -0.35) continue;
      expect(aimScore(computeLaunchPreview(world, hero, aimOf(d), { hero: STARTER_HERO }), hp, 0)).toBeLessThanOrEqual(best);
    }
  });

  it('keeps its chain a little off its line (the whole-degree snap)', () => {
    const near = computeLaunchPreview(world, hero, aimOf(deg + 0.4), { hero: STARTER_HERO });
    expect(near.legs.map(l => l.end)).toEqual(preview.legs.map(l => l.end));
  });

  it('prefers, at equal kills, a chain whose bounce points stand two ring radii apart', () => {
    // 205 and 222 both kill once; 205's bounce points are 131+ uu apart, two of 222's are 2 uu apart
    const spread = computeLaunchPreview(world, hero, aimOf(205), { hero: STARTER_HERO });
    const crowded = computeLaunchPreview(world, hero, aimOf(222), { hero: STARTER_HERO });
    expect(aimScore(spread, hp, 0)).toBeGreaterThan(aimScore(crowded, hp, 0));
  });
});

describe('scripted cursor', () => {
  it('swings ±10° about its line, eased, then holds it', () => {
    expect([0, 0.4, 0.8, 1.2, 1.4].map(t => sweepAngle(200, t, 0.8))).toEqual([190, 210, 200, 200, 200]);
    // each half is a smoothstep: half-way through the first half it is at the line
    expect(sweepAngle(200, 0.2, 0.8)).toBeCloseTo(200, 9);
  });
});

describe('preview chevrons', () => {
  const line: Vec2[] = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 50 },
  ];

  it('sit every 30 uu along a leg from half a pitch in, across polyline corners', () => {
    expect(stations(line, PREVIEW_MARKS.chevronPitch)).toEqual([
      { x: 15, y: 0, dx: 1, dy: 0, at: 15 },
      { x: 40, y: 5, dx: 0, dy: 1, at: 45 },
      { x: 40, y: 35, dx: 0, dy: 1, at: 75 },
    ]);
  });

  it('scroll forward with the texture (位移速度 −2: two tiles a second) and wrap at the pitch', () => {
    const at = (offset: number): number[] => stations(line, 30, offset).map(st => st.at);
    expect(at(10)).toEqual([25, 55, 85]);
    expect(at(20)).toEqual([5, 35, 65]);
    expect(at(30)).toEqual(at(0));
  });

  it('use the Demo’s preview sizes (trajectory-preview §3.6, §8)', () => {
    expect(PREVIEW_MARKS).toMatchObject({ chevronPitch: 30, chevronWidth: 24, ringRadius: 60, enemyDot: 36, dot: 30, ringDashes: 16, scroll: 2 });
  });
});

describe('pointer', () => {
  const internal = { width: 960, height: 540, scale: 2, outputWidth: 1920, outputHeight: 1080 };
  const rect = { left: 0, top: 0, width: 1920, height: 1080 };

  it('maps client pixels to the internal grid', () => {
    expect(clientToInternal(960, 540, rect, internal)).toEqual({ x: 480, y: 270 });
    expect(clientToInternal(0, 0, rect, internal)).toEqual({ x: 0, y: 0 });
    // a letterboxed grid (683×384 at ×2 on 1366×769) keeps its centre
    expect(clientToInternal(683, 384.5, { left: 0, top: 0, width: 1366, height: 769 }, { width: 683, height: 384, scale: 2, outputWidth: 1366, outputHeight: 769 })).toEqual({ x: 341.5, y: 192 });
  });

  it('finds the floor point under an internal pixel (square floor tiles)', () => {
    const view = { target: { x: 11, z: 8 }, ppt: 24 };
    expect(internalToFloor({ x: 480, y: 270 }, internal, view)).toEqual({ x: 11, z: 8 });
    expect(internalToFloor({ x: 504, y: 222 }, internal, view)).toEqual({ x: 12, z: 6 });
  });
});

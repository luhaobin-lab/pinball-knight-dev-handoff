import { describe, expect, it } from 'vitest';
import { evalCurve, flipbookFrame, mapRangeClamped } from '../../src/anim/curve';
import { baseAttribute, 数据表_敌人_普通, 数据表_玩家 } from '../../src/content/demo/index.ts';
import {
  blinkOn,
  corpseTint,
  DEATH_SECONDS,
  deathFrame,
  recoilTrack,
  recoilUu,
  slashFrame,
  SQUASH_SECONDS,
  squashHeight,
  squashWidth,
} from '../../src/anim/reactions';

describe('evalCurve', () => {
  it('interpolates Hermite segments with the keys’ tangents and holds outside', () => {
    const keys = [{ time: 0, value: 0, leave: 0 }, { time: 1, value: 1 }];
    expect(evalCurve(keys, -1)).toBe(0);
    expect(evalCurve(keys, 0.5)).toBeCloseTo(0.5, 12);
    expect(evalCurve(keys, 0.25)).toBeCloseTo(3 * 0.0625 - 2 * 0.015625, 12);
    expect(evalCurve(keys, 2)).toBe(1);
  });

  it('honours linear and constant segments', () => {
    expect(evalCurve([{ time: 0, value: 2, interp: 'linear' }, { time: 2, value: 4 }], 0.5)).toBeCloseTo(2.5, 12);
    expect(evalCurve([{ time: 0, value: 2, interp: 'constant' }, { time: 2, value: 4 }], 1.9)).toBe(2);
  });

  it('maps ranges with clamping and steps flipbooks on whole 1/60-s frames', () => {
    expect(mapRangeClamped(2000, 3000, 6000, 48, 96)).toBe(48);
    expect(mapRangeClamped(4500, 3000, 6000, 48, 96)).toBe(72);
    let age = 0;
    for (let i = 0; i < 6; i++) age += 1 / 60;
    expect(flipbookFrame(age, 10, 4)).toBe(1);
    expect(flipbookFrame(9, 10, 4)).toBe(3);
  });
});

describe('可控反弹动画 (recoil)', () => {
  it('passes through the dumped keys', () => {
    expect(recoilTrack(0)).toBeCloseTo(0.3, 6);
    expect(recoilTrack(0.07)).toBeCloseTo(1, 6);
    expect(recoilTrack(0.18)).toBeCloseTo(0.87, 6);
    expect(recoilTrack(0.36)).toBeCloseTo(-0.2, 6);
    expect(recoilTrack(0.56)).toBeCloseTo(0, 6);
    expect(recoilTrack(0.9)).toBe(0);
    expect(recoilTrack(1)).toBe(0);
  });

  it('rises steeply from 0.3 (tangent 17.4 per s) and never overshoots its peak', () => {
    expect(recoilTrack(0.0175)).toBeCloseTo(0.581, 3);
    expect(recoilTrack(0.035)).toBeCloseTo(0.802, 3);
    for (let t = 0; t < 1; t += 0.001) expect(recoilTrack(t)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('is 48 uu for the knight and scales with the hitter speed', () => {
    expect(recoilUu(0)).toBe(48);
    expect(recoilUu(2000)).toBe(48);
    expect(recoilUu(2900)).toBe(48);
    expect(recoilUu(4500)).toBe(72);
    expect(recoilUu(9000)).toBe(96);
  });

  it('does not depend on the row: 初始质量 is never assigned, so the mass factor is 1 for every body', () => {
    // L25's MapRangeClamped(拥有者.初始质量 = 0, 50, 800, 1, 0.2)
    expect(mapRangeClamped(0, 50, 800, 1, 0.2)).toBe(1);
    const rows = [...Object.values(数据表_敌人_普通.rows), ...Object.values(数据表_玩家.rows)];
    const masses = new Set(rows.flatMap(r => baseAttribute(r.科学词条, '质量')?.值 ?? []));
    expect(masses.size).toBeGreaterThan(5);
    // a row's 质量 (10 to 20000), even if a caller hands it in, leaves the hitter-speed map alone
    const withRow = recoilUu as (hitterSpeedUu: number, ...row: number[]) => number;
    for (const mass of masses) {
      for (const speed of [0, 2000, 4500, 9000]) expect(withRow(speed, mass)).toBe(mapRangeClamped(speed, 3000, 6000, 48, 96));
    }
  });
});

describe('反弹动画2 (squash)', () => {
  it('passes through the dumped keys, linear first, then flat cubics', () => {
    expect(squashWidth(0)).toBe(1);
    expect(squashWidth(2351 / 24000 / 2)).toBeCloseTo(0.95, 9);
    expect(squashHeight(2351 / 24000 / 2)).toBeCloseTo(1.1, 9);
    expect(squashWidth(2351 / 24000)).toBeCloseTo(0.9, 9);
    expect(squashHeight(2351 / 24000)).toBeCloseTo(1.2, 9);
    expect(squashWidth(4821 / 24000)).toBeCloseTo(1.2, 9);
    expect(squashHeight(4821 / 24000)).toBeCloseTo(0.9, 9);
    expect(squashWidth(7954 / 24000)).toBeCloseTo(0.95, 9);
    expect(squashHeight(7954 / 24000)).toBeCloseTo(1.1, 9);
    expect(squashWidth(SQUASH_SECONDS)).toBe(1);
    expect(squashHeight(SQUASH_SECONDS + 0.1)).toBe(1);
  });
});

describe('闪烁, death and slash', () => {
  it('blinks as a 4 Hz square wave', () => {
    expect(blinkOn(0.01)).toBe(true);
    expect(blinkOn(0.124)).toBe(true);
    expect(blinkOn(0.126)).toBe(false);
    expect(blinkOn(0.251)).toBe(true);
  });

  it('runs the death on 10 frames at 10 fps and darkens the corpse from 0.9 s over 1.2 s', () => {
    expect(deathFrame(0)).toBe(0);
    expect(deathFrame(0.5)).toBe(5);
    expect(deathFrame(0.99)).toBe(9);
    expect(deathFrame(5)).toBe(9);
    expect(corpseTint(0.89)).toEqual({ brightness: 1, desaturation: 0 });
    expect(corpseTint(DEATH_SECONDS).brightness).toBeCloseTo(0.5, 9);
    expect(corpseTint(DEATH_SECONDS).desaturation).toBeCloseTo(0.35, 9);
    // the curve leaves 0 at 1.33 per s: half way at ≈ 0.39 s
    expect(corpseTint(0.9 + 0.6).brightness).toBeCloseTo(1 - 0.5 * (0.125 * 1.3290243 * 1.2 + 0.5), 6);
  });

  it('slashes in four 0.1-s steps', () => {
    expect([0, 0.05, 0.1, 0.25, 0.35, 0.399, 0.4].map(slashFrame)).toEqual([0, 0, 1, 2, 3, 3, -1]);
    expect(slashFrame(Infinity)).toBe(-1);
  });
});

import { describe, expect, it } from 'vitest';
import { HIT_STOP } from '../../src/core/launch/index.ts';
import { advanceLaunchClock } from '../../src/game/hit-stop';
import { placeholderHit } from '../../src/game/placeholder-combat';
import { damageAngle, DAMAGE_PICKS } from '../../src/game/popups';

describe('damage popup 旋转 (UI_伤害提示 L2016)', () => {
  it('is CalculateDirection of −normal in the Demo frame (X = screen up, Y = screen right), plus the pick', () => {
    // the hero below the enemy: the normal points down (south), −normal up → 0°
    expect(damageAngle({ x: 0, y: 1 }, 0)).toBeCloseTo(0, 9);
    // the hero west of the enemy: −normal points east = screen right → +90°
    expect(damageAngle({ x: -1, y: 0 }, 0)).toBeCloseTo(90, 9);
    expect(damageAngle({ x: 1, y: 0 }, 0)).toBeCloseTo(-90, 9);
    expect(damageAngle({ x: 0, y: -1 }, 0)).toBeCloseTo(180, 9);
    expect(damageAngle({ x: -Math.SQRT1_2, y: Math.SQRT1_2 }, 20)).toBeCloseTo(65, 9);
  });

  it('picks from the seven Demo offsets', () => {
    expect([...DAMAGE_PICKS]).toEqual([-30, -20, -10, 0, 10, 20, 30]);
  });
});

describe('hit-stop clock', () => {
  const real = (contacts: number[], until: number, dt: number): number => {
    let g = 0;
    let r = 0;
    while (g < until && r < 10) {
      g = advanceLaunchClock(g, dt, contacts);
      r += dt;
    }
    return r;
  };

  it('runs at real speed without enemy contacts', () => {
    expect(advanceLaunchClock(0.3, 0.5, [])).toBeCloseTo(0.8, 12);
  });

  it('plays the 变速 track from an enemy contact: 0.2 for 0.022 s, 1.5 to 0.08 s, then 1 (≈ 0.3187 s real)', () => {
    const c = [0.2];
    expect(advanceLaunchClock(0, 0.2 + 0.022 / 0.2, c)).toBeCloseTo(0.222, 12);
    expect(advanceLaunchClock(0, 0.2 + 0.11 + 0.058 / 1.5, c)).toBeCloseTo(0.28, 12);
    const extra = 0.022 / 0.2 + 0.058 / 1.5 + (HIT_STOP.duration - 0.08);
    expect(extra).toBeCloseTo(0.3187, 4);
    expect(advanceLaunchClock(0, 0.2 + extra + 0.1, c)).toBeCloseTo(0.2 + HIT_STOP.duration + 0.1, 12);
  });

  it('does not depend on the frame rate and passes every step boundary it reaches exactly', () => {
    const c = [0.2, 0.31, 0.5];
    const coarse = advanceLaunchClock(0, 1, c);
    let fine = 0;
    for (let i = 0; i < 60; i++) fine = advanceLaunchClock(fine, 1 / 60, c);
    let finer = 0;
    for (let i = 0; i < 240; i++) finer = advanceLaunchClock(finer, 1 / 240, c);
    expect(fine).toBeCloseTo(coarse, 9);
    expect(finer).toBeCloseTo(coarse, 9);
    // 60 fps through the 0.022 s boundary (0.2 + 0.022 lands on a float boundary) never stalls
    expect(real([0.2], 0.6, 1 / 60)).toBeLessThan(0.75);
  });

  it('restarts the track at every enemy contact', () => {
    const one = advanceLaunchClock(0, 0.6, [0.2]);
    const two = advanceLaunchClock(0, 0.6, [0.2, 0.25]);
    expect(two).toBeLessThan(one);
  });
});

describe('placeholder hits (SPEC-GAP until damage-crit-weakspot is ported)', () => {
  it('takes one pip, three on the session’s third hit, which shows doubled', () => {
    expect([0, 1, 2, 3, 4, 5].map(placeholderHit)).toEqual([
      { pips: 1, crit: false, damage: 6 },
      { pips: 1, crit: false, damage: 8 },
      { pips: 3, crit: true, damage: 24 },
      { pips: 1, crit: false, damage: 7 },
      { pips: 1, crit: false, damage: 9 },
      { pips: 1, crit: false, damage: 6 },
    ]);
  });
});

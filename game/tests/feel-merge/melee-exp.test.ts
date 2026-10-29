import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { meleeHit, meleeVictims, type MeleeTarget } from '../../src/game/melee';
import { aroundCharacter, killExp } from '../../src/game/popups';
import { demoExp, STAND_IN } from '../../src/game/roster';

const at = (id: string, x: number, y: number, width = 40): MeleeTarget => ({ id, center: { x, y }, width });

describe('melee AoE (近战捕获攻击目标, FEEL-060)', () => {
  const hero = { x: 0, y: 0 };

  it('takes every enemy within 攻击距离 + its own 宽度 of the hero centre, the touched one first', () => {
    const touched = at('touched', 300, 0);
    const near = at('near', 0, 150);
    const edge = at('edge', -150, 0);
    const far = at('far', 0, -151);
    const ids = meleeVictims(hero, touched, [near, touched, edge, far], 110).map(t => t.id);
    expect(ids).toEqual(['touched', 'near', 'edge']);
  });

  it('always includes the touched enemy, out of reach or not, and only once', () => {
    const touched = at('touched', 900, 0);
    expect(meleeVictims(hero, touched, [touched], 110)).toEqual([touched]);
  });

  it('hits an untouched victim on its side facing the hero, the normal toward him', () => {
    const h = meleeHit(hero, at('v', 100, 0, 40));
    expect(h.normal.x).toBeCloseTo(-1, 12);
    expect(h.normal.y).toBeCloseTo(0, 12);
    expect(h.point.x).toBeCloseTo(60, 12);
    expect(h.point.y).toBeCloseTo(0, 12);
  });
});

describe('a kill’s EXP (BP_Actor_Other L8845, UI_拾取提示 L2882)', () => {
  it('rolls the row’s 经验 × U(0.8, 1.2) and shows its FTrunc', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = killExp(50, rng);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(60);
    }
  });

  it('reads 经验 from the stand-in rows', () => {
    for (const kind of Object.keys(STAND_IN) as (keyof typeof STAND_IN)[]) expect(demoExp(kind)).toBeGreaterThan(0);
    expect(demoExp('wickling')).toBe(50);
  });

  it('starts ON the circle of 0.65 × 高度 around the hero, at his centre height', () => {
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const p = aroundCharacter({ x: 10, z: 5 }, 56, rng);
      expect(Math.hypot(p.x - 10, p.z - 5) * 64).toBeCloseTo(36.4, 9);
      expect(p.y * 64).toBeCloseTo(56, 9);
    }
  });
});

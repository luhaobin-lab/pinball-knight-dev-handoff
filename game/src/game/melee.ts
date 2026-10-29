import type { Vec2 } from '../core/launch/index.ts';

/**
 * 可控挥击's melee hit on an enemy contact (发动攻击 → BP_ManeActor.近战捕获攻击目标; spec/launch-feel.md FEEL-060 and
 * its open finding): every enemy whose 2-D centre lies within 攻击距离 + its own 宽度 of the hero's centre takes the
 * hit, the touched one always (first). Units are uu in the launch frame (x east, y south).
 */

/** An enemy the knight's melee may reach: its floor centre and 属性.宽度 (uu). */
export interface MeleeTarget {
  readonly id: string;
  readonly center: Vec2;
  readonly width: number;
}

/** Where a victim takes the hit: the impact point and the unit normal from the victim toward the hero. */
export interface MeleeHit {
  readonly point: Vec2;
  readonly normal: Vec2;
}

/** The victims of one swing, the touched enemy first, then the others in the given order. */
export function meleeVictims<T extends MeleeTarget>(hero: Vec2, touched: T, others: readonly T[], range: number): T[] {
  const reach = (t: T): boolean => Math.hypot(t.center.x - hero.x, t.center.y - hero.y) <= range + t.width;
  return [touched, ...others.filter(t => t.id !== touched.id && reach(t))];
}

/**
 * The hit on a victim the hero did not touch: the point of its capsule facing the hero and the normal toward him.
 * SPEC-GAP: the Demo's sphere trace reports its own impact point for these (近战捕获攻击目标); the facing point stands in.
 */
export function meleeHit(hero: Vec2, target: MeleeTarget): MeleeHit {
  const dx = hero.x - target.center.x;
  const dy = hero.y - target.center.y;
  const len = Math.hypot(dx, dy);
  const normal = len > 1e-6 ? { x: dx / len, y: dy / len } : { x: 0, y: 1 };
  return { point: { x: target.center.x + normal.x * target.width, y: target.center.y + normal.y * target.width }, normal };
}

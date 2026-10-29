import { uuToTiles, type Vec2 } from '../core/launch/index.ts';
import type { Rng } from '../core/rng';

/**
 * What the game passes with each HUD popup (src/ui README "Popups"): UI_伤害提示's 旋转, and where a kill's EXP
 * starts and how much it is. The HUD numbers and merges damage popups itself (`owner`, `skill`).
 */

/** UI_伤害提示 picks 旋转's offset with Array_RandomFromStream from these (degrees). */
export const DAMAGE_PICKS = [-30, -20, -10, 0, 10, 20, 30] as const;

/**
 * UI_伤害提示.旋转 (L2016): CalculateDirection(−Normal2D(击中点法线), Rotator(roll 1°)) + `pick`, in degrees. The
 * normal is in the launch frame (x east, y south) pointing from the target toward the attacker; the Demo's frame
 * has X = screen up = −y and Y = screen right = x (src/core/launch/math.ts), and CalculateDirection returns the
 * angle from X, signed toward Y. The Demo re-seeds the stream with 来自角色.种子 for every popup, so `pick` is the
 * same for all of one attacker's hits.
 */
export function damageAngle(normal: Vec2, pick: number): number {
  const x = normal.y;
  const y = -normal.x;
  const len = Math.hypot(x, y);
  if (len < 1e-4) return pick;
  const deg = (Math.acos(Math.min(1, Math.max(-1, x / len))) * 180) / Math.PI;
  return (y < 0 ? -deg : deg) + pick;
}

/**
 * 函数库_工具.扩散命中中心(character, 0, 0.65, 0) for a character that is not a card: its actor location (the capsule
 * centre, 高度 above the floor) plus RotateAngleAxis((0.65 × 高度, 0, 0), RandomFloatInRange(−180, 180), Z), a point
 * ON that circle, in tiles (the Demo frame has X = screen up = −z and Y = screen right = x). A kill's "+N经验" starts
 * here around the HERO (增加经验's 经验来源 is 游戏模式.玩家角色, BP_Actor_Other L8845; UI_拾取提示 L2882).
 * SPEC-GAP: the Demo's camera looks straight down, so its Z never moves the popup on screen; under our oblique
 * camera it lifts the start 0.625 × 高度 (as 击中点位置 does for the damage numbers).
 */
export function aroundCharacter(at: { readonly x: number; readonly z: number }, heightUu: number, rng: Rng): { x: number; y: number; z: number } {
  const r = uuToTiles(0.65 * heightUu);
  const a = (rng.range(-180, 180) * Math.PI) / 180;
  return { x: at.x + r * Math.sin(a), y: uuToTiles(heightUu), z: at.z - r * Math.cos(a) };
}

/**
 * 死亡产生经验 (BP_Actor_Other L8845): the row's 经验 × RandomFloatInRange(0.8, 1.2); 增加经验 shows "+{FTrunc}经验"
 * (经验修正% is 0 without items).
 */
export function killExp(exp: number, rng: Rng): number {
  return Math.trunc(exp * rng.range(0.8, 1.2));
}

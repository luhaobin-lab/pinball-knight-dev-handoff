import { evalCurve, flipbookFrame, mapRangeClamped, type CurveKey } from './curve';

/**
 * The Demo's reactions to a launch contact and to death, with their dumped keys (demo-juice §4.1, §7.2, §7.3).
 * All ages are game seconds: the caller advances them with the dilated game dt, so the hit-stop slows them like
 * the Demo's global time dilation (rec-02: the recoil peaks ≈ 0.14 s real after the contact because of it).
 */

// ---- 可控反弹动画: the recoil of a body touched by a launch (蓝图_效果_可控反弹动画) -----------------------

/** CurveFloat_0 of the effect's 时间轴 (dump/curves/CatapultHero/BP/Skill/效果/蓝图_效果_可控反弹动画.json). */
export const RECOIL_TRACK: readonly CurveKey[] = [
  { time: 0, value: 0.3, arrive: 17.418392, leave: 17.418388 },
  { time: 0.07, value: 1 },
  { time: 0.18, value: 0.87, arrive: -2.0199225, leave: -2.019923 },
  { time: 0.36, value: -0.2 },
  { time: 0.56, value: 0 },
];
/** The timeline's length: at its end 额外动画根 goes back to zero and the effect is destroyed. */
export const RECOIL_SECONDS = 1;

/** Recoil track value `age` seconds after the contact (0 outside the timeline). */
export function recoilTrack(age: number): number {
  return age >= 0 && age < RECOIL_SECONDS ? evalCurve(RECOIL_TRACK, age) : 0;
}

/**
 * The recoil's full distance in uu (时间轴 update, L25): MapRangeClamped(释放者.移动当前速度, 3000, 6000, 48, 96),
 * the same for every body. The knight's legs (2000–2900 uu/s) give 48 uu.
 */
export function recoilUu(hitterSpeedUu: number): number {
  // L25's other factor, MapRangeClamped(拥有者.初始质量, 50, 800, 1, 0.2), is 1: 初始质量 is never assigned (0).
  return mapRangeClamped(hitterSpeedUu, 3000, 6000, 48, 96);
}

// ---- 反弹动画2: the touched enemy's squash and stretch (BP_Actor_Other, RelativeScale3D of the flipbook) ----

const TICK = 1 / 24000;
/** Width keys (X); the first segment is linear, the rest cubic with flat tangents. */
export const SQUASH_WIDTH: readonly CurveKey[] = [
  { time: 0, value: 1, interp: 'linear' },
  { time: 2351 * TICK, value: 0.9 },
  { time: 4821 * TICK, value: 1.2 },
  { time: 7954 * TICK, value: 0.95 },
  { time: 11932 * TICK, value: 1 },
];
/** Height keys (Z), same times. */
export const SQUASH_HEIGHT: readonly CurveKey[] = [
  { time: 0, value: 1, interp: 'linear' },
  { time: 2351 * TICK, value: 1.2 },
  { time: 4821 * TICK, value: 0.9 },
  { time: 7954 * TICK, value: 1.1 },
  { time: 11932 * TICK, value: 1 },
];
/** The sequence's last key (0.497 s); it restarts on every contact. */
export const SQUASH_SECONDS = 11932 * TICK;

export function squashWidth(age: number): number {
  return age >= 0 && age < SQUASH_SECONDS ? evalCurve(SQUASH_WIDTH, age) : 1;
}

export function squashHeight(age: number): number {
  return age >= 0 && age < SQUASH_SECONDS ? evalCurve(SQUASH_HEIGHT, age) : 1;
}

// ---- 蓝图_效果_闪烁: the hit flash of every victim ---------------------------------------------------------

/** 闪烁开关 stays 1 for this long (Delay 0.3, game time). */
export const FLASH_SECONDS = 0.3;
/**
 * SPEC-GAP: Mat_SpritBase's graph is stripped; its 闪烁速度 is 4. The captures fit a 4 Hz square wave (half on) on
 * the material's game clock, gated by 闪烁开关: rec-02 shows one white blink 0.11 game s long starting 0.08 s after
 * the contact (f183–f188), the tutorial two (2 then 3 frames at 30 fps). The phase comes from the clock, not the hit.
 */
export const BLINK_HZ = 4;

export function blinkOn(clock: number): boolean {
  const phase = clock * BLINK_HZ;
  return phase - Math.floor(phase) < 0.5;
}

// ---- 角色死亡: an enemy's death (Die flipbook, notifies, 死亡变色) ------------------------------------------

/** Enemy Die flipbooks run at 10 fps; 眼球 (M02) dies in 10 frames. */
export const DEATH_FPS = 10;
export const DEATH_FRAMES = 10;
/** 精灵播放粒子 粒子_Blood_02 at 0.50 s (and 音效_基础_血浆01 at 0.503 s): our spore splat. */
export const SPLAT_AT = 0.5;
/** 精灵死亡变色 notify: the corpse starts to darken. */
export const DEATH_TINT_AT = 0.9;
/** 死亡变色 CurveFloat_0 (dump/curves/CatapultHero/BP/Actor/BP_Actor_Other.json), 1.2 s. */
export const DEATH_TINT: readonly CurveKey[] = [
  { time: 0, value: 0, arrive: 1.3290284, leave: 1.3290243 },
  { time: 1.2, value: 1 },
];
/** Everything has settled: the darkened corpse from here on. */
export const DEATH_SECONDS = DEATH_TINT_AT + 1.2;
/** 死亡变色's ends: 明度 Lerp(1, 0.5) and 饱和度 Lerp(0, 0.35) (BP_Actor_Other L13721, L13889). */
export const CORPSE_BRIGHTNESS = 0.5;
export const CORPSE_DESATURATION = 0.35;

export function deathFrame(age: number): number {
  return flipbookFrame(age, DEATH_FPS, DEATH_FRAMES);
}

/** The corpse's 明度 and 饱和度 `age` seconds after 角色死亡. */
export function corpseTint(age: number): { brightness: number; desaturation: number } {
  const c = evalCurve(DEATH_TINT, age - DEATH_TINT_AT);
  return { brightness: 1 + (CORPSE_BRIGHTNESS - 1) * c, desaturation: CORPSE_DESATURATION * c };
}

// ---- 回旋斩: the hero's whirlwind slash on an enemy contact (Actor_C01_SQ_Attack02, 4 frames at 10 fps) ----

export const SLASH_FPS = 10;
export const SLASH_FRAMES = 4;
export const SLASH_SECONDS = SLASH_FRAMES / SLASH_FPS;

/** The slash frame `age` seconds in, or -1 once it has ended. */
export function slashFrame(age: number): number {
  return age >= 0 && age < SLASH_SECONDS - 1e-6 ? flipbookFrame(age, SLASH_FPS, SLASH_FRAMES) : -1;
}

/**
 * The Demo's launch effects as numbers (ART_BIBLE rule 9: the feel is a 1:1 copy). Lengths are uu (64 per tile),
 * times game seconds (they slow with the hit-stop). Sources: the dump (D:/TAPTAPGAME_ref/dump, cited per value) and
 * the 60 fps captures of the real Demo (D:/TAPTAPGAME_studio/tmp/feel/demo-rec-0{1,2}-frames, 1 uu ≈ 1 capture px),
 * measured for this lane (README.md "Measurements").
 */

/** A piecewise-linear curve: [x, y] keys, x ascending; constant outside. */
export type Keys = readonly (readonly [number, number])[];

export function evalKeys(keys: Keys, x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [x1, y1] = keys[i];
    if (x <= x1) {
      const [x0, y0] = keys[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return keys[keys.length - 1][1];
}

/** 粒子_轨迹: the ribbon behind the hero (蓝图_效果_可控弹射 L7039 spawns it, L5358 deactivates it). */
export const TRAIL = {
  /** User.轨迹宽度 = 高度 − 10 (CK L7039). Measured: the fresh band is 41–47 px across (rec-01 f177–f198). */
  widthUu: 46,
  /** SpawnPerUnit 0.125 per uu (粒子_轨迹 SystemUpdateScript literal). */
  spacingUu: 8,
  /** A point is gone at this age: rec-01 legs 1–2 vanish at 1.10–1.15 s; the tutorial trail ≈ 1.2 s after release. */
  lifeS: 1.15,
  /**
   * Fraction of the band's pixels still drawn, by point age (rec-01 legs 1–2: pixels 25+ above the floor; the legs
   * the hero's light leaves early fade sooner, leg 0 is gone by 0.95 s).
   */
  visible: [[0, 1], [0.1, 0.91], [0.2, 0.8], [0.3, 0.73], [0.4, 0.66], [0.5, 0.59], [0.6, 0.42], [0.7, 0.27], [0.8, 0.16], [0.9, 0.07], [1.0, 0.03], [1.15, 0]] as Keys,
  /**
   * Fraction drawn in bone white (the rest of `visible` is the dim veil, VEIL), fitted so that coverage × contrast
   * follows the band's measured mean brightness over the floor (rec-01 legs 1–2: 1, 0.81, 0.43, 0.31, 0.23, 0.16, 0.07
   * at 0, 0.1 … 0.6 s), with the Demo's veil-to-head contrast ratio (≈ 0.25).
   */
  bright: [[0, 1], [0.05, 0.82], [0.1, 0.78], [0.15, 0.57], [0.2, 0.31], [0.3, 0.17], [0.4, 0.09], [0.5, 0.02], [0.55, 0]] as Keys,
} as const;

/** 粒子_Dust_01 (component 粒子_灰尘 on every BP_ManeActor). */
export const DUST = {
  /** SpawnPerUnit 0.01 (SystemUpdateScript literal): one puff per 100 uu, spawned where the mover is that frame. */
  everyUu: 100,
  /** Spawn-script literal 0.4; measured 22 frames (0.385 s) from the big puff to the last speck (rec-01 f169–f190). */
  lifeS: 0.4,
  /** SubImageSize 4 × 1, played once over the life. */
  frames: 4,
  /** The first frame's puff: 36 × 34 px (rec-01 f172–f174); later frames break into blobs and specks. */
  puffUu: 35,
  /**
   * Puff centre below the trail's centre line on screen (+z): rec-01 puffs sit 16–31 px under it. BP_ManeActor puts
   * 粒子_灰尘 at RelativeLocation X −45 (45 uu screen-down); the puff is drawn in the upper part of its 75-uu cell.
   */
  dropUu: 26,
} as const;

/** 粒子_Hit_01 (被击特效B of 受击特效处理), one per victim. */
export const SPARK = {
  /** Spawn literals 0.2 0.6; rec-02's spark lives ≈ 0.46 game s (f174–f205 real, hit-stop undone). */
  lifeS: [0.2, 0.6] as const,
  /** Spawn literals 32 64 (sprite size). Measured: the ring ≈ 25 px (f174), the disc 38–40 px (f190). */
  sizeUu: [32, 64] as const,
  /** SubImageSize 6 × 1, played once over the life. */
  frames: 6,
  /** 击中点位置 + 30 Z (BP_ManeActor 受击特效处理). */
  heightUu: 30,
} as const;

/** 粒子_Blood_01 (被击特效A, the enemies' 粒子[0]), reskinned as corruption spores and ichor. */
export const SPORES = {
  heightUu: 30,
  /** Everything of one hit vanishes at once: rec-02 f205 → f206, 0.53–0.55 game s after the contact. */
  endS: 0.54,
  /**
   * Drops (velocity-aligned, MI_Drops_Pix): User.DropsSpawnRate 20 for User.DropsDuration 0.3 s, plus the emitter's
   * SpawnBurst_Instantaneous at the hit. rec-02 f198–f204 shows 10–12 dashes along the normal: 6 from the rate, 4 in
   * the burst.
   */
  dropRate: 20,
  dropForS: 0.3,
  dropBurst: 4,
  /**
   * Drop flight: the leading drop is 150 px out along the normal at 0.17 game s, 250 at 0.25, 330 at 0.40 and 400
   * at 0.49 (rec-02 f186–f203): about 1000 uu/s easing off (drag ≈ 1 /s); the later drops trail behind it.
   */
  dropSpeed: [450, 1050] as const,
  dropDrag: 1,
  /** Spread of the drops around the normal (rec-02: within ±40 px of the axis 250 px out). */
  dropSpreadRad: 0.15,
  /** Drops leave from 30 uu up and fall (Drops literal −980): they touch the floor ≈ 0.25 s after leaving. */
  gravity: 980,
  /** The dashes the drops draw: 10–26 px long, 8–16 px wide (rec-02 f194–f204): width, longest. */
  dropUu: [9, 26] as const,
  /**
   * The two splash sprites (Simple_Blood001, Simple_Blood_0: 35–45 × User.Scale 2 quads). On screen (rec-02
   * f186–f204, measured along the normal from the hit point): a main splash 60–75 px across that settles 45–65 px
   * out (its red ring shows around the spark's 38-px disc; 2300–2550 px of red within 100 px of the hit at 0.25 s),
   * and a second one 45–60 px across 110–125 px out (with the drops, 2000–2300 px between 100 and 250 px out).
   */
  splashes: [
    { sizeUu: [60, 74], restUu: 50 },
    { sizeUu: [48, 60], restUu: 120 },
  ] as const,
  /** They grow from nothing between 0.02 and 0.2 s (f181–f189) and reach 90 % of their rest by 0.25 s. */
  splashGrowS: [0.02, 0.2] as const,
  splashDriftTau: 0.11,
  /** From 0.3 s they shrink: the main splash covers 1784, 1446, 767, ≈ 500, ≈ 250 px at 0.25, 0.33, 0.40, 0.47, 0.50 s. */
  splashShrinkS: 0.3,
  /** Blood_Burst (custom aligned along the normal, pivot 0.5/0.9): ≈ 50 × 30 px at the first frame (f174). */
  burstUu: [50, 30] as const,
  burstS: 0.12,
} as const;

/** BP_Decal floor stains spawned by BP_ManeActor.ReceiveParticleData for 粒子_Blood_01's reported particles. */
export const STAIN = {
  /** 传统概率判断(0.5) (L7685). */
  chance: 0.5,
  /** DecalScale 2.0 × U(0.9, 1.3) per axis (L369…). */
  scale: 2,
  jitter: [0.9, 1.3] as const,
  /** BP_Decal: FadeInDuration + 0.01, Start Delay 10, Fade Duration 4. */
  fadeInS: 0.01,
  holdS: 10,
  fadeS: 4,
} as const;

/** 粒子_Blood_02, the Die animation's notify at 0.50 s (眼球 M02, 大肠 M05 …), reskinned as a spore splat. */
export const SPLAT = {
  /** Spawned at (+10, 0, +20) on the sprite: 10 uu screen-up, 20 uu above the floor. */
  upUu: 10,
  heightUu: 20,
  /** Blood_Burst_3: life 0.6, size 10–50 × User.Scale 1.2, speed 100–250 uu/s, gravity −300. */
  burstS: 0.6,
  burstUu: [12, 60] as const,
  burstSpeed: [100, 250] as const,
  burstGravity: 300,
  /** Simple_Blood: life 0.3–0.4, size 35–45 × 1.2. */
  splashS: [0.3, 0.4] as const,
  splashUu: [42, 54] as const,
  /** Simple_Blood_0001 (the smoke): life 0.1–0.4, size 20–60 × 1.2, speed 30–70 uu/s. */
  smokeS: [0.1, 0.4] as const,
  smokeUu: [24, 72] as const,
  smokeSpeed: [30, 70] as const,
} as const;

/** 回旋斩: the knight's Actor_C01_SQ_Attack02 flipbook (BP_ManeActor 进入攻击状态, 4 frames at 10 fps). */
export const WHIRLWIND = {
  frames: 4,
  frameS: 0.1,
  /** Outer diameter: the crescents span 176–182 px across (rec-02 f175–f198). */
  diameterUu: 180,
} as const;

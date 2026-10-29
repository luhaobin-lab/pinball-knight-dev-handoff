/**
 * Launch numbers from the Demo data, each with its source (paths under D:/TAPTAPGAME_ref/dump/).
 * Distances in uu (64 per tile), speeds in uu/s, times in seconds of game time.
 */

/** The hero values the launch reads (datatables 数据表_玩家 row 属性 / 科学词条, launch skill row 参数). */
export interface HeroLaunchStats {
  /** 属性.宽度: capsule radius. The preview probe is 0.95 × this; the terminal probe is this. */
  readonly width: number;
  /** 属性.高度: capsule half-height; every preview trace runs with its centre at this height. */
  readonly height: number;
  /** 属性.最大疲劳 = Bounce Limit (反弹次数上限); compared as `bounces < limit`, so 4.5 allows 5. */
  readonly maxBounces: number;
  /** 科学词条.弹射距离 = Launch Distance: the length of every main leg. */
  readonly launchDistance: number;
  /** Launch skill 参数[1] 碰撞墙壁触发？: attack on wall contacts (ranged) instead of enemy contacts (melee). */
  readonly wallTriggered: boolean;
}

/**
 * 幽冥骑士 (Spectral Knight), the always-unlocked starter hero; the beetle knight is its reskin.
 * Source: datatables/CatapultHero/数据表/角色/数据表_玩家.json row 幽冥骑士 (属性.宽度 56, 属性.高度 56,
 * 属性.最大疲劳 4, 科学词条.弹射距离 5.0e2) and 数据表/技能/数据表_技能_默认.json row 可控挥击, its slot-0
 * skill (参数[1] 碰撞墙壁触发？ 初始值 0.0).
 */
export const STARTER_HERO: HeroLaunchStats = Object.freeze({
  width: 56,
  height: 56,
  maxBounces: 4,
  launchDistance: 500,
  wallTriggered: false,
});

/**
 * 灵魂猎手 (Soul Hunter), the other live hero. Source: 数据表_玩家 row 灵魂猎手 (宽度 56, 高度 56, 最大疲劳 5,
 * 弹射距离 5.0e2) and 数据表_技能_默认 row 可控反蹬箭 (参数[1] 碰撞墙壁触发？ 初始值 1.0).
 */
export const SOUL_HUNTER: HeroLaunchStats = Object.freeze({
  width: 56,
  height: 56,
  maxBounces: 5,
  launchDistance: 500,
  wallTriggered: true,
});

/** Rules of the preview chain (碰撞预览圈) and the controlled launch (蓝图_效果_可控弹射). */
export const LAUNCH_RULES = Object.freeze({
  /** Main-leg probe radius = 0.95 × 宽度 (碰撞预览圈 L1802: 拾取物判断(Start, End, 0.95)). */
  probeRadiusFactor: 0.95,
  /** A leg's trace starts this far along its direction (L1802: Conv_DoubleToVector(0.05)). */
  startOffset: 0.05,
  /** Terminal length after a non-bouncing last circle (计算总长度 L612: FMin(96.0, next.长度)). */
  terminalCap: 96,
  /** 长度 uses the arc length only above this (L1802: > 0.001). */
  arcLengthThreshold: 0.001,
  /** Circle 0 aims along the cursor snapped to whole degrees (L8781: 向量吸附角度(目标位置向量, 1.0)). */
  aimSnapDegrees: 1,
  /** The cursor point snaps to a 4-uu grid first (蓝图_主角色控制器 设置指引点向量: Vector_SnappedToGrid(…, 4.0)). */
  cursorGrid: 4,
  /** Highest 序号 the native resolve can make bounceable (exe@0x1445b1aae). */
  maxBounceIndex: 61,
  /** The chain grows while it holds at most this many circles (CanGrowLegacyPreviewChain, exe@0x1445acd32). */
  maxGrowCount: 63,
  /** Gravity-bounce credits are capped (exe@0x1445b1a63). */
  maxPendingGravityBounces: 64,
  /** Main leg: speed = FMin(疲劳 × 300 + 2000, 6000) (蓝图_效果_可控弹射 L1882). */
  legSpeedBase: 2000,
  legSpeedPerFatigue: 300,
  legSpeedMax: 6000,
  /** Terminal leg: speed = 0.3 × 移动当前速度, the last main leg's speed (L1196). */
  terminalSpeedFactor: 0.3,
  /** Leg duration = max(length / speed, 0.01) (StartLegacyPreviewLeg, exe@0x1445b250b–0x1445b2526). */
  minLegDuration: 0.01,
});

/**
 * Hit-stop of a contact with a hostile target: 蓝图_效果_时间变速 plays timeline 普通时间扭曲 (0.25 s), whose
 * track 变速 (curves/.../蓝图_效果_时间变速.json CurveFloat_0_1, constant keys) sets the global time dilation.
 * The timeline runs in dilated time (no bIgnoreTimeDilation; launch-movement GAP-11), ≈ 0.3187 s real.
 */
export const HIT_STOP = Object.freeze({
  duration: 0.25,
  steps: Object.freeze([
    Object.freeze({ from: 0, dilation: 0.2 }),
    Object.freeze({ from: 0.022, dilation: 1.5 }),
    Object.freeze({ from: 0.08, dilation: 1 }),
  ]),
});

/** Global time dilation `gameSeconds` after a hostile contact (1 outside the hit-stop). */
export function hitStopDilation(gameSeconds: number): number {
  if (!(gameSeconds >= 0) || gameSeconds >= HIT_STOP.duration) return 1;
  let dilation = 1;
  for (const step of HIT_STOP.steps) if (gameSeconds >= step.from) dilation = step.dilation;
  return dilation;
}

/**
 * The travelling highlight of the preview chain (ULaunchPreviewPathComponent: native defaults, with the
 * 碰撞预览圈 SCS overrides PulsePeakBrightness 1.5, PulseTailLength 500, CircleFlashDuration 0.25). Real time.
 */
export const PREVIEW_PULSE = Object.freeze({
  speed: 1400,
  frontWidth: 70,
  tailLength: 500,
  cycleGap: 0.35,
  baseBrightness: 0.25,
  peakBrightness: 1.5,
  markerFlashDuration: 0.25,
});

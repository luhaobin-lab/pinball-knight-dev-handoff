import { Curve, widgetAnim } from '../core/motion';

/**
 * The Demo's widget animations the combat HUD plays, every key verbatim from
 * D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI/<widget>.json (tick, value, interp, tangents per tick, weights
 * of weighted keys; tests/ui-feel/widget-keys.test.ts compares them with the dump). Translations are widget px at
 * 1920×1080 (× 0.5 on our grid); X and Y scale are one channel where the dump keys them identically.
 */

/** UI_伤害提示.弹出V2 on 背景 (every damage number but 疲劳). */
export const DAMAGE_POP = widgetAnim(0, 120001, {
  dy: [[0, -0.7503379, 'cubic', 0.01391611, 0.01391611], [3000, 15, 'cubic', 0, 0], [10000, -8.683866, 'cubic', -0.002863286, -0.002863286, 'both', 13.111128, 13.111128], [30000, -34.189735, 'cubic', -0.0005107544, -0.0005107544], [90000, -36.926662, 'cubic', 0.00020916572, 0.00020916572], [120000, -30.852493, 'linear', 0.0002024723, 0]],
  scale: [[0, 1.797023, 'cubic', -0.000129, -0.000129], [12000, 1.227398, 'cubic', 0, 0], [18000, 1.290266, 'cubic', 0, 0], [30000, 1, 'cubic', 0, 0], [90000, 1, 'cubic', 0, 0], [120000, 0.973738, 'linear', -8.753995e-7, 0]],
  opacity: [[0, 0, 'cubic', 0, 0], [3000, 1, 'cubic', 0, 0], [96000, 1, 'cubic', 0, 0], [120000, 0, 'linear', -4.1666666e-5, 0]],
});

/** 数值更新 on HorizontalBox_0 (UI_伤害提示 and UI_治疗提示 key it alike): the bump of a merged number. */
export const VALUE_BUMP = widgetAnim(0, 6001, {
  scale: [[0, 1.5, 'cubic', 0, 0], [6000, 1, 'cubic', 0, 0]],
});

/** UI_治疗提示.弹出 on 背景. */
export const HEAL_POP = widgetAnim(0, 102001, {
  dy: [[455, 0, 'cubic', 0.0042962586, 0.0042962586], [7365, 20.494732, 'cubic', 0, 0], [16000, -1.9467795, 'cubic', -0.0027599968, -0.0027599968], [82000, -9.159504, 'cubic', 0.0019046739, 0.0019046739], [102000, 30, 'linear', 0.001957975, 0]],
  scale: [[455, 0.7264877, 'cubic', 4.4870998e-5, 4.4870998e-5], [14275, 1.0799526, 'cubic', 1.54702e-5, 1.54702e-5], [21185, 1.1512187, 'cubic', 0, 0], [35005, 1, 'cubic', 0, 0], [82000, 1, 'cubic', 0, 0], [102000, 0.9574716, 'cubic', -3.5569951e-6, -3.5569951e-6]],
  opacity: [[455, 0, 'cubic', 0, 0], [7365, 1, 'cubic', 0, 0], [88466, 1, 'cubic', 0, 0], [98831, 0, 'linear', -9.6478536e-5, 0]],
});

/** UI_充能提示.向上弹出 / 向下弹出 on 背景 (one scale and opacity; the translations differ, not only in sign). */
const CHARGE_SCALE = [[0, 0.7264877, 'cubic', 4.4870998e-5, 4.4870998e-5], [9567, 1.0799526, 'cubic', 3.040766e-5, 3.040766e-5], [14351, 1.162868, 'cubic', 0, 0], [23920, 1.0331287, 'cubic', -1.21420235e-5, -1.21420235e-5], [47839, 0.872749, 'cubic', -2.3991458e-6, -2.3991458e-6], [59799, 0.84634, 'linear', -2.2081078e-6, 0]] as const;
const CHARGE_OPACITY = [[0, 0, 'cubic', 0, 0], [4784, 1, 'cubic', 0, 0], [52623, 1, 'cubic', 0, 0], [59799, 0, 'linear', -0.0001393534, 0.00015465512]] as const;
export const CHARGE_UP = widgetAnim(0, 64584, {
  dy: [[0, 0, 'cubic', -0.0077181933, -0.0077181933], [7176, -38.886177, 'cubic', -0.0023010059, -0.0023010059], [59799, -79.92856, 'cubic', 0, 0]],
  scale: CHARGE_SCALE,
  opacity: CHARGE_OPACITY,
});
export const CHARGE_DOWN = widgetAnim(0, 64584, {
  dy: [[0, 0, 'cubic', 0.009847694, 0.009847694], [7176, 38.886177, 'cubic', 0.0023266778, 0.0023266778], [59799, 79.92856, 'cubic', 0, 0]],
  scale: CHARGE_SCALE,
  opacity: CHARGE_OPACITY,
});

/** UI_拾取提示.向下弹出 on 背景: 增加经验 creates its "+{0}经验" with 向上/向下 = true. */
export const PICKUP_DOWN = widgetAnim(0, 90202, {
  dy: [[0, 0, 'cubic', 0.0022769743, 0.0022769743], [90000, 79.92856, 'cubic', 0, 0]],
  scale: [[0, 0.85289645, 'cubic', 4.4870998e-5, 4.4870998e-5], [9000, 1.2063613, 'cubic', 2.9092018e-5, 2.9092018e-5], [15000, 1.2892767, 'cubic', 0, 0], [24000, 1.1595374, 'cubic', -1.3148941e-5, -1.3148941e-5], [48000, 1, 'cubic', 0, 0], [90201, 1, 'linear', 0, 0]],
  opacity: [[0, 0, 'cubic', 0, 0], [4784, 1, 'cubic', 0, 0], [52623, 1, 'cubic', 0, 0], [90000, 0, 'linear', -2.6754422e-5, 0.00015465512]],
});

/** UI_主界面.回合统计出现 on 回合统计 (RenderTransformPivot 0.8, 0.1): fade in and a 1.1 pop (X and Y keyed apart). */
export const STATS_APPEAR = widgetAnim(0, 15044, {
  opacity: [[142, 0, 'cubic', 0.00033413823, 0.00033413823], [5973, 1, 'cubic', 0, 0], [15043, 0.99986345, 'cubic', 0, 0]],
  scaleX: [[0, 1, 'cubic', 2.1617665e-5, 2.1617665e-5], [5933, 1.1, 'cubic', 0, 0], [15001, 1, 'cubic', 0, 0]],
  scaleY: [[0, 1, 'cubic', 3.1050826e-5, 3.1050826e-5], [5933, 1.1, 'cubic', 0, 0], [15001, 1, 'cubic', 0, 0]],
});

/** UI_主界面.回合统计结束 on 回合统计: full for 1 s, gone by 3 s. */
export const STATS_END = widgetAnim(0, 179953, {
  opacity: [[0, 1, 'cubic', 0, 0], [60184, 1, 'cubic', 0, 0], [179952, 0, 'cubic', 0, 0]],
});

/**
 * UI_主界面.评级更新: the rank image (评级图片切换, pivot 0.5, 0.5) drops from −12 and shrinks from 1.2, the rule
 * (Image) and its shadow (Image_84, pivot 0.8, 0.5) shrink in X from 1.1. (评级文本 is Collapsed.)
 */
export const RANK_UPDATE = widgetAnim(0, 12034, {
  rankDy: [[0, -12, 'cubic', 0, 0], [12033, 0, 'cubic', 0, 0]],
  rankScale: [[0, 1.2, 'cubic', 0, 0], [12000, 1, 'cubic', 0, 0]],
  ruleScaleX: [[0, 1.1, 'cubic', 0, 0], [12033, 1, 'cubic', 0, 0]],
});

/**
 * UI_回合统计词条.更新闪烁 (played by 激活词条 and 更新词条): the flash bar Image_30 (pivot 1, 0) wipes in from the
 * right and fades; the line (HorizontalBox, pivot 0.5, 1) swells in Y.
 */
export const ROW_FLASH = widgetAnim(-19, 59956, {
  barScaleX: [[19, 0, 'cubic', 0.00031663995, 0.00031663995], [6015, 1, 'cubic', 0, 0], [18190, 1, 'cubic', 0, 0], [59809, 0.9, 'cubic', 0, 0]],
  barAlpha: [[124, 0, 'cubic', 0, 0], [5872, 1, 'cubic', 0, 0], [18553, 1, 'cubic', 0, 0], [59735, 0, 'cubic', 0, 0]],
  rowScaleY: [[-19, 1, 'cubic', 0, 0], [5940, 1.1, 'cubic', 0, 0], [18134, 1, 'cubic', 0, 0], [59766, 1, 'cubic', 0, 0]],
});

/** UI_意图提示.浮动 on Overlay_1 (looping): 4-unit steps, held (constant keys). */
export const INTENT_BOB = widgetAnim(0, 180001, {
  dy: [[0, 0, 'constant', 0, 0], [30000, -4, 'constant', -0.00013333333, -0.00013333333], [60000, -8, 'constant', 0, 0], [90000, -12, 'constant', 0, 0], [120000, -8, 'constant', 0, 0], [150000, -4, 'constant', 0.00013333333, 0.00013333333], [180000, 0, 'cubic', 0, 0]],
});

/** 曲线表 rows (D:/TAPTAPGAME_ref/dump/curves/CatapultHero/BP/曲线表.json). */
export const CURVES = {
  /** UI_伤害提示.位移提示, read at 位移计数 (+dt per Tick). */
  damagePath: Curve.table([
    [0, 0, 3.1294277, 3.1294277],
    [0.4196742, 0.91411453, 0.6752879, 0.6752879],
    [1, 1, 0, 0.003849011],
  ]),
  /** UI_治疗提示 / UI_充能提示 / UI_拾取提示.位移提示, read at 位移计数 (+dt × 0.5 per Tick). */
  recoverPath: Curve.table([
    [0, -2.0134259e-8, 2.1319714, 2.1319714],
    [1, 1, 0, 0],
  ]),
  /** UI_头顶状态条.切换可视: the bar's alpha from 透明度计数. */
  barShow: Curve.table([
    [0, 0, 2.7372649, 0],
    [1, 1, 0, -3.262234],
  ]),
} as const;

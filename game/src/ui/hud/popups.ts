import { createRng, type Rng } from '../../core/rng';
import type { Rgba } from '../core/color';
import { animLength, sample, type Curve, type WidgetAnim } from '../core/motion';
import { Surface } from '../core/surface';
import { abbreviate } from '../text/abbrev';
import { digitsWidth, drawDigits } from '../text/digits';
import type { TextFont } from '../text/font';
import { CRIT_ICON, drawMask, teenMask, type TeenSize } from '../text/teen';
import { BONE, DANGER, INK, SAPPHIRE, WEAK } from '../style/palette';
import { CHARGE_DOWN, CHARGE_UP, CURVES, DAMAGE_POP, HEAL_POP, PICKUP_DOWN, VALUE_BUMP } from './anims';
import { popupBounds, SCREEN, type Bounds } from './layout';

/**
 * Number popups of the TIPS canvas (screen space, so they never shake): UI_伤害提示, UI_治疗提示, UI_充能提示 and
 * UI_拾取提示. A popup appears after its 序号 delay, plays its widget animation (src/ui/hud/anims.ts, the dumped keys)
 * and drifts from 起始坐标 toward its 位移提示 target. A popup with an owner merges like 提示简化处理: a later one of
 * the same owner and skill adds its value and plays 数值更新. Everything runs on the HUD's clock: real time, never
 * slowed by the hit-stop (UMG ignores global time dilation).
 */
export type PopupKind =
  /** Damage dealt to an enemy (bone). */
  | 'damage'
  /** A weak-point hit (是弱点？): the 27-pt numerals in the weak colour. */
  | 'weak'
  /** A critical hit (是暴击？): the 27-pt numerals and 会心图标. */
  | 'crit'
  /** Damage the hero takes (玩家, danger red). */
  | 'hurt'
  /** Damage over time ticks (流血 / 燃烧 / 剧毒, danger red with the word). */
  | 'dot'
  /** HP gained (BP_ManeActor.获得治疗 on any character, "+{0}生命"): sapphire on the hero, danger red on an enemy. */
  | 'heal'
  /** Stamina gained or lost (体力, sapphire). */
  | 'stamina'
  /** Charge added to a card (UI_充能提示 "+{0}"; with the prefix 灌注 it reads 灌注+{0}). */
  | 'charge'
  /** EXP from a kill (增加经验 → UI_拾取提示 "+{0}经验"), sapphire: the hero's resource; it starts at the hero (经验来源). */
  | 'exp';

/** A point in HUD-layer px. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

interface PopupFields {
  value: number;
  /** Word before the number in the pixel font (流血 / 燃烧 / 剧毒 for damage over time, 灌注 for charge). */
  prefix?: string;
  /** Word after the number; a heal defaults to 生命 ("+{0}生命"), armour gained reads 强固 ("+{0}强固"). */
  suffix?: string;
  /**
   * 拥有者 of the popup: the damaged character (目标角色, UI_伤害提示) or the healer (释放者, UI_治疗提示). With an
   * owner the HUD numbers the popup itself (序号 = its index among the owner's live popups, unless `stack` is given)
   * and merges it (提示简化处理, 回合伤害来源映射 / 回合治愈来源映射): a later popup of the same owner and `skill` adds its
   * value to the first one (添加数值, which plays 数值更新) instead of showing a new number, until `Popups.clearMerges`
   * (清理提示映射 at 进入战斗状态). The first popup keeps its style (a merged crit stays in the first hit's face).
   */
  owner?: string;
  /** 来自技能 of a damage popup (GetDisplayName of the skill): one number per (owner, skill). Heals merge per healer. */
  skill?: string;
  /**
   * 序号, an integer ≥ 0: the popup's index among its character's live popups (目标角色.伤害提示延迟
   * for damage, 释放者.治疗提示延迟 for heals; an entry stays from the request until 2 s after it
   * appears). The popup appears after Fraction(序号 × 0.15) s and fans 48 units further per step (序号 % 12).
   */
  stack?: number;
  /**
   * 旋转 in degrees, turning the fan clockwise from screen-up. Damage: CalculateDirection(−击中点法线)
   * plus a pick of [−30, −20, …, 30] from FRandomStream(来自角色.种子); heals: a pick of [−60, −40, …, 60]
   * from FRandomStream(释放者.种子). A heal from a card fans straight up (the Demo sets 旋转 0).
   */
  angle?: number;
  /**
   * 目标角色.高度 in units (UI_伤害提示 only; 角色配置.属性.高度, e.g. 56 for the hero): the fan vector is
   * (0, 高度 − 48 × (序号 % 12)), so even the first number moves 高度 away from the hit point.
   */
  height?: number;
  /** Charge popups fly up (向上弹出) or down (向下弹出). */
  down?: boolean;
}

/** What a popup shows and how it moves. A heal says whose HP it is: 获得治疗 runs on every character. */
export type PopupContent = (PopupFields & { kind: Exclude<PopupKind, 'heal'> }) | (PopupFields & { kind: 'heal'; hero: boolean });

export type PopupSpec = PopupContent & {
  /** 起始坐标 in HUD-layer px, or how to find it when the popup appears (the Demo projects 击中点位置 after the delay). */
  start: Point | (() => Point);
};

/** A popup's pixels at rest (scale 1) and the pivot of its render transform (the content's centre). */
interface Art {
  readonly text: string;
  readonly surface: Surface;
  readonly cx: number;
  readonly cy: number;
}

export type Popup = PopupContent & {
  /** Seconds since the request. */
  age: number;
  /** Seconds before it appears: Fraction(序号 × 0.15) (UI_充能提示 and UI_拾取提示 appear at once). */
  readonly delay: number;
  /** 位移提示's vector (0, y) in widget units and the angle GetRotated2D turns it by. */
  readonly fan: { readonly y: number; readonly angle: number };
  /** 起始坐标, fixed when the popup appears. */
  origin: Point | null;
  readonly locate: () => Point;
  /** Seconds since 数值更新 last started (a merge), or null. */
  bump: number | null;
  art?: Art;
};

/** One of the popup widgets. */
interface Widget {
  readonly anim: WidgetAnim<'dy' | 'scale' | 'opacity'>;
  /** 位移提示's progress: a 曲线表 row read at 位移计数, which the widget's Tick advances by dt × `rate`. */
  readonly path: Curve;
  readonly rate: number;
  /** Whether the target is FClamped to `popupBounds`. */
  readonly clamp: boolean;
  /**
   * Seconds from appearing to leaving the list: the Delay(2.0) of UI_伤害提示 / UI_治疗提示 (which also drops the
   * 序号 entry); the end of the animation for UI_充能提示 / UI_拾取提示, transparent from then on and unnumbered.
   */
  readonly life: number;
}

/** UI_伤害提示: 弹出V2 (every damage number except 疲劳), 伤害提示曲线 at dt × 1, clamped. */
const DAMAGE: Widget = { anim: DAMAGE_POP, path: CURVES.damagePath, rate: 1, clamp: true, life: 2 };
/** UI_治疗提示: 弹出, 恢复提示曲线 at dt × 0.5, clamped. */
const HEAL: Widget = { anim: HEAL_POP, path: CURVES.recoverPath, rate: 0.5, clamp: true, life: 2 };
/** UI_充能提示: 向上弹出 / 向下弹出, 恢复提示曲线 at dt × 0.5, not clamped. */
const CHARGE_UP_W: Widget = { anim: CHARGE_UP, path: CURVES.recoverPath, rate: 0.5, clamp: false, life: animLength(CHARGE_UP) };
const CHARGE_DOWN_W: Widget = { anim: CHARGE_DOWN, path: CURVES.recoverPath, rate: 0.5, clamp: false, life: animLength(CHARGE_DOWN) };
/** UI_拾取提示: 向下弹出 (增加经验 asks for 向下), 恢复提示曲线 at dt × 0.5, not clamped. */
const PICKUP: Widget = { anim: PICKUP_DOWN, path: CURVES.recoverPath, rate: 0.5, clamp: false, life: animLength(PICKUP_DOWN) };

/** How the number is set: the Teen numerals (UI_伤害提示), the HUD's 7-px digits, or the pixel font for the whole text. */
type Face = { readonly kind: 'teen'; readonly size: TeenSize } | { readonly kind: 'digits' } | { readonly kind: 'font' };

interface Style {
  readonly color: Rgba;
  readonly face: Face;
}

const TEEN_18PT: Face = { kind: 'teen', size: 13 };
const TEEN_27PT: Face = { kind: 'teen', size: 18 };

// UI_伤害提示.更新文本内容: Teen 18 pt, 27 pt for 是暴击？ or 是弱点？; the colours are the palette's.
// SPEC-GAP: damage over time and 体力 use 天狼星10px at 22.5 pt there; here the word is the pixel font, the number Teen
const STYLE: Record<Exclude<PopupKind, 'heal'>, Style> = {
  damage: { color: BONE.base, face: TEEN_18PT },
  weak: { color: WEAK, face: TEEN_27PT },
  crit: { color: BONE.base, face: TEEN_27PT },
  hurt: { color: DANGER.base, face: TEEN_18PT },
  dot: { color: DANGER.base, face: TEEN_18PT },
  stamina: { color: SAPPHIRE.light, face: TEEN_18PT },
  charge: { color: BONE.dim, face: { kind: 'digits' } },
  exp: { color: SAPPHIRE.light, face: { kind: 'font' } },
};

/** A heal is the colour of the HP it adds: the hero's sapphire, or an enemy's red. */
const HEAL_STYLE = { hero: { color: SAPPHIRE.light, face: { kind: 'digits' } }, enemy: { color: DANGER.base, face: { kind: 'digits' } } } as const;

function styleOf(p: PopupContent): Style {
  if (p.kind === 'heal') return p.hero ? HEAL_STYLE.hero : HEAL_STYLE.enemy;
  return STYLE[p.kind];
}

function widgetOf(p: PopupContent): Widget {
  if (p.kind === 'heal') return HEAL;
  if (p.kind === 'charge') return p.down ? CHARGE_DOWN_W : CHARGE_UP_W;
  if (p.kind === 'exp') return PICKUP;
  return DAMAGE;
}

/** Which 序号 list and merge map a popup belongs to: UI_伤害提示's, UI_治疗提示's, or none. */
function familyOf(p: PopupContent): 'damage' | 'heal' | null {
  if (p.kind === 'heal') return 'heal';
  return p.kind === 'charge' || p.kind === 'exp' ? null : 'damage';
}

/**
 * 提示简化处理's key: the owner's 回合伤害来源映射 by GetDisplayName(来自技能) (a missing skill is "None", one key), or
 * the healer's 回合治愈来源映射 / 回合强固来源映射 by the healer itself.
 */
function mergeKey(p: PopupContent): string | null {
  const family = familyOf(p);
  if (family === null || p.owner === undefined) return null;
  return family === 'damage' ? `damage|${p.owner}|${p.skill ?? ''}` : `heal|${p.owner}|${p.suffix ?? '生命'}`;
}

/** 位移提示's vector before rotation: GetRotated2D((0, y), 旋转) is added to 起始坐标. */
function fanOf(c: PopupContent, stack: number, rng: Rng): Popup['fan'] {
  if (c.kind === 'charge') {
    // UI_充能提示: (0, ∓RandomFloatInRange(0, 50)) turned by RandomFloatInRange(−45, 45)
    const r = rng.range(0, 50);
    return { y: (c.down ? 1 : -1) * r, angle: rng.range(-45, 45) };
  }
  if (c.kind === 'exp') {
    // UI_拾取提示 with 向上/向下 = true: (0, +RandomFloatInRange(20, 100)) turned by RandomFloatInRange(−45, 45)
    const r = rng.range(20, 100);
    return { y: r, angle: rng.range(-45, 45) };
  }
  const step = -48 * (stack % 12);
  // UI_治疗提示: FTrunc(−48 × (序号 % 12)); UI_伤害提示 adds 目标角色.高度
  return { y: c.kind === 'heal' ? step : step + (c.height ?? 0), angle: c.angle ?? 0 };
}

/** Delay(Fraction(序号 × 0.15)) before UI_伤害提示 / UI_治疗提示 are added to TIPS. */
function delayOf(c: PopupContent, stack: number): number {
  if (familyOf(c) === null) return 0;
  const v = stack * 0.15;
  return v - Math.floor(v);
}

/** The live popups; `update` ages them, fixes 起始坐标 when they appear and retires them. Pure model (no DOM). */
export class Popups {
  readonly list: Popup[] = [];
  /** 提示简化处理's maps. An entry outlives its popup until cleared, as in the Demo: a merge into a retired number is lost. */
  private readonly merged = new Map<string, Popup>();

  /** `rng` draws UI_充能提示's and UI_拾取提示's drift (an unseeded RandomFloatInRange in the Demo). */
  constructor(private readonly rng: Rng = createRng('ui-popups')) {}

  /** Shows a popup, or adds its value to the owner's earlier one (添加数值); returns the popup that shows it. */
  spawn(spec: PopupSpec): Popup {
    const key = mergeKey(spec);
    const into = key === null ? undefined : this.merged.get(key);
    if (into) {
      into.value += spec.value;
      into.bump = 0;
      return into;
    }
    const { start, ...content } = spec;
    const locate = typeof start === 'function' ? start : (): Point => start;
    const stack = content.stack ?? (content.owner === undefined ? 0 : this.liveCount(content));
    const delay = delayOf(content, stack);
    const p: Popup = { ...content, stack, age: 0, delay, fan: fanOf(content, stack, this.rng), origin: delay > 0 ? null : locate(), locate, bump: null };
    this.list.push(p);
    if (key !== null) this.merged.set(key, p);
    return p;
  }

  /** 清理提示映射 (进入战斗状态): every later popup starts a new number. */
  clearMerges(): void {
    this.merged.clear();
  }

  /** Array_AddUnique's index in the owner's 伤害提示延迟 / 治疗提示延迟: its live popups of the same widget. */
  private liveCount(c: PopupContent): number {
    const family = familyOf(c);
    return this.list.filter(p => p.owner === c.owner && familyOf(p) === family).length;
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.age += dt;
      if (p.bump !== null) p.bump += dt;
      if (!p.origin && p.age >= p.delay) p.origin = p.locate();
    }
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].age - this.list[i].delay >= widgetOf(this.list[i]).life) this.list.splice(i, 1);
  }

  get active(): boolean {
    return this.list.length > 0;
  }
}

export interface PopupView {
  /** The content's centre (the pivot of 背景's render transform) in HUD-layer px. */
  x: number;
  y: number;
  /** 弹出's scale × 数值更新's (UMG scales the pixel font; drawn nearest-neighbour). */
  scale: number;
  opacity: number;
  text: string;
}

/** The number as 更新文本内容 sets it: 科学数字缩写 with 2 decimals for damage and heals, whole for charge, stamina and EXP. */
function textOf(p: PopupContent): string {
  if (p.kind === 'exp') return `+${Math.trunc(p.value)}经验`;
  const whole = p.kind === 'charge' || p.kind === 'stamina';
  const digits = abbreviate(p.value, whole ? 0 : 2);
  const gain = whole || p.kind === 'heal';
  return gain && p.value >= 0 ? `+${digits}` : digits;
}

/** Where a popup is drawn at its age inside `bounds` (null before it appears). */
export function popupState(p: Popup, bounds: Bounds): PopupView | null {
  const age = p.age - p.delay;
  const o = p.origin;
  if (age < 0 || !o) return null;
  const w = widgetOf(p);
  const k = SCREEN.scale;
  // 位移提示: target = 起始坐标 + GetRotated2D((0, y), 旋转) = (−sin·y, cos·y), FClamped; the Tick
  // eases 起始坐标 → target by the curve (Ease, linear)
  const rad = (p.fan.angle * Math.PI) / 180;
  let tx = o.x - Math.sin(rad) * p.fan.y * k;
  let ty = o.y + Math.cos(rad) * p.fan.y * k;
  if (w.clamp) {
    tx = Math.min(bounds.x1, Math.max(bounds.x0, tx));
    ty = Math.min(bounds.y1, Math.max(bounds.y0, ty));
  }
  const a = w.path.at(age * w.rate);
  const bump = p.bump === null ? 1 : sample(VALUE_BUMP, 'scale', p.bump);
  return {
    x: o.x + (tx - o.x) * a,
    y: o.y + (ty - o.y) * a + sample(w.anim, 'dy', age) * k,
    scale: sample(w.anim, 'scale', age) * bump,
    opacity: Math.max(0, Math.min(1, sample(w.anim, 'opacity', age))),
    text: textOf(p),
  };
}

/** One element of a popup's row: its ink box and how to draw it with the box's top-left at (x, y). */
interface Part {
  readonly w: number;
  readonly h: number;
  draw(s: Surface, x: number, y: number): void;
}

/** 会心图标's right padding (6 widget px). */
const ICON_GAP = 3;
/** Room for the rings and the shadow around the parts. */
const PAD = 2;

/** The number in its face: the Teen numerals or the HUD's 7-px digits. */
function numberPart(face: Exclude<Face, { kind: 'font' }>, text: string, c: Rgba): Part {
  if (face.kind === 'digits') return { w: digitsWidth(text, 7), h: 7, draw: (s, x, y) => drawDigits(s, text, x, y, 7, { color: c, outline: INK.deep }) };
  const m = teenMask(text, face.size);
  return { w: m.w, h: m.h, draw: (s, x, y) => drawMask(s, m, x, y, c, INK.deep) };
}

function parts(p: Popup, text: string, font: TextFont): { parts: Part[]; gaps: number[] } {
  const { color: c, face } = styleOf(p);
  if (face.kind === 'font') {
    // UI_拾取提示.文本: 天狼星10px with the outline and a (3, 3) shadow; 1.5 px here, so 1
    const line: Part = {
      w: font.measure(text) + 1,
      h: font.line + 1,
      draw: (s, x, y) => {
        font.draw(s, text, x + 1, y + 1, { color: INK.deep, outline: INK.deep });
        font.draw(s, text, x, y, { color: c, outline: INK.deep });
      },
    };
    return { parts: [line], gaps: [] };
  }
  const word = (t: string): Part => ({ w: font.measure(t), h: font.line, draw: (s, x, y) => font.draw(s, t, x, y, { color: c, outline: INK.deep }) });
  const out: Part[] = [];
  const gaps: number[] = [];
  if (p.kind === 'crit') {
    out.push({ w: CRIT_ICON.w, h: CRIT_ICON.h, draw: (s, x, y) => drawMask(s, CRIT_ICON, x, y, c, INK.deep) });
    gaps.push(ICON_GAP);
  }
  if (p.prefix) {
    out.push(word(p.prefix));
    gaps.push(1);
  }
  out.push(numberPart(face, text, c));
  const suffix = p.suffix ?? (p.kind === 'heal' ? '生命' : undefined);
  if (suffix) {
    gaps.push(1);
    out.push(word(suffix));
  }
  return { parts: out, gaps };
}

/** The popup at rest: its parts in a row, centred on one line (HorizontalBox_0, VAlign Center). */
function artOf(p: Popup, text: string, font: TextFont): Art {
  if (p.art?.text === text) return p.art;
  const { parts: row, gaps } = parts(p, text, font);
  const w = row.reduce((n, q) => n + q.w, 0) + gaps.reduce((n, g) => n + g, 0);
  const h = Math.max(...row.map(q => q.h));
  const surface = new Surface(w + 2 * PAD, h + 2 * PAD);
  let x = PAD;
  row.forEach((q, i) => {
    q.draw(surface, x, PAD + Math.floor((h - q.h) / 2));
    x += q.w + (gaps[i] ?? 0);
  });
  p.art = { text, surface, cx: PAD + w / 2, cy: PAD + h / 2 };
  return p.art;
}

export function drawPopups(s: Surface, font: TextFont, list: readonly Popup[]): void {
  const bounds = popupBounds(s.w, s.h);
  for (const p of list) {
    const v = popupState(p, bounds);
    if (!v || v.opacity <= 0) continue;
    const a = artOf(p, v.text, font);
    // the transform pivots on the content's centre; at scale 1 the art lands on whole pixels
    const x = v.x - a.cx * v.scale;
    const y = v.y - a.cy * v.scale;
    s.blitScaled(a.surface, v.scale === 1 ? Math.round(x) : x, v.scale === 1 ? Math.round(y) : y, v.scale, v.scale, v.opacity);
  }
}

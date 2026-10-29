import { animLength, sample } from '../core/motion';
import { Surface } from '../core/surface';
import type { TextFont } from '../text/font';
import { BONE, INK } from '../style/palette';
import { ink, R, type P, type Pen } from '../icons/pen';
import { RANK_UPDATE, ROW_FLASH, STATS_APPEAR, STATS_END } from './anims';
import { SCREEN, screenRect, TURN_STATS } from './layout';
import type { Rank, TurnStats } from './state';

/**
 * 回合统计: the rank letter (评级图片切换, one image per rank, filled bottom-to-top by a
 * ProgressBar), the bone rule (Image 240×3 at 86, its shadow at 88) and the stat lines
 * (UI_回合统计词条: value, then the label in a 120-unit box, right-aligned) from 96 down.
 * SPEC-GAP: the rank art (营地格_Sprite_27…40) is sprites without pixels: procedural engraved letters
 * in the per-rank boxes; ss4/ss6 (older build) place the block ~36 px further in; the dump wins.
 *
 * It moves like the Demo (蓝图_动作游戏模式.更新回合战斗统计, UI_回合统计词条): the launch's first scored event plays
 * 回合统计出现 on new lines, every later one 评级更新; each line an event touches plays 更新闪烁; 回合统计结束 fades the
 * block when the round ends. Every animation runs on the HUD's real-time clock and keeps its last state (UMG).
 */

/** Per-rank image size and top padding in widget units (the WidgetSwitcher's SizeBoxes). */
const RANK_BOX: Record<Rank, { w: number; h: number; top: number }> = {
  D: { w: 99, h: 102, top: -17 },
  C: { w: 87, h: 99, top: -17 },
  B: { w: 84, h: 105, top: -23 },
  A: { w: 99, h: 105, top: -23 },
  S: { w: 93, h: 111, top: -29 },
  SS: { w: 141, h: 111, top: -29 },
  SSS: { w: 177, h: 111, top: -29 },
};

/** Points of an arc (degrees, y up), for stroked letters. */
function arc(cx: number, cy: number, r: number, from: number, to: number, n = 16): P[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as P;
  });
}

function path(p: Pen, pts: readonly P[], width: number): void {
  for (let i = 1; i < pts.length; i++) p.stroke(pts[i - 1], pts[i], width, R.Body);
}

const W = 5;
/** Engraved capitals: strokes of width W with short serifs at the free ends. */
const LETTERS: Record<'D' | 'C' | 'B' | 'A' | 'S', (p: Pen) => void> = {
  D: p => {
    path(p, [[9, 4], [9, 28]], W);
    path(p, [[5, 4], [12, 4], ...arc(12, 16, 12, 90, -90), [5, 28]], W);
  },
  C: p => {
    path(p, arc(17, 16, 11.5, 55, 305, 20), W);
    path(p, [[23.5, 6], [24, 11]], W - 1);
    path(p, [[23.5, 26], [24, 21]], W - 1);
  },
  B: p => {
    path(p, [[9, 4], [9, 28]], W);
    path(p, [[5, 4], [15, 4], ...arc(15, 10, 6, 90, -90), [9, 16]], W);
    path(p, [[9, 16], [16, 16], ...arc(16, 22, 6, 90, -90), [5, 28]], W);
  },
  A: p => {
    path(p, [[16, 3], [7, 28]], W);
    path(p, [[16, 3], [25, 28]], W);
    path(p, [[3.5, 28], [10.5, 28]], W - 1);
    path(p, [[21.5, 28], [28.5, 28]], W - 1);
    path(p, [[10, 19.5], [22, 19.5]], W - 1);
  },
  S: p => {
    path(p, [...arc(16, 9.5, 6.5, 35, 270, 14), ...arc(16, 22.5, 6.5, 90, -145, 14)], W);
    path(p, [[21.3, 5.8], [22.5, 10]], W - 1);
    path(p, [[10.7, 26.2], [9.5, 22]], W - 1);
  },
};

/**
 * One letter `h` px tall: its lower `fill` part bone with a dim lower edge (engraved), the rest
 * faint (the rank's progress, ProgressBar BottomToTop).
 */
function letter(ch: keyof typeof LETTERS, h: number, fill: number): Surface {
  const level = 1 - Math.max(0, Math.min(1, fill));
  const s = ink(
    h,
    h,
    p => {
      LETTERS[ch](p);
      p.mask(R.Body, (_x, y) => y >= 2 + 28 * level, R.Shade);
    },
    { 1: BONE.base, 2: BONE.faint, 3: BONE.base, 4: BONE.dim, 5: INK.base },
    INK.deep,
  );
  for (let y = 0; y < s.h - 1; y++) for (let x = 0; x < s.w; x++) if (s.get(x, y) === BONE.base && s.get(x, y + 1) === INK.deep) s.px(x, y, BONE.dim);
  return s;
}

/** The rank image: the first letter full height, repeats smaller (the Demo's "Sss"), right-aligned at `left + w`. */
interface RankArt {
  readonly key: string;
  readonly surface: Surface;
  /** Left edge of the surface relative to the block's right edge (negative). */
  readonly left: number;
}

function rankArt(rank: Rank, progress: number): RankArt {
  const big = Math.round(RANK_BOX[rank].h * SCREEN.scale);
  const letters = [...rank] as (keyof typeof LETTERS)[];
  const placed: { g: Surface; x: number; y: number }[] = [];
  let x = 0;
  for (let i = letters.length - 1; i >= 0; i--) {
    const size = i === 0 ? big : Math.round(big * 0.62);
    x -= i === 0 ? size : Math.round(size * 0.78);
    placed.push({ g: letter(letters[i], size, progress), x, y: big - size });
  }
  const right = Math.max(...placed.map(p => p.x + p.g.w));
  const surface = new Surface(right - x, big);
  for (const p of placed) surface.blit(p.g, p.x - x, p.y);
  return { key: `${rank}:${progress}`, surface, left: x };
}

/** One UI_回合统计词条 and the age of its 更新闪烁 (null when it is not playing). */
interface Row {
  readonly label: string;
  value: string;
  flash: number | null;
}

/** Room around the 400 × 635 block for what animates past it: the rank above, the flash bar and the scaled rank right. */
const MARGIN = { top: 34, right: 16 } as const;
/** 回合统计's RenderTransformPivot (0.8, 0.1) in px of the block. */
const PIVOT = { x: 0.8 * TURN_STATS.slot.size[0] * SCREEN.scale, y: 0.1 * TURN_STATS.slot.size[1] * SCREEN.scale } as const;
/** Image_30's padding (−64 left, −12 right) in px: the flash bar reaches past the line on both sides. */
const BAR_PAD = { left: 64 * SCREEN.scale, right: 12 * SCREEN.scale } as const;
/** The flash bar's left-to-right ramp (Mat_UI_统计词条, 渐变左 0) in steps. */
const RAMP_STEPS = 8;
/** The block's opacity is drawn in steps, so its 2-s fade redraws ~16 times a second rather than every frame. */
const OPACITY_STEPS = 32;

export class TurnStatsPanel {
  private rank: Rank = 'D';
  private progress = 0;
  private rows: Row[] = [];
  /** Seconds since 回合统计出现 / 评级更新 / 回合统计结束 started, or null when not playing. */
  private appear: number | null = null;
  private rankUpdate: number | null = null;
  private end: number | null = null;
  /** 回合统计's RenderOpacity and scale as the animations last set them (UI_主界面 starts it at opacity 0). */
  private opacity = 0;
  private scaleX = 1;
  private scaleY = 1;
  /** 回合战斗统计 is empty: the next event is the launch's first. */
  private fresh = true;
  private art: RankArt | null = null;
  private drawnOpacity = 0;
  private panel = new Surface(1, 1);

  /** Sets the block without animation (the HUD's initial state); null removes it, so the next event brings it in. */
  show(stats: TurnStats | null): void {
    this.appear = this.rankUpdate = this.end = null;
    this.scaleX = this.scaleY = 1;
    if (!stats) {
      this.rows = [];
      this.opacity = 0;
      this.fresh = true;
      return;
    }
    this.take(stats);
    this.rows = stats.lines.map(l => ({ label: l.label, value: l.value, flash: null }));
    this.opacity = 1;
    this.fresh = false;
  }

  /** 进入战斗状态 clears 回合战斗统计: the next event brings the block in with fresh lines. */
  beginLaunch(): void {
    this.fresh = true;
  }

  /**
   * 更新回合战斗统计 after one scored event, `stats` being the new totals: stops 回合统计结束 (the opacity stays where
   * it is), then the launch's first event clears the lines and plays 回合统计出现, a later one 评级更新; every line the
   * event touched (new, or with a new value) plays 更新闪烁.
   */
  event(stats: TurnStats): void {
    this.end = null;
    if (this.fresh) {
      this.rows = [];
      this.appear = 0;
    } else this.rankUpdate = 0;
    this.fresh = false;
    this.take(stats);
    for (const line of stats.lines) {
      const row = this.rows.find(r => r.label === line.label);
      if (!row) this.rows.push({ label: line.label, value: line.value, flash: 0 });
      else if (row.value !== line.value) {
        row.value = line.value;
        row.flash = 0;
      }
    }
  }

  /** 回合统计结束 (退出战斗状态): full for 1 s, gone by 3 s. */
  finish(): void {
    this.end = 0;
  }

  private take(stats: TurnStats): void {
    this.rank = stats.rank;
    this.progress = stats.progress;
  }

  /** Advances the animations; true when the block must be redrawn. */
  update(dt: number): boolean {
    let moving = false;
    if (this.appear !== null) {
      this.appear += dt;
      this.opacity = sample(STATS_APPEAR, 'opacity', this.appear);
      this.scaleX = sample(STATS_APPEAR, 'scaleX', this.appear);
      this.scaleY = sample(STATS_APPEAR, 'scaleY', this.appear);
      moving = true;
      if (this.appear >= animLength(STATS_APPEAR)) this.appear = null;
    }
    if (this.end !== null) {
      this.end += dt;
      this.opacity = sample(STATS_END, 'opacity', this.end);
      if (this.end >= animLength(STATS_END)) this.end = null;
    }
    if (this.rankUpdate !== null) {
      this.rankUpdate += dt;
      moving = true;
      if (this.rankUpdate >= animLength(RANK_UPDATE)) this.rankUpdate = null;
    }
    for (const r of this.rows) {
      if (r.flash === null) continue;
      r.flash += dt;
      moving = true;
      if (r.flash >= animLength(ROW_FLASH)) r.flash = null;
    }
    return moving || this.quantized() !== this.drawnOpacity;
  }

  private quantized(): number {
    return Math.round(Math.max(0, Math.min(1, this.opacity)) * OPACITY_STEPS) / OPACITY_STEPS;
  }

  /** Draws the block on a design frame `w` × `h` px. */
  draw(s: Surface, font: TextFont, w: number, h: number): void {
    this.drawnOpacity = this.quantized();
    if (this.drawnOpacity <= 0 || this.rows.length === 0) return;
    const box = screenRect(TURN_STATS.slot, w, h);
    if (this.panel.w !== box.w + MARGIN.right || this.panel.h !== box.h + MARGIN.top) this.panel = new Surface(box.w + MARGIN.right, box.h + MARGIN.top);
    const panel = this.panel;
    panel.clear();
    this.drawContent(panel, font, box.w, MARGIN.top);
    // 回合统计出现's scale about the pivot, then the block's opacity
    const px = box.x + PIVOT.x;
    const py = box.y + PIVOT.y;
    s.blitScaled(panel, px + (box.x - px) * this.scaleX, py + (box.y - MARGIN.top - py) * this.scaleY, this.scaleX, this.scaleY, this.drawnOpacity);
  }

  /** The block's content with its right edge at `right` and its top at `top` of `s`. */
  private drawContent(s: Surface, font: TextFont, right: number, top: number): void {
    const k = SCREEN.scale;
    const t = this.rankUpdate;
    const rb = RANK_BOX[this.rank];
    if (this.art?.key !== `${this.rank}:${this.progress}`) this.art = rankArt(this.rank, this.progress);
    const art = this.art;
    // 评级更新: the image (pivot: the centre of the switcher, which the padding shortens) drops and shrinks into place
    const rs = t === null ? 1 : sample(RANK_UPDATE, 'rankScale', t);
    const dy = t === null ? 0 : sample(RANK_UPDATE, 'rankDy', t) * k;
    const cx = right - (rb.w * k) / 2;
    const cy = top + ((rb.h + rb.top) * k) / 2;
    const ax = right + art.left;
    const ay = top + Math.round(rb.top * k);
    s.blitScaled(art.surface, cx + (ax - cx) * rs, cy + (ay - cy) * rs + dy, rs, rs);
    // the 240-unit rule and its shadow (Padding Right −2), scaled in X about 0.8 of their width
    const ruleW = TURN_STATS.ruleWidth * k;
    const sx = t === null ? 1 : sample(RANK_UPDATE, 'ruleScaleX', t);
    const rule = (r: number, y: number, c: number): void => {
      const pivot = r - 0.2 * ruleW;
      const x0 = Math.round(pivot - 0.8 * ruleW * sx);
      s.fill(x0, y, Math.round(pivot + 0.2 * ruleW * sx) - x0, 1, c);
    };
    rule(right, top + Math.round(TURN_STATS.ruleTop * k), BONE.base);
    rule(right + 1, top + Math.round((TURN_STATS.ruleTop + 2) * k), INK.deep);
    // the stat lines, 16 px apart (the 24-pt line is taller than the 30-unit boxes)
    const labelW = Math.round(TURN_STATS.labelWidth * k);
    const gap = Math.round(TURN_STATS.valueGap * k);
    this.rows.forEach((row, i) => {
      const y = top + Math.round(TURN_STATS.linesTop * k) + i * font.line;
      const left = right - labelW - gap - font.measure(row.value);
      if (row.flash !== null) flashBar(s, left - BAR_PAD.left, right + BAR_PAD.right, y, font.line, row.flash);
      const sy = row.flash === null ? 1 : sample(ROW_FLASH, 'rowScaleY', row.flash);
      const line = new Surface(right + 2, font.line + 2);
      font.draw(line, row.label, right - font.measure(row.label), 1, { color: BONE.dim, outline: INK.deep });
      font.draw(line, row.value, left, 1, { color: BONE.base, outline: INK.deep });
      // HorizontalBox's pivot (0.5, 1): the line swells upward from its bottom
      const bottom = y + font.line;
      s.blitScaled(line, 0, bottom + (y - 1 - bottom) * sy, 1, sy);
    });
  }
}

/**
 * Image_30 (Mat_UI_统计词条 tinted bone, translucent): a bar `x0`..`x1` × `h` behind a line whose alpha ramps up
 * from its left end, wiping in from the right (scale X about its right edge) and fading (更新闪烁).
 */
function flashBar(s: Surface, x0: number, x1: number, y: number, h: number, age: number): void {
  const alpha = sample(ROW_FLASH, 'barAlpha', age);
  const w = (x1 - x0) * sample(ROW_FLASH, 'barScaleX', age);
  if (alpha <= 0 || w <= 0) return;
  const left = x1 - w;
  for (let x = Math.floor(left); x < Math.ceil(x1); x++) {
    const u = (x + 0.5 - left) / w;
    if (u < 0 || u > 1) continue;
    const level = (Math.min(RAMP_STEPS - 1, Math.floor(u * RAMP_STEPS)) + 0.5) / RAMP_STEPS;
    s.fill(x, y, 1, h, BONE.base, level * alpha);
  }
}

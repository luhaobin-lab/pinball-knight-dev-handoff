import type { LaunchPreview, Vec2 } from '../core/launch/index.ts';
import { arcPixels, CHEVRON_SPAN, chevronStamp, dashedRingPixels, digitsWidth, LIT_WHITE, odd, Strokes, WHITE, type Pixel, type PixelCanvas } from './overlay';
import { LIT, type PreviewPulse } from './preview-pulse';

/**
 * The aim preview of the Demo's 碰撞预览圈 chain (src/core/launch computeLaunchPreview), drawn flat in the pixel
 * overlay: chevrons along every displayed leg and the terminal leg, and at each leg end the Demo's mark
 * (trajectory-preview TRAJEC-035/038): enemy contact = dashed ring + dot Ø 36 uu, other contact = dot Ø 30 uu +
 * arc toward the obstacle, no contact = dot Ø 30 uu. Every mark takes the one marker tint (提示颜色 #CCC9C4,
 * TRAJEC-036): bone here. ART_BIBLE §8 adds a number at every bounce point (TRAJEC-042: the Demo shows none): it is
 * knocked out of the leg end's dot in ink.
 *
 * The travelling pulse lights the chevrons it passes and flashes each mark (`PreviewPulse`); the rest is bone.
 * Rings, arcs and the hero's box follow the world's size; chevrons, their pitch, the dots and the digits keep their
 * zoom-1 pixel size, so a zoomed view keeps golden 01's continuous ladder. Where marks crowd, a dot moves off its
 * leg end (a small dot stays at the true end), chevrons give way to rings, arcs and dots, a leg that runs back along
 * an earlier one takes its own lane beside it, and nothing is drawn over the hero.
 */

/** Sizes of the Demo's preview, in uu (trajectory-preview §3.6, §8). */
export const PREVIEW_MARKS = Object.freeze({
  /** 指引线 ribbons tile one chevron every 30 uu (TilingLength 30). */
  chevronPitch: 30,
  /** Ribbon width 24 uu: the chevron's span across the line. */
  chevronWidth: 24,
  /** 碰撞圈 生成范围 60: radius of the enemy ring and of the wall arc. */
  ringRadius: 60,
  /** 粒子_有敌人碰撞提示 圆心 Ø 36; 粒子_无敌人碰撞提示 / 粒子_无碰撞提示 圆心 Ø 30. */
  enemyDot: 36,
  dot: 30,
  /** The wall arc spans about 78°, centred toward the wall (measured on ss2: 225°–300°). */
  arcHalfAngle: (39 * Math.PI) / 180,
  /** 粒子_有敌人碰撞提示 圆环: 16 stripes (Mat_FX_条纹 条纹数量 16). */
  ringDashes: 16,
  /** 材质_指引线脉冲_普通 位移速度 (−2, 0): the chevron texture scrolls two tiles a second. */
  scroll: 2,
});

/** A dot that leaves its leg end leaves this small rest-tone dot (px) at the true end. */
const END_DOT = 3;
/** How far (px) a leg that runs back along an earlier one, or a chevron crowding an earlier one, steps aside. */
const LANE = 3;
/** Chevron centres closer than this (px) touch. */
const CROWD = 7;

/** A chevron on a leg: its centre, the unit direction of travel (uu) and its distance along the line. */
export interface Station {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly at: number;
}

/**
 * Chevron centres along a polyline, one per `pitch` of arc length: the centres of the ribbon's texture tiles,
 * which run from the path's first point, moved forward by `offset` (the texture scroll).
 */
export function stations(line: readonly Vec2[], pitch: number, offset = 0): Station[] {
  const out: Station[] = [];
  let next = (((pitch / 2 + offset) % pitch) + pitch) % pitch;
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 0) continue;
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    while (next <= walked + len) {
      const t = next - walked;
      out.push({ x: a.x + dx * t, y: a.y + dy * t, dx, dy, at: next });
      next += pitch;
    }
    walked += len;
  }
  return out;
}

/** Overlay pixels of a floor point given in uu. */
export type ProjectUu = (p: Vec2) => { x: number; y: number };

/** The box the standing hero's sprite covers on screen, in uu from his floor point: the preview leaves it empty. */
export interface HeroBox {
  /** Half its width. */
  readonly halfWidth: number;
  /** How far it reaches up the screen (north of the floor point) and down. */
  readonly up: number;
  readonly down: number;
}

export interface PreviewDrawOptions {
  /** Internal pixels per uu at the current zoom (the world-sized rings, arcs and hero box). */
  readonly pxPerUu: number;
  /** The camera zoom: chevrons, their pitch, the dots and the digits keep their zoom-1 size in pixels. */
  readonly zoom: number;
  /** The hero (uu) and his sprite's box. The Demo draws the hero over the preview; here the preview skips the box. */
  readonly hero: Vec2;
  readonly heroBox: HeroBox;
  readonly pulse: PreviewPulse;
  /** World seconds, for the chevron scroll. */
  readonly time: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** A leg-end mark on screen. */
export interface PlacedMark {
  /** Where the leg ends: the ring's or arc's centre, where the Demo puts the dot. */
  readonly end: Point;
  /** Where its dot sits (a whole pixel): the end, unless that crowds an earlier dot or the hero. */
  readonly pos: Point;
  /** The dot's diameter (odd px, without its 1-px ink rim). */
  readonly diameter: number;
  readonly label: string | null;
}

interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const tone = (level: number): string => (level >= LIT ? LIT_WHITE : WHITE);
const whole = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** The hero's box on screen. */
function heroRect(project: ProjectUu, o: PreviewDrawOptions): Rect {
  const h = project(o.hero);
  const s = o.pxPerUu;
  return { x0: h.x - o.heroBox.halfWidth * s, y0: h.y - o.heroBox.up * s, x1: h.x + o.heroBox.halfWidth * s, y1: h.y + o.heroBox.down * s };
}

/** Distance from p to the rect (0 inside). */
const rectDistance = (r: Rect, p: Point): number => Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.y0 - p.y, 0, p.y - r.y1));

/** The screen direction of floor direction `dir` at floor point `from`. */
function toward(project: ProjectUu, from: Vec2, dir: Vec2): Point {
  const a = project(from);
  const b = project({ x: from.x + dir.x * PREVIEW_MARKS.ringRadius, y: from.y + dir.y * PREVIEW_MARKS.ringRadius });
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

const rotate = (u: Point, degrees: number): Point => {
  const a = (degrees * Math.PI) / 180;
  return { x: u.x * Math.cos(a) - u.y * Math.sin(a), y: u.x * Math.sin(a) + u.y * Math.cos(a) };
};

/** Where a crowded dot may go, in order: [turn from the outgoing leg (°), distance in diameters]. */
const MOVES: readonly (readonly [number, number])[] = [
  ...[0, 60, -60, 120, -120, 180].flatMap(turn => [1, 1.5, 2].map(f => [turn, f] as const)),
  // far enough to clear the hero's box when a bounce point lies on him
  ...[3, 4, 5].flatMap(f => [0, 60, -60, 120, -120, 180].map(turn => [turn, f] as const)),
];

/**
 * Every leg end's dot, with its number when the end is a bounce point. A dot that would crowd an earlier one or
 * the hero moves to the first of these that keeps a 1-px ink gap: 1×, 1.5× and 2× its diameter along the outgoing
 * leg, then the same at ±60°, ±120° and 180° from it, then farther out (the clearest place if none does).
 */
export function placeMarks(preview: LaunchPreview, project: ProjectUu, o: PreviewDrawOptions): PlacedMark[] {
  const fixed = o.pxPerUu / o.zoom;
  const hero = heroRect(project, o);
  const placed: PlacedMark[] = [];
  /** How much room the dot keeps at p: ≥ 0 when its rim stays a pixel off every earlier dot's rim and off the hero. */
  const slack = (p: Point, d: number): number =>
    Math.min(rectDistance(hero, p) - (d / 2 + 1), ...placed.map(m => dist(p, m.pos) - ((d + m.diameter) / 2 + 2)));
  let n = 0;
  for (const leg of preview.legs) {
    const end = project(leg.end);
    const label = leg.marker !== 'none' || leg.deferredGravityBounce ? String(++n) : null;
    const d = Math.max(odd(fixed * (leg.marker === 'enemy' ? PREVIEW_MARKS.enemyDot : PREVIEW_MARKS.dot)), label ? odd(digitsWidth(label) + 4) : 1);
    const out = toward(project, leg.end, leg.bounceDirection);
    const candidates = [whole(end), ...MOVES.map(([turn, f]) => {
      const u = rotate(out, turn);
      return whole({ x: end.x + u.x * f * d, y: end.y + u.y * f * d });
    })];
    const pos = candidates.find(p => slack(p, d) >= 0) ?? candidates.reduce((a, b) => (slack(b, d) > slack(a, d) ? b : a));
    placed.push({ end, pos, diameter: d, label });
  }
  return placed;
}

/** Distance from pixel p to a ring of radius r around c, or to its arc from a0 to a1. */
function markGap(p: Point, c: Point, r: number, arc?: { a0: number; a1: number }): number {
  const d = dist(p, c);
  if (!arc) return Math.abs(d - r);
  const mid = (arc.a0 + arc.a1) / 2;
  const off = Math.abs(((Math.atan2(p.y - c.y, p.x - c.x) - mid + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  if (off <= (arc.a1 - arc.a0) / 2) return Math.abs(d - r);
  return Math.min(...[arc.a0, arc.a1].map(a => dist(p, { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r })));
}

/** Distance from p to a polyline. */
function polylineDistance(p: Point, line: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t));
  }
  return best;
}

/** The preview chain as two-pass strokes: the rings and arcs, the chevrons, then the dots and numbers. */
export function previewStrokes(preview: LaunchPreview, project: ProjectUu, o: PreviewDrawOptions): Strokes {
  const s = new Strokes();
  const hero = heroRect(project, o);
  const marks = placeMarks(preview, project, o);
  const onHero = (x: number, y: number): boolean => x >= hero.x0 - 1 && x <= hero.x1 + 1 && y >= hero.y0 - 1 && y <= hero.y1 + 1;
  const dots: { p: Point; r: number }[] = marks.map(m => ({ p: m.pos, r: m.diameter / 2 }));
  // a moved dot leaves a small one at the true leg end, where it fits
  const ends = marks
    .filter(m => m.pos.x !== Math.round(m.end.x) || m.pos.y !== Math.round(m.end.y))
    .map(m => whole(m.end))
    .filter(p => rectDistance(hero, p) >= END_DOT / 2 + 1 && dots.every(d => dist(p, d.p) >= d.r + END_DOT / 2 + 2));
  dots.push(...ends.map(p => ({ p, r: END_DOT / 2 })));
  /** A core pixel off the hero, with a 1-px ink gap to every dot. */
  const free = (x: number, y: number): boolean => !onHero(x, y) && dots.every(d => Math.hypot(x - d.p.x, y - d.p.y) >= d.r + 2.5);

  // rings and arcs, each whole but where it would cross a dot or the hero
  const radius = PREVIEW_MARKS.ringRadius * o.pxPerUu;
  const shapes: { c: Point; arc?: { a0: number; a1: number } }[] = [];
  const markCells = new Set<string>();
  preview.legs.forEach((leg, k) => {
    const { end } = marks[k];
    let pixels: Pixel[];
    if (leg.marker === 'enemy') {
      pixels = dashedRingPixels(end.x, end.y, radius, PREVIEW_MARKS.ringDashes);
      shapes.push({ c: end });
    } else if (leg.marker === 'wall' && leg.hit) {
      const u = toward(project, leg.end, { x: -leg.hit.normal.x, y: -leg.hit.normal.y });
      const a = Math.atan2(u.y, u.x);
      const arc = { a0: a - PREVIEW_MARKS.arcHalfAngle, a1: a + PREVIEW_MARKS.arcHalfAngle };
      pixels = arcPixels(end.x, end.y, radius, arc.a0, arc.a1);
      shapes.push({ c: end, arc });
    } else return;
    const kept = pixels.filter(([x, y]) => free(x, y));
    for (const [x, y] of kept) markCells.add(`${x},${y}`);
    s.pixels(kept, tone(o.pulse.marker(k)));
  });

  // chevrons, kept a pixel off every ring and arc (a gap of half a span plus 2 px from their lines) and off
  // each other
  const pitch = PREVIEW_MARKS.chevronPitch / o.zoom;
  const scroll = (o.time * PREVIEW_MARKS.scroll * pitch) % pitch;
  const centres: Point[] = [];
  const chevronCells = new Set<string>();
  const earlier: Point[][] = [];
  /** A pixel of `cells` within `r` px (Chebyshev) of (x, y). */
  const near = (cells: Set<string>, x: number, y: number, r = 1): boolean => {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (cells.has(`${x + i},${y + j}`)) return true;
    return false;
  };
  const stamp = (p: Point, d: Point): Pixel[] => chevronStamp(d.x, d.y).map(([x, y]) => [Math.round(p.x) + x, Math.round(p.y) + y] as const);
  /**
   * Crowds an earlier chevron: a centre closer than CROWD, or a pixel less than 2 px from its pixels (with a 1-px gap
   * their outlines would merge them into one glyph).
   */
  const crowds = (p: Point, d: Point): boolean => centres.some(q => dist(p, q) < CROWD) || stamp(p, d).some(([x, y]) => near(chevronCells, x, y, 2));
  const fits = (p: Point, d: Point): boolean =>
    shapes.every(m => markGap(p, m.c, radius, m.arc) >= CHEVRON_SPAN / 2 + 2) && stamp(p, d).every(([x, y]) => free(x, y) && !near(markCells, x, y));
  const chevrons = (line: readonly Vec2[], start: number): void => {
    // a leg that runs within LANE px of an earlier one for two pitches or more takes the lane to its right,
    // half a pitch along, so out-and-back legs read as a v lane beside a ^ lane
    const lane = stations(line, pitch, scroll).filter(st => earlier.some(l => polylineDistance(project(st), l) <= LANE)).length >= 2;
    for (const st of stations(line, pitch, lane ? scroll + pitch / 2 : scroll)) {
      const a = project(st);
      const b = project({ x: st.x + st.dx, y: st.y + st.dy });
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      // a chevron that would touch an earlier one steps LANE px to the right of its travel, or is left out
      const side = (p: Point): Point => ({ x: p.x - d.y * LANE, y: p.y + d.x * LANE });
      let p = lane ? side(a) : a;
      if (crowds(p, d)) p = side(p);
      if (crowds(p, d) || !fits(p, d)) continue;
      s.chevron(p.x, p.y, d.x, d.y, tone(o.pulse.line(start + st.at)));
      centres.push(p);
      for (const [x, y] of stamp(p, d)) chevronCells.add(`${x},${y}`);
    }
    earlier.push(line.map(project));
  };
  preview.legs.forEach((leg, k) => chevrons(leg.line, preview.pulse.mainSegments[k]?.start ?? 0));
  if (preview.terminal && preview.pulse.terminalSegment) chevrons(preview.terminal.line, preview.pulse.terminalSegment.start);

  for (const p of ends) s.disc(p.x, p.y, END_DOT, WHITE);
  marks.forEach((m, k) => {
    const color = tone(o.pulse.marker(k));
    if (m.label) s.numbered(m.pos.x, m.pos.y, m.diameter, m.label, color);
    else s.disc(m.pos.x, m.pos.y, m.diameter, color);
  });
  return s;
}

/** Draws the preview chain (`previewStrokes`). */
export function drawLaunchPreview(c: PixelCanvas, preview: LaunchPreview, project: ProjectUu, o: PreviewDrawOptions): void {
  previewStrokes(preview, project, o).drawTo(c);
}

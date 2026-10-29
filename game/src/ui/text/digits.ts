import type { Rgba } from '../core/color';
import type { Surface } from '../core/surface';

/**
 * Bitmap numerals for the HUD's small numbers (bars, badges, intents, heal and charge popups). The Demo draws
 * them in its pixel typeface 「像素字体」 at 24 pt, i.e. 32 widget units: 12 px in the 3D side panel
 * (×0.375) and 16 px on screen (×0.5). Its digits are ~6–7 px tall there, so the HUD uses D7
 * (5×7) and D9 (6×9, 2-px stems) for the large size. Glyph widths vary (the Demo's face is
 * proportional); the gap is 1 px. Damage numbers use the Teen numerals (teen.ts).
 */
export type DigitSize = 7 | 9;

const D7: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};

const D9: Record<string, string[]> = {
  '0': ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  '1': ['.##.', '###.', '.##.', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  '2': ['.####.', '##..##', '....##', '....##', '...##.', '..##..', '.##...', '##....', '######'],
  '3': ['#####.', '....##', '....##', '....##', '.####.', '....##', '....##', '....##', '#####.'],
  '4': ['...##.', '..###.', '.####.', '##.##.', '##.##.', '######', '...##.', '...##.', '...##.'],
  '5': ['######', '##....', '##....', '#####.', '....##', '....##', '....##', '##..##', '.####.'],
  '6': ['..###.', '.##...', '##....', '#####.', '##..##', '##..##', '##..##', '##..##', '.####.'],
  '7': ['######', '....##', '....##', '...##.', '...##.', '..##..', '..##..', '..##..', '..##..'],
  '8': ['.####.', '##..##', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '.####.'],
  '9': ['.####.', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '...##.', '.###..'],
  k: ['##...', '##...', '##..#', '##.##', '####.', '###..', '####.', '##.##', '##..#'],
  M: ['##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##', '##...##', '##...##'],
  B: ['#####.', '##..##', '##..##', '##..##', '#####.', '##..##', '##..##', '##..##', '#####.'],
  T: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  '+': ['......', '......', '..##..', '..##..', '######', '..##..', '..##..', '......', '......'],
  '-': ['.....', '.....', '.....', '.....', '#####', '.....', '.....', '.....', '.....'],
  '×': ['......', '......', '##..##', '.####.', '..##..', '.####.', '##..##', '......', '......'],
  '/': ['....##', '....##', '...##.', '...##.', '..##..', '.##...', '.##...', '##....', '##....'],
  '%': ['##...#', '##..##', '...##.', '...##.', '..##..', '.##...', '.##...', '##..##', '#...##'],
  '.': ['..', '..', '..', '..', '..', '..', '..', '##', '##'],
  ' ': ['...', '...', '...', '...', '...', '...', '...', '...', '...'],
};

interface Glyph {
  readonly w: number;
  readonly h: number;
  readonly bits: Uint8Array;
}

const FAMILIES = new Map<DigitSize, Map<string, Glyph>>();

function family(size: DigitSize): Map<string, Glyph> {
  let f = FAMILIES.get(size);
  if (!f) {
    f = new Map();
    const src = size === 7 ? D7 : D9;
    for (const [ch, rows] of Object.entries(src)) {
      const w = rows[0].length;
      const bits = new Uint8Array(w * size);
      rows.forEach((r, y) => {
        for (let x = 0; x < w; x++) bits[y * w + x] = r[x] === '#' ? 1 : 0;
      });
      f.set(ch, { w, h: size, bits });
    }
    FAMILIES.set(size, f);
  }
  return f;
}

/** Maps text onto the family's glyphs: x and * become ×, K becomes k, unknown characters drop. */
function glyphs(text: string, size: DigitSize): Glyph[] {
  const f = family(size);
  const out: Glyph[] = [];
  for (const raw of text) {
    const ch = raw === 'x' || raw === '*' ? '×' : raw === 'K' ? 'k' : raw === '−' ? '-' : raw;
    const g = f.get(ch);
    if (g) out.push(g);
  }
  return out;
}

/** Ink width of `text` at `size` (without the outline). */
export function digitsWidth(text: string, size: DigitSize): number {
  const gs = glyphs(text, size);
  if (!gs.length) return 0;
  return gs.reduce((w, g) => w + g.w, 0) + gs.length - 1;
}

export interface DigitStyle {
  color: Rgba;
  /** 8-neighbour outline 1 px around the ink; omit for none. */
  outline?: Rgba;
  /** Anchor of `x`: the ink box's left, centre or right. */
  align?: 'left' | 'center' | 'right';
  opacity?: number;
}

/** The ink mask of `text` (row-major, `w` × `size`). */
function mask(text: string, size: DigitSize): { w: number; bits: Uint8Array } {
  const gs = glyphs(text, size);
  const w = digitsWidth(text, size);
  const bits = new Uint8Array(Math.max(1, w * size));
  let pen = 0;
  for (const g of gs) {
    for (let gy = 0; gy < g.h; gy++) for (let gx = 0; gx < g.w; gx++) if (g.bits[gy * g.w + gx]) bits[gy * w + pen + gx] = 1;
    pen += g.w + 1;
  }
  return { w, bits };
}

/** Draws `text` with the ink box's top at `y`; returns the ink box's left x. Each pixel is written once. */
export function drawDigits(s: Surface, text: string, x: number, y: number, size: DigitSize, style: DigitStyle): number {
  const m = mask(text, size);
  const w = m.w;
  const align = style.align ?? 'left';
  const x0 = Math.round(align === 'left' ? x : align === 'center' ? x - w / 2 : x - w);
  const y0 = Math.round(y);
  const opacity = style.opacity ?? 1;
  const on = (mx: number, my: number): boolean => mx >= 0 && my >= 0 && mx < m.w && my < size && m.bits[my * m.w + mx] === 1;
  for (let my = -1; my <= size; my++) {
    for (let mx = -1; mx <= m.w; mx++) {
      let c: Rgba | undefined;
      if (on(mx, my)) c = style.color;
      else if (style.outline !== undefined) {
        for (let oy = -1; oy <= 1 && c === undefined; oy++) for (let ox = -1; ox <= 1 && c === undefined; ox++) if (on(mx + ox, my + oy)) c = style.outline;
      }
      if (c !== undefined) s.px(x0 + mx, y0 + my, c, opacity);
    }
  }
  return x0;
}

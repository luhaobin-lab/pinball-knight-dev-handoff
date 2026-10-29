import type { Rgba } from '../core/color';
import type { Surface } from '../core/surface';

/**
 * Hand-placed HUD glyphs. '#' = main ink of the glyph, '=' = its secondary tone, '.' = empty.
 * Glyphs are drawn at 1:1 on the 960×540 grid (never scaled) with an optional 1-px ink ring.
 */
const SRC = {
  /** 生命: left of the HP bar (ss2 heart 11×10 px). */
  heart: ['.###.###.', '#########', '##=######', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  /** 体力: left of the stamina bar (ss2: a bell with a handle). */
  stamina: ['...###...', '..#...#..', '..#...#..', '.#######.', '##=######', '#########', '#########', '.#######.', '..#####..'],
  /** 腐化: the skull at the end of the corruption bar. */
  skull: ['..#####..', '.#######.', '#########', '#..###..#', '#..###..#', '####.####', '.#######.', '..#.#.#..', '..#####..'],
  /** Locked equipment slot (修炼页_锁定). */
  lock: ['..###..', '.#...#.', '.#...#.', '#######', '###.###', '###.###', '#######'],
  /** Intent kinds (UI_意图提示: 攻击 / 治愈 / 强固 / 特殊; 修炼页_Sprite_36/37/38/44, 20 units). */
  attack: ['.....##', '....###', '...###.', '#.###..', '.###...', '..#....', '.#.#...'],
  heal: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  fortify: ['#######', '#=====#', '#=====#', '#=====#', '.#===#.', '..#=#..', '...#...'],
  special: ['...#...', '...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...', '...#...'],
  /** UI_弱点提示: the weak-point reticle. */
  weak: ['###...###', '#.......#', '#.......#', '....#....', '...###...', '....#....', '#.......#', '#.......#', '###...###'],
} as const;

export type GlyphName = keyof typeof SRC;

interface Bitmap {
  readonly w: number;
  readonly h: number;
  /** 0 empty, 1 main, 2 secondary. */
  readonly roles: Uint8Array;
}

const CACHE = new Map<GlyphName, Bitmap>();

export function glyph(name: GlyphName): Bitmap {
  let b = CACHE.get(name);
  if (!b) {
    const rows = SRC[name];
    const w = Math.max(...rows.map(r => r.length));
    const roles = new Uint8Array(w * rows.length);
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) roles[y * w + x] = r[x] === '#' ? 1 : r[x] === '=' ? 2 : 0;
    });
    b = { w, h: rows.length, roles };
    CACHE.set(name, b);
  }
  return b;
}

export interface GlyphStyle {
  main: Rgba;
  /** Secondary tone; defaults to `main`. */
  second?: Rgba;
  /** 1-px 8-neighbour ring. */
  outline?: Rgba;
  opacity?: number;
}

/** Draws a glyph with its top-left at (x, y). */
export function drawGlyph(s: Surface, name: GlyphName, x: number, y: number, style: GlyphStyle): void {
  const g = glyph(name);
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const op = style.opacity ?? 1;
  const at = (gx: number, gy: number): number => (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h ? 0 : g.roles[gy * g.w + gx]);
  for (let gy = -1; gy <= g.h; gy++) {
    for (let gx = -1; gx <= g.w; gx++) {
      const r = at(gx, gy);
      if (r === 1) s.px(x0 + gx, y0 + gy, style.main, op);
      else if (r === 2) s.px(x0 + gx, y0 + gy, style.second ?? style.main, op);
      else if (style.outline !== undefined) {
        let near = false;
        for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1 && !near; ox++) near = at(gx + ox, gy + oy) !== 0;
        if (near) s.px(x0 + gx, y0 + gy, style.outline, op);
      }
    }
  }
}

/** Draws a glyph centred in a rect (rounding down to whole pixels). */
export function drawGlyphIn(s: Surface, name: GlyphName, r: { x: number; y: number; w: number; h: number }, style: GlyphStyle): void {
  const g = glyph(name);
  drawGlyph(s, name, r.x + Math.floor((r.w - g.w) / 2), r.y + Math.floor((r.h - g.h) / 2), style);
}

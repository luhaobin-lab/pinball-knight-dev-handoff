import * as THREE from 'three';
import { fullscreenMaterial, type PassContext, type PixelRenderer } from '../render/api';
import { toHex } from '../ui/core/color';
import { BONE, INK as INK_RGBA } from '../ui/style/palette';

/**
 * Pixel-exact overlay at the internal resolution: a 2D canvas the size of the internal render, drawn
 * every frame with whole pixels, composited by the renderer's overlay stage after all colour effects. It
 * carries the aim preview (chevrons, leg-end marks, bounce numbers) and the hit sparks.
 *
 * Style A「墨与骨」(Ink & Bone, ART_BIBLE §7), the HUD's own palette (src/ui/style/palette.ts): bone strokes on
 * ink outlines, no red and no gold. The preview is drawn through `Strokes` in two passes, every ink outline
 * before any bone core, so where glyphs touch no outline cuts into a neighbour.
 */

export const INK = toHex(INK_RGBA.base);
/** Bone white (BONE.base): the preview at rest, numbers' dots, sparks. */
export const WHITE = toHex(BONE.base);
/** The preview's lit step while the pulse passes: golden 02's chevron white, a warm white above BONE.base. */
export const LIT_WHITE = '#FFF6E3';
/** Secondary bone: the motion trail's tail and every other spark spoke (never the preview). */
export const BONE_DIM = toHex(BONE.dim);

/** The overlay's 5×7 digits, one string of 5 bits per row. */
export const DIGITS_5x7: Readonly<Record<string, readonly string[]>> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

/** Width in px of `text` in the 5×7 digits (1-px gaps). */
export const digitsWidth = (text: string): number => text.length * 6 - 1;

/** A pixel (x right, y down). */
export type Pixel = readonly [number, number];

/** Bresenham pixels from (x0, y0) to (x1, y1), both ends included. */
export function linePixels(x0: number, y0: number, x1: number, y1: number): Pixel[] {
  const out: Pixel[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Pixel offsets moved so their bounding box is centred on (0, 0), so every chevron of a leg sits on its line. */
function centred(pixels: readonly Pixel[]): Pixel[] {
  const xs = pixels.map(p => p[0]);
  const ys = pixels.map(p => p[1]);
  const cx = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2 + 0.5);
  const cy = Math.floor((Math.min(...ys) + Math.max(...ys)) / 2 + 0.5);
  return pixels.map(([x, y]) => [x - cx, y - cy] as const);
}

/** A 1-px arrowhead: straight arms from a tip at (0, 0) back to each end, centred. */
function arrowhead(ends: readonly Pixel[]): Pixel[] {
  const seen = new Map<string, Pixel>([['0,0', [0, 0]]]);
  for (const [x, y] of ends) for (const p of linePixels(0, 0, x, y)) seen.set(`${p[0]},${p[1]}`, p);
  return centred([...seen.values()]);
}

/**
 * The chevron stamps for 16 headings (k × 22.5°, screen space: 0 = east, clockwise): 1-px arrowheads like golden
 * 02's, at most 7 px across, each mirror-symmetric about its heading with equal arms and a single-pixel tip.
 * - East: the golden's cardinal v, its own pixels (arms back to (−4, ±3), steep by the tip).
 * - South-east: the golden's diagonal corner with its arm ends tipped in, arms back to (−5, −1) and (−1, −5).
 * - East-south-east: arms back to (−5, 1) and (−3, −5).
 * South-south-east mirrors east-south-east across the diagonal; the other twelve are quarter turns.
 */
const CHEVRONS: readonly (readonly Pixel[])[] = (() => {
  const east = centred([[0, 0], [-1, -1], [-1, 1], [-2, -1], [-2, 1], [-3, -2], [-3, 2], [-4, -3], [-4, 3]]);
  const ese = arrowhead([[-5, 1], [-3, -5]]);
  const se = arrowhead([[-5, -1], [-1, -5]]);
  const stamps: Pixel[][] = [east, ese, se, ese.map(([x, y]) => [y, x] as const)];
  // a quarter turn clockwise on screen (y down): (x, y) → (−y, x)
  for (let k = 4; k < 16; k++) stamps.push(stamps[k - 4].map(([x, y]) => [-y, x] as const));
  return stamps;
})();

/** The chevron stamp for direction (dx, dy), snapped to the nearest of the 16 headings: pixel offsets from its centre. */
export function chevronStamp(dx: number, dy: number): readonly Pixel[] {
  return CHEVRONS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) % 16) + 16) % 16];
}

/** Chevron size across its line (px): the clearance the preview keeps around its marks. */
export const CHEVRON_SPAN = 7;

/** An odd pixel diameter close to `d`, so a disc has a centre pixel. */
export const odd = (d: number): number => 2 * Math.floor(Math.max(1, d) / 2) + 1;

/** Pixels of a disc of odd `diameter` around the centre pixel (cx, cy). */
export function discPixels(cx: number, cy: number, diameter: number): Pixel[] {
  const h = (diameter - 1) / 2;
  const r2 = (diameter / 2) ** 2;
  const out: Pixel[] = [];
  for (let j = -h; j <= h; j++) for (let i = -h; i <= h; i++) if (i * i + j * j <= r2) out.push([cx + i, cy + j]);
  return out;
}

/** Pixels of a ring of radius r cut into `dashes` stripes, each half its period. */
export function dashedRingPixels(x: number, y: number, r: number, dashes: number): Pixel[] {
  const n = Math.max(dashes * 4, Math.round(Math.PI * 4 * r));
  const out: Pixel[] = [];
  for (let i = 0; i < n; i++) {
    if (Math.floor((i / n) * dashes * 2) % 2 === 1) continue;
    const a = (i / n) * Math.PI * 2;
    out.push([Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r)]);
  }
  return out;
}

/** Pixels of an arc of radius r from angle a0 to a1 (radians, screen space). */
export function arcPixels(x: number, y: number, r: number, a0: number, a1: number): Pixel[] {
  const n = Math.max(6, Math.round(Math.abs(a1 - a0) * r));
  const out: Pixel[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r)]);
  }
  return out;
}

/** What a core pixel belongs to: a chevron, a ring or arc, a dot, a digit. */
export type GlyphKind = 'chevron' | 'mark' | 'dot' | 'digit';

export interface CorePixel {
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly kind: GlyphKind;
}

/**
 * Glyphs collected for a two-pass draw: each adds its 1-px ink outline and its coloured core, and `drawTo`
 * lays every outline before any core (the cores in the order they were added).
 */
export class Strokes {
  /** Ink rects as x, y, w, h. */
  readonly inks: number[] = [];
  readonly cores: CorePixel[] = [];

  /** A core pixel and its 3×3 ink. */
  private core(x: number, y: number, color: string, kind: GlyphKind): void {
    this.inks.push(x - 1, y - 1, 3, 3);
    this.cores.push({ x, y, color, kind });
  }

  /** 1-px strokes with their outline. */
  pixels(pixels: readonly Pixel[], color: string, kind: GlyphKind = 'mark'): void {
    for (const [x, y] of pixels) this.core(x, y, color, kind);
  }

  /** The chevron stamp for direction (dx, dy) (16 steps), centred on the pixel nearest (x, y). */
  chevron(x: number, y: number, dx: number, dy: number, color: string): void {
    const cx = Math.round(x);
    const cy = Math.round(y);
    for (const [px, py] of chevronStamp(dx, dy)) this.core(cx + px, cy + py, color, 'chevron');
  }

  /** A filled disc about `diameter` px across (made odd) centred on the pixel nearest (x, y), with a 1-px ink rim. */
  disc(x: number, y: number, diameter: number, color: string): void {
    const d = odd(diameter);
    const cx = Math.round(x);
    const cy = Math.round(y);
    for (const [px, py] of discPixels(cx, cy, d + 2)) this.inks.push(px, py, 1, 1);
    for (const [px, py] of discPixels(cx, cy, d)) this.cores.push({ x: px, y: py, color, kind: 'dot' });
  }

  /** A numbered dot: `disc` with `text` knocked out of it in ink 5×7 digits. */
  numbered(x: number, y: number, diameter: number, text: string, color: string): void {
    this.disc(x, y, diameter, color);
    this.glyphs(text, Math.round(x), Math.round(y), (gx, gy) => this.cores.push({ x: gx, y: gy, color: INK, kind: 'digit' }));
  }

  /** 5×7 digits centred at (x, y), ink-outlined. */
  digits(text: string, x: number, y: number, color: string): void {
    this.glyphs(text, x, y, (gx, gy) => this.core(gx, gy, color, 'digit'));
  }

  private glyphs(text: string, x: number, y: number, put: (x: number, y: number) => void): void {
    const x0 = Math.round(x - digitsWidth(text) / 2);
    const y0 = Math.round(y - 3.5);
    [...text].forEach((ch, i) => DIGITS_5x7[ch]?.forEach((row, gy) => [...row].forEach((bit, gx) => bit === '1' && put(x0 + i * 6 + gx, y0 + gy))));
  }

  drawTo(c: PixelCanvas): void {
    c.g.fillStyle = INK;
    for (let i = 0; i < this.inks.length; i += 4) c.g.fillRect(this.inks[i], this.inks[i + 1], this.inks[i + 2], this.inks[i + 3]);
    for (const p of this.cores) c.px(p.x, p.y, p.color);
  }
}

export class PixelCanvas {
  readonly canvas = document.createElement('canvas');
  readonly g: CanvasRenderingContext2D;

  constructor() {
    this.g = this.canvas.getContext('2d')!;
  }

  resize(w: number, h: number): void {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.g.clearRect(0, 0, w, h);
    this.g.imageSmoothingEnabled = false;
  }

  px(x: number, y: number, color: string, w = 1, h = 1): void {
    this.g.fillStyle = color;
    this.g.fillRect(Math.round(x), Math.round(y), w, h);
  }

  /** Bresenham line between pixel centres; `thick` > 1 stamps a square brush (for outlines). */
  line(x0: number, y0: number, x1: number, y1: number, color: string, thick = 1): void {
    const o = Math.floor(thick / 2);
    this.g.fillStyle = color;
    for (const [x, y] of linePixels(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1))) this.g.fillRect(x - o, y - o, thick, thick);
  }

  /** Ring of radius r; `dash` > 0 draws dashes of that many pixels; ink-outlined unless `outline` is false. */
  ring(x: number, y: number, r: number, color: string, dash = 0, outline = true): void {
    const n = Math.max(12, Math.round(Math.PI * 2 * r));
    const pts: Pixel[] = [];
    for (let i = 0; i < n; i++) {
      if (dash > 0 && Math.floor(i / dash) % 2 === 1) continue;
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r)]);
    }
    if (!outline) {
      for (const [px, py] of pts) this.px(px, py, color);
      return;
    }
    this.glyph(s => s.pixels(pts, color));
  }

  // Single glyphs for the core lane's debug scene (core-launch.ts), drawn like the preview's.

  /** The chevron stamp along (dx, dy). `_size` is the old computed chevron's arm length: the stamps have one size. */
  chevron(x: number, y: number, dx: number, dy: number, _size?: number, color = WHITE): void {
    this.glyph(s => s.chevron(x, y, dx, dy, color));
  }

  /** Arc from angle a0 to a1 (radians, screen space), ink-outlined. */
  arc(x: number, y: number, r: number, a0: number, a1: number, color: string): void {
    this.glyph(s => s.pixels(arcPixels(x, y, r, a0, a1), color));
  }

  /** A `size`-px square dot with a 1-px ink rim. */
  dot(x: number, y: number, color: string, size = 2): void {
    this.px(Math.round(x) - 1, Math.round(y) - 1, INK, size + 2, size + 2);
    this.px(Math.round(x), Math.round(y), color, size, size);
  }

  /** 5×7 digits centred at (x, y), ink-outlined. `_o.big` picked the size of the old two fonts: there is one now. */
  number(text: string, x: number, y: number, color: string, _o?: { big?: boolean }): void {
    this.glyph(s => s.digits(text, x, y, color));
  }

  private glyph(add: (s: Strokes) => void): void {
    const s = new Strokes();
    add(s);
    s.drawTo(this);
  }
}

export interface OverlayPass {
  readonly canvas: PixelCanvas;
}

/**
 * Registers an overlay-stage pass that clears the canvas to the internal size, calls `draw` (with the
 * pass context for `project`), uploads and composites it.
 */
export function addPixelOverlay(renderer: PixelRenderer, draw: (c: PixelCanvas, ctx: PassContext) => void): OverlayPass {
  const canvas = new PixelCanvas();
  const texture = new THREE.CanvasTexture(canvas.canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = fullscreenMaterial(
    /* glsl */ `
uniform sampler2D tCanvas;
uniform vec2 uSize;
void main() {
  vec4 c = texture2D(tCanvas, (floor(gl_FragCoord.xy) + 0.5) / uSize);
  gl_FragColor = vec4(c.rgb * c.a, c.a);
}`,
    { tCanvas: { value: texture }, uSize: { value: new THREE.Vector2(1, 1) } },
  );
  renderer.addPass('overlay', {
    name: 'pixel-overlay',
    render(ctx) {
      canvas.resize(ctx.width, ctx.height);
      draw(canvas, ctx);
      texture.needsUpdate = true;
      material.uniforms.uSize.value.set(ctx.width, ctx.height);
      ctx.fullscreen(material);
    },
  });
  return { canvas };
}

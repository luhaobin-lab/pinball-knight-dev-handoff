import fontUrl from '../font/fusion-pixel-12px-proportional-zh_hans.subset.woff2?inline';
import oflText from '../font/OFL.txt?raw';
import type { Rgba } from '../core/color';
import type { Surface } from '../core/surface';
import { glyphFromCoverage, RASTER, REFERENCE_GLYPH, referenceMismatch, type Glyph } from './raster';

/**
 * Fusion Pixel 12px (OFL; with the subset script and the licences of the fonts it derives from in
 * ../font/). The subset is embedded in the bundle. Each glyph is drawn once by the browser at
 * 8 × 12 px and sampled at every design-pixel centre (./raster.ts), so text reproduces the font's
 * 1-px design on the 960×540 grid; `load` checks that on 触 and reports a mismatch with console.error.
 */
export const FONT_LICENSE = {
  font: 'Fusion Pixel 12px Proportional zh-Hans (subset)',
  url: 'https://github.com/TakWolf/fusion-pixel-font',
  text: oflText,
};

export interface TextStyle {
  color: Rgba;
  /** 8-neighbour outline, 1 px. */
  outline?: Rgba;
  opacity?: number;
}

/** What HUD widgets need from a font; tests use a stub with the same metrics. */
export interface TextFont {
  /** Line box height in px (ascent + descent). */
  readonly line: number;
  measure(text: string): number;
  /** Draws one line with its line box's top-left at (x, y); returns the advance width. */
  draw(s: Surface, text: string, x: number, y: number, style: TextStyle): number;
}

const FAMILY = 'FusionPixel12';

/** Characters that take no space (break hints in the Demo's strings). */
const ZERO_WIDTH = new Set(['\u200b', '\u200c', '\u200d', '\ufeff', '\r']);

export class PixelFont implements TextFont {
  readonly line = RASTER.line;
  private readonly cache = new Map<string, Glyph>();
  private readonly ctx: OffscreenCanvasRenderingContext2D;

  private constructor() {
    const k = RASTER.super;
    const canvas = new OffscreenCanvas(RASTER.width * k, RASTER.line * k);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('ui: no 2D context for glyph rasterization');
    ctx.font = `${RASTER.size * k}px ${FAMILY}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    this.ctx = ctx;
  }

  /** Loads the embedded subset once and returns the shared font. */
  static load(): Promise<PixelFont> {
    shared ??= (async () => {
      const face = new FontFace(FAMILY, `url(${fontUrl})`);
      await face.load();
      document.fonts.add(face);
      const font = new PixelFont();
      const wrong = referenceMismatch(font.glyph(REFERENCE_GLYPH.ch));
      if (wrong) console.error(`ui: ${wrong}`);
      return font;
    })();
    return shared;
  }

  measure(text: string): number {
    let w = 0;
    for (const ch of text) if (!ZERO_WIDTH.has(ch)) w += this.glyph(ch).advance;
    return w;
  }

  draw(s: Surface, text: string, x: number, y: number, style: TextStyle): number {
    const x0 = Math.round(x);
    const top = Math.round(y);
    const opacity = style.opacity ?? 1;
    const gs = [...text].filter(ch => !ZERO_WIDTH.has(ch)).map(ch => this.glyph(ch));
    for (const pass of style.outline !== undefined ? ['ring', 'ink'] : ['ink']) {
      let pen = x0;
      for (const g of gs) {
        if (pass === 'ink') stamp(s, g, pen, top, style.color, opacity);
        else ring(s, g, pen, top, style.outline!, opacity);
        pen += g.advance;
      }
    }
    return gs.reduce((w, g) => w + g.advance, 0);
  }

  private glyph(ch: string): Glyph {
    let g = this.cache.get(ch);
    if (!g) {
      g = this.rasterize(ch);
      this.cache.set(ch, g);
    }
    return g;
  }

  private rasterize(ch: string): Glyph {
    const ctx = this.ctx;
    const k = RASTER.super;
    const w = RASTER.width * k;
    const h = RASTER.line * k;
    ctx.clearRect(0, 0, w, h);
    ctx.fillText(ch, RASTER.pad * k, RASTER.baseline * k);
    return glyphFromCoverage(ctx.getImageData(0, 0, w, h).data, Math.round(ctx.measureText(ch).width / k));
  }
}

let shared: Promise<PixelFont> | null = null;

const on = (g: Glyph, x: number, y: number): boolean => x >= 0 && y >= 0 && x < g.w && y < g.h && g.bits[y * g.w + x] === 1;

function stamp(s: Surface, g: Glyph, pen: number, top: number, c: Rgba, opacity: number): void {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.bits[y * g.w + x]) s.px(pen + g.x + x, top + g.y + y, c, opacity);
}

function ring(s: Surface, g: Glyph, pen: number, top: number, c: Rgba, opacity: number): void {
  for (let y = -1; y <= g.h; y++) {
    for (let x = -1; x <= g.w; x++) {
      if (on(g, x, y)) continue;
      let near = false;
      for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1 && !near; ox++) near = on(g, x + ox, y + oy);
      if (near) s.px(pen + g.x + x, top + g.y + y, c, opacity);
    }
  }
}

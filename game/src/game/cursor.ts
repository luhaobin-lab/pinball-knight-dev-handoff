import type { PixelRenderer } from '../render/api';
import { INK, WHITE } from './overlay';

/** The arrow's head: its edges run this many px along the top and the left from the tip. */
const HEAD = 12;
/** Where its 3-px diagonal shaft ends (px from the tip's corner). */
const SHAFT_END = 21;

/**
 * UI_光标's arrow at the Demo's size: the visible part of the 21-texel sprite at 1.5 px per texel (63×63 widget
 * px at 1920×1080), 23×23 px. The tip is at the top left, the head's edges run along the top and the left,
 * symmetric about the diagonal, and a 3-px shaft runs down the diagonal to the bottom right; ink rim, bone core.
 * Rows of 0 = clear, 1 = ink, 2 = bone.
 */
export const ARROW: readonly string[] = (() => {
  const core = (x: number, y: number): boolean =>
    x >= 1 && y >= 1 && (x + y <= HEAD + 1 || (Math.abs(x - y) <= 1 && x + y >= HEAD && x <= SHAFT_END && y <= SHAFT_END));
  const rim = (x: number, y: number): boolean => !core(x, y) && [-1, 0, 1].some(i => [-1, 0, 1].some(j => core(x + i, y + j)));
  const size = SHAFT_END + 2;
  return Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => (core(x, y) ? '2' : rim(x, y) ? '1' : '0')).join(''));
})();

/** The hot spot: the tip's core pixel (UE centres the 105×105 widget on the mouse, its 42-px padding puts the tip there). */
const HOT = 1;

/** A pixel grid on the page: its top-left corner in client (CSS) px and the CSS px per grid pixel. */
export interface PixelGrid {
  readonly left: number;
  readonly top: number;
  /** CSS px per grid pixel. */
  readonly css: number;
}

/** The grid of a pixelated canvas, e.g. the HUD's screen layer. */
export function canvasGrid(canvas: HTMLCanvasElement): PixelGrid {
  const r = canvas.getBoundingClientRect();
  return { left: r.left, top: r.top, css: r.width / Math.max(1, canvas.width) };
}

/** The renderer's internal grid inside its canvas (integer upscale, centred). */
export function internalGrid(renderer: PixelRenderer): PixelGrid {
  const r = renderer.canvas.getBoundingClientRect();
  const { width, height, scale, outputWidth, outputHeight } = renderer.internal;
  const cssPerOutput = r.width / Math.max(1, outputWidth);
  return {
    left: r.left + ((outputWidth - width * scale) / 2) * cssPerOutput,
    top: r.top + ((outputHeight - height * scale) / 2) * cssPerOutput,
    css: scale * cssPerOutput,
  };
}

/** The `grid` pixel under the client point (x, y). */
export function gridPixel(grid: PixelGrid, clientX: number, clientY: number): { x: number; y: number } {
  return { x: Math.floor((clientX - grid.left) / grid.css), y: Math.floor((clientY - grid.top) / grid.css) };
}

/**
 * The Demo's cursor (UI_光标, the Default cursor everywhere): the bone pixel arrow on top of the HUD and the game,
 * a small pixelated canvas snapped to a grid pixel. Pointer events pass through it.
 */
export class PixelCursor {
  private readonly el = document.createElement('canvas');

  constructor(parent: HTMLElement = document.body) {
    this.el.width = ARROW[0].length;
    this.el.height = ARROW.length;
    const g = this.el.getContext('2d')!;
    ARROW.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === '0') return;
        g.fillStyle = c === '1' ? INK : WHITE;
        g.fillRect(x, y, 1, 1);
      }),
    );
    this.el.dataset.uiLayer = 'cursor';
    this.el.style.cssText = 'position:fixed;left:0;top:0;image-rendering:pixelated;pointer-events:none;z-index:3;display:none;';
    parent.append(this.el);
  }

  /** Shows the arrow with its hot spot on the `grid` pixel under the client point (x, y). */
  show(grid: PixelGrid, clientX: number, clientY: number): void {
    const p = gridPixel(grid, clientX, clientY);
    const st = this.el.style;
    st.left = `${grid.left + (p.x - HOT) * grid.css}px`;
    st.top = `${grid.top + (p.y - HOT) * grid.css}px`;
    st.width = `${this.el.width * grid.css}px`;
    st.height = `${this.el.height * grid.css}px`;
    st.display = 'block';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}

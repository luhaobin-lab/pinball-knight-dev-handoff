import type { PixelRenderer } from '../../render/api';
import { Surface } from './surface';

/** The Demo's design grid (1920×1080 at ×0.5): the HUD never draws on less. */
const HUD_GRID = { w: 960, h: 540 } as const;

/**
 * The screen-anchored HUD layer: a 2D canvas stacked over the game canvas, upscaled by the
 * compositor with `image-rendering: pixelated`, never moved by the renderer's screen shake. It
 * shares the renderer's internal grid (same integer scale, same centring) whenever that grid holds
 * the 960×540 Demo layout; on outputs where the renderer picks a smaller grid (1440p → 854×480 at
 * ×3) it takes the largest integer scale that still gives at least 960×540, so the layout is
 * never cut. It takes no pointer events itself (see `toLayer`).
 */
export class ScreenLayer {
  readonly canvas: HTMLCanvasElement;
  surface = new Surface(1, 1);
  private readonly ctx: CanvasRenderingContext2D;
  private image: ImageData | null = null;
  private key = '';
  /** Device px per layer px, and the layer's device-px offset from the output's top-left. */
  private scale = 1;
  private offX = 0;
  private offY = 0;

  constructor(
    private readonly renderer: PixelRenderer,
    parent: HTMLElement,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.dataset.uiLayer = 'hud';
    this.canvas.style.cssText = 'position:fixed;left:0;top:0;image-rendering:pixelated;pointer-events:none;z-index:2;';
    const ctx = this.canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('ui: no 2D canvas context');
    this.ctx = ctx;
    parent.append(this.canvas);
    this.sync();
  }

  /** Follows the renderer's output and the game canvas's box; true when the layer's grid changed. */
  sync(): boolean {
    const { width, height, scale, outputWidth, outputHeight } = this.renderer.internal;
    const box = this.renderer.canvas.getBoundingClientRect();
    const dpr = outputWidth / Math.max(1, box.width || outputWidth);
    const key = `${width}x${height}@${scale}/${outputWidth}x${outputHeight}/${box.left},${box.top},${dpr}`;
    if (key === this.key) return false;
    this.key = key;
    let s = scale;
    let w = width;
    let h = height;
    if (w < HUD_GRID.w || h < HUD_GRID.h) {
      s = Math.max(1, Math.floor(Math.min(outputWidth / HUD_GRID.w, outputHeight / HUD_GRID.h)));
      w = Math.ceil(outputWidth / s);
      h = Math.ceil(outputHeight / s);
    }
    this.scale = s;
    this.offX = (outputWidth - w * s) / 2;
    this.offY = (outputHeight - h * s) / 2;
    const st = this.canvas.style;
    st.width = `${(w * s) / dpr}px`;
    st.height = `${(h * s) / dpr}px`;
    st.left = `${box.left + this.offX / dpr}px`;
    st.top = `${box.top + this.offY / dpr}px`;
    if (this.surface.w === w && this.surface.h === h) return false;
    this.surface = new Surface(w, h);
    this.canvas.width = w;
    this.canvas.height = h;
    this.image = new ImageData(new Uint8ClampedArray(this.surface.data.buffer), w, h);
    return true;
  }

  /** Uploads the surface. */
  present(): void {
    if (this.image) this.ctx.putImageData(this.image, 0, 0);
  }

  /** Client (CSS) coordinates → layer pixels. */
  toLayer(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: Math.floor(((clientX - r.left) / Math.max(1, r.width)) * this.surface.w), y: Math.floor(((clientY - r.top) / Math.max(1, r.height)) * this.surface.h) };
  }

  /** A renderer internal pixel (e.g. from `renderer.project`) → layer pixels. */
  fromInternal(p: { x: number; y: number }): { x: number; y: number } {
    const { width, height, scale, outputWidth, outputHeight } = this.renderer.internal;
    const dx = (p.x - width / 2) * scale + outputWidth / 2;
    const dy = (p.y - height / 2) * scale + outputHeight / 2;
    return { x: (dx - this.offX) / this.scale, y: (dy - this.offY) / this.scale };
  }

  dispose(): void {
    this.canvas.remove();
  }
}

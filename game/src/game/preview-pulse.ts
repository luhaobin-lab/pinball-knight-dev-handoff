import { PREVIEW_PULSE, type PulseLayout } from '../core/launch/index.ts';

const P = PREVIEW_PULSE;
const SPEED = Math.max(P.speed, 1);
const FRONT = Math.max(P.frontWidth, 1);
const TAIL = Math.max(P.tailLength, 1);
const GAP = Math.max(P.cycleGap, 0);
const BASE = Math.min(1, Math.max(0, P.baseBrightness));
const PEAK = Math.max(P.peakBrightness, 0);
const FLASH = Math.max(P.markerFlashDuration, 0.01);

/** The brightness at which the overlay's two bone steps switch: halfway from the rest level to full. */
export const LIT = (BASE + 1) / 2;

/**
 * The travelling highlight of the preview chain (弹射预览路径 on the chain's root circle, trajectory-preview
 * TRAJEC-043…048): a head runs along the chain distance at 1400 uu/s; past the end plus the tail it waits the
 * cycle gap and restarts at 0. Each marker flashes when the head passes it. Advanced with world time; the
 * offsets come from the core's `LaunchPreview.pulse` (TRAJEC-044, F-9).
 */
export class PreviewPulse {
  head = 0;
  /** Seconds left in the gap, or −1 while the head runs. */
  private gap = -1;
  private cycle = 0;
  private active = false;
  private remaining: number[] = [];
  private flashed: number[] = [];

  update(dt: number, layout: PulseLayout): void {
    const total = layout.totalLength;
    // TRAJEC-045: no length, no pulse; the first active frame after one advances by 0
    if (!(total > 1e-8)) {
      this.active = false;
      return;
    }
    const step = this.active ? Math.max(0, dt) : 0;
    this.active = true;
    const previous = this.head;
    let moved = false;
    if (this.gap < 0) {
      this.head += SPEED * step;
      moved = step > 0;
      if (this.head > total + TAIL) this.gap = GAP;
    } else {
      this.gap -= step;
      if (this.gap <= 0) {
        this.gap = -1;
        this.head = 0;
        this.cycle++;
      }
    }
    // TRAJEC-048: a marker flashes once per cycle, when the head crosses its chain distance
    const markers = layout.markerDistances;
    this.remaining.length = markers.length;
    this.flashed.length = markers.length;
    markers.forEach((m, k) => {
      this.remaining[k] = Math.max((this.remaining[k] ?? 0) - step, 0);
      if (moved && this.flashed[k] !== this.cycle && Number.isFinite(m) && m >= 0 && previous < m && m <= this.head) {
        this.remaining[k] = FLASH;
        this.flashed[k] = this.cycle;
      }
    });
  }

  /** PulseHead as the lines get it: off the chain (−front − 1) during the gap (TRAJEC-047). */
  get lineHead(): number {
    return this.gap >= 0 ? -FRONT - 1 : this.head;
  }

  /**
   * The line's brightness at chain distance `s` (F-11): full at the head, fading over the front ahead of it and
   * over the tail behind it, down to the rest level.
   * SPEC-GAP: 材质_指引线脉冲_普通's brightness graph is compiled only (U-2); F-11 is the spec's reconstruction. So
   * is the chevron scroll of 位移速度 (−2, 0), read as two tiles per second forward (U-16).
   */
  line(s: number): number {
    const d = this.lineHead - s;
    const w = d < 0 ? sat(1 + d / FRONT) : sat(1 - d / TAIL);
    return BASE + (PEAK - BASE) * w;
  }

  /** Marker k's 透明度: the rest level, raised by the flash x²(3 − 2x) over 0.25 s (TRAJEC-048, F-12). */
  marker(k: number): number {
    const x = sat((this.remaining[k] ?? 0) / FLASH);
    return BASE + (PEAK - BASE) * x * x * (3 - 2 * x);
  }
}

const sat = (v: number): number => Math.min(1, Math.max(0, v));

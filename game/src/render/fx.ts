import * as THREE from 'three';
import type { CameraShakeKind, CameraShakeReading, FlashOptions, FxHooks, FxState, Hex, ImpactKind, ImpactOptions } from './api';
import { DemoCameraShakes, PX_PER_UU, snapPixel } from './camera-shake';

/** Shake translation at trauma 1, in internal pixels. */
const MAX_SHAKE_PX = 7;
/** Shake roll at trauma 1, in radians (about 2.5 degrees). */
const MAX_ROLL = 0.044;
/** Trauma lost per second. */
const TRAUMA_DECAY = 1.5;
const CHROMA_DECAY = 9;

class MutableFxState implements FxState {
  trauma = 0;
  shakeX = 0;
  shakeY = 0;
  roll = 0;
  cameraShakes: readonly CameraShakeReading[] = [];
  chroma = 0;
  readonly flashColor = new THREE.Color();
  flashAmount = 0;
  impact: ImpactKind | null = null;
  impactX = 0;
  impactY = 0;
  hitstop = 0;
}

/**
 * Simple, deterministic implementations of the hit-feel hooks. All motion is a function of the
 * render clock (the Demo camera shakes: of shake time), so fixed-time screenshots reproduce exactly.
 */
export class Fx implements FxHooks {
  readonly settings = { shake: 1, flash: 1 };
  readonly state = new MutableFxState();

  private readonly demo = new DemoCameraShakes();
  private shakeDilation = 1;
  private dirX = 0;
  private dirY = 0;
  private flashPeak = 0;
  private flashLeft = 0;
  private flashDuration = 0;
  private impactFrames = 0;
  private pendingFocus: THREE.Vector3 | null = null;

  constructor() {
    this.state.cameraShakes = this.demo.running;
  }

  get timeScale(): number {
    return this.state.hitstop > 0 ? 0 : 1;
  }

  cameraShake(kind: CameraShakeKind): void {
    this.demo.play(kind);
  }

  shakeTime(scale: number): void {
    this.shakeDilation = scale > 0 && Number.isFinite(scale) ? scale : 0;
  }

  shakeSeed(seed: number): void {
    this.demo.reseed(seed);
  }

  shake(trauma: number, direction?: { x: number; y: number }): void {
    this.state.trauma = Math.min(1, this.state.trauma + Math.max(0, trauma));
    if (direction) {
      const len = Math.hypot(direction.x, direction.y) || 1;
      this.dirX = direction.x / len;
      this.dirY = direction.y / len;
    }
  }

  hitstop(ms: number): void {
    this.state.hitstop = Math.max(this.state.hitstop, ms / 1000);
  }

  impactFrame(kind: ImpactKind, options: ImpactOptions = {}): void {
    this.state.impact = kind;
    this.impactFrames = Math.max(1, Math.round(options.frames ?? 2));
    const f = options.focus;
    this.pendingFocus = f ? new THREE.Vector3(f.x, f.y, f.z) : null;
  }

  chroma(amount: number): void {
    this.state.chroma = Math.max(this.state.chroma, Math.min(1, amount));
  }

  flash(color: Hex, options: FlashOptions = {}): void {
    this.state.flashColor.set(color);
    this.flashPeak = Math.min(1, options.intensity ?? 0.7);
    this.flashDuration = Math.max(1, options.ms ?? 120) / 1000;
    this.flashLeft = this.flashDuration;
  }

  /**
   * Advances decays and computes this frame's shake. `dt` is real time; the Demo shakes advance `dt` times the
   * `shakeTime` scale. `project` maps a world point to internal pixels.
   */
  update(dt: number, time: number, width: number, height: number, project: (p: THREE.Vector3) => { x: number; y: number }): void {
    const s = this.state;
    s.hitstop = Math.max(0, s.hitstop - dt);
    s.trauma = Math.max(0, s.trauma - TRAUMA_DECAY * dt);
    const amount = s.trauma * s.trauma * this.settings.shake;
    if (amount > 0) {
      const t = time * 22;
      const kick = noise(t, 4) * 0.6;
      s.shakeX = MAX_SHAKE_PX * amount * (noise(t, 1) + this.dirX * kick);
      s.shakeY = MAX_SHAKE_PX * amount * (noise(t, 2) + this.dirY * kick);
      s.roll = MAX_ROLL * amount * noise(t * 0.7, 3);
    } else {
      s.shakeX = s.shakeY = s.roll = 0;
      this.dirX = this.dirY = 0;
    }
    this.demo.update(dt * this.shakeDilation);
    const px = PX_PER_UU * this.settings.shake;
    s.shakeX += snapPixel(this.demo.x * px);
    s.shakeY += snapPixel(this.demo.y * px);

    s.chroma *= Math.exp(-CHROMA_DECAY * dt);
    if (s.chroma < 0.01) s.chroma = 0;

    this.flashLeft = Math.max(0, this.flashLeft - dt);
    const k = this.flashDuration > 0 ? this.flashLeft / this.flashDuration : 0;
    s.flashAmount = this.flashPeak * k * k * this.settings.flash;

    if (s.impact && this.pendingFocus) {
      const p = project(this.pendingFocus);
      s.impactX = p.x;
      s.impactY = p.y;
      this.pendingFocus = null;
    } else if (s.impact && s.impactX === 0 && s.impactY === 0) {
      s.impactX = width / 2;
      s.impactY = height / 2;
    }
  }

  /** Called after a frame is presented: counts down impact frames. */
  endFrame(): void {
    const s = this.state;
    if (s.impact && --this.impactFrames <= 0) {
      s.impact = null;
      s.impactX = s.impactY = 0;
    }
  }
}

/** Smooth deterministic 1-D value noise in [-1, 1]. */
function noise(x: number, channel: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i, channel);
  return (a + (hash(i + 1, channel) - a) * u) * 2 - 1;
}

function hash(i: number, channel: number): number {
  let h = Math.imul(i ^ Math.imul(channel, 0x27d4eb2d), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

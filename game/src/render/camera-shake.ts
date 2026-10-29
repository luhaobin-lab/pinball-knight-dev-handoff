/**
 * The Demo's camera shakes, ported from Unreal Engine 5.7 (README.md "Camera shakes" lists the engine functions and
 * what the 60 fps Demo captures confirm). Both shake classes are DefaultCameraShakeBase with bSingleInstance and a
 * PerlinNoiseCameraShakePattern root; only the location moves, on the camera's local Y (screen right) and Z (screen up).
 */
import { createRng, type Rng } from '../core/rng';
import type { CameraShakeKind, CameraShakeReading } from './api';
import { PPT } from './density';

/**
 * The shake classes (raw/Game/CatapultHero/BP/摄像机晃动_零点六.json, 摄像机晃动_零点二.json). `amplitude` and
 * `frequency` are LocationAmplitudeMultiplier and LocationFrequencyMultiplier times the Y and Z shakers' engine
 * defaults (Amplitude 1, Frequency 1); X has amplitude 0, rotation is off by default (RotationAmplitudeMultiplier 0)
 * and the FOV amplitude is 0.
 */
export const DEMO_SHAKES = {
  摄像机晃动_零点六: { amplitude: 250, frequency: 8, duration: 0.5, blendIn: 0.1, blendOut: 0.1 },
  摄像机晃动_零点二: { amplitude: 250, frequency: 4, duration: 0.3, blendIn: 0.1, blendOut: 0.1 },
} as const;

export type DemoShake = keyof typeof DEMO_SHAKES;

/**
 * What the game plays: PlayWorldCameraShake(class, 摄像机中心, inner radius 0, outer radius R, falloff 1). 'damage'
 * and 'crit' are one class, so they share its running instance, as in the Demo.
 */
export const CAMERA_SHAKES: Readonly<Record<CameraShakeKind, { readonly shake: DemoShake; readonly outerRadius: number }>> = {
  /** 蓝图_效果_反弹中 L5330: every bounce of the hero, walls and enemies alike. */
  bounce: { shake: '摄像机晃动_零点六', outerRadius: 520 },
  /** 蓝图_效果_受伤 L1391: every damage instance whose source is 攻击 or 投射物. */
  damage: { shake: '摄像机晃动_零点二', outerRadius: 550 },
  /** The same call when 是暴击？. */
  crit: { shake: '摄像机晃动_零点二', outerRadius: 750 },
};

/** Distance of the camera from 摄像机中心, the epicentre of every call: the spring arm (摄像机 SCS, TargetArmLength 500, pitch −90). */
export const CAMERA_ARM_UU = 500;

/** Internal pixels per Demo unit (1 tile = 64 uu): 0.375 at 960×540. */
export const PX_PER_UU = PPT / 64;

/** APlayerCameraManager::CalcRadialShakeScale with inner radius 0 and falloff 1, the camera on its arm. */
export function radialShakeScale(outerRadius: number): number {
  return 1 - Math.min(1, Math.max(0, CAMERA_ARM_UU / outerRadius));
}

/** Peak offset of a kind in uu: the shaker amplitude times the radial scale (9.6, 22.7 and 83.3). */
export function peakShakeUu(kind: CameraShakeKind): number {
  const call = CAMERA_SHAKES[kind];
  return DEMO_SHAKES[call.shake].amplitude * radialShakeScale(call.outerRadius);
}

/** FMath::PerlinNoise1D's sixteen lattice gradients, ±1/8 … ±8/8 (never 0). */
const GRADIENTS = [-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8].map(g => g / 8);

/**
 * A fixed shuffle of 0..255, repeated twice, standing in for the engine's fixed permutation table: of 4000 seeded
 * shuffles, the one whose per-cell peaks |noise| are distributed closest to the engine table's (mean 0.428, max 1).
 */
const PERMUTATION = (() => {
  const base = createRng('camera-shake-permutation-2739').shuffle(Array.from({ length: 256 }, (_, i) => i));
  return Uint8Array.from({ length: 512 }, (_, i) => base[i & 255]);
})();

/**
 * 1-D gradient noise built exactly like FMath::PerlinNoise1D: the lattice gradients of cells x and x + 1 picked
 * through the permutation, blended with the quintic fade 6f⁵ − 15f⁴ + 10f³, times 2. It is 0 at every integer and
 * stays in [−1, 1] (±1 only at the centre of a cell between gradients ±1 and ∓1); it repeats every 256 units.
 */
export function gradientNoise1D(x: number): number {
  const floor = Math.floor(x);
  const i = floor & 255;
  const f = x - floor;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const a = GRADIENTS[PERMUTATION[i] & 15] * f;
  const b = GRADIENTS[PERMUTATION[i + 1] & 15] * (f - 1);
  return 2 * (a + (b - a) * u);
}

/** One running Demo shake: FCameraShakeState plus the pattern's Y and Z noise offsets. */
class RunningShake implements CameraShakeReading {
  weight = 0;
  x = 0;
  y = 0;
  elapsed = 0;
  /** False once the shake has ended; the rack drops it in the same update. */
  playing = true;
  private blendInTime = 0;
  private blendingIn = true;
  private blendOutTime = 0;
  private blendingOut = false;

  constructor(
    readonly shake: DemoShake,
    public kind: CameraShakeKind,
    /** UCameraShakeBase::ShakeScale: the radial scale of the last play. */
    public scale: number,
    /** FPerlinNoiseShaker offsets of camera-local Y and Z: FMath::RandHelper(255) on a fresh start. */
    private offsetY: number,
    private offsetZ: number,
  ) {}

  /** A single-instance restart (FCameraShakeState::Start with a playing previous state): the noise runs on. */
  restart(kind: CameraShakeKind, scale: number): void {
    const { blendIn, blendOut } = DEMO_SHAKES[this.shake];
    const resumeFrom = this.blendingOut ? blendIn * (1 - this.blendOutTime / blendOut) : 0;
    this.kind = kind;
    this.scale = scale;
    this.elapsed = 0;
    this.blendOutTime = 0;
    this.blendingOut = false;
    this.blendingIn = true;
    // restarting during the blend-out turns it into a blend-in from the same weight; otherwise the weight starts at 0
    this.blendInTime = resumeFrom;
  }

  /** UPerlinNoiseCameraShakePattern::UpdateShakePatternImpl: the noise first, then the blend state. */
  update(dt: number): void {
    const c = DEMO_SHAKES[this.shake];
    this.offsetY += dt * c.frequency;
    this.offsetZ += dt * c.frequency;
    const ny = gradientNoise1D(this.offsetY);
    const nz = gradientNoise1D(this.offsetZ);

    this.elapsed += dt;
    if (this.blendingIn) this.blendInTime += dt;
    if (this.blendingOut) this.blendOutTime += dt;
    let w = 1;
    if (this.elapsed >= c.duration) {
      this.playing = false;
      w = 0;
    } else {
      const remaining = c.duration - this.elapsed;
      if (!this.blendingOut && remaining < c.blendOut) {
        this.blendingOut = true;
        this.blendOutTime = c.blendOut - remaining;
      }
      if (this.blendingIn) {
        if (this.blendInTime < c.blendIn) w *= this.blendInTime / c.blendIn;
        else {
          this.blendingIn = false;
          this.blendInTime = c.blendIn;
        }
      }
      if (this.blendingOut) {
        if (this.blendOutTime < c.blendOut) w *= 1 - this.blendOutTime / c.blendOut;
        else {
          this.playing = false;
          w = 0;
        }
      }
    }
    this.weight = w;
    const k = c.amplitude * w * this.scale;
    this.x = k * ny;
    this.y = k * nz;
  }
}

/**
 * The running Demo shakes (UCameraModifier_CameraShake's active list): one instance per class, restarted by a new
 * play of its class; the classes add up. Advance it in shake time, i.e. game time under the hit-stop dilation.
 */
export class DemoCameraShakes {
  /** The running shakes in start order; finished ones leave in the update that ends them. */
  readonly running: RunningShake[] = [];
  private rng: Rng;

  constructor(seed = 1) {
    this.rng = createRng(seed);
  }

  /** Reseeds the stream the noise offsets of fresh starts are drawn from. */
  reseed(seed: number): void {
    this.rng = createRng(seed);
  }

  play(kind: CameraShakeKind): void {
    const call = CAMERA_SHAKES[kind];
    const scale = radialShakeScale(call.outerRadius);
    const live = this.running.find(s => s.shake === call.shake);
    if (live) live.restart(kind, scale);
    else this.running.push(new RunningShake(call.shake, kind, scale, this.offset(), this.offset()));
  }

  /** Advances every running shake by `dt` seconds of shake time and drops the ones that ended. */
  update(dt: number): void {
    for (const s of this.running) s.update(dt);
    for (let i = this.running.length - 1; i >= 0; i--) if (!this.running[i].playing) this.running.splice(i, 1);
  }

  /** Summed camera offset in uu (x right, y up). */
  get x(): number {
    return this.running.reduce((sum, s) => sum + s.x, 0);
  }

  get y(): number {
    return this.running.reduce((sum, s) => sum + s.y, 0);
  }

  /** FMath::RandHelper(255): an integer in 0..254. */
  private offset(): number {
    return this.rng.int(0, 254);
  }
}

/** Rounds half away from zero, so a shake's pixel steps are symmetric about the rest position (never −0). */
export function snapPixel(v: number): number {
  return v < 0 ? -Math.round(-v) || 0 : Math.round(v);
}

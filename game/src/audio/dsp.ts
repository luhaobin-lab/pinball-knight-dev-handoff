/**
 * Pure DSP building blocks for the procedural source waves (waves.ts) and the room impulse (room.ts): seeded
 * noise, a TPT state-variable filter, struck modes, swept sines, noise grains and edge fades. Everything writes into
 * a Float32Array at a given sample rate and is a pure function of its arguments (no WebAudio, no Math.random), so
 * Node renders exactly what the browser renders.
 */

export type Curve = (t: number) => number;

/** A sample buffer that owns its memory (what AudioBuffer.copyToChannel accepts). */
export type Samples = Float32Array<ArrayBuffer>;

/** Seeded white noise in [-1, 1) (xorshift32; a zero seed is remapped). */
export function whiteNoise(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2147483648 - 1;
  };
}

/** Pink-ish noise (Paul Kellet's economy filter over seeded white noise), roughly unit RMS. */
function pinkNoise(seed: number): () => number {
  const white = whiteNoise(seed);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  return () => {
    const w = white();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    return (b0 + b1 + b2 + w * 0.1848) * 0.42;
  };
}

/** Small seeded helper for placing grains and partials inside one wave. */
export interface Dice {
  next(): number;
  range(min: number, max: number): number;
  /** Log-uniform in [min, max). */
  logRange(min: number, max: number): number;
}

export function dice(seed: number): Dice {
  const n = whiteNoise(seed);
  const next = (): number => (n() + 1) / 2;
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    logRange: (min, max) => min * Math.pow(max / min, next()),
  };
}

export type FilterMode = 'lp' | 'bp' | 'hp';

/**
 * Topology-preserving state-variable filter (Zavalishin / Simper), stable under fast cutoff modulation. The band
 * output is normalized to unit gain at the centre, so Q only sets the width.
 */
class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private k = 1;
  private readonly sampleRate: number;
  private readonly nyquistGuard: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.nyquistGuard = sampleRate * 0.49;
  }

  set(frequency: number, q: number): void {
    const f = Math.min(Math.max(frequency, 10), this.nyquistGuard);
    const g = Math.tan((Math.PI * f) / this.sampleRate);
    this.k = 1 / Math.max(q, 0.05);
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  process(x: number, mode: FilterMode): number {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    if (mode === 'lp') return v2;
    if (mode === 'bp') return this.k * v1;
    return x - this.k * v1 - v2;
  }
}

/** Filter coefficients and curves are evaluated every CONTROL samples (0.33 ms at 48 kHz) and interpolated. */
const CONTROL = 16;

const span = (out: Float32Array, sampleRate: number, from: number, to: number): [number, number] => [
  Math.max(0, Math.floor(from * sampleRate)),
  Math.min(out.length, Math.ceil(to * sampleRate)),
];

/** Every band and sweep ramps in over 1 ms and out over 4 ms inside [from, to], so no layer starts or stops on a step. */
const edge = (i: number, i0: number, i1: number, rampIn: number, rampOut: number): number =>
  Math.min(1, (i - i0 + 1) / rampIn, (i1 - i) / rampOut);

export interface NoiseBand {
  seed: number;
  /** Start and end in seconds of the output; `t` passed to the curves is relative to `from`. */
  from: number;
  to: number;
  mode: FilterMode;
  frequency: Curve;
  q: number;
  amp: Curve;
  /** 'pink' for the storm; default white. */
  colour?: 'white' | 'pink';
}

/** Adds filtered noise with a time-varying cutoff and amplitude. */
export function addNoiseBand(out: Float32Array, sampleRate: number, band: NoiseBand): void {
  const [i0, i1] = span(out, sampleRate, band.from, band.to);
  const src = band.colour === 'pink' ? pinkNoise(band.seed) : whiteNoise(band.seed);
  const svf = new Svf(sampleRate);
  const step = CONTROL / sampleRate;
  const rampIn = 0.001 * sampleRate;
  const rampOut = 0.004 * sampleRate;
  let a0 = 0;
  let a1 = band.amp(0);
  for (let i = i0; i < i1; i++) {
    const k = (i - i0) % CONTROL;
    if (k === 0) {
      const t = (i - i0) / sampleRate;
      svf.set(band.frequency(t), band.q);
      a0 = a1;
      a1 = band.amp(t + step);
    }
    out[i] += svf.process(src(), band.mode) * (a0 + ((a1 - a0) * k) / CONTROL) * edge(i, i0, i1, rampIn, rampOut);
  }
}

export interface Sweep {
  from: number;
  to: number;
  frequency: Curve;
  amp: Curve;
  /** Relative level of the 2nd and 3rd harmonics (body on small speakers). */
  h2?: number;
  h3?: number;
}

/**
 * Adds a sine whose frequency follows a curve: a rotating phasor (no sin per sample), re-tuned and renormalized
 * every CONTROL samples; it starts at phase 0, so it starts silently.
 */
export function addSweep(out: Float32Array, sampleRate: number, sweep: Sweep): void {
  const [i0, i1] = span(out, sampleRate, sweep.from, sweep.to);
  const h2 = sweep.h2 ?? 0;
  const h3 = sweep.h3 ?? 0;
  const step = CONTROL / sampleRate;
  const rampOut = 0.004 * sampleRate;
  let x = 1;
  let y = 0;
  let c = 1;
  let s = 0;
  let a0 = 0;
  let a1 = sweep.amp(0);
  for (let i = i0; i < i1; i++) {
    const k = (i - i0) % CONTROL;
    if (k === 0) {
      const t = (i - i0) / sampleRate;
      const w = (2 * Math.PI * sweep.frequency(t + step / 2)) / sampleRate;
      c = Math.cos(w);
      s = Math.sin(w);
      const m = 1 / Math.hypot(x, y);
      x *= m;
      y *= m;
      a0 = a1;
      a1 = sweep.amp(t + step);
    }
    const v = y + (h2 ? 2 * h2 * x * y : 0) + (h3 ? h3 * (3 * y - 4 * y * y * y) : 0);
    out[i] += v * (a0 + ((a1 - a0) * k) / CONTROL) * Math.min(1, (i1 - i) / rampOut);
    const nx = c * x - s * y;
    y = s * x + c * y;
    x = nx;
  }
}

export interface Mode {
  frequency: number;
  amp: number;
  /** Exponential decay time constant in seconds. */
  tau: number;
  /** Start phase in radians (0 starts the mode silently). */
  phase?: number;
}

/**
 * Adds struck modes from time `at`: decaying sinusoids A·rⁿ·sin(ωn + φ) from a two-pole recursion (no sin per
 * sample), rendered down to −60 dB. `attack` (seconds) softens the strike edge over its first few time constants.
 */
export function addModes(out: Float32Array, sampleRate: number, at: number, modes: readonly Mode[], attack = 0.0005): void {
  const i0 = Math.max(0, Math.floor(at * sampleRate));
  const ka = attack > 0 ? Math.exp(-1 / (attack * sampleRate)) : 0;
  const attackEnd = attack > 0 ? Math.ceil(attack * 9.2 * sampleRate) : 0;
  for (const m of modes) {
    if (m.frequency >= sampleRate * 0.48 || m.amp === 0) continue;
    const end = Math.min(out.length, Math.ceil((at + m.tau * 6.9) * sampleRate));
    const w = (2 * Math.PI * m.frequency) / sampleRate;
    const r = Math.exp(-1 / (m.tau * sampleRate));
    const a1 = 2 * r * Math.cos(w);
    const a2 = r * r;
    const phase = m.phase ?? 0;
    let y1 = (m.amp * Math.sin(phase - w)) / r;
    let y2 = (m.amp * Math.sin(phase - 2 * w)) / (r * r);
    const split = Math.min(end, i0 + attackEnd);
    let rise = 1;
    for (let i = i0; i < split; i++) {
      const y = a1 * y1 - a2 * y2;
      out[i] += y * (1 - rise);
      rise *= ka;
      y2 = y1;
      y1 = y;
    }
    for (let i = split; i < end; i++) {
      const y = a1 * y1 - a2 * y2;
      out[i] += y;
      y2 = y1;
      y1 = y;
    }
  }
}

export interface Grain {
  /** Start in seconds. */
  t: number;
  dur: number;
  frequency: number;
  q: number;
  amp: number;
}

/** Adds Hann-windowed band-passed noise bursts (crunch, crackle, droplet ticks). */
export function addGrains(out: Float32Array, sampleRate: number, seed: number, grains: readonly Grain[]): void {
  const src = whiteNoise(seed);
  const svf = new Svf(sampleRate);
  for (const g of grains) {
    const i0 = Math.max(0, Math.floor(g.t * sampleRate));
    const n = Math.max(2, Math.round(g.dur * sampleRate));
    const i1 = Math.min(out.length, i0 + n);
    svf.set(g.frequency, g.q);
    for (let i = i0; i < i1; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (n - 1));
      out[i] += svf.process(src(), 'bp') * w * g.amp;
    }
  }
}

export interface Bubble {
  t: number;
  /** Start frequency; a bubble's resonance rises as it closes. */
  frequency: number;
  rise: number;
  dur: number;
  amp: number;
}

/** Adds bubble chirps: a sine rising by `rise` over `dur` with a fast exponential decay (wet squelch, drips). */
export function addBubbles(out: Float32Array, sampleRate: number, bubbles: readonly Bubble[]): void {
  for (const b of bubbles) {
    const tau = b.dur / 3.5;
    addSweep(out, sampleRate, {
      from: b.t,
      to: b.t + b.dur * 1.6,
      frequency: t => b.frequency * Math.pow(b.rise, Math.min(1, t / b.dur)),
      amp: t => b.amp * Math.exp(-t / tau) * (t < 0.0015 ? 0.5 - 0.5 * Math.cos((Math.PI * t) / 0.0015) : 1),
    });
  }
}

/** Raised-cosine fade-in and fade-out at the buffer edges (seconds). */
export function fadeEdges(out: Float32Array, sampleRate: number, fadeIn: number, fadeOut: number): void {
  const nIn = Math.min(out.length, Math.round(fadeIn * sampleRate));
  for (let i = 0; i < nIn; i++) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / nIn);
  const nOut = Math.min(out.length, Math.round(fadeOut * sampleRate));
  for (let i = 0; i < nOut; i++) out[out.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / nOut);
}

/** tanh saturation normalized to keep ±1 at ±1: thickens a body and lowers its crest factor. */
export function saturate(out: Float32Array, drive: number): void {
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  if (max === 0) return;
  const k = drive / max;
  const norm = max / Math.tanh(drive);
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * k) * norm;
}

/** Scales to a peak of 1 (silence stays silent). */
export function normalizePeak(out: Float32Array): void {
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  if (max === 0) return;
  const g = 1 / max;
  for (let i = 0; i < out.length; i++) out[i] *= g;
}

/**
 * Turns `src` (loop length + crossfade) into a seamless loop of `loopSamples`: the tail past the loop point is
 * blended into the head with an equal-power crossfade.
 */
export function seamlessLoop(src: Samples, loopSamples: number): Samples {
  const fade = src.length - loopSamples;
  if (fade <= 0) return src.slice(0, loopSamples);
  const out = src.slice(0, loopSamples);
  for (let i = 0; i < fade; i++) {
    const a = (i + 0.5) / fade;
    out[i] = out[i] * Math.sin((Math.PI / 2) * a) + src[loopSamples + i] * Math.cos((Math.PI / 2) * a);
  }
  return out;
}

/** Common envelope shapes (t in seconds). */
export const env = {
  /** Linear attack then exponential decay. */
  ad(attack: number, tau: number): Curve {
    return t => (t < attack ? t / attack : Math.exp(-(t - attack) / tau));
  },
  /** Smooth rise to 1 at `peak`, then a smooth fall to 0 at `end` (a pass-by). */
  swell(peak: number, end: number, fall = 1.6): Curve {
    return t => {
      if (t <= 0 || t >= end) return 0;
      if (t < peak) {
        const u = t / peak;
        return u * u * (3 - 2 * u);
      }
      const u = (t - peak) / (end - peak);
      return Math.pow(1 - u, fall) * (1 - u * u * 0.2);
    };
  },
};

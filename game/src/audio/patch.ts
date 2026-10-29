import type { Rng } from '../core/rng.ts';
import { tilesToUu } from '../core/launch/units.ts';
import { ATTENUATION, WIND, type CueDef, type LayerDef } from './cues.ts';
import { WAVES, type WaveId } from './waves.ts';

/**
 * The shared one-shot patch 音效_基础 (dump 声音/音效_基础.json) as plain numbers, and the spatial model.
 *
 * Per play the patch rolls RandomFloat(−5, 5) semitones r and feeds the Wave Player r + 12·log2(播放速度) (a
 * resample), then a Delay Pitch Shift of 音高 − 12·log2(播放速度) (pure pitch), so the result is pitch r + 音高 at
 * tempo 播放速度·2^(r/12). Then the one-pole high-pass (Cutoff Frequency), × 音量, × an AD envelope (Attack Time
 * 0.01 s, linear decay over 最长时间, curves 1.0), and the wave stops at 最长时间.
 */

export const PATCH = {
  /** RandomFloat Min/Max of 音效_基础. */
  randomSemitones: 5,
  /** AD Envelope default Attack Time (the graph leaves it unset). */
  attack: 0.01,
} as const;

/** Pure pitch shifts are rendered on a grid of this many semitones (variants are cached per step). */
const PITCH_STEP = 1;
/** The step's roll u is rendered on a grid of this step (its volume uses the exact roll). */
const ROLL_STEP = 0.5;

export const ratio = (semitones: number): number => 2 ** (semitones / 12);

/** One layer of a planned voice, everything the engine needs to schedule it. */
export interface LayerPlan {
  readonly wave: WaveId;
  /** Pure pitch baked into the rendered wave (音高 + the rolled pitch, on the grid), semitones. */
  readonly bakedPitch: number;
  /** Tempo baked into the rendered wave (播放速度). */
  readonly tempo: number;
  /** The patch's random resample: playbackRate = 2^(resample/12). */
  readonly resample: number;
  readonly highpass: number;
  /** 音量 (× the roll) × the wave's trim. */
  readonly gain: number;
  readonly delay: number;
  readonly maxTime: number;
}

export interface VoicePlan {
  readonly layers: readonly LayerPlan[];
  /** Seconds from the play to OnFinished: the voice's lifetime and when every layer is cut. */
  readonly lifetime: number;
  readonly gain: number;
}

/** Key of the rendered buffer a layer needs. */
export const bufferKey = (l: Pick<LayerPlan, 'wave' | 'bakedPitch' | 'tempo'>): string => `${l.wave}|${l.bakedPitch.toFixed(4)}|${l.tempo}`;

/** Remembers the last pick of each multi-wave layer (Random Get, No Repeats 1, shared state). */
export type PickMemory = Map<string, number>;

/**
 * Rolls one play of `cue`. Draw order per layer: wave pick, roll, extra pitch, the patch's resample. Every call
 * draws the same count for the same cue, so the stream never depends on what was audible.
 */
export function planVoice(name: string, cue: CueDef, rng: Rng, picks: PickMemory): VoicePlan {
  return voice(
    cue,
    cue.layers.map((l, i) => {
      const wave = pickWave(`${name}:${i}`, l, rng, picks);
      const u = l.roll ? rng.range(l.roll[0], l.roll[1]) : 1;
      const extra = l.pitchRandom ? rng.range(-l.pitchRandom, l.pitchRandom) : 0;
      return layerPlan(l, wave, u, extra, rng.range(-PATCH.randomSemitones, PATCH.randomSemitones));
    }),
  );
}

/** The cue at the centre of every roll: no resample, no extra pitch, the roll's middle, the `variant`-th wave. */
export function nominalPlan(cue: CueDef, variant = 0): VoicePlan {
  return voice(
    cue,
    cue.layers.map(l => layerPlan(l, l.waves[Math.min(variant, l.waves.length - 1)], l.roll ? (l.roll[0] + l.roll[1]) / 2 : 1, 0, 0)),
  );
}

function layerPlan(l: LayerDef, wave: WaveId, u: number, extra: number, resample: number): LayerPlan {
  const rolledPitch = l.roll ? l.pitch * Math.round(u / ROLL_STEP) * ROLL_STEP : l.pitch;
  return {
    wave,
    bakedPitch: rolledPitch + Math.round(extra / PITCH_STEP) * PITCH_STEP,
    tempo: l.tempo,
    resample,
    highpass: l.highpass,
    gain: l.volume * u * 10 ** (WAVES[wave].trimDb / 20),
    delay: l.delay,
    maxTime: l.maxTime,
  };
}

function voice(cue: CueDef, layers: LayerPlan[]): VoicePlan {
  const finish = cue.layers[cue.finishLayer];
  return { layers, lifetime: finish.delay + PATCH.attack + finish.maxTime, gain: cue.gain };
}

function pickWave(key: string, l: LayerDef, rng: Rng, picks: PickMemory): WaveId {
  if (l.waves.length === 1) return l.waves[0];
  const last = picks.get(key);
  const options = l.waves.map((_, i) => i).filter(i => i !== last);
  const index = options[Math.floor(rng.next() * options.length)];
  picks.set(key, index);
  return l.waves[index];
}

export interface WindPlan {
  /** Semitones: 15 × Speed + the roll at OnPlay. */
  readonly pitch: number;
  readonly rate: number;
  /** 音量 × Speed (音量 = 0.4 × Speed), × the storm wave's trim. */
  readonly gain: number;
}

/** The wind loop for a random offset (the RandomFloat(−5, 5) rolled when it starts). */
export function windPlan(offset: number): WindPlan {
  const pitch = WIND.pitchPerSpeed * WIND.speed + offset;
  return { pitch, rate: ratio(pitch), gain: WIND.volumePerSpeed * WIND.speed * WIND.speed * 10 ** (WAVES[WIND.wave].trimDb / 20) };
}

/** Bilinear (prewarped, TPT) one-pole coefficients for an IIRFilterNode, as UE's One-Pole filter nodes. */
export function onePole(kind: 'lowpass' | 'highpass', cutoff: number, sampleRate: number): { feedforward: number[]; feedback: number[] } {
  const k = Math.tan((Math.PI * Math.min(cutoff, sampleRate * 0.49)) / sampleRate);
  const pole = (k - 1) / (k + 1);
  return kind === 'lowpass' ? { feedforward: [k / (1 + k), k / (1 + k)], feedback: [1, pole] } : { feedforward: [1 / (1 + k), -1 / (1 + k)], feedback: [1, pole] };
}

/** Linear attenuation of 音效衰减_默认 at a distance in uu. */
export function attenuation(distanceUu: number): number {
  return Math.min(1, Math.max(0, 1 - (distanceUu - ATTENUATION.inner) / ATTENUATION.falloff));
}

/**
 * SPEC-GAP: UE pans by the source's azimuth around a listener whose axes come from the hero's flipbook rotation
 * (engine-side). We use a small pan by the screen-x offset: ±PAN.max at half the Demo's view width (2560 uu).
 */
const PAN = { max: 0.5, range: 1280 } as const;

function panFor(dxUu: number): number {
  return PAN.max * Math.min(1, Math.max(-1, dxUu / PAN.range));
}

/** A fixed point on the floor (tiles), or null for sounds at the listener (attached or 2D). */
export type Place = { readonly x: number; readonly z: number } | null;

export interface Spatial {
  /** uu */
  readonly distance: number;
  readonly gain: number;
  readonly pan: number;
}

export function spatial(place: Place, listener: { readonly x: number; readonly z: number }): Spatial {
  if (!place) return { distance: 0, gain: 1, pan: 0 };
  const dx = tilesToUu(place.x - listener.x);
  const distance = Math.hypot(dx, tilesToUu(place.z - listener.z));
  return { distance, gain: attenuation(distance), pan: panFor(dx) };
}

/** Every buffer a play can ask for, most needed first (the nominal rolls, then the other grid steps). */
export function bufferVariants(cues: readonly CueDef[]): Pick<LayerPlan, 'wave' | 'bakedPitch' | 'tempo'>[] {
  const nominal: Pick<LayerPlan, 'wave' | 'bakedPitch' | 'tempo'>[] = [];
  const rest: Pick<LayerPlan, 'wave' | 'bakedPitch' | 'tempo'>[] = [];
  for (const cue of cues) {
    for (const l of cue.layers) {
      const pitches = l.roll
        ? range(l.roll[0], l.roll[1], ROLL_STEP).map(u => l.pitch * u)
        : range(-l.pitchRandom, l.pitchRandom, PITCH_STEP).map(k => l.pitch + k);
      const mid = l.roll ? l.pitch * Math.round((l.roll[0] + l.roll[1]) / 2 / ROLL_STEP) * ROLL_STEP : l.pitch;
      for (const wave of l.waves) {
        for (const bakedPitch of pitches) (Math.abs(bakedPitch - mid) < 1e-9 ? nominal : rest).push({ wave, bakedPitch, tempo: l.tempo });
      }
    }
  }
  return [...nominal, ...rest];
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

import { whiteNoise, type Samples } from './dsp.ts';

/**
 * The room the Demo's sounds play in. Every SFX wave is in 音效类_声效, whose default submix 子混音_声效混响 runs
 * 预设_声效混响 (DryLevel 0.75, Gain 0.45), and 音效衰减_默认 sends 0.8 to the level's AudioVolume reverb
 * (TA2: 默认混响, UE's default ReverbEffect: DecayTime 1.49 s, DecayHFRatio 0.83, ReflectionsDelay 0.007 s,
 * LateDelay 0.011 s). We fold both into one convolution: the dry path at 0.75 and this impulse at ROOM.wet.
 */
export const ROOM = {
  dry: 0.75,
  /**
   * SPEC-GAP: UE's plate-reverb gain staging (submix WetLevel default, Gain 0.45, the AudioVolume send 0.8) is
   * engine code, not in the dump. 0.19 puts the tail 12 dB under the dry path (a stone room, not a hall).
   */
  wet: 0.19,
  decay: 1.49,
  decayHfRatio: 0.83,
  reflectionsDelay: 0.007,
  lateDelay: 0.011,
  length: 1.8,
} as const;

const CROSSOVER_HZ = 2500;

/** Stereo impulse response (unit energy per channel): early taps, then two-band exponentially decaying noise. */
export function roomImpulse(sampleRate: number, seed: number): [Samples, Samples] {
  const n = Math.round(ROOM.length * sampleRate);
  const channels: [Samples, Samples] = [new Float32Array(n), new Float32Array(n)];
  const lateStart = ROOM.reflectionsDelay + ROOM.lateDelay;
  const kLow = Math.log(1000) / ROOM.decay;
  const kHigh = Math.log(1000) / (ROOM.decay * ROOM.decayHfRatio);
  const a = Math.exp((-2 * Math.PI * CROSSOVER_HZ) / sampleRate);
  channels.forEach((out, ch) => {
    const noise = whiteNoise(seed * 2 + ch + 1);
    const taps = whiteNoise(seed * 7 + ch + 3);
    for (let i = 0; i < 6; i++) {
      const t = ROOM.reflectionsDelay + ((i + (taps() + 1) / 2) / 6) * 0.033;
      out[Math.round(t * sampleRate)] += (i % 2 ? -1 : 1) * 0.9 * Math.exp(-i * 0.25);
    }
    let low = 0;
    for (let i = Math.round(lateStart * sampleRate); i < n; i++) {
      const t = i / sampleRate - lateStart;
      const x = noise();
      low = (1 - a) * x + a * low;
      const high = x - low;
      const build = 1 - Math.exp(-t / 0.012);
      const tail = i > n - sampleRate * 0.1 ? (n - i) / (sampleRate * 0.1) : 1;
      out[i] += (low * Math.exp(-kLow * t) + high * Math.exp(-kHigh * t)) * build * tail * 0.35;
    }
    let energy = 0;
    for (let i = 0; i < n; i++) energy += out[i] * out[i];
    const g = 1 / Math.sqrt(energy);
    for (let i = 0; i < n; i++) out[i] *= g;
  });
  return channels;
}

/**
 * Measurement and export for QA (the audio-sfx debug scene and tests): levels, onset and length, spectral
 * centroid, a short-time spectrum for spectrograms, and 16-bit PCM WAV encoding. Pure functions over sample
 * arrays.
 */

export interface Metrics {
  /** Seconds from the first sample to the last one above −60 dBFS. */
  duration: number;
  /** Sample peak, dBFS. */
  peakDb: number;
  /** RMS from the onset to the end of `duration`, dBFS. */
  rmsDb: number;
  /** Loudest 50-ms window RMS, dBFS (how loud the cue reads). */
  rmsMax50Db: number;
  /** Energy-weighted mean frequency over the active part, Hz. */
  centroidHz: number;
  /** First time the 5-ms RMS exceeds −50 dBFS, seconds. */
  onset: number;
  /** |first sample| and the RMS of the last 5 ms, dBFS (click checks; −200 is digital silence). */
  startDb: number;
  endDb: number;
}

const toDb = (x: number): number => (x > 1e-10 ? 20 * Math.log10(x) : -200);
const round = (x: number, digits = 2): number => Number(x.toFixed(digits));

/** Mono mix of the channels (mean). */
export function mixDown(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

function windowRms(x: Float32Array, from: number, n: number): number {
  let sum = 0;
  const end = Math.min(x.length, from + n);
  for (let i = from; i < end; i++) sum += x[i] * x[i];
  return Math.sqrt(sum / Math.max(1, end - from));
}

/** Measures one rendered cue. `channels` are the output channels (the louder channel sets the peak). */
export function measure(channels: readonly Float32Array[], sampleRate: number): Metrics {
  const mono = mixDown(channels);
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  const floor = 10 ** (-60 / 20);
  let last = 0;
  for (let i = mono.length - 1; i >= 0; i--) {
    if (Math.abs(mono[i]) > floor) {
      last = i;
      break;
    }
  }
  const w5 = Math.max(1, Math.round(0.005 * sampleRate));
  let onset = 0;
  for (let i = 0; i + w5 <= mono.length; i += Math.max(1, w5 >> 2)) {
    if (windowRms(mono, i, w5) > 10 ** (-50 / 20)) {
      onset = i;
      break;
    }
  }
  const active = Math.max(1, last - onset + 1);
  const w50 = Math.round(0.05 * sampleRate);
  let rmsMax = 0;
  for (let i = onset; i < last; i += Math.max(1, w50 >> 3)) rmsMax = Math.max(rmsMax, windowRms(mono, i, w50));
  let lastRms = 0;
  for (const ch of channels) lastRms = Math.max(lastRms, windowRms(ch, ch.length - w5, w5));
  let start = 0;
  for (const ch of channels) start = Math.max(start, Math.abs(ch[0]));
  return {
    duration: round(last / sampleRate, 3),
    peakDb: round(toDb(peak)),
    rmsDb: round(toDb(windowRms(mono, onset, active))),
    rmsMax50Db: round(toDb(rmsMax)),
    centroidHz: Math.round(spectralCentroid(mono.subarray(onset, last + 1), sampleRate)),
    onset: round(onset / sampleRate, 4),
    startDb: round(toDb(start)),
    endDb: round(toDb(lastRms)),
  };
}

export interface CutMetrics {
  /** 5-ms RMS of the output just before the voice is stolen, dBFS. */
  beforeDb: number;
  /** 2-ms RMS just before its sources stop and just after, dBFS (the room's tail goes on). */
  atStopDb: number;
  afterStopDb: number;
  /** atStopDb − beforeDb: what is left of the voice when its sources stop (down to the room's tail when faded). */
  residualDb: number;
  /** atStopDb − afterStopDb: a cut is a drop at the stop; a voice that faded out first leaves none (≤ 0 ± the tail's noise). */
  stepDb: number;
}

/** How a stolen voice ends (`stealAt`, `stopAt` in output seconds, latency included): faded out or cut. */
export function stealCut(channels: readonly Float32Array[], sampleRate: number, stealAt: number, stopAt: number): CutMetrics {
  const mono = mixDown(channels);
  const ms = Math.round(0.001 * sampleRate);
  const stop = Math.round(stopAt * sampleRate);
  const before = toDb(windowRms(mono, Math.round(stealAt * sampleRate) - 5 * ms, 5 * ms));
  const at = toDb(windowRms(mono, stop - 2 * ms, 2 * ms));
  const after = toDb(windowRms(mono, stop, 2 * ms));
  return { beforeDb: round(before), atStopDb: round(at), afterStopDb: round(after), residualDb: round(at - before), stepDb: round(at - after) };
}

/** In-place radix-2 FFT (re, im of length 2^k). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    const wr = Math.cos(a);
    const wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

export interface Spectrum {
  /** Power per frame and bin (frames × bins), linear. */
  power: Float32Array[];
  binHz: number;
  hopSeconds: number;
}

/** Short-time power spectrum (Hann window). */
export function stft(x: Float32Array, sampleRate: number, size = 2048, hop = 256): Spectrum {
  const win = new Float64Array(size).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  const power: Float32Array[] = [];
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let start = -size / 2; start < x.length - size / 2; start += hop) {
    for (let i = 0; i < size; i++) {
      const j = start + i;
      re[i] = j >= 0 && j < x.length ? x[j] * win[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    const frame = new Float32Array(size / 2);
    for (let k = 0; k < size / 2; k++) frame[k] = re[k] * re[k] + im[k] * im[k];
    power.push(frame);
  }
  return { power, binHz: sampleRate / size, hopSeconds: hop / sampleRate };
}

/** Energy-weighted spectral centroid of a whole signal, Hz. */
function spectralCentroid(x: Float32Array, sampleRate: number): number {
  if (x.length === 0) return 0;
  const { power, binHz } = stft(x, sampleRate, 2048, 512);
  let num = 0;
  let den = 0;
  for (const frame of power) {
    for (let k = 1; k < frame.length; k++) {
      num += frame[k] * k * binHz;
      den += frame[k];
    }
  }
  return den > 0 ? num / den : 0;
}

/** 16-bit PCM WAV of interleaved channels (clipped to ±1). */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const frames = channels[0].length;
  const n = channels.length;
  const data = frames * n * 2;
  const buf = new ArrayBuffer(44 + data);
  const v = new DataView(buf);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  v.setUint32(4, 36 + data, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, n, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * n * 2, true);
  v.setUint16(32, n * 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, data, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < n; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, Math.round(s * 32767), true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

import { WIND, type BusName } from './cues.ts';
import { bufferKey, onePole, PATCH, ratio, spatial, type LayerPlan, type Place, type VoicePlan, type WindPlan } from './patch.ts';
import { ROOM, roomImpulse } from './room.ts';
import { WAVES } from './waves.ts';

/**
 * The WebAudio side: one graph per context (a live AudioContext or the debug scene's OfflineAudioContext).
 *
 *   voice layer: buffer source (playbackRate = the patch's resample) → AD envelope × 音量 → the voice's chain
 *   chain (one per high-pass cutoff in the voice): sum → stereo pan → distance gain → shared one-pole HPF → sfx bus ─┐
 *   wind loop → loop gain → shared one-pole LPF 1 kHz → ambience bus ───────────────────────────────────────────────┤
 *                     room: dry 0.75 + convolution reverb → master bus → limiter → trim → safety clip → destination
 *
 * The one-pole filters are shared, after the per-voice gains: they are linear and time-invariant and the gains move
 * slowly, so this equals UE's per-voice order, and Chromium spends ~12 ms building each IIRFilterNode (it measures
 * the tail by brute force), which no voice could afford.
 */

/**
 * Master limiter: a DynamicsCompressorNode near brick-wall, above the level of any single cue, so it only acts when
 * cues pile up. WebAudio adds automatic makeup gain ((1 / curve(0 dBFS))^0.6 = +1.14 dB here); TRIM puts its static
 * ceiling at −3 dBFS. Its detector still lets ~1 ms transients through (Chromium's minimum attack), so a soft clip
 * catches the overshoot: transparent to −3 dBFS, then a tanh knee that never exceeds −1 dBFS.
 */
const LIMITER = { threshold: -2, knee: 0, ratio: 20, attack: 0, release: 0.12 } as const;
const TRIM = 0.75;
export const CLIP = { knee: 10 ** (-3 / 20), ceiling: 10 ** (-1 / 20), range: 2 } as const;

/** WaveShaper curve over inputs ±CLIP.range (scaled into the shaper's ±1 domain and back). */
export function clipCurve(points = 4096): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = ((i / (points - 1)) * 2 - 1) * CLIP.range;
    const a = Math.abs(x);
    const y = a <= CLIP.knee ? a : CLIP.knee + (CLIP.ceiling - CLIP.knee) * Math.tanh((a - CLIP.knee) / (CLIP.ceiling - CLIP.knee));
    curve[i] = (Math.sign(x) * y) / CLIP.range;
  }
  return curve;
}
/** Listener moves glide the pan and attenuation of playing voices (no zipper noise). */
const GLIDE = 0.02;
/**
 * A stolen voice fades out over this time constant (UE's VoiceStealReleaseTime 0 still avoids a click); its sources
 * stop after STEAL_STOPS of them (e^−8: −70 dB).
 */
export const STEAL = 0.003;
export const STEAL_STOPS = 8;
const WIND_FADE_IN = 0.02;
const WIND_FADE_OUT = 0.1;

interface Chain {
  readonly sum: GainNode;
  readonly pan: StereoPannerNode;
  readonly out: GainNode;
}

interface LiveVoice {
  readonly place: Place;
  readonly sources: AudioBufferSourceNode[];
  readonly nodes: AudioNode[];
  readonly chains: Chain[];
  /** Set by stop(): the voice is fading out until its sources end, and nothing else may move its gains. */
  stolen: boolean;
}

export class Engine {
  readonly ctx: BaseAudioContext;
  private readonly buses: Record<BusName, GainNode>;
  private readonly room: GainNode;
  private readonly reverb: ConvolverNode;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly voices = new Map<number, LiveVoice>();
  private readonly highpasses = new Map<number, AudioNode>();
  private windFilter: AudioNode | null = null;
  private windNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private prewarmTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly seed: number;

  constructor(ctx: BaseAudioContext, seed: number) {
    this.ctx = ctx;
    this.seed = seed;
    const gain = (value: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = value;
      return g;
    };
    const master = gain(1);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = LIMITER.threshold;
    limiter.knee.value = LIMITER.knee;
    limiter.ratio.value = LIMITER.ratio;
    limiter.attack.value = LIMITER.attack;
    limiter.release.value = LIMITER.release;
    const trim = gain(TRIM / CLIP.range);
    const clip = ctx.createWaveShaper();
    clip.curve = clipCurve();
    clip.oversample = '4x';
    const unscale = gain(CLIP.range);
    master.connect(limiter);
    limiter.connect(trim);
    trim.connect(clip);
    clip.connect(unscale);
    unscale.connect(ctx.destination);
    this.room = gain(1);
    const dry = gain(ROOM.dry);
    const wet = gain(ROOM.wet);
    this.reverb = ctx.createConvolver();
    this.reverb.normalize = false;
    this.room.connect(dry);
    dry.connect(master);
    this.room.connect(this.reverb);
    this.reverb.connect(wet);
    wet.connect(master);
    const sfx = gain(1);
    const ambience = gain(1);
    sfx.connect(this.room);
    ambience.connect(this.room);
    this.buses = { master, sfx, ambience };
  }

  setVolume(bus: BusName, value: number): void {
    this.buses[bus].gain.setTargetAtTime(value, this.ctx.currentTime, GLIDE);
  }

  /** The rendered buffer of one layer (rendered now if prewarming has not reached it). */
  buffer(l: Pick<LayerPlan, 'wave' | 'bakedPitch' | 'tempo'>): AudioBuffer {
    const key = bufferKey(l);
    let buf = this.buffers.get(key);
    if (!buf) {
      const wave = WAVES[l.wave];
      const rate = this.ctx.sampleRate * wave.rate;
      const data = wave.render(rate, ratio(l.bakedPitch), 1 / l.tempo);
      buf = this.ctx.createBuffer(1, data.length, rate);
      buf.copyToChannel(data, 0);
      this.buffers.set(key, buf);
    }
    return buf;
  }

  /** The shared high-pass at `cutoff` Hz, into the sfx bus. */
  private highpass(cutoff: number): AudioNode {
    let node = this.highpasses.get(cutoff);
    if (!node) {
      const { feedforward, feedback } = onePole('highpass', cutoff, this.ctx.sampleRate);
      node = this.ctx.createIIRFilter(feedforward, feedback);
      node.connect(this.buses.sfx);
      this.highpasses.set(cutoff, node);
    }
    return node;
  }

  /**
   * Builds the room impulse, the shared high-passes at `cutoffs` and the `variants`' buffers, one per macrotask, so
   * no frame takes the whole cost.
   */
  prewarm(variants: readonly Pick<LayerPlan, 'wave' | 'bakedPitch' | 'tempo'>[], cutoffs: readonly number[]): void {
    const queue: (() => void)[] = [
      () => this.ensureRoom(),
      ...cutoffs.map(c => () => void this.highpass(c)),
      ...variants.map(v => () => void this.buffer(v)),
    ];
    const next = (): void => {
      this.prewarmTimer = null;
      queue.shift()?.();
      if (queue.length) this.prewarmTimer = setTimeout(next, 0);
    };
    this.prewarmTimer = setTimeout(next, 0);
  }

  private ensureRoom(): void {
    if (this.reverb.buffer) return;
    const [l, r] = roomImpulse(this.ctx.sampleRate, this.seed);
    const ir = this.ctx.createBuffer(2, l.length, this.ctx.sampleRate);
    ir.copyToChannel(l, 0);
    ir.copyToChannel(r, 1);
    this.reverb.buffer = ir;
  }

  /** Schedules a planned voice to start now. */
  start(id: number, plan: VoicePlan, place: Place, listener: { x: number; z: number }): void {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const end = t0 + plan.lifetime;
    this.ensureRoom();
    const s = spatial(place, listener);
    const voice: LiveVoice = { place, sources: [], nodes: [], chains: [], stolen: false };
    const chains = new Map<number, Chain>();
    const chainFor = (cutoff: number): Chain => {
      let chain = chains.get(cutoff);
      if (!chain) {
        const sum = ctx.createGain();
        // the cue stops at OnFinished: a 5-ms fade so a layer still sounding is cut without a click
        sum.gain.setValueAtTime(plan.gain, t0);
        sum.gain.setValueAtTime(plan.gain, end - 0.005);
        sum.gain.linearRampToValueAtTime(0, end);
        const pan = ctx.createStereoPanner();
        pan.pan.value = s.pan;
        const out = ctx.createGain();
        out.gain.value = s.gain;
        sum.connect(pan);
        pan.connect(out);
        out.connect(cutoff > 0 ? this.highpass(cutoff) : this.buses.sfx);
        chain = { sum, pan, out };
        chains.set(cutoff, chain);
        voice.chains.push(chain);
        voice.nodes.push(sum, pan, out);
      }
      return chain;
    };
    let pending = 0;
    for (const l of plan.layers) {
      const at = t0 + l.delay;
      if (at >= end) continue;
      const buf = this.buffer(l);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const rate = ratio(l.resample);
      src.playbackRate.value = rate;
      const envelope = ctx.createGain();
      const decayEnd = at + PATCH.attack + l.maxTime;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(l.gain, at + PATCH.attack);
      envelope.gain.linearRampToValueAtTime(0, decayEnd);
      src.connect(envelope);
      envelope.connect(chainFor(l.highpass).sum);
      voice.nodes.push(src, envelope);
      voice.sources.push(src);
      src.start(at);
      src.stop(Math.min(at + buf.duration / rate, decayEnd, end) + 0.005);
      pending++;
      src.onended = () => {
        if (--pending === 0) this.release(id);
      };
    }
    this.voices.set(id, voice);
    if (pending === 0) this.release(id);
  }

  /**
   * Steals a playing voice (concurrency eviction): its distance gains fade to silence and its sources stop once
   * silent. The voice stays in `voices` until they end (release() disconnects it), marked stolen: a listener glide
   * back to its distance gain would undo the fade, and the stop would cut it.
   */
  stop(id: number): void {
    const v = this.voices.get(id);
    if (!v || v.stolen) return;
    v.stolen = true;
    const now = this.ctx.currentTime;
    for (const c of v.chains) {
      c.out.gain.cancelScheduledValues(now);
      c.out.gain.setTargetAtTime(0, now, STEAL);
    }
    for (const src of v.sources) src.stop(now + STEAL * STEAL_STOPS);
  }

  /** Glides every positioned voice still playing (not stolen) to its new pan and attenuation. */
  moveListener(listener: { x: number; z: number }): void {
    const now = this.ctx.currentTime;
    for (const v of this.voices.values()) {
      if (!v.place || v.stolen) continue;
      const s = spatial(v.place, listener);
      for (const c of v.chains) {
        c.pan.pan.setTargetAtTime(s.pan, now, GLIDE);
        c.out.gain.setTargetAtTime(s.gain, now, GLIDE);
      }
    }
  }

  /** Starts the ambience loop (fading out a running one), or only fades it out with null. */
  wind(plan: WindPlan | null): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (this.windNodes) {
      const { source, gain } = this.windNodes;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, WIND_FADE_OUT / 3);
      source.stop(now + WIND_FADE_OUT * 2);
      this.windNodes = null;
    }
    if (!plan) return;
    const source = ctx.createBufferSource();
    source.buffer = this.buffer({ wave: WIND.wave, bakedPitch: 0, tempo: 1 });
    source.loop = true;
    source.playbackRate.value = plan.rate;
    if (!this.windFilter) {
      const { feedforward, feedback } = onePole('lowpass', WIND.lowpass, ctx.sampleRate);
      this.windFilter = ctx.createIIRFilter(feedforward, feedback);
      this.windFilter.connect(this.buses.ambience);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(plan.gain, now + WIND_FADE_IN);
    source.connect(gain);
    gain.connect(this.windFilter);
    source.start(now);
    this.windNodes = { source, gain };
  }

  dispose(): void {
    if (this.prewarmTimer !== null) clearTimeout(this.prewarmTimer);
    this.prewarmTimer = null;
    for (const id of [...this.voices.keys()]) this.stop(id);
    this.wind(null);
  }

  private release(id: number): void {
    const v = this.voices.get(id);
    if (!v) return;
    this.voices.delete(id);
    for (const n of v.nodes) n.disconnect();
  }
}

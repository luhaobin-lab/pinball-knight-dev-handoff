import { uuToTiles } from '../../core/launch/units.ts';
import { CUES, type CueName } from '../cues.ts';
import { Engine, STEAL, STEAL_STOPS } from '../engine.ts';
import { createAudio, type Audio, type AudioEvent } from '../index.ts';
import { nominalPlan, windPlan } from '../patch.ts';

/**
 * Offline renders for QA (the audio-sfx debug scene, ?render=1): the same Engine graph on an OfflineAudioContext.
 * A cue alone uses its nominal plan (patch.ts nominalPlan); a timeline drives the public API at suspend points, with
 * the context's clock as the audio clock, so it hears exactly what play() does in the game.
 */

const RENDER_RATE = 48000;
const QUANTUM = 128 / RENDER_RATE;
/**
 * Chromium's DynamicsCompressorNode starts in a heavily reducing state: anything in the first tens of milliseconds
 * of a context comes out 10–16 dB down. Solo renders run this long first and drop it from the result.
 */
const LEAD_IN = 0.25;
/**
 * The master chain delays the output by 480 samples at 48 kHz (measured in Chrome): the limiter's 6-ms lookahead
 * (288) and the safety clip's 4× oversampling filters (192).
 */
export const OUTPUT_LATENCY = 480 / RENDER_RATE;

export interface Rendered {
  readonly channels: Float32Array[];
  readonly sampleRate: number;
}

const channelsOf = (buf: AudioBuffer, from = 0): Float32Array[] =>
  Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c).slice(Math.round(from * RENDER_RATE)));

/** Renders `seconds` of whatever `begin` starts on a fresh engine LEAD_IN seconds into the context. */
async function solo(seed: number, seconds: number, begin: (engine: Engine) => void): Promise<Rendered> {
  const ctx = new OfflineAudioContext(2, Math.ceil((LEAD_IN + seconds) * RENDER_RATE), RENDER_RATE);
  const engine = new Engine(ctx, seed);
  void ctx.suspend(LEAD_IN).then(() => {
    begin(engine);
    return ctx.resume();
  });
  return { channels: channelsOf(await ctx.startRendering(), LEAD_IN), sampleRate: RENDER_RATE };
}

/** One cue at its nominal plan (variant = which wave of a Random Get), listener at the source. */
export function renderCue(cue: CueName, variant: number, seed: number, seconds: number): Promise<Rendered> {
  return solo(seed, seconds, engine => engine.start(1, nominalPlan(CUES[cue], variant), null, { x: 0, z: 0 }));
}

/** The wind loop at its nominal pitch (no random offset). */
export function renderWind(seed: number, seconds: number): Promise<Rendered> {
  return solo(seed, seconds, engine => engine.wind(windPlan(0)));
}

export interface Timed<T = Audio> {
  /** Seconds from the start of the render. */
  readonly t: number;
  readonly run: (target: T) => void;
}

/**
 * Runs every step on `target` at the first render quantum at or after `offset + t`: suspend points fall on quanta,
 * and steps sharing one run together, in order (a second suspend at the same time would be rejected).
 */
function schedule<T>(ctx: OfflineAudioContext, steps: readonly Timed<T>[], target: T, offset = 0): void {
  const byQuantum = new Map<number, Timed<T>[]>();
  for (const step of [...steps].sort((a, b) => a.t - b.t)) {
    const q = Math.ceil((offset + step.t) / QUANTUM - 1e-9);
    byQuantum.set(q, [...(byQuantum.get(q) ?? []), step]);
  }
  for (const [q, group] of byQuantum) {
    if (q === 0) group.forEach(s => s.run(target));
    else
      void ctx.suspend(q * QUANTUM).then(() => {
        group.forEach(s => s.run(target));
        return ctx.resume();
      });
  }
}

/** Plays a timeline through createAudio({ seed }) offline; returns the mix and the audio event log. */
export async function renderTimeline(steps: readonly Timed[], seed: number, seconds: number): Promise<{ rendered: Rendered; events: AudioEvent[] }> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RENDER_RATE), RENDER_RATE);
  const audio = createAudio({ seed, context: () => ctx, now: () => ctx.currentTime, prewarm: false });
  await audio.unlock();
  schedule(ctx, steps, audio);
  const buffer = await ctx.startRendering();
  return { rendered: { channels: channelsOf(buffer), sampleRate: RENDER_RATE }, events: audio.events.slice() };
}

/** The steal check: the hit's age when it is stolen (as on the ping-pong launch's third contact) and the length. */
export const STEAL_CHECK = { age: 8 / 60, seconds: 0.8 } as const;

/**
 * One voice stolen with nothing else playing (the eviction without the mix that masks it): the hit at a victim at
 * contact distance, the hero bouncing away at a knight leg's speed with the listener updated every frame, the steal
 * STEAL_CHECK.age s in and that frame's listener update right after it (the order that undid the fade before the
 * fix). Times are seconds from the start of the result.
 */
export async function renderSteal(seed: number): Promise<{ rendered: Rendered; stealAt: number; stopAt: number }> {
  const ctx = new OfflineAudioContext(2, Math.ceil((LEAD_IN + STEAL_CHECK.seconds) * RENDER_RATE), RENDER_RATE);
  const victim = { x: 14 + uuToTiles(104), z: 12 };
  const hero = (t: number) => ({ x: 14 - uuToTiles(2600 * t), z: 12 });
  let stealAt = Number.NaN;
  const steps: Timed<Engine>[] = [
    { t: 0, run: e => e.start(1, nominalPlan(CUES.hit), victim, hero(0)) },
    {
      t: STEAL_CHECK.age,
      run: e => {
        stealAt = e.ctx.currentTime - LEAD_IN;
        e.stop(1);
      },
    },
  ];
  for (let f = 1; f / 60 < STEAL_CHECK.seconds; f++) steps.push({ t: f / 60, run: e => e.moveListener(hero(f / 60)) });
  schedule(ctx, steps, new Engine(ctx, seed), LEAD_IN);
  const rendered = { channels: channelsOf(await ctx.startRendering(), LEAD_IN), sampleRate: RENDER_RATE };
  return { rendered, stealAt, stopAt: stealAt + STEAL * STEAL_STOPS };
}

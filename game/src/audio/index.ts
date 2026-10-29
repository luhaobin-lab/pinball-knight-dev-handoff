import { createRng, type Rng } from '../core/rng.ts';
import { Concurrency } from './concurrency.ts';
import { CUE_NAMES, CUES, WIND, type BusName, type CueName, type LoopName } from './cues.ts';
import { Engine } from './engine.ts';
import { bufferVariants, planVoice, ratio, spatial, windPlan, type PickMemory, type Place, type WindPlan } from './patch.ts';

export { CUE_NAMES, CUES, GROUPS, WIND, type BusName, type CueDef, type CueName, type GroupName, type LoopName } from './cues.ts';

/**
 * Procedural audio for the launch (README.md): the Demo's cues, timing and layers, synthesized at runtime.
 * Coordinates are floor tiles (x east, z south), as in src/game; the listener is the hero.
 */

export interface AudioEvent {
  /** Audio-clock seconds (the `now` option). */
  readonly t: number;
  readonly cue: string;
  readonly params: Record<string, unknown>;
}

export interface AudioOptions {
  readonly seed: number | string;
  /**
   * Audio-clock seconds for event times, concurrency and retrigger; default performance.now() / 1000. Audio is not
   * slowed by the hit-stop, so pass an undilated clock (a deterministic one in stepped runs).
   */
  readonly now?: () => number;
  /** Builds the context on the first unlock(); default `new AudioContext()`. Tests pass a mock, the offline renderer its OfflineAudioContext. */
  readonly context?: () => BaseAudioContext;
  /** Render every wave variant in idle slices after unlock (default true). */
  readonly prewarm?: boolean;
}

export type AudioState = 'locked' | 'running' | 'unavailable';

export interface Audio {
  /** Creates and resumes the context; call it from user gestures (idempotent, never rejects). */
  unlock(): Promise<void>;
  /** Plays a cue; `x`, `z` place it (world cues default to the listener). Never throws; dropped while locked. */
  play(cue: CueName, opts?: { x?: number; z?: number }): void;
  loop(name: LoopName, on: boolean): void;
  setListener(x: number, z: number): void;
  setVolume(bus: BusName, v: number): void;
  /** The last EVENT_LOG_SIZE plays and loop changes, for QA. */
  readonly events: AudioEvent[];
  readonly state: AudioState;
  /** The live context once unlocked (the offline renderer reads it). */
  readonly context: BaseAudioContext | null;
  dispose(): void;
}

export const EVENT_LOG_SIZE = 1024;

const round = (x: number): number => Math.round(x * 1000) / 1000;
const isOffline = (ctx: BaseAudioContext): boolean => typeof (ctx as OfflineAudioContext).startRendering === 'function';

export function createAudio(options: AudioOptions): Audio {
  const root = createRng(options.seed);
  const streams = new Map<string, Rng>();
  const stream = (name: string): Rng => {
    let rng = streams.get(name);
    if (!rng) {
      rng = root.derive(`audio:${name}`);
      streams.set(name, rng);
    }
    return rng;
  };
  const now = options.now ?? (() => performance.now() / 1000);
  const picks: PickMemory = new Map();
  const concurrency = new Concurrency();
  const places = new Map<number, Place>();
  const listener = { x: 0, z: 0 };
  const volumes: Record<BusName, number> = { master: 1, sfx: 1, ambience: 1 };
  const events: AudioEvent[] = [];
  let ctx: BaseAudioContext | null = null;
  let engine: Engine | null = null;
  let unavailable = false;
  let nextVoice = 1;
  let wind: WindPlan | null = null;
  let warned = false;

  const log = (cue: string, params: Record<string, unknown>): void => {
    events.push({ t: round(now()), cue, params });
    if (events.length > EVENT_LOG_SIZE) events.splice(0, events.length - EVENT_LOG_SIZE);
  };
  const warn = (error: unknown): void => {
    if (warned) return;
    warned = true;
    console.warn('[audio] error (later ones are not reported):', error);
  };
  const running = (): boolean => engine !== null && ctx !== null && (isOffline(ctx) || ctx.state === 'running');
  const startWind = (): void => {
    if (engine && wind) engine.wind(wind);
  };

  return {
    events,
    get state(): AudioState {
      return unavailable ? 'unavailable' : running() ? 'running' : 'locked';
    },
    get context() {
      return ctx;
    },

    unlock(): Promise<void> {
      try {
        if (unavailable) return Promise.resolve();
        if (!ctx) {
          ctx = (options.context ?? (() => new AudioContext({ latencyHint: 'interactive' })))();
          engine = new Engine(ctx, root.seed);
          for (const bus of Object.keys(volumes) as BusName[]) engine.setVolume(bus, volumes[bus]);
          startWind();
          if (options.prewarm !== false) {
            const cues = CUE_NAMES.map(c => CUES[c]);
            engine.prewarm(bufferVariants(cues), [...new Set(cues.flatMap(c => c.layers.map(l => l.highpass)).filter(f => f > 0))]);
          }
        }
        if (running()) return Promise.resolve();
        return (ctx as AudioContext).resume().then(
          () => undefined,
          () => undefined,
        );
      } catch (error) {
        unavailable = true;
        warn(error);
        return Promise.resolve();
      }
    },

    play(cue, opts) {
      try {
        if (!CUE_NAMES.includes(cue)) {
          log(String(cue), { admitted: false, played: false, reason: 'unknown' });
          return;
        }
        const def = CUES[cue];
        const t = now();
        const plan = planVoice(cue, def, stream(cue), picks);
        const x = Number.isFinite(opts?.x) ? (opts?.x as number) : listener.x;
        const z = Number.isFinite(opts?.z) ? (opts?.z as number) : listener.z;
        const place: Place = def.space === 'world' ? { x, z } : null;
        const s = spatial(place, listener);
        const params: Record<string, unknown> = {
          x: round(x),
          z: round(z),
          group: def.group,
          distance: round(s.distance),
          gain: round(s.gain),
          pan: round(s.pan),
          layers: plan.layers.map(l => ({
            wave: l.wave,
            pitch: round(l.bakedPitch + l.resample),
            baked: round(l.bakedPitch),
            resample: round(l.resample),
            rate: round(ratio(l.resample)),
            gain: round(l.gain),
            delay: l.delay,
          })),
        };
        const admission = concurrency.admit(def.group, t, s.distance, v => spatial(places.get(v.id) ?? null, listener).distance);
        if (!admission.ok) {
          log(cue, { ...params, admitted: false, played: false, reason: admission.reason });
          return;
        }
        const id = nextVoice++;
        concurrency.start({ id, group: def.group, start: t, end: t + plan.lifetime }, admission.evict);
        places.set(id, place);
        const alive = new Set(concurrency.active(t).map(v => v.id));
        for (const key of places.keys()) if (!alive.has(key)) places.delete(key);
        if (admission.evict) engine?.stop(admission.evict.id);
        const audible = running();
        if (audible) engine?.start(id, plan, place, listener);
        log(cue, { ...params, admitted: true, voice: id, evicted: admission.evict?.id ?? null, played: audible, ...(audible ? {} : { reason: 'locked' }) });
      } catch (error) {
        warn(error);
        log(String(cue), { admitted: false, played: false, reason: 'error' });
      }
    },

    loop(name, on) {
      try {
        if (name !== 'wind') return;
        if (on) {
          wind = windPlan(stream('wind').range(-WIND.pitchRandom, WIND.pitchRandom));
          log('wind', { on, pitch: round(wind.pitch), rate: round(wind.rate), gain: round(wind.gain), played: running() });
          startWind();
        } else {
          wind = null;
          log('wind', { on, played: running() });
          engine?.wind(null);
        }
      } catch (error) {
        warn(error);
      }
    },

    setListener(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      listener.x = x;
      listener.z = z;
      try {
        engine?.moveListener(listener);
      } catch (error) {
        warn(error);
      }
    },

    setVolume(bus, v) {
      if (!Object.hasOwn(volumes, bus) || !Number.isFinite(v)) return;
      volumes[bus] = Math.min(1, Math.max(0, v));
      try {
        engine?.setVolume(bus, volumes[bus]);
      } catch (error) {
        warn(error);
      }
    },

    dispose() {
      try {
        engine?.dispose();
        if (ctx && !isOffline(ctx)) void (ctx as AudioContext).close().catch(() => undefined);
      } catch (error) {
        warn(error);
      }
      engine = null;
      ctx = null;
    },
  };
}

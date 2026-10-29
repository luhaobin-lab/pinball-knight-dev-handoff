/**
 * Latent blueprint nodes with UE semantics (ARCHITECTURE §4.6), keyed by the node label so translators copy it:
 * Delay (one latch per node per object), RetriggerableDelay (a call while pending restarts it), DelayUntilNextTick,
 * K2_SetTimerDelegate (first call after `rate + InitialStartDelay`, no timer when `rate ≤ 0`: ABILIT-043, TURN-030),
 * timelines (length and tracks from the class manifest), PaperZD `PlayAnimationOverrideWithCallbacks` (length and
 * notifies from the animation manifest) and ReceiveTick. Everything resolves on the canonical 60 Hz frame
 * (TURN-GAP-05) and is cancelled when its owner is destroyed.
 */
import type { RichCurve, RichCurveKey } from '../../content/demo/types.ts';
import { evalRichCurve, type RichKey } from '../launch/curves.ts';
import { FRAME, countdownEnd, frameOf, frameTime, type Scheduler } from './clock.ts';

export type TimelineMode = 'PlayFromStart' | 'Play' | 'Reverse' | 'ReverseFromEnd' | 'Stop';

export interface TimelineCallbacks {
  update?(t: number, tracks: Readonly<Record<string, number>>): void;
  finished?(): void;
}

export interface AnimCallbacks {
  completed?(): void;
  cancelled?(): void;
  notify?(name: string): void;
}

export interface AnimOptions { readonly rate?: number; readonly weak?: boolean }

export interface TimelineDef {
  readonly length: number;
  readonly tracks: Readonly<Record<string, RichCurve>>;
}

/** What the latent service needs of an object (BpObject satisfies it). */
export interface LatentOwner {
  readonly id: number;
  readonly def: { readonly path: string; readonly timelines: Readonly<Record<string, TimelineDef>> };
  ReceiveTick(dt: number): void;
}

/** One animation sequence of the animation manifest. */
export interface AnimInfo {
  readonly seconds: number;
  readonly loop?: boolean;
  readonly notifies: readonly { readonly name: string; readonly time: number }[];
}

export interface LatentDeps {
  readonly clock: Scheduler;
  /** Sequence (asset path or name) → length and notifies; undefined when the manifest does not know it. */
  anim(sequence: string): AnimInfo | undefined;
  /** Inherited Blueprint timeline components; the object's own definition always wins. */
  resolveTimeline?(classPath: string, name: string): TimelineDef | undefined;
  /** Presentation hook for `actor.anim`. */
  onAnim?(on: LatentOwner, sequence: string, seconds: number, loop: boolean): void;
  /** Called with a description when a latent call cannot be resolved from data (coverage / strict). */
  missing?(what: string): void;
}

interface TimelineState {
  position: number;
  direction: 1 | -1;
  playing: boolean;
  entry: number | null;
  cb: TimelineCallbacks | undefined;
  readonly def: TimelineDef;
  readonly keys: Readonly<Record<string, readonly RichKey[]>>;
}

interface AnimState {
  readonly caller: LatentOwner;
  readonly entries: number[];
  readonly cb: AnimCallbacks | undefined;
}

interface OwnerState {
  latches: Map<string, number>;
  timers: Map<string, number>;
  timelines: Map<string, TimelineState>;
  tick: number | null;
  /** The PaperZD override slot of this object, when it is the animated actor. */
  anim: AnimState | null;
}

const INTERP: Record<RichCurveKey['InterpMode'], RichKey['interp']> = {
  RCIM_Linear: 'linear', RCIM_Constant: 'constant', RCIM_Cubic: 'cubic', RCIM_None: 'constant',
};
const WEIGHT: Record<RichCurveKey['TangentWeightMode'], RichKey['weightMode']> = {
  RCTWM_WeightedNone: 'none', RCTWM_WeightedArrive: 'arrive', RCTWM_WeightedLeave: 'leave', RCTWM_WeightedBoth: 'both',
};

function toRichKeys(c: RichCurve): readonly RichKey[] {
  return c.Keys.map(k => ({
    time: k.Time, value: k.Value, interp: INTERP[k.InterpMode],
    arriveTangent: k.ArriveTangent, arriveTangentWeight: k.ArriveTangentWeight,
    leaveTangent: k.LeaveTangent, leaveTangentWeight: k.LeaveTangentWeight, weightMode: WEIGHT[k.TangentWeightMode],
  }));
}

function evalTrack(c: RichCurve, keys: readonly RichKey[], t: number): number {
  if (keys.length === 0) return c.DefaultValue;
  if (keys.length === 1) return keys[0].value;
  // SPEC-GAP: only constant extrapolation (the cooked timelines use the engine default RCCE_Constant).
  return evalRichCurve(keys, t);
}

export class LatentService {
  private readonly state = new Map<LatentOwner, OwnerState>();

  private readonly deps: LatentDeps;

  constructor(deps: LatentDeps) {
    this.deps = deps;
  }

  private get clock(): Scheduler { return this.deps.clock; }

  private of(o: LatentOwner): OwnerState {
    let s = this.state.get(o);
    if (!s) this.state.set(o, (s = { latches: new Map(), timers: new Map(), timelines: new Map(), tick: null, anim: null }));
    return s;
  }

  /** `Delay(seconds)`: a call while the node is pending is ignored. Resolves on the first frame boundary at or after expiry. */
  delay(o: LatentOwner, node: string, seconds: number, then: () => void): void {
    const s = this.of(o);
    if (s.latches.has(node)) return;
    this.latch(o, s, node, countdownEnd(this.clock.now, seconds), then);
  }

  /** `RetriggerableDelay(seconds)`: a call while pending restarts the countdown. */
  retriggerableDelay(o: LatentOwner, node: string, seconds: number, then: () => void): void {
    const s = this.of(o);
    const old = s.latches.get(node);
    if (old !== undefined) this.clock.cancel(old);
    s.latches.delete(node);
    this.latch(o, s, node, countdownEnd(this.clock.now, seconds), then);
  }

  /** `DelayUntilNextTick`: the next frame boundary; latched per node like Delay. */
  nextTick(o: LatentOwner, node: string, then: () => void): void {
    const s = this.of(o);
    if (s.latches.has(node)) return;
    this.latch(o, s, node, frameTime(frameOf(this.clock.now) + 1), then);
  }

  isPending(o: LatentOwner, node: string): boolean {
    return this.state.get(o)?.latches.has(node) ?? false;
  }

  private latch(o: LatentOwner, s: OwnerState, node: string, time: number, then: () => void): void {
    const id = this.clock.at(time, () => {
      s.latches.delete(node);
      then();
    }, o);
    s.latches.set(node, id);
  }

  /**
   * `K2_SetTimerDelegate(fn, rate, looping, InitialStartDelay)`: replaces the handle's timer. UE: first delay
   * `rate + InitialStartDelay` (or `rate` when that is negative); a timer fires at the timer-manager tick (frame
   * boundary) at or after its expiry, never in the frame it was set; a looping timer that missed several periods
   * fires once per missed period and keeps its own expiry line. `rate ≤ 0` only clears.
   */
  setTimer(o: LatentOwner, handle: string, rate: number, looping: boolean, fn: () => void, initialStartDelay = 0): void {
    this.clearTimer(o, handle);
    if (!(rate > 0)) return;
    const s = this.of(o);
    const first = rate + initialStartDelay >= 0 ? rate + initialStartDelay : rate;
    let expire = this.clock.now + first;
    const setFrame = frameOf(this.clock.now);
    const arm = (): void => {
      const f = Math.max(setFrame + 1, Math.ceil(expire / FRAME - 1e-4));
      s.timers.set(handle, this.clock.at(frameTime(f), fire, o));
    };
    const fire = (): void => {
      if (!looping) {
        s.timers.delete(handle);
        fn();
        return;
      }
      const now = this.clock.now;
      const calls = Math.trunc((now - expire) / rate + 1e-9) + 1;
      expire += calls * rate;
      const mine = s.timers.get(handle);
      for (let i = 0; i < calls; i++) {
        fn();
        if (s.timers.get(handle) !== mine) return; // cleared or replaced by the callback
      }
      arm();
    };
    arm();
  }

  clearTimer(o: LatentOwner, handle: string): void {
    const s = this.state.get(o);
    const id = s?.timers.get(handle);
    if (id === undefined) return;
    this.clock.cancel(id);
    s!.timers.delete(handle);
  }

  isTimerActive(o: LatentOwner, handle: string): boolean {
    return this.state.get(o)?.timers.has(handle) ?? false;
  }

  /** `ReceiveTick(DeltaSeconds)` at every frame boundary while enabled (weak entries: they never keep the game busy). */
  setTickEnabled(o: LatentOwner, on: boolean): void {
    const s = this.of(o);
    if (!on) {
      if (s.tick !== null) this.clock.cancel(s.tick);
      s.tick = null;
      return;
    }
    if (s.tick !== null) return;
    const step = (): void => {
      s.tick = this.clock.nextFrame(step, o, { weak: true });
      o.ReceiveTick(FRAME);
    };
    s.tick = this.clock.nextFrame(step, o, { weak: true });
  }

  /**
   * Timeline component: advances by one frame per frame boundary while playing, calls `update` with the position and
   * the evaluated tracks, and `finished` when it reaches an end. The callbacks of the latest call replace earlier ones
   * (the blueprint's exec pins are fixed per timeline).
   */
  timeline(o: LatentOwner, name: string, mode: TimelineMode, cb?: TimelineCallbacks): void {
    const s = this.of(o);
    let tl = s.timelines.get(name);
    if (!tl) {
      const def = o.def.timelines[name] ?? this.deps.resolveTimeline?.(o.def.path, name);
      if (!def) {
        this.deps.missing?.(`timeline ${o.def.path}.${name}`);
        return;
      }
      const keys: Record<string, readonly RichKey[]> = {};
      for (const [track, curve] of Object.entries(def.tracks)) keys[track] = toRichKeys(curve);
      tl = { position: 0, direction: 1, playing: false, entry: null, cb: undefined, def, keys };
      s.timelines.set(name, tl);
    }
    if (cb) tl.cb = cb;
    switch (mode) {
      case 'PlayFromStart': tl.position = 0; tl.direction = 1; tl.playing = true; break;
      case 'Play': tl.direction = 1; tl.playing = true; break;
      case 'Reverse': tl.direction = -1; tl.playing = true; break;
      case 'ReverseFromEnd': tl.position = tl.def.length; tl.direction = -1; tl.playing = true; break;
      case 'Stop': tl.playing = false; break;
    }
    if (tl.playing) this.armTimeline(o, tl);
    else if (tl.entry !== null) { this.clock.cancel(tl.entry); tl.entry = null; }
  }

  timelinePosition(o: LatentOwner, name: string): number {
    return this.state.get(o)?.timelines.get(name)?.position ?? 0;
  }

  private armTimeline(o: LatentOwner, tl: TimelineState): void {
    if (tl.entry !== null && this.clock.isPending(tl.entry)) return;
    tl.entry = this.clock.nextFrame(() => {
      tl.entry = null;
      if (!tl.playing) return;
      const length = tl.def.length;
      let p = tl.position + tl.direction * FRAME;
      let done = false;
      if (tl.direction > 0 && p >= length - 1e-9) { p = length; done = true; }
      if (tl.direction < 0 && p <= 1e-9) { p = 0; done = true; }
      tl.position = p;
      if (done) tl.playing = false;
      else this.armTimeline(o, tl);
      if (tl.cb?.update) {
        const values: Record<string, number> = {};
        for (const [track, curve] of Object.entries(tl.def.tracks)) values[track] = evalTrack(curve, tl.keys[track], p);
        tl.cb.update(p, values);
      }
      if (done) tl.cb?.finished?.();
    }, o);
  }

  /**
   * PaperZD `PlayAnimationOverrideWithCallbacks` on `on`'s override slot: notifies at their manifest times,
   * `completed` after the sequence length; a new override on the same actor cancels the previous one (`cancelled`).
   * Callbacks are owned by `caller` (destroying either cancels them).
   */
  playAnim(caller: LatentOwner, on: LatentOwner, sequence: string, cb?: AnimCallbacks, opts?: AnimOptions): void {
    const target = this.of(on);
    const prev = target.anim;
    if (prev) {
      for (const id of prev.entries) this.clock.cancel(id);
      target.anim = null;
      prev.cb?.cancelled?.();
    }
    const info = this.deps.anim(sequence);
    if (!info) this.deps.missing?.(`anim ${sequence}`);
    // SPEC-GAP: a sequence missing from the manifest completes on the next frame.
    const rate = opts?.rate ?? 1;
    if (!(rate > 0) || !Number.isFinite(rate)) throw new RangeError('playAnim requires a finite positive rate');
    const seconds = (info?.seconds ?? 0) / rate;
    const loop = info?.loop ?? false;
    this.deps.onAnim?.(on, sequence, seconds, loop);
    const state: AnimState = { caller, entries: [], cb };
    target.anim = state;
    const now = this.clock.now;
    for (const n of info?.notifies ?? []) {
      const id = this.clock.at(countdownEnd(now, n.time / rate), () => state.cb?.notify?.(n.name), caller, opts);
      state.entries.push(id);
    }
    if (!loop) {
      state.entries.push(this.clock.at(countdownEnd(now, seconds), () => {
        if (target.anim === state) target.anim = null;
        state.cb?.completed?.();
      }, caller, opts));
    }
  }

  /** Forget everything the object owned (its clock entries are cancelled by the world through `cancelOwner`). */
  release(o: LatentOwner): void {
    // PaperZD keeps its override slot on the animated actor, but its delegate receiver can be another object.
    // Releasing that receiver must remove the slot callback too; a later animation must not call a dead receiver.
    for (const [on, s] of this.state) {
      if (!s.anim || (on !== o && s.anim.caller !== o)) continue;
      for (const id of s.anim.entries) this.clock.cancel(id);
      s.anim = null;
    }
    this.state.delete(o);
  }
}

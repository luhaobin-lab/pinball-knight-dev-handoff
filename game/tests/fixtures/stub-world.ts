/**
 * An inert World (WAVE_A A01, part 2) for pure unit tests that need a world before (or without) core-sim's
 * `createWorld`. Every service exists and is deterministic, nothing runs on its own:
 *
 * - `clock`: a manual queue. Entries run only inside `advance` / `runUntil`, in (time, insertion) order; processes step at
 *   1/120 s. No frame callbacks or latent nodes are driven by it.
 * - `latent`: records every call in `latentCalls` and never fires a callback (`fireLatent` runs a recorded one by hand).
 * - `bus` / `fx`: `fx` calls are recorded in `fxCalls`; `emit` queues, `drain` empties.
 * - `unported`: counted in `unportedCalls` and `coverage`; throws when `strict`.
 * - `spawn`: constructs the class with its manifest entry (or a blank ClassDef), runs `init`, sets the location and calls
 *   `ReceiveBeginPlay`. `destroy` marks the object invalid and cancels its clock entries.
 * - `sys`: the real module table (`createSystems`) with `sys` overrides applied, or any object you pass as `systems`
 *   (a Proxy of doubles, for instance).
 * - `mode` / `cult`: 蓝图_动作游戏模式 and 修炼系统 with their CDO defaults, constructed on first access.
 * - `data`: the Demo tables and manifests of src/content/demo, unless `data` overrides them.
 *
 *   const w = stubWorld({ sys: { damage: { BP_ManeActor: { 造成即时伤害: (self, d) => { … } } } } });
 */
import type { PresentEvent } from '../../src/core/api/events.ts';
import type { ModalAnswer } from '../../src/core/api/commands.ts';
import type { ModalView } from '../../src/core/api/view.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { createRngDomains } from '../../src/core/rng/domains.ts';
import { BpObject, type Fx } from '../../src/core/sim/object.ts';
import { 蓝图_动作游戏模式 } from '../../src/core/sim/mode.ts';
import { 修炼系统 } from '../../src/core/sim/cult.ts';
import type { AnimCallbacks, Coverage, LatentService, ModalService, PresentBus, SimClock, TimelineCallbacks, TimelineMode, World } from '../../src/core/sim/world.ts';
import type { AnimDef, AssetPath, BpCtor, ClassDef, ContentRegistry, DemoData, Vec3 } from '../../src/core/sim/types.ts';
import { createSystems } from '../../src/core/sys/index.ts';
import { demoTablesByAsset } from '../../src/content/demo/registry.ts';
import { demoClasses } from '../../src/content/demo/classes.ts';
import { demoAnims } from '../../src/content/demo/anims.ts';
import { demoTags } from '../../src/content/demo/tags.ts';

export interface StubWorldOptions {
  seed?: number;
  strict?: boolean;
  filter?: 'ported' | 'all';
  /** Module overrides merged over the real table (createSystems). */
  sys?: Partial<Systems>;
  /** Replaces the whole table (e.g. a Proxy of doubles); `sys` is ignored then. */
  systems?: Systems;
  /** Classes `spawn(path)` and `isPorted` resolve. */
  registry?: ContentRegistry;
  data?: Partial<DemoData>;
}

export interface LatentCall { op: keyof LatentService; o: BpObject; args: unknown[] }
export interface FxCall { op: keyof Fx; args: unknown[] }

export interface StubWorld extends World {
  readonly unportedCalls: string[];
  readonly latentCalls: LatentCall[];
  readonly fxCalls: FxCall[];
  readonly events: PresentEvent[];
  /** Runs the callback of the n-th recorded latent call (its last function argument). */
  fireLatent(index: number): void;
}

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
/** src/content/demo/anims.ts as the world's AnimDef manifest (path, length, notifies). */
const ANIMS: Readonly<Record<AssetPath, AnimDef>> = Object.fromEntries(Object.entries(demoAnims).map(([path, a]) =>
  [path, { path, length: a.length, notifies: a.notifies.map(n => ({ name: n.name, time: n.time, duration: n.duration ?? 0 })) }]));

/** A blank class definition (no tags, no manifest variables). */
export function blankDef(path: AssetPath = '', kind: ClassDef['kind'] = 'other'): ClassDef {
  return { path, name: path.split('/').pop() ?? '', parent: null, kind, tags: [], vars: {}, timelines: {}, components: {}, rows: [], reachable: true };
}

function manualClock(): SimClock {
  type Entry = { id: number; time: number; fn: () => void; owner?: BpObject };
  let now = 0;
  let seq = 0;
  let entries: Entry[] = [];
  const processes: { step(dt: number): void; active(): boolean }[] = [];
  const add = (time: number, fn: () => void, owner?: BpObject): number => {
    const id = ++seq;
    entries.push({ id, time, fn, owner });
    entries.sort((a, b) => a.time - b.time || a.id - b.id);
    return id;
  };
  const runDue = (until: number): void => {
    while (entries.length && entries[0].time <= until) {
      const e = entries.shift() as Entry;
      now = Math.max(now, e.time);
      e.fn();
    }
  };
  const clock: SimClock = {
    get now() { return now; },
    get frame() { return Math.floor(now * 60 + 1e-9); },
    at: add,
    after: (s, fn, owner) => add(now + s, fn, owner),
    nextFrame: (fn, owner) => add((Math.floor(now * 60 + 1e-9) + 1) / 60, fn, owner),
    cancel: id => { entries = entries.filter(e => e.id !== id); },
    cancelOwner: owner => { entries = entries.filter(e => e.owner !== owner); },
    addProcess: p => { processes.push(p); },
    advance(dt) {
      const end = now + dt;
      for (;;) {
        const live = processes.filter(p => p.active());
        if (!live.length) break;
        const step = Math.min(1 / 120, end - now);
        if (step <= 1e-12) break;
        runDue(now + step);
        for (const p of live) p.step(step);
        now += step;
      }
      runDue(end);
      now = end;
    },
    runUntil(stop, maxSeconds) {
      const end = now + maxSeconds;
      while (!stop()) {
        if (!entries.length && !processes.some(p => p.active())) return 'idle';
        if (now >= end) return 'timeout';
        clock.advance(Math.min(1 / 60, end - now));
      }
      return 'stopped';
    },
  };
  return clock;
}

export function stubWorld(opts: StubWorldOptions = {}): StubWorld {
  let id = 0;
  const unportedCalls: string[] = [];
  const latentCalls: LatentCall[] = [];
  const fxCalls: FxCall[] = [];
  const events: PresentEvent[] = [];
  const counts = new Map<string, number>();
  const coverage: Coverage = { hit: what => { counts.set(what, (counts.get(what) ?? 0) + 1); }, counts };

  const record = (op: keyof LatentService) => (o: BpObject, ...args: unknown[]): void => { latentCalls.push({ op, o, args }); };
  const latent: LatentService = {
    delay: record('delay'),
    retriggerableDelay: record('retriggerableDelay'),
    nextTick: record('nextTick'),
    setTimer: record('setTimer'),
    clearTimer: record('clearTimer'),
    isTimerActive: () => false,
    timeline: record('timeline') as (o: BpObject, name: string, mode: TimelineMode, cb?: TimelineCallbacks) => void,
    playAnim: record('playAnim') as (o: BpObject, on: BpObject, sequence: string, cb?: AnimCallbacks) => void,
    setTickEnabled: record('setTickEnabled'),
  };

  const fxOp = (op: keyof Fx) => (...args: unknown[]): void => { fxCalls.push({ op, args }); };
  const fx: Fx = { vfx: fxOp('vfx'), sound: fxOp('sound'), shake: fxOp('shake'), flipbook: fxOp('flipbook'), flash: fxOp('flash'), headUp: fxOp('headUp'), popup: fxOp('popup'), log: fxOp('log'), ui: fxOp('ui'), bgm: fxOp('bgm') };
  const bus: PresentBus = { fxFor: () => fx, emit: e => { events.push(e); }, drain: () => events.splice(0) };

  let modalView: ModalView | null = null;
  let modalHandler: ((a: ModalAnswer) => void) | null = null;
  const modal: ModalService = {
    get current() { return modalView; },
    open(view, onAnswer) { modalView = view; modalHandler = onAnswer; },
    answer(a) {
      if (!modalHandler) return false;
      const h = modalHandler;
      modalView = null; modalHandler = null;
      h(a);
      return true;
    },
    close() { modalView = null; modalHandler = null; },
  };

  const data: DemoData = {
    table: asset => demoTablesByAsset[asset],
    classes: demoClasses,
    anims: ANIMS,
    tags: demoTags,
    ...opts.data,
  };
  const registry = opts.registry;
  const strict = opts.strict ?? false;
  let mode: 蓝图_动作游戏模式 | null = null;
  let cult: 修炼系统 | null = null;
  const defOf = (path: AssetPath): ClassDef => data.classes[path] ?? blankDef(path);

  const w: StubWorld = {
    unportedCalls, latentCalls, fxCalls, events,
    fireLatent(index) {
      const fn = [...latentCalls[index].args].reverse().find(a => typeof a === 'function') as (() => void) | undefined;
      if (!fn) throw new Error(`stubWorld: latent call ${index} (${latentCalls[index].op}) has no callback`);
      fn();
    },
    clock: manualClock(),
    latent,
    rng: createRngDomains(opts.seed ?? 1),
    data,
    get mode() { return (mode ??= new 蓝图_动作游戏模式(w, defOf(蓝图_动作游戏模式.path))); },
    get cult() { return (cult ??= new 修炼系统(w, defOf(修炼系统.path))); },
    sys: opts.systems ?? createSystems(opts.sys),
    bus,
    coverage,
    modal,
    strict,
    filter: opts.filter ?? 'all',
    nextId: () => ++id,
    spawn<T extends BpObject>(cls: AssetPath | BpCtor<T>, init?: (o: T) => void, at?: Vec3): T {
      const ctor = (typeof cls === 'string' ? registry?.get(cls) : cls) as (new (world: World, def: ClassDef) => T) & { path: AssetPath } | undefined;
      if (!ctor) throw new Error(`stubWorld.spawn: ${String(cls)} is not registered`);
      const o = new ctor(w, defOf(ctor.path));
      init?.(o);
      o.K2_SetActorLocation(at ?? ZERO);
      o.ReceiveBeginPlay();
      return o;
    },
    destroy(o) {
      o.valid = false;
      w.clock.cancelOwner(o);
    },
    isValid: (o): o is BpObject => o instanceof BpObject && o.valid,
    unported(what) {
      unportedCalls.push(what);
      coverage.hit(what);
      if (strict) throw new Error(`unported: ${what}`);
    },
    isPorted: path => registry?.get(path) !== undefined,
    isRowPorted: () => true,
    trace: { sphere: () => [], line: () => null },
  };
  return w;
}

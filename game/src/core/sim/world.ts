/**
 * The world and its services (ARCHITECTURE Appendix A.5, §4.1, §4.6, §4.9, §4.12; WAVE_A §3.5). Interfaces only:
 * core-sim implements them (`createWorld`). Contract file of core-contracts.
 */
import type { PresentEvent } from '../api/events.ts';
import type { ModalAnswer } from '../api/commands.ts';
import type { ModalView } from '../api/view.ts';
import type { Systems } from '../bp/systems.ts';
import type { RngDomains } from '../rng/domains.ts';
import type { 修炼系统 } from './cult.ts';
import type { 蓝图_动作游戏模式 } from './mode.ts';
import type { BpObject, Fx } from './object.ts';
import type { AssetPath, BpCtor, DemoData, HitResult, Vec3 } from './types.ts';

/** Game time in seconds; canonical frame 1/60 s; entries run in (time, insertion sequence) order. */
export interface SimClock {
  readonly now: number;
  /** Canonical 60 Hz frame index. */
  readonly frame: number;
  at(time: number, fn: () => void, owner?: BpObject): number;
  after(seconds: number, fn: () => void, owner?: BpObject): number;
  /** The next canonical frame boundary. */
  nextFrame(fn: () => void, owner?: BpObject): number;
  cancel(entry: number): void;
  cancelOwner(owner: BpObject): void;
  /** Sub-stepped at 1/120 s while active (enemy physics, projectiles, gravity pulls). */
  addProcess(p: { step(dt: number): void; active(): boolean }): void;
  advance(dt: number): void;
  runUntil(stop: () => boolean, maxSeconds: number): 'stopped' | 'idle' | 'timeout';
}

export type TimelineMode = 'PlayFromStart' | 'Play' | 'Reverse' | 'ReverseFromEnd' | 'Stop';
export interface TimelineCallbacks { update?(t: number, tracks: Readonly<Record<string, number>>): void; finished?(): void }
export interface AnimCallbacks { completed?(): void; cancelled?(): void; notify?(name: string): void }
export interface AnimOptions { readonly rate?: number; readonly weak?: boolean }

/**
 * UE latent nodes (ARCHITECTURE §4.6), keyed by the blueprint node label per object. BpObject's helpers delegate here.
 */
export interface LatentService {
  /** Delay: one latch per (object, node); a call while pending is ignored. */
  delay(o: BpObject, node: string, seconds: number, then: () => void): void;
  /** RetriggerableDelay: a call while pending restarts it. */
  retriggerableDelay(o: BpObject, node: string, seconds: number, then: () => void): void;
  /** DelayUntilNextTick: the next frame boundary. */
  nextTick(o: BpObject, node: string, then: () => void): void;
  /** K2_SetTimerDelegate: first call after rate + initialStartDelay; rate ≤ 0 creates no timer (ABILIT-043). */
  setTimer(o: BpObject, handle: string, rate: number, looping: boolean, fn: () => void, initialStartDelay: number): void;
  clearTimer(o: BpObject, handle: string): void;
  isTimerActive(o: BpObject, handle: string): boolean;
  /** Timelines: length and tracks from the class manifest. */
  timeline(o: BpObject, name: string, mode: TimelineMode, cb?: TimelineCallbacks): void;
  /** PlayAnimationOverrideWithCallbacks: length and notifies from the animation manifest; also emits `actor.anim`. */
  playAnim(o: BpObject, on: BpObject, sequence: string, cb?: AnimCallbacks, opts?: AnimOptions): void;
  /** ReceiveTick at frame boundaries while enabled. */
  setTickEnabled(o: BpObject, on: boolean): void;
}

/** Presentation bus: `fx` per object, and the event queue the API drains. */
export interface PresentBus {
  fxFor(o: BpObject): Fx;
  emit(e: PresentEvent): void;
  drain(): PresentEvent[];
}

/** Coverage counters (ARCHITECTURE §4.12): unported facade functions and stub classes hit at run time. */
export interface Coverage {
  hit(what: string): void;
  readonly counts: ReadonlyMap<string, number>;
}

/** The kernel modal service: blocking views the player answers (TURN-034/035 barrier). */
export interface ModalService {
  readonly current: ModalView | null;
  open(view: ModalView, onAnswer: (answer: ModalAnswer) => void): void;
  /** Routes a modal command to the open modal's handler; false if none is open. */
  answer(answer: ModalAnswer): boolean;
  close(): void;
}

export interface WorldTrace {
  sphere(from: Vec3, to: Vec3, radius: number, channel: string, ignore?: readonly BpObject[]): HitResult[];
  line(from: Vec3, to: Vec3, channel: string, ignore?: readonly BpObject[]): HitResult | null;
}

export interface World {
  readonly clock: SimClock;
  readonly latent: LatentService;
  readonly rng: RngDomains;
  /** Tables + classes + anims + tags manifests. */
  readonly data: DemoData;
  /** The game mode (蓝图_动作游戏模式's variables and facade). */
  readonly mode: 蓝图_动作游戏模式;
  /** 修炼系统 (variables and facade). */
  readonly cult: 修炼系统;
  /** WAVE_A Appendix W2 modules. */
  readonly sys: Systems;
  readonly bus: PresentBus;
  readonly coverage: Coverage;
  readonly modal: ModalService;
  /** Unit tests and claimed G2 systems: unported code throws instead of returning neutral values. */
  readonly strict: boolean;
  /** 'ported': pools skip rows whose classes are not all registered (WAVE_A §3.5). */
  readonly filter: 'ported' | 'all';
  /** Monotonic object ids: creation order is part of determinism. */
  nextId(): number;
  /** Deferred spawn: construct (CDO defaults), init, ReceiveBeginPlay. */
  spawn<T extends BpObject>(cls: AssetPath | BpCtor<T>, init?: (o: T) => void, at?: Vec3): T;
  /** K2_DestroyActor: invalid, scheduled entries cancelled, array slots kept (TURN-102). */
  destroy(o: BpObject): void;
  /** The Demo's IsValid. */
  isValid(o: unknown): o is BpObject;
  /** A facade function without implementation; throws in strict mode, else counts in coverage. */
  unported(what: string): void;
  isPorted(path: AssetPath): boolean;
  /** True when every class the row's manifest entry references is registered. */
  isRowPorted(table: AssetPath, row: string): boolean;
  readonly trace: WorldTrace;
}

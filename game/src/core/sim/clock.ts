/**
 * The scheduler (ARCHITECTURE §4.6): game seconds, entries run in (time, insertion sequence) order, a canonical
 * 60 Hz frame for "next tick" and per-frame countdowns (TURN-GAP-05, decision D5), continuous processes sub-stepped
 * at 1/120 s. `advance(dt)` and `runUntil(stop)` run the same event loop, so they give identical results for the same
 * inputs at the same game times.
 */

export const FRAME_HZ = 60;
export const FRAME = 1 / FRAME_HZ;
export const SUBSTEP_HZ = 120;
export const SUBSTEP = 1 / SUBSTEP_HZ;

/** Tolerance for snapping a time to a frame boundary (in frames: absorbs float noise, e.g. a float32 Delay duration, as UE's float DeltaSeconds accumulation does). */
const EPS = 1e-4;

/** Index of the frame boundary at or before `time`. */
export function frameOf(time: number): number {
  return Math.floor(time * FRAME_HZ + EPS);
}

/** `time` itself, or the frame boundary it is within float noise of (so `advance(1/60)` steps never drift). */
export function snapToFrame(time: number): number {
  const f = Math.round(time * FRAME_HZ);
  return Math.abs(time * FRAME_HZ - f) < 1e-6 ? frameTime(f) : time;
}

/** Time of frame boundary `f` (computed from the integer, never accumulated). */
export function frameTime(f: number): number {
  return f / FRAME_HZ;
}

/** The first frame boundary strictly after `now` and at or after `now + seconds`: when a per-frame countdown started at `now` resolves. */
export function countdownEnd(now: number, seconds: number): number {
  const next = frameOf(now) + 1;
  const due = Math.ceil((now + Math.max(0, seconds)) * FRAME_HZ - EPS);
  return frameTime(Math.max(next, due));
}

export interface Process {
  step(dt: number): void;
  active(): boolean;
}

interface Entry {
  readonly id: number;
  readonly time: number;
  readonly seq: number;
  readonly fn: () => void;
  readonly owner: object | undefined;
  /** Weak entries (per-frame ticks of objects) do not keep the scheduler busy: `runUntil` reports idle when only they remain. */
  readonly weak: boolean;
  cancelled: boolean;
}

export interface ScheduleOptions {
  weak?: boolean;
}

/** Binary min-heap on (time, seq). */
class EntryHeap {
  private readonly a: Entry[] = [];
  get size(): number { return this.a.length; }
  peek(): Entry | undefined { return this.a[0]; }
  push(e: Entry): void {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!before(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): Entry | undefined {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0 && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && before(a[l], a[m])) m = l;
        if (r < a.length && before(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
  entries(): readonly Entry[] { return this.a; }
}

function before(x: Entry, y: Entry): boolean {
  return x.time < y.time || (x.time === y.time && x.seq < y.seq);
}

export interface ClockSave {
  readonly now: number;
  readonly seq: number;
}

export class Scheduler {
  private time = 0;
  private seq = 0;
  private readonly heap = new EntryHeap();
  private readonly byId = new Map<number, Entry>();
  private readonly byOwner = new Map<object, Set<number>>();
  private strongCount = 0;
  private readonly processes: Process[] = [];
  private processEntry: number | null = null;

  get now(): number { return this.time; }
  /** Canonical 60 Hz frame index of `now`. */
  get frame(): number { return frameOf(this.time); }

  /** Run `fn` at game time `time` (clamped to now). Returns the entry id. */
  at(time: number, fn: () => void, owner?: object, opts?: ScheduleOptions): number {
    const id = ++this.seq;
    // Use advance()'s existing frame-boundary normalization on event insertion too. A callback at
    // 27.78333333333333 must share the 1667/60 tick batch, not expose input 3.55e-15 s before its weak ticks.
    // Genuine sub-frame/physics times outside snapToFrame's narrow tolerance remain unchanged.
    const e: Entry = { id, time: Math.max(snapToFrame(time), this.time), seq: id, fn, owner, weak: opts?.weak ?? false, cancelled: false };
    this.heap.push(e);
    this.byId.set(id, e);
    if (!e.weak) this.strongCount++;
    if (owner) {
      let s = this.byOwner.get(owner);
      if (!s) this.byOwner.set(owner, (s = new Set()));
      s.add(id);
    }
    return id;
  }

  after(seconds: number, fn: () => void, owner?: object, opts?: ScheduleOptions): number {
    return this.at(this.time + Math.max(0, seconds), fn, owner, opts);
  }

  /** The next frame boundary strictly after now. */
  nextFrame(fn: () => void, owner?: object, opts?: ScheduleOptions): number {
    return this.at(frameTime(this.frame + 1), fn, owner, opts);
  }

  cancel(entry: number): void {
    const e = this.byId.get(entry);
    if (!e) return;
    this.release(e);
    e.cancelled = true;
  }

  cancelOwner(owner: object): void {
    const s = this.byOwner.get(owner);
    if (!s) return;
    for (const id of [...s]) this.cancel(id);
    this.byOwner.delete(owner);
  }

  isPending(entry: number): boolean {
    return this.byId.has(entry);
  }

  /** Continuous processes (enemy physics, projectiles, gravity pulls) are stepped at 1/120 s boundaries while active. */
  addProcess(p: Process): void {
    if (!this.processes.includes(p)) this.processes.push(p);
    this.armProcesses();
  }

  advance(dt: number): void {
    const target = snapToFrame(this.time + Math.max(0, dt));
    for (;;) {
      const e = this.nextLive();
      if (!e || e.time > target) break;
      this.run(e);
    }
    this.time = Math.max(this.time, target);
  }

  /**
   * Jump between settled timestamps until `stop()` holds, nothing but weak entries remain, or the time limit passes.
   * Flush every entry at the current timestamp (including weak ticks and nested entries) before exposing input,
   * matching advance() at the same time. Otherwise a loading callback can expose input before that frame's tick.
   */
  runUntil(stop: () => boolean, maxSeconds: number): 'stopped' | 'idle' | 'timeout' {
    const limit = this.time + maxSeconds;
    for (;;) {
      const ready = this.nextLive();
      if (ready && ready.time <= this.time) { this.run(ready); continue; }
      if (stop()) return 'stopped';
      if (this.strongCount === 0) return 'idle';
      const e = this.nextLive();
      if (!e) return 'idle';
      if (e.time > limit) { this.time = limit; return 'timeout'; }
      this.run(e);
    }
  }

  /** Pending entries in run order (digest and diagnostics). */
  pending(): { time: number; seq: number; owner: object | undefined; weak: boolean }[] {
    return [...this.heap.entries()].filter(e => !e.cancelled).sort((x, y) => (before(x, y) ? -1 : 1))
      .map(e => ({ time: e.time, seq: e.seq, owner: e.owner, weak: e.weak }));
  }

  save(): ClockSave { return { now: this.time, seq: this.seq }; }

  private nextLive(): Entry | undefined {
    for (;;) {
      const e = this.heap.peek();
      if (!e || !e.cancelled) return e;
      this.heap.pop();
    }
  }

  private run(e: Entry): void {
    this.heap.pop();
    this.release(e);
    e.cancelled = true;
    this.time = Math.max(this.time, e.time);
    e.fn();
  }

  private release(e: Entry): void {
    if (!this.byId.delete(e.id)) return;
    if (!e.weak) this.strongCount--;
    if (e.owner) this.byOwner.get(e.owner)?.delete(e.id);
  }

  private armProcesses(): void {
    if (this.processEntry !== null && this.isPending(this.processEntry)) return;
    if (!this.processes.some(p => p.active())) return;
    const t = (Math.floor(this.time * SUBSTEP_HZ + EPS) + 1) / SUBSTEP_HZ;
    this.processEntry = this.at(t, () => this.stepProcesses());
  }

  private stepProcesses(): void {
    this.processEntry = null;
    for (const p of [...this.processes]) if (p.active()) p.step(SUBSTEP);
    for (let i = this.processes.length - 1; i >= 0; i--) if (!this.processes[i].active()) this.processes.splice(i, 1);
    this.armProcesses();
  }
}

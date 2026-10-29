import { describe, expect, it } from 'vitest';
import { FRAME, Scheduler, countdownEnd, frameOf } from '../../src/core/sim/clock.ts';
import { LatentService, type LatentOwner } from '../../src/core/sim/latent.ts';
import type { RichCurve } from '../../src/content/demo/types.ts';

function owner(id: number, timelines: LatentOwner['def']['timelines'] = {}): LatentOwner & { ticks: number } {
  return { id, def: { path: `Test/O${id}`, timelines }, ticks: 0, ReceiveTick(this: { ticks: number }) { this.ticks++; } };
}

/** A small scripted world: delays, retriggers, timers and processes logging (time, label). */
function scenario(clock: Scheduler): string[] {
  const log: string[] = [];
  const lat = new LatentService({ clock, anim: () => undefined });
  const a = owner(1), b = owner(2);
  const t = (s: string): void => { log.push(`${clock.now.toFixed(4)} ${s}`); };
  lat.delay(a, 'L10', 0.3, () => { t('a.L10'); lat.delay(a, 'L10', 0.2, () => t('a.L10 again')); });
  lat.retriggerableDelay(b, 'L20', 0.5, () => t('b.L20'));
  clock.after(0.25, () => lat.retriggerableDelay(b, 'L20', 0.5, () => t('b.L20 restarted')));
  lat.setTimer(a, 'tick', 0.1, true, () => { t('a.timer'); if (clock.now > 0.45) lat.clearTimer(a, 'tick'); }, -0.1);
  clock.at(0.1, () => t('at 0.1 #1'));
  clock.at(0.1, () => { t('at 0.1 #2'); clock.at(0.1, () => t('at 0.1 nested')); });
  let n = 0;
  clock.addProcess({ step: () => { n++; if (n % 12 === 0) t(`process ${n}`); }, active: () => n < 36 });
  return log;
}

describe('scheduler', () => {
  it('advance(1/60) steps give the same result as runUntil', () => {
    const c1 = new Scheduler();
    const log1 = scenario(c1);
    for (let i = 0; i < 120; i++) c1.advance(FRAME);
    const c2 = new Scheduler();
    const log2 = scenario(c2);
    expect(c2.runUntil(() => false, 10)).toBe('idle');
    expect(log1).toEqual(log2);
    expect(log1.length).toBeGreaterThan(8);
    expect(c1.now).toBeCloseTo(2, 12);
    expect(frameOf(c1.now)).toBe(120);
  });

  it('advance in uneven steps gives the same result', () => {
    const c1 = new Scheduler();
    const log1 = scenario(c1);
    for (const dt of [0.013, 0.2, 0.0001, 0.5, 0.7, 0.6]) c1.advance(dt);
    const c2 = new Scheduler();
    const log2 = scenario(c2);
    c2.runUntil(() => false, 10);
    expect(log1).toEqual(log2);
  });

  it('runs entries in (time, insertion) order, nested same-time entries after the current one', () => {
    const c = new Scheduler();
    const out: string[] = [];
    c.at(0.2, () => out.push('b'));
    c.at(0.1, () => { out.push('a1'); c.at(0.1, () => out.push('a3')); });
    c.at(0.1, () => out.push('a2'));
    c.advance(1);
    expect(out).toEqual(['a1', 'a2', 'a3', 'b']);
  });

  it('cancels entries and every entry of an owner', () => {
    const c = new Scheduler();
    const out: string[] = [];
    const o = {};
    const e = c.at(0.1, () => out.push('x'));
    c.at(0.2, () => out.push('o1'), o);
    c.at(0.3, () => out.push('o2'), o);
    c.at(0.4, () => out.push('free'));
    c.cancel(e);
    c.cancelOwner(o);
    expect(c.runUntil(() => false, 5)).toBe('idle');
    expect(out).toEqual(['free']);
  });

  it('runUntil stops, idles (weak entries do not count) and times out', () => {
    const c = new Scheduler();
    let x = 0;
    c.at(0.5, () => { x = 1; });
    c.at(1.5, () => { x = 2; });
    expect(c.runUntil(() => x === 1, 10)).toBe('stopped');
    expect(c.now).toBe(0.5);
    expect(c.runUntil(() => false, 0.5)).toBe('timeout');
    expect(c.now).toBe(1);
    const lat = new LatentService({ clock: c, anim: () => undefined });
    const o = owner(1);
    lat.setTickEnabled(o, true);
    expect(c.runUntil(() => false, 10)).toBe('idle');
    expect(x).toBe(2);
    expect(o.ticks).toBe(30); // frames 61…90: finish the 1.5 s timestamp before reporting idle
  });

  it('exposes input only after same-time weak ticks and nested callbacks settle, like advance', () => {
    const setup = () => {
      const c = new Scheduler();
      let input = false;
      const log: string[] = [];
      c.at(0.5, () => { input = true; log.push('input'); c.at(0.5, () => log.push('nested')); });
      c.at(0.5, () => log.push('tick'), undefined, { weak: true });
      c.at(1, () => log.push('later'));
      return { c, log, input: () => input };
    };
    const a = setup(), b = setup();
    expect(a.c.runUntil(a.input, 10)).toBe('stopped');
    b.c.advance(0.5);
    expect(a.log).toEqual(['input', 'tick', 'nested']);
    expect(a.log).toEqual(b.log);
    expect(a.c.pending()).toEqual(b.c.pending());
  });

  it('countdowns resolve on the first frame boundary at or after expiry, never in the same frame', () => {
    expect(countdownEnd(0, 0)).toBeCloseTo(FRAME, 12);
    expect(countdownEnd(0, 0.3)).toBeCloseTo(0.3, 12);
    expect(countdownEnd(0.01, 0.3)).toBeCloseTo(19 / 60, 12);
    expect(countdownEnd(0.5, 1e-4)).toBeCloseTo(31 / 60, 12);
  });

  it('processes are stepped at 1/120 s while active', () => {
    const c = new Scheduler();
    let steps = 0;
    c.addProcess({ step: dt => { expect(dt).toBe(1 / 120); steps++; }, active: () => steps < 10 });
    c.advance(1);
    expect(steps).toBe(10);
    expect(c.runUntil(() => false, 1)).toBe('idle');
  });
});

describe('latent nodes', () => {
  it('Delay latches per node per object: a call while pending is ignored', () => {
    const c = new Scheduler();
    const lat = new LatentService({ clock: c, anim: () => undefined });
    const o = owner(1), p = owner(2);
    const out: string[] = [];
    lat.delay(o, 'L1', 0.5, () => out.push(`first ${c.now}`));
    lat.delay(o, 'L1', 0.1, () => out.push('ignored'));
    lat.delay(o, 'L2', 0.1, () => out.push(`other node ${c.now.toFixed(4)}`));
    lat.delay(p, 'L1', 0.2, () => out.push(`other object ${c.now.toFixed(4)}`));
    c.advance(1);
    expect(out).toEqual(['other node 0.1000', 'other object 0.2000', 'first 0.5']);
  });

  it('RetriggerableDelay restarts while pending', () => {
    const c = new Scheduler();
    const lat = new LatentService({ clock: c, anim: () => undefined });
    const o = owner(1);
    const out: number[] = [];
    lat.retriggerableDelay(o, 'L1', 0.5, () => out.push(c.now));
    c.advance(0.4);
    lat.retriggerableDelay(o, 'L1', 0.5, () => out.push(c.now));
    c.advance(2);
    expect(out).toHaveLength(1);
    expect(out[0]).toBeCloseTo(0.9, 12);
  });

  it('DelayUntilNextTick resumes on the next frame boundary', () => {
    const c = new Scheduler();
    const lat = new LatentService({ clock: c, anim: () => undefined });
    const o = owner(1);
    const out: number[] = [];
    c.at(0.005, () => lat.nextTick(o, 'L1', () => out.push(c.now)));
    c.advance(1);
    expect(out[0]).toBeCloseTo(FRAME, 12);
  });

  it('timer: first call at rate + InitialStartDelay, then every rate; rate ≤ 0 creates no timer', () => {
    const c = new Scheduler();
    const lat = new LatentService({ clock: c, anim: () => undefined });
    const o = owner(1);
    const calls: number[] = [];
    lat.setTimer(o, 'h', 0.5, true, () => calls.push(c.now), 0.25);
    c.advance(1.8);
    expect(calls.map(x => +x.toFixed(4))).toEqual([0.75, 1.25, 1.75]);
    // InitialStartDelay = −rate (TURN-030): the first call is the next timer tick
    const d: number[] = [];
    lat.setTimer(o, 'g', 0.4, false, () => d.push(c.now), -0.4);
    c.advance(1);
    expect(d).toHaveLength(1);
    expect(d[0] - 1.8).toBeCloseTo(FRAME, 9);
    for (const rate of [0, -1]) {
      lat.setTimer(o, 'none', rate, true, () => d.push(-1));
      expect(lat.isTimerActive(o, 'none')).toBe(false);
    }
    c.advance(1);
    expect(d).toHaveLength(1);
  });

  it('a looping timer faster than a frame fires once per missed period', () => {
    const c = new Scheduler();
    const lat = new LatentService({ clock: c, anim: () => undefined });
    const o = owner(1);
    let n = 0;
    lat.setTimer(o, 'h', 0.005, true, () => n++);
    c.advance(1);
    expect(n).toBe(200);
  });

  it('owner cancel on destroy removes latches, timers and ticks', () => {
    const c = new Scheduler();
    const lat = new LatentService({ clock: c, anim: () => undefined });
    const o = owner(1);
    let n = 0;
    lat.delay(o, 'L1', 0.2, () => n++);
    lat.setTimer(o, 't', 0.1, true, () => n++);
    lat.setTickEnabled(o, true);
    c.cancelOwner(o);
    lat.release(o);
    c.advance(1);
    expect(n).toBe(0);
    expect(o.ticks).toBe(0);
  });

  it('timeline length and tracks come from the class manifest', () => {
    const linear: RichCurve = {
      Keys: [
        { InterpMode: 'RCIM_Linear', TangentMode: 'RCTM_Auto', TangentWeightMode: 'RCTWM_WeightedNone', Time: 0, Value: 0, ArriveTangent: 0, ArriveTangentWeight: 0, LeaveTangent: 0, LeaveTangentWeight: 0 },
        { InterpMode: 'RCIM_Linear', TangentMode: 'RCTM_Auto', TangentWeightMode: 'RCTWM_WeightedNone', Time: 0.5, Value: 100, ArriveTangent: 0, ArriveTangentWeight: 0, LeaveTangent: 0, LeaveTangentWeight: 0 },
      ],
      DefaultValue: 0, PreInfinityExtrap: 'RCCE_Constant', PostInfinityExtrap: 'RCCE_Constant',
    };
    const c = new Scheduler();
    const missing: string[] = [];
    const lat = new LatentService({ clock: c, anim: () => undefined, missing: w => missing.push(w) });
    const o = owner(1, { 移动: { length: 0.5, tracks: { 位移: linear } } });
    const ups: [number, number][] = [];
    let finishedAt = -1;
    lat.timeline(o, '移动', 'PlayFromStart', { update: (t, tr) => ups.push([t, tr.位移]), finished: () => { finishedAt = c.now; } });
    c.advance(1);
    expect(ups).toHaveLength(30);
    expect(ups[0][0]).toBeCloseTo(FRAME, 9);
    expect(ups[14][1]).toBeCloseTo(50, 3);
    expect(ups[29]).toEqual([0.5, 100]);
    expect(finishedAt).toBeCloseTo(0.5, 9);
    lat.timeline(o, '移动', 'ReverseFromEnd');
    c.advance(1);
    expect(ups.at(-1)).toEqual([0, 0]);
    lat.timeline(o, '不存在', 'Play');
    expect(missing).toEqual(['timeline Test/O1.不存在']);
  });

  it.each(['caller', 'target'])('destroying the animation %s removes cross-owner delegates without firing cancellation', removed => {
    const c = new Scheduler();
    const lat = new LatentService({ clock: c, anim: () => ({ seconds: 1, notifies: [{ name: 'late', time: 0.8 }] }) });
    const caller = owner(1), actor = owner(2), nextCaller = owner(3);
    const events: string[] = [];
    lat.playAnim(caller, actor, 'Born', {
      cancelled: () => events.push('dead caller cancelled'),
      completed: () => events.push('dead caller completed'),
      notify: () => events.push('dead caller notify'),
    });
    c.advance(0.2);
    const gone = removed === 'caller' ? caller : actor;
    c.cancelOwner(gone);
    lat.release(gone);
    // Same surviving actor can receive another animation after its old callback receiver is gone.
    if (removed === 'caller') lat.playAnim(nextCaller, actor, 'Attack', { completed: () => events.push('live caller completed') });
    c.advance(2);
    expect(events).toEqual(removed === 'caller' ? ['live caller completed'] : []);
  });

  it('playAnim: notifies and completion from the animation manifest; a new override cancels the old', () => {
    const c = new Scheduler();
    const anims: string[] = [];
    const lat = new LatentService({
      clock: c,
      anim: s => (s === 'atk' ? { seconds: 0.6, notifies: [{ name: '动画攻击检测', time: 0.25 }] } : s === 'idle' ? { seconds: 1, notifies: [] } : undefined),
      onAnim: (on, s, sec) => anims.push(`${on.id}:${s}:${sec}`),
    });
    const caller = owner(1), actor = owner(2);
    const out: string[] = [];
    lat.playAnim(caller, actor, 'atk', { notify: n => out.push(`${n} ${c.now.toFixed(4)}`), completed: () => out.push(`done ${c.now.toFixed(4)}`) });
    c.advance(1);
    lat.playAnim(caller, actor, 'idle', { completed: () => out.push('idle done'), cancelled: () => out.push('idle cancelled') });
    c.advance(0.5);
    lat.playAnim(caller, actor, 'atk');
    c.advance(1);
    expect(out).toEqual(['动画攻击检测 0.2500', 'done 0.6000', 'idle cancelled']);
    expect(anims).toEqual(['2:atk:0.6', '2:idle:1', '2:atk:0.6']);
  });

  it('rate .8 scales notify and completion together; replacing the slot cancels its pending delegates', () => {
    const c = new Scheduler(), events: string[] = [], shown: number[] = [];
    const lat = new LatentService({ clock: c, anim: () => ({ seconds: .4, notifies: [{ name: 'hit', time: .2 }] }),
      onAnim: (_on, _seq, seconds) => shown.push(seconds) });
    const caller = owner(1), actor = owner(2);
    lat.playAnim(caller, actor, 'slow', { notify: () => events.push(`hit:${c.now}`), completed: () => events.push(`done:${c.now}`) }, { rate: .8 });
    c.advance(.249); expect(events).toEqual([]); c.advance(.001); expect(events).toEqual(['hit:0.25']);
    c.advance(.25); expect(events).toEqual(['hit:0.25', 'done:0.5']); expect(shown).toEqual([.5]);
    lat.playAnim(caller, actor, 'slow', { notify: () => events.push('obsolete hit'), cancelled: () => events.push('cancelled'), completed: () => events.push('obsolete done') }, { rate: .8 });
    c.advance(.1); lat.playAnim(caller, actor, 'replacement'); c.advance(1);
    expect(events).toEqual(['hit:0.25', 'done:0.5', 'cancelled']); expect(shown).toEqual([.5, .5, .4]);
  });

  it('weak cosmetic overrides do not keep idle alive but still notify during actual advancement and release cleanly', () => {
    const c = new Scheduler(), events: string[] = [], caller = owner(1), actor = owner(2);
    const lat = new LatentService({ clock: c, anim: () => ({ seconds: .4, notifies: [{ name: 'dust', time: .2 }] }) });
    lat.playAnim(caller, actor, 'counter', { notify: n => events.push(n), completed: () => events.push('done') }, { rate: .8, weak: true });
    expect(c.runUntil(() => false, 10)).toBe('idle'); expect(c.now).toBe(0);
    c.advance(.25); expect(events).toEqual(['dust']); lat.release(caller); c.advance(1); expect(events).toEqual(['dust']);
  });
});

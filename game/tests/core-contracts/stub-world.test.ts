import { describe, expect, it } from 'vitest';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { blankDef, stubWorld } from '../fixtures/stub-world.ts';

describe('stubWorld (tests/fixtures, WAVE_A A01 part 2)', () => {
  it('runs clock entries only when advanced, in (time, insertion) order', () => {
    const w = stubWorld();
    const log: string[] = [];
    w.clock.after(0.5, () => log.push('b'));
    w.clock.after(0.25, () => log.push('a'));
    w.clock.after(0.5, () => log.push('c'));
    const dropped = w.clock.after(0.3, () => log.push('x'));
    w.clock.cancel(dropped);
    expect(log).toEqual([]);
    w.clock.advance(0.4);
    expect(log).toEqual(['a']);
    expect(w.clock.runUntil(() => log.length === 3, 5)).toBe('stopped');
    expect(log).toEqual(['a', 'b', 'c']);
    expect(w.clock.runUntil(() => false, 1)).toBe('idle');
  });

  it('records latent calls and fires them only by hand', () => {
    const w = stubWorld();
    const a = new BP_ManeActor(w, blankDef());
    let fired = 0;
    a.delay('L100', 0.5, () => fired++);
    expect(w.latentCalls.map(c => [c.op, c.o, c.args[0]])).toEqual([['delay', a, 'L100']]);
    w.clock.advance(1);
    expect(fired).toBe(0);
    w.fireLatent(0);
    expect(fired).toBe(1);
  });

  it('counts unported calls, and throws on them when strict', () => {
    const w = stubWorld({ sys: { craft: {} } });
    // Explicitly remove these implementations, regardless of which content batches have landed.
    expect(函数库_工具.判断生产状态(new BP_ManeActor(w, blankDef()))).toEqual({ 生产中: false });
    expect(w.unportedCalls).toEqual(['函数库_工具.判断生产状态']);
    expect(w.coverage.counts.get('函数库_工具.判断生产状态')).toBe(1);
    const s = stubWorld({ strict: true, sys: { launch: {} } });
    expect(() => new BP_ManeActor(s, blankDef()).弹性处理()).toThrow(/unported: BP_ManeActor\.弹性处理/);
  });

  it('routes facade calls to module overrides', () => {
    const w = stubWorld({ sys: { kernel: { 函数库_工具: { 吸附到网格: (_ctx, v, _o, size) => ({ x: Math.round(v.x / size) * size, y: 0, z: 0 }) } } } });
    expect(函数库_工具.吸附到网格(new BP_ManeActor(w, blankDef()), { x: 100, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 64)).toEqual({ x: 128, y: 0, z: 0 });
    expect(w.unportedCalls).toEqual([]);
  });

  it('spawns with the class manifest, destroys, and answers modals', () => {
    const w = stubWorld();
    const p = w.spawn(BP_Actor_Player, o => { o.等级 = 3; }, { x: 64, y: 0, z: 0 });
    expect(p.等级).toBe(3);
    expect(p.K2_GetActorLocation()).toEqual({ x: 64, y: 0, z: 0 });
    expect(p.HasMatchingGameplayTag('可交互.角色')).toBe(true);
    expect(w.isValid(p)).toBe(true);
    w.destroy(p);
    expect(w.isValid(p)).toBe(false);
    expect(w.mode).toBe(w.mode);
    expect(w.mode.id).not.toBe(w.cult.id);
    const answers: string[] = [];
    w.mode.openModal({ kind: 'warning', type: 0, text: '', buttons: ['a', 'b'] }, a => answers.push(a.type));
    expect(w.modal.current?.kind).toBe('warning');
    expect(w.modal.answer({ type: 'warning.answer', button: 0 })).toBe(true);
    expect(answers).toEqual(['warning.answer']);
    expect(w.modal.answer({ type: 'warning.answer', button: 0 })).toBe(false);
  });
});

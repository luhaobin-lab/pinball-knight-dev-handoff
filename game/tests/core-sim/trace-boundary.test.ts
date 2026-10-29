/** Source net uses Pawn MultiSphere(Start==End), followed by a zero-width 可伤害 LineSingle from owner's surface.
 * These are geometric boundary fixtures, not natural-room or Chaos-order equivalence claims.
 */
import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BpObject } from '../../src/core/sim/object.ts';
import { registerEffectSphere } from '../../src/core/sys/physics/effect-body.ts';

class Conductor extends BpObject { static override readonly path = 'Test/QueryConductor'; }
const at = (x: number, y = 0) => ({ x, y, z: 0 });
const setup = () => createWorld({ content: registry, seed: 4 });
const actor = (w: ReturnType<typeof setup>, x: number, radius = 28) => w.spawn(BP_ManeActor, a => { a.宽度 = radius; }, at(x));

describe('world query source boundaries', () => {
  it('zero-length overlap includes actors beyond an overlapping wall and retains block/touch flags', () => {
    const w = setup(); w.setGeometry(() => ({ boxes: [{ id: 'wall', minX: -5, maxX: 5, minY: -200, maxY: 200 }] }));
    const a = actor(w, 80), b = actor(w, -80);
    const conductor = w.spawn(Conductor, undefined, at(140));
    conductor.OwnedGameplayTags.add('可交互.角色.环境.导体');
    registerEffectSphere(conductor, { radius: 12, mass: 1, linearDamping: 0, objectType: 'WorldDynamic', defaultResponse: 'ignore', responses: { Pawn: 'overlap' } });
    const query = () => w.trace.sphere(at(0), at(0), 200, 'Pawn');
    const hits = query(); expect(hits.some(h => h.actor === null && h.blockingHit)).toBe(true);
    expect(hits.filter(h => h.actor instanceof BP_ManeActor).map(h => h.actor)).toEqual(expect.arrayContaining([a, b]));
    expect(hits.find(h => h.actor === conductor)?.blockingHit).toBe(false);
    expect(hits.find(h => h.actor === a)?.blockingHit).toBe(true);
    expect(hits.every(h => h.time === 0)).toBe(true);
    const before = w.digest(); expect(query()).toEqual(hits); expect(w.digest()).toBe(before);
  });
  it('moving multi-sphere and single-line still stop at a blocking static wall', () => {
    const w = setup(); w.setGeometry(() => ({ boxes: [{ id: 'wall', minX: 50, maxX: 60, minY: -200, maxY: 200 }] }));
    const behind = actor(w, 100, 10);
    const hits = w.trace.sphere(at(0), at(200), 5, 'Pawn');
    expect(hits).toHaveLength(1); expect(hits[0]?.staticSurface?.kind).toBe('solid'); expect(hits[0]?.blockingHit).toBe(true);
    expect(hits.some(h => h.actor === behind)).toBe(false);
    const ray = w.trace.line(at(0), at(200), '可伤害'); expect(ray?.actor).toBe(null); expect(ray?.location.x).toBe(50);
  });
  it('a ray leaving an exact actor surface reaches the next actor without radius inflation', () => {
    const w = setup(); const owner = actor(w, 0), target = actor(w, 100, 10);
    const hit = w.trace.line(at(28), at(180), '可伤害'); expect(hit?.actor).toBe(target); expect(hit?.location.x).toBeCloseTo(90);
    expect(w.trace.line(at(28), at(-100), '可伤害')?.actor).toBe(owner); // entering the same boundary still blocks
  });
  it('a genuinely penetrating start is retained even when the ray moves outward', () => {
    const w = setup(), owner = actor(w, 0);
    const hit = w.trace.line(at(27.999), at(180), '可伤害'); expect(hit?.actor).toBe(owner); expect(hit?.time).toBe(0);
  });
  it('exact rays miss a .005uu gap that the old .01uu sphere incorrectly blocked', () => {
    const w = setup(); w.setGeometry(() => ({ boxes: [{ id: 'near', minX: 20, maxX: 40, minY: .005, maxY: 4 }] }));
    expect(w.trace.line(at(0), at(100), '可伤害')).toBe(null);
  });
  it('single-line ignores touch-only generic conductors but reports the next blocking actor', () => {
    const w = setup(), conductor = w.spawn(Conductor, undefined, at(40)), target = actor(w, 100, 10);
    registerEffectSphere(conductor, { radius: 12, mass: 1, linearDamping: 0, objectType: 'WorldDynamic', defaultResponse: 'overlap', responses: {} });
    expect(w.trace.line(at(0), at(180), '可伤害')?.actor).toBe(target);
  });
});

import { describe, expect, it } from 'vitest';
import { ClassResolver, cloneDefault, type AnyCtor } from '../../src/core/sim/registry.ts';
import { CoverageCounters } from '../../src/core/sim/coverage.ts';
import { Hasher, serialize } from '../../src/core/sim/digest.ts';

class Base { static readonly path: string = 'Script/Base'; hp = 1; }
class Effect extends Base { static override readonly path: string = 'BP/蓝图_效果'; 持续回合 = -1; }

const defs = new Map([
  ['BP/蓝图_效果', { path: 'BP/蓝图_效果', parent: null, vars: {} }],
  ['BP/蓝图_效果_甲', { path: 'BP/蓝图_效果_甲', parent: 'BP/蓝图_效果', vars: { 叠加值: 3, 列表: [1, 2] } }],
  ['BP/蓝图_效果_乙', { path: 'BP/蓝图_效果_乙', parent: 'BP/蓝图_效果_甲', vars: { 乙值: 'x' } }],
  ['BP/孤儿', { path: 'BP/孤儿', parent: 'Script/Unknown', vars: {} }],
]);
const registered = new Map<string, AnyCtor>([['BP/蓝图_效果', Effect]]);

describe('class resolver', () => {
  const r = new ClassResolver<AnyCtor, (typeof defs extends Map<string, infer D> ? D : never)>({
    get: p => registered.get(p), def: p => defs.get(p), fallback: () => Base,
  });
  it('returns registered modules as they are', () => {
    expect(r.resolve('BP/蓝图_效果')).toEqual({ ctor: Effect, stub: false });
  });
  it('builds stubs from the manifest: parent behaviour, own vars with fresh copies, cached', () => {
    const a = r.resolve('BP/蓝图_效果_乙')!;
    expect(a.stub).toBe(true);
    expect(a.ctor.path).toBe('BP/蓝图_效果_乙');
    const C = a.ctor as unknown as new () => Record<string, unknown>;
    const x = new C(), y = new C();
    expect(x).toBeInstanceOf(Effect);
    expect([x.持续回合, x.叠加值, x.乙值]).toEqual([-1, 3, 'x']);
    expect(x.列表).not.toBe(y.列表);
    expect(r.resolve('BP/蓝图_效果_乙')!.ctor).toBe(a.ctor);
    expect(r.resolve('BP/蓝图_效果_甲')!.ctor.path).toBe('BP/蓝图_效果_甲');
    expect(new (r.resolve('BP/孤儿')!.ctor as unknown as new () => object)()).toBeInstanceOf(Base);
    expect(r.resolve('BP/none')).toBeUndefined();
  });
  it('cloneDefault copies arrays, maps and records', () => {
    const v = { a: [1, { b: 2 }], m: new Map([['k', [3]]]) };
    const c = cloneDefault(v);
    expect(c).toEqual(v);
    expect(c.a).not.toBe(v.a);
    expect(c.m.get('k')).not.toBe(v.m.get('k'));
  });
});

describe('coverage and digest', () => {
  it('counts hits by key, sorted in the report', () => {
    const c = new CoverageCounters();
    c.stubHit('b'); c.stubHit('a'); c.stubHit('b'); c.unportedHit('BP_ManeActor.终结目标'); c.classHit('x');
    expect(c.report()).toEqual({ classes: { x: 1 }, stubs: { a: 1, b: 2 }, unported: { 'BP_ManeActor.终结目标': 1 } });
    expect(Object.keys(c.report().stubs)).toEqual(['a', 'b']);
  });
  it('serializes state with object references as ids and keeps container order', () => {
    const o1 = { id: 1, world: 'skip', 当前生命: 5 };
    const o2 = { id: 2, 目标: o1, 列表: [o1, null], 映射: new Map([['b', 1], ['a', 2]]), tags: { toArray: () => ['x.y'] } };
    const refs = { idOf: (v: object) => (v === o1 || v === o2 ? (v as { id: number }).id : undefined) };
    expect(serialize(o2, refs, o2)).toBe('{id:2,目标:#1,列表:[#1,n,],映射:M{"b":1,"a":2,},tags:T["x.y",],}');
    expect(serialize(o1, refs, o1)).toBe('{id:1,当前生命:5,}');
    expect(new Hasher().update('a').hex()).not.toBe(new Hasher().update('b').hex());
    expect(new Hasher().update('abc').hex()).toBe(new Hasher().update('abc').hex());
  });
});

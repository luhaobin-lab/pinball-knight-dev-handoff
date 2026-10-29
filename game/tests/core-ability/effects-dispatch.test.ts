/** 蓝图_效果 lifecycle, stacking / unique rules, the generic passives and dispatch (ability-framework ABILIT-039…062, §18). */
import { describe, expect, it } from 'vitest';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { make效果配置 } from '../../src/core/bp/structs.ts';
import { fireCopy, fireLive, forLive, tickCopy } from '../../src/core/ability/dispatch.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { sci } from '../../src/core/math/sci.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { 蓝图_能力_给自身加被动 } from '../../src/content/bp/Skill/Ability/蓝图_能力_给自身加被动.ts';
import { 蓝图_能力_给自身加被动_多个 } from '../../src/content/bp/Skill/Ability/蓝图_能力_给自身加被动_多个.ts';
import { addSkill, calls, effectRow, fixture, listener, skillRow } from './helpers.ts';

const DAY = '效果.时机.新一天时';
const MADE = '效果.时机.创建时';

/** A passive that applies `cfg` (one 效果配置) and runs 执行技能 once per call. */
function passive(owner: Parameters<typeof addSkill>[0], cfg: ReturnType<typeof effectRow>, o: { 唯一ID?: string; 多个?: readonly ReturnType<typeof effectRow>[] } = {}): 蓝图_能力 {
  const cls = o.多个 ? 蓝图_能力_给自身加被动_多个 : 蓝图_能力_给自身加被动;
  const a = addSkill(owner, cls, skillRow({ 标签: ['能力.时机.被动'], 能力: { 效果: o.多个 ?? [cfg] } }), { 唯一ID: o.唯一ID, active: false });
  // 添加技能's passive routing (ABILIT-005)
  owner.拥有的被动能力.push(a);
  a.被选中();
  a.执行技能(false);
  return a;
}
const ofClass = (list: readonly (蓝图_效果 | null)[], name: string) => list.filter(e => e?.def.path === `Test/${name}`);

describe('turn-timed effects (ABILIT-042, 045, 062)', () => {
  it('ABILIT-TV17: 持续回合 2 activated mid-turn ticks 3 → 2 → 1 → 0, fires 3 times and dies in the third cleanup', () => {
    const E = listener('E', [DAY, MADE]);
    const w = fixture({ classes: [E] });
    passive(w.hero, effectRow({ 效果类: 'Test/E', 持续回合: 2, '唯一？': true }));
    const e = ofClass(w.hero.拥有的效果, 'E')[0]!;
    const seq = [e.剩余回合];
    for (let t = 0; t < 3; t++) { w.turnStart(); seq.push(e.剩余回合); }
    expect(seq).toEqual([3, 2, 1, 0]);
    expect(calls.filter(c => c === `E.持续中触发(${DAY})`).length).toBe(3);
    expect(w.world.isValid(e)).toBe(false);
    expect(w.hero.拥有的效果).not.toContain(e);
  });

  it('ABILIT-TV18: 持续回合 0 fires once at the next turn start and is removed', () => {
    const E = listener('E', [DAY, MADE]);
    const w = fixture({ classes: [E] });
    passive(w.hero, effectRow({ 效果类: 'Test/E', 持续回合: 0 }));
    const e = ofClass(w.hero.拥有的效果, 'E')[0]!;
    expect(e.剩余回合).toBe(1);
    w.turnStart();
    expect([e.剩余回合, w.world.isValid(e)]).toEqual([0, false]);
    expect(calls.filter(c => c.startsWith('E.持续中触发')).length).toBe(1);
  });

  it('ABILIT-TV19 / ABILIT-041: without 创建时 an effect stays dormant and a turn-timed one dies on its first tick (SPEC-GAP G9)', () => {
    const E = listener('E', ['效果.时机.死亡前', DAY]);
    const w = fixture({ classes: [E] });
    passive(w.hero, effectRow({ 效果类: 'Test/E', 持续回合: 2 }));
    const e = ofClass(w.hero.拥有的效果, 'E')[0]!;
    expect(e.剩余回合).toBe(-1);
    expect(calls.some(c => c.startsWith('E.激活后触发'))).toBe(false);
    w.turnStart();
    expect([e.剩余回合, e.已销毁, w.world.isValid(e)]).toEqual([-2, true, false]);
    expect(calls.filter(c => c.startsWith('E.持续中触发')).length).toBe(1);
  });

  it('a time-timed effect: looping timer from 0 s at 触发间隔, countdown to 销毁效果 at 持续时长', () => {
    const E = listener('E', [MADE]);
    const w = fixture({ classes: [E] });
    passive(w.hero, effectRow({ 效果类: 'Test/E', 持续时间: 1.0, 触发间隔: 0.25 }));
    const e = ofClass(w.hero.拥有的效果, 'E')[0]!;
    expect(e.剩余时长).toBe(1.0);
    w.advance(0.6);
    const fires = calls.filter(c => c === 'E.持续中触发(None)').length;
    expect(fires).toBeGreaterThanOrEqual(2);
    expect(w.world.isValid(e)).toBe(true);
    w.advance(0.5);
    expect(w.world.isValid(e)).toBe(false);
    expect(w.hero.拥有的效果).not.toContain(e);
  });

  it('销毁效果 with 销毁延迟 keeps the effect in the lists until the delay; a second call while pending only re-runs 销毁前触发', () => {
    let before = 0;
    const E = listener('E', [MADE]);
    class D extends E { static override readonly path = 'Test/D'; override 销毁前触发(): void { before++; } }
    const w = fixture({ classes: [D] });
    passive(w.hero, effectRow({ 效果类: 'Test/D' }));
    const e = w.hero.拥有的效果.find(x => x?.def.path === 'Test/D')!;
    e.销毁延迟 = 0.5;
    e.销毁效果();
    e.销毁效果();
    expect([before, w.hero.拥有的效果.includes(e)]).toEqual([2, true]);
    w.advance(0.5);
    expect([w.world.isValid(e), w.hero.拥有的效果.includes(e)]).toEqual([false, false]);
    // A stale reference cannot re-enter the before-hook or schedule a second destruction after the actor is gone.
    const digest = w.world.digest();
    e.销毁效果();
    expect(before).toBe(2);
    expect(w.world.digest()).toBe(digest);
  });
});

describe('apply, refresh, stack, unique (ABILIT-050…055)', () => {
  it('ABILIT-TV10: a unique class merge refreshes with max() and adds a stack up to the cap', () => {
    const w = fixture();
    const e = w.world.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/蓝图_效果_空', x => { x.拥有者 = w.hero; });
    w.hero.拥有的效果.push(e);
    Object.assign(e, { 剩余时长: 2.0, 剩余回合: 2, 叠加层数: 3 });
    const r = 函数库_工具.附加效果前处理(w.hero, make效果配置({ 效果类: 'CatapultHero/BP/Skill/效果/蓝图_效果_空', 唯一: true, 检查效果名: false, 持续时间: 5.0, 持续回合: 3, 叠加层数: 1, 叠加上限: 5 }), w.hero, 'x');
    expect(r).toEqual({ 不需附加新效果: true, 效果实例: e });
    expect([e.剩余时长, e.剩余回合, e.叠加层数]).toEqual([5.0, 4, 4]);
  });

  it('ABILIT-TV11 / TV12: the cap clamps; 叠加上限 1 never stacks', () => {
    const w = fixture();
    const e = w.world.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/蓝图_效果_空', x => { x.拥有者 = w.hero; });
    w.hero.拥有的效果.push(e);
    const cfg = (p: object) => make效果配置({ 效果类: 'CatapultHero/BP/Skill/效果/蓝图_效果_空', 唯一: true, ...p });
    Object.assign(e, { 叠加层数: 99, 剩余回合: 1 });
    函数库_工具.附加效果前处理(w.hero, cfg({ 持续回合: 0, 叠加层数: 1, 叠加上限: 99 }), w.hero, 'x');
    expect([e.叠加层数, e.剩余回合]).toEqual([99, 1]);
    Object.assign(e, { 叠加层数: 1, 剩余回合: 2 });
    函数库_工具.附加效果前处理(w.hero, cfg({ 持续回合: 5, 叠加上限: 1 }), w.hero, 'x');
    expect([e.叠加层数, e.剩余回合]).toEqual([1, 6]);
  });

  it('ABILIT-TV13: non-unique effects stack by instance count', () => {
    const E = listener('E', [MADE]);
    const w = fixture({ classes: [E] });
    const a = passive(w.hero, effectRow({ 效果类: 'Test/E', '唯一？': false }));
    a.执行技能(false);
    expect(ofClass(w.hero.拥有的效果, 'E').length).toBe(2);
  });

  it('ABILIT-TV14: name matching merges only the same ability instance', () => {
    const E = listener('E', [MADE]);
    const w = fixture({ classes: [E] });
    const cfg = effectRow({ 效果类: 'Test/E', '唯一？': true, '检查效果名？': true });
    const A = passive(w.hero, cfg, { 唯一ID: 'P//数据表_技能_修炼物品//R' });
    passive(w.hero, cfg, { 唯一ID: 'P2//数据表_技能_修炼物品//R' });
    A.执行技能(false);
    const list = ofClass(w.hero.拥有的效果, 'E');
    expect(list.length).toBe(2);
    expect(list[0]!.效果名字).toBe('P//数据表_技能_修炼物品//R_E');
    expect(list[0]!.来自技能).toBe(A);
  });

  it('ABILIT-TV15: class matching merges any source of that exact class', () => {
    const E = listener('E', [MADE]);
    const w = fixture({ classes: [E] });
    const cfg = effectRow({ 效果类: 'Test/E', '唯一？': true });
    const A = passive(w.hero, cfg, { 唯一ID: 'A' });
    passive(w.hero, cfg, { 唯一ID: 'B' });
    const list = ofClass(w.hero.拥有的效果, 'E');
    expect(list.length).toBe(1);
    expect(list[0]!.来自技能).toBe(A);
  });

  it('ABILIT-TV16: re-applying re-activates from the instance fields after the max() refresh (SPEC-GAP G10)', () => {
    const E = listener('E', [MADE, DAY]);
    const w = fixture({ classes: [E] });
    const A = passive(w.hero, effectRow({ 效果类: 'Test/E', '唯一？': true, 持续回合: 2 }));
    const e = ofClass(w.hero.拥有的效果, 'E')[0]!;
    w.turnStart();
    expect(e.剩余回合).toBe(2);
    A.效果配置[0] = make效果配置({ 效果类: 'Test/E', 唯一: true, 持续回合: 4 });
    calls.length = 0;
    函数库_工具.附加效果前处理(A, A.效果配置[0], w.hero, e.效果名字);
    expect(e.剩余回合).toBe(5);
    A.执行技能(false);
    expect(e.剩余回合).toBe(3);
    expect(calls).toContain('E.激活后触发()');
  });

  it('ABILIT-046: a flagged effect still merges until the cleanup destroys it', () => {
    const E = listener('E', [MADE, DAY]);
    const w = fixture({ classes: [E] });
    const A = passive(w.hero, effectRow({ 效果类: 'Test/E', '唯一？': true, 持续回合: 0 }));
    const e = ofClass(w.hero.拥有的效果, 'E')[0]!;
    e.持续效果();
    expect(e.已销毁).toBe(true);
    A.执行技能(false);
    expect(ofClass(w.hero.拥有的效果, 'E')).toEqual([e]);
    expect(e.已销毁).toBe(true); // sticky: re-activation does not reset it
  });

  it('ABILIT-069: 给自身加被动_多个 applies every config with its own 创建时 gate', () => {
    const On = listener('On', [MADE]);
    const Off = listener('Off', [DAY]);
    const w = fixture({ classes: [On, Off] });
    passive(w.hero, effectRow(), { 多个: [effectRow({ 效果类: 'Test/On', 持续回合: 1 }), effectRow({ 效果类: 'Test/Off', 持续回合: 1 })] });
    expect(ofClass(w.hero.拥有的效果, 'On')[0]!.剩余回合).toBe(2);
    expect(ofClass(w.hero.拥有的效果, 'Off')[0]!.剩余回合).toBe(-1);
  });

  it('ABILIT-040: an item card\'s effects get 装上 / 卸下, a talent\'s get 能力.类型.天赋', () => {
    const w = fixture({ equip: [{ row: '旧剑', quality: 1 }] });
    const e = w.cards[0]!.拥有的效果[0]!;
    expect(e.OwnedGameplayTags.hasAll(['效果.时机.装上', '效果.时机.卸下'])).toBe(true);
    expect(w.hero.拥有的效果).toContain(e); // ABILIT-057: equipped into the hero's list too
    const E = listener('E', [MADE]);
    const w2 = fixture({ classes: [E] });
    const t = addSkill(w2.hero, 蓝图_能力_给自身加被动, skillRow({ 能力: { 效果: [effectRow({ 效果类: 'Test/E' })] } }), { active: false });
    t.是天赋 = true;
    t.执行技能(false);
    expect(ofClass(w2.hero.拥有的效果, 'E')[0]!.OwnedGameplayTags.hasExact('能力.类型.天赋')).toBe(true);
  });

  it('ABILIT-058: unequipping removes the effect from the hero and gives it back to the card', () => {
    const w = fixture({ equip: [{ row: '旧剑', quality: 1 }] });
    const card = w.cards[0]!;
    const e = card.拥有的效果[0]!;
    e.卸下时触发();
    expect([w.hero.拥有的效果.includes(e), e.拥有者]).toEqual([false, card]);
  });

  it('ABILIT-TV29: 排序效果 descending puts the last of the tied maximum first', () => {
    const w = fixture();
    const mk = (lv: number, name: string) => {
      const a = addSkill(w.hero, 蓝图_能力_给自身加被动, skillRow(), { 等级: lv, 能力名: name, active: false });
      return w.world.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/蓝图_效果_空', x => { x.来自技能 = a; x.效果名字 = name; });
    };
    const arr = [mk(5, 'a'), mk(5, 'b'), mk(3, 'c')];
    函数库_工具.排序效果(w.hero, arr, false);
    expect(arr.map(e => e!.效果名字)).toEqual(['b', 'a', 'c']);
  });
});

describe('dispatch (ABILIT-060…062)', () => {
  it('ABILIT-TV33: on a live dispatch a listener that destroys itself makes the next one miss it (SPEC-GAP G6)', () => {
    const tag = '效果.时机.释放技能后';
    const run = (selfFirst: boolean) => {
      const A = listener('A', [tag], e => e.销毁效果());
      const B = listener('B', [tag]);
      const w = fixture({ classes: [A, B] });
      const a = w.world.spawn(A, e => { e.拥有者 = w.hero; });
      const b = w.world.spawn(B, e => { e.拥有者 = w.hero; });
      w.hero.拥有的效果.push(...(selfFirst ? [a, b] : [b, a]));
      fireLive(w.hero.拥有的效果, tag);
      return [calls.includes(`A.持续中触发(${tag})`), calls.includes(`B.持续中触发(${tag})`)];
    };
    expect(run(true)).toEqual([true, false]);
    expect(run(false)).toEqual([true, true]);
  });

  it('TF-TV-30: a live dispatch with record re-reads the slot: the effect that slid into a self-removed listener slot is recorded unfired', () => {
    const tag = '效果.时机.有敌人死亡';
    const run = (order: 'GK' | 'KG') => {
      const P = listener('P', []);
      const G = listener('G', [tag], e => e.销毁效果());
      const K = listener('K', [tag]);
      const w = fixture({ classes: [P, G, K] });
      const [p, g, k] = [P, G, K].map(C => w.world.spawn(C, e => { e.拥有者 = w.hero; }));
      w.hero.拥有的效果.push(p!, ...(order === 'GK' ? [g!, k!] : [k!, g!]));
      const fired = new Set<蓝图_效果>();
      fireLive(w.hero.拥有的效果, tag, undefined, { record: fired });
      return { fired: calls.map(c => c[0]), recorded: [...fired].map(e => e.def.name), k };
    };
    const a = run('GK');
    expect(a.fired).toEqual(['G']);
    expect(a.recorded).toEqual(['K']);
    expect(run('KG').fired).toEqual(['K', 'G']);
  });

  it('live loops visit appended entries; snapshots skip them and survive removals; stale slots are skipped', () => {
    const tag = '效果.时机.附加效果后';
    const C = listener('C', [tag]);
    let spawnOnce = true;
    const P = listener('P', [tag], e => {
      if (!spawnOnce) return;
      spawnOnce = false;
      e.拥有者!.拥有的效果.push(e.world.spawn(C, x => { x.拥有者 = e.拥有者; }));
    });
    const w = fixture({ classes: [P, C] });
    const p = w.world.spawn(P, e => { e.拥有者 = w.hero; });
    const dead = w.world.spawn(C, e => { e.拥有者 = w.hero; });
    w.hero.拥有的效果.push(dead, p);
    dead.K2_DestroyActor();
    fireLive(w.hero.拥有的效果, tag);
    expect(calls.filter(c => c.startsWith('C.')).length).toBe(1); // the appended C, not the stale one
    calls.length = 0;
    spawnOnce = true;
    fireCopy(w.hero.拥有的效果, tag);
    expect(calls.filter(c => c.startsWith('C.')).length).toBe(1); // the old C only, not the new append
  });

  it('TF-TV-30 shape: skip / record de-duplicate an equipped effect that is in the card\'s and the hero\'s list', () => {
    const w = fixture({ equip: [{ row: '旧剑', quality: 1 }] });
    const card = w.cards[0]!;
    const e = card.拥有的效果[0]!;
    e.持续回合 = 3;
    e.剩余回合 = 3;
    e.OwnedGameplayTags.add(DAY);
    const fired = new Set<蓝图_效果>();
    tickCopy(card.拥有的效果, DAY, { record: fired });
    tickCopy(w.hero.拥有的效果, DAY, { skip: fired });
    expect(e.剩余回合).toBe(2);
    tickCopy(card.拥有的效果, DAY);
    tickCopy(w.hero.拥有的效果, DAY);
    expect(e.剩余回合).toBe(0); // without de-duplication it ticks once per list
  });

  it('a dispatch sets 触发时机 and the payload before the hook; 附加效果前 / 后 carry the effect on the actor', () => {
    const tag = '效果.时机.附加效果前';
    const seen: unknown[] = [];
    const E = listener('E', [tag], e => seen.push(e.触发时机, e.触发次数, e.拥有者!.当前附加效果));
    const w = fixture({ classes: [E] });
    const e = w.world.spawn(E, x => { x.拥有者 = w.hero; });
    w.hero.拥有的效果.push(e);
    fireLive(w.hero.拥有的效果, tag, x => { x.触发次数 = 7; });
    w.hero.附加效果前(e);
    expect(seen).toEqual([tag, 7, null, tag, 7, e]);
  });

  it('forLive re-reads the length every iteration', () => {
    const arr = [1, 2];
    const seen: number[] = [];
    forLive(arr, x => { seen.push(x); if (x === 1) arr.push(3); });
    expect(seen).toEqual([1, 2, 3]);
  });

  it('a hierarchical tag test: a child tag matches the parent query, not the other way round', () => {
    const E = listener('E', ['能力.时机.主动.不立刻释放']);
    const w = fixture({ classes: [E] });
    const e = w.world.spawn(E);
    expect([e.HasMatchingGameplayTag('能力.时机.主动'), e.HasMatchingGameplayTag('能力.时机.主动.不立刻释放.x')]).toEqual([true, false]);
  });
});

describe('连击处理 (ABILIT-049, TV20)', () => {
  it('N = c ≤ 1 ? 1 : trunc(c); delayed echoes are 结算类型 7 settlements of 延迟 0.3 under a parent of 延迟 0', () => {
    const run = (c: number, instant: boolean): number => {
      const E = listener('E', [MADE]);
      const w = fixture({ classes: [E] });
      w.world.mode.当前环节 = '进行战斗';
      passive(w.hero, effectRow({ 效果类: 'Test/E' }));
      const e = ofClass(w.hero.拥有的效果, 'E')[0]!;
      添加科学映射值(w.hero.词条, '连击', '', sci(c), false); // the hero row has 连击 1: set the base source
      e.无延迟连击 = instant;
      calls.length = 0;
      e.连击处理(sci(10));
      if (!instant && c > 1) {
        expect(e.连击动画结算.every(s => s!.结算类型 === '连击结算' && s!.延迟 === 0.3)).toBe(true);
        expect(w.world.mode.模式动画结算数组.at(-1)!.子动画结算).toEqual(e.连击动画结算);
      }
      w.advance(3);
      return calls.filter(x => x.startsWith('E.额外子触发')).reduce((n, x) => n + Number(/\((\d+)\)/.exec(x)![1]), 0);
    };
    expect([run(3.0, false), run(2.5, true), run(0.0, false), run(1.5, false)]).toEqual([3, 2, 1, 1]);
  });
});

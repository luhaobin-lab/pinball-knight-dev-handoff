/** DMG-TV-15…29 (draft damage-crit-weakspot §12): 受到即时伤害, statuses, 失去生命/护甲, death check. */
import { describe, expect, it } from 'vitest';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci } from '../../src/core/math/sci.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { harness, n } from './harness.ts';


const hitOn = (h: ReturnType<typeof harness>, target: Parameters<ReturnType<typeof harness>['enemy']>[0] | null, v: number, opts: Partial<ReturnType<typeof make伤害>> = {}) => {
  const from = h.enemy();
  return { from, d: (t: BP_ManeActor) => make伤害({ 伤害来源: '攻击', 伤害类型: '物理', 伤害数值: sci(v), 来自角色: from, 目标角色: t, ...opts }), target };
};

describe('受到即时伤害 (DAMAGE-050…055)', () => {
  it('DMG-TV-15 伤害减免% 0.5 halves the hit', () => {
    const h = harness();
    const t = h.hero({ '伤害减免%': ['乘算', [0.5]], '强固减伤%': 0 }, 100);
    const { d } = hitOn(h, null, 30);
    expect(t.受到即时伤害(d(t), true, false).成功了).toBe(true);
    expect(n(t.当前受伤数值)).toBe(15);
    expect(h.hp(t)).toBe(85);
  });

  it('DMG-TV-16 two Vulnerable stacks: −0.2 → 36', () => {
    const h = harness();
    const t = h.hero({ '伤害减免%': ['乘算', [0, -0.2]], '强固减伤%': 0 }, 100);
    t.受到即时伤害(hitOn(h, null, 30).d(t), true, false);
    expect(n(t.当前受伤数值)).toBeCloseTo(36, 9);
    expect(h.hp(t)).toBeCloseTo(64, 9);
  });

  it('DMG-TV-17 0.5 and −0.2 combine to 0.4', () => {
    const h = harness();
    const t = h.hero({ '伤害减免%': ['乘算', [0.5, -0.2]], '强固减伤%': 0 }, 100);
    t.受到即时伤害(hitOn(h, null, 30).d(t), true, false);
    expect(n(t.当前受伤数值)).toBeCloseTo(18, 9);
    expect(h.hp(t)).toBeCloseTo(82, 9);
  });

  it('DMG-TV-22 a dodge consumes one stack, reduces by 90 %, marks （闪避）, skips block', () => {
    const h = harness();
    const t = h.hero({ '闪避减伤%': ['乘算', [0.9]] }, 150);
    t.闪避层计数 = 2;
    t.格挡层计数 = 3;
    t.受到即时伤害(hitOn(h, null, 30).d(t), true, false);
    expect(t.闪避层计数).toBe(1);
    expect(t.格挡层计数).toBe(3);
    expect(t.当前受伤数据.断开骨骼名).toBe('闪避');
    expect(n(t.当前受伤数值)).toBeCloseTo(3, 9);
    expect(h.hp(t)).toBeCloseTo(147, 9);
    expect(h.w.events.drain().filter(e => e.kind === 'log').map(e => (e as { rich: string }).rich)).toEqual(['<技能>“”</>对<强调>幽冥骑士</>造成了<玩家伤害>3</>伤害。（闪避）']);
  });

  it('DMG-TV-23 one dodge stack reduces a 3-hit packet once; 闪避后 gets the remaining stacks', () => {
    const h = harness();
    const t = h.hero({ '闪避减伤%': ['乘算', [0.9]] });
    let after = -1;
    h.probe(t, ['效果.时机.闪避后'], e => { after = e.触发次数; });
    t.闪避层计数 = 1;
    t.当前受伤数据 = hitOn(h, null, 30, { 触发次数: 3 }).d(t);
    expect(t.闪避处理().闪避了).toBe(true);
    expect(t.闪避层计数).toBe(0);
    expect(n(t.当前受伤数据.伤害数值)).toBeCloseTo(3, 9);
    expect(after).toBe(0);
  });

  it('DMG-TV-24 block: ×(1 − 0.15)^(stacks after)', () => {
    const h = harness();
    const t = h.hero({ '格挡减伤%': ['乘算', [0.15]] });
    const seen: string[] = [];
    h.probe(t, ['效果.时机.格挡前', '效果.时机.格挡后'], (e, tag) => seen.push(`${tag}:${e.触发次数}`));
    t.格挡层计数 = 3;
    t.当前受伤数据 = hitOn(h, null, 100).d(t);
    expect(t.格挡处理().格挡了).toBe(true);
    expect(t.格挡层计数).toBe(2);
    expect(n(t.当前受伤数据.伤害数值)).toBeCloseTo(72.25, 9);
    expect(t.当前受伤数据.断开骨骼名).toBe('格挡');
    expect(seen).toEqual(['效果.时机.格挡前:1', '效果.时机.格挡后:1']);
    expect(h.named('精神系统').map(c => c.args)).toEqual([[0, 1, '触发格挡']]);
  });

  it('DMG-TV-25 the last block stack reduces nothing but still marks 格挡', () => {
    const h = harness();
    const t = h.hero({ '格挡减伤%': ['乘算', [0.15]] });
    t.格挡层计数 = 1;
    t.当前受伤数据 = hitOn(h, null, 100).d(t);
    t.格挡处理();
    expect(t.格挡层计数).toBe(0);
    expect(n(t.当前受伤数据.伤害数值)).toBe(100);
    expect(t.当前受伤数据.断开骨骼名).toBe('格挡');
  });

  it('DMG-TV-26 immunity: no HP change, no log, no 受伤, no attacker 造成伤害后', () => {
    const h = harness();
    const t = h.enemy({}, 50);
    t.OwnedGameplayTags.add('状态.免疫');
    const a = h.hero();
    let after = 0;
    h.probe(a, ['效果.时机.造成伤害后'], () => after++);
    a.造成即时伤害(make伤害({ 伤害来源: '攻击', 伤害类型: '物理', 伤害数值: sci(30), 来自角色: a, 目标角色: t }), false, false);
    expect(h.hp(t)).toBe(50);
    expect(after).toBe(0);
    const events = h.w.events.drain();
    expect(events.filter(e => e.kind === 'log')).toHaveLength(0);
    // COMBAT-047: the immunity feedback's 激活后触发 (L25) returns through L10 销毁效果.
    expect(h.named('激活效果').map(c => c.args[0])).toEqual(['蓝图_效果_免疫抵消伤害时']);
    expect(h.named('销毁效果').map(c => c.args[0])).toEqual(['蓝图_效果_免疫抵消伤害时']);
    expect(events.filter(e => e.kind === 'popup')).toMatchObject([{ popup: 'text', value: '免疫', target: null }]);
    expect(t.拥有的效果).toHaveLength(0);
  });

  it('DMG-TV-27 a zero hit fails before the log', () => {
    const h = harness();
    const t = h.enemy({}, 50);
    expect(t.受到即时伤害(hitOn(h, null, 0).d(t), true, false).成功了).toBe(false);
    expect(t.拥有的效果).toHaveLength(0);
    expect(h.w.events.drain().filter(e => e.kind === 'log')).toHaveLength(0);
  });

  it('DMG-TV-28 HP goes negative, 受伤 kills, then the attacker 造成伤害后 fires', () => {
    const h = harness();
    h.hero();
    const t = h.enemy({}, 20);
    const k = h.enemy({ '暴击伤害%': 1.5 });
    k.角色类型 = '玩家';
    const order: string[] = [];
    h.probe(k, ['效果.时机.造成伤害后'], () => order.push(`造成伤害后:dead=${t.死掉了}`));
    k.造成即时伤害(make伤害({ 伤害来源: '攻击', 伤害类型: '物理', 伤害数值: sci(30), 来自角色: k, 目标角色: t }), false, false);
    expect(h.hp(t)).toBe(-10);
    expect(t.死掉了).toBe(true);
    expect(order).toEqual(['造成伤害后:dead=true']);
  });

  it('DMG-TV-29 可死亡检查 at HP 0', () => {
    const h = harness();
    const a = h.enemy({}, 0);
    expect(a.可死亡检查().可死亡).toBe(true);
  });

  it('the order of one hit (§7 trigger order, steps 4–11)', () => {
    const h = harness();
    const t = h.hero({ '格挡减伤%': ['乘算', [0.15]] });
    t.格挡层计数 = 2;
    const order: string[] = [];
    h.probe(t, ['效果.时机.受到伤害前', '效果.时机.格挡前', '效果.时机.格挡后', '效果.时机.失去生命后', '效果.时机.受到伤害后'], (_e, tag) => order.push(tag.split('.').pop()!));
    t.受到即时伤害(hitOn(h, null, 10).d(t), true, false);
    expect(order).toEqual(['受到伤害前', '格挡前', '格挡后', '失去生命后', '受到伤害后']);
    // COMBAT-032 step 9: 格挡 activates, plays its sound and destroys itself before the next hit effects.
    expect(h.calls.filter(c => c.fn === '激活效果' || c.fn === '销毁效果').map(c => [c.fn, c.args[0]])).toEqual([
      ['激活效果', '蓝图_效果_格挡'], ['销毁效果', '蓝图_效果_格挡'],
      ['激活效果', '蓝图_效果_闪烁'], ['激活效果', '蓝图_效果_受伤'],
    ]);
    expect(h.w.events.drain().filter(e => e.kind === 'sound')).toContainEqual(expect.objectContaining({ asset: '音效_基础_格挡' }));
    expect(t.拥有的效果.map(e => e?.def.name).filter(x => x !== 'Probe')).toEqual(['蓝图_效果_闪烁', '蓝图_效果_受伤']);
  });

  it('non-player victims feed 所有伤害 and the attacker 造成伤害', () => {
    const h = harness();
    const t = h.enemy({}, 50);
    const { from, d } = hitOn(h, null, 12);
    t.受到即时伤害(d(t), true, false);
    expect(h.named('更新回合战斗统计').map(c => [c.args[0], n(c.args[1] as never), c.args[2], c.args[3], c.args[4]])).toEqual([['所有伤害', 12, 25, 4, '速降衰减']]);
    expect(h.named('更新角色战斗统计').map(c => [c.args[0], c.args[1], c.args[2]])).toEqual([[from, '造成伤害', 12]]);
  });
});

describe('失去生命/护甲 (DAMAGE-056/057, combat-statuses §4)', () => {
  it('DMG-TV-18 enough shield: half absorbed', () => {
    const h = harness();
    const t = h.hero({ '强固减伤%': 0.5 }, 150);
    t.当前护甲值 = sci(20);
    let fired = 0;
    h.probe(t, ['效果.时机.失去生命后'], () => fired++);
    t.失去生命_护甲(sci(30), sci(0), true);
    expect([n(t.当前失去护甲), n(t.当前护甲值), n(t.当前失去生命), h.hp(t), fired]).toEqual([15, 5, 15, 135, 1]);
  });

  it('DMG-TV-19 shield too small', () => {
    const h = harness();
    const t = h.hero({ '强固减伤%': 0.5 }, 150);
    t.当前护甲值 = sci(10);
    t.失去生命_护甲(sci(30), sci(0), true);
    expect([n(t.当前失去生命), h.hp(t), n(t.当前失去护甲), n(t.当前护甲值)]).toEqual([20, 130, 10, 0]);
  });

  it('DMG-TV-20 full absorption: no 失去生命后, 生命百分比 kept', () => {
    const h = harness();
    const t = h.hero({ '强固减伤%': 1 }, 150);
    t.当前护甲值 = sci(50);
    t.生命百分比 = 1;
    let fired = 0;
    h.probe(t, ['效果.时机.失去生命后'], () => fired++);
    t.失去生命_护甲(sci(30), sci(0), true);
    expect([n(t.当前护甲值), h.hp(t), fired, t.生命百分比]).toEqual([20, 150, 0, 1]);
  });

  it('DMG-TV-21 enemies (no 强固减伤% key) never spend shield', () => {
    const h = harness();
    const t = h.enemy({}, 30);
    t.当前护甲值 = sci(30);
    t.失去生命_护甲(sci(30), sci(0), true);
    expect([n(t.当前护甲值), h.hp(t)]).toEqual([30, 0]);
  });
});

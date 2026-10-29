/** TF-TV-03, 04, 23, 39 and TURN-037: drawing cards to the field, the initial gauge, the per-round gain, stale neutrals. */
import { describe, expect, it } from 'vitest';
import { harness } from './harness.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';

describe('TURN-010 抽取特定类型卡牌到场上（碰撞）', () => {
  it('TF-TV-03: k = min(max − len(场上), n) bounded by the deck; cards in deck order', () => {
    const cases = [
      { deck: 2, field: 0, max: 5, n: 10, k: 2 }, { deck: 7, field: 3, max: 5, n: 10, k: 2 }, { deck: 3, field: 5, max: 5, n: 10, k: 0 },
      { deck: 0, field: 0, max: 5, n: 10, k: 0 }, { deck: 4, field: 0, max: 1, n: 10, k: 1 }, { deck: 6, field: 0, max: 99, n: 999, k: 6 },
    ];
    for (const c of cases) {
      const h = harness();
      const m = h.w.mode;
      const deck: (BP_ManeActor | null)[] = Array.from({ length: c.deck }, (_, i) => h.enemy(`d${i}`));
      m.敌方牌库.push(...deck);
      const field: (BP_ManeActor | null)[] = Array.from({ length: c.field }, (_, i) => h.enemy(`f${i}`));
      m.抽取特定类型卡牌到场上_碰撞(m.敌方牌库, field, c.max, c.n);
      expect(m.场上所有).toEqual(deck.slice(0, c.k));
      expect(m.敌方牌库).toEqual(deck.slice(c.k));
    }
  });

  it('TF-TV-04: the initial gauge; one U and one U(0, 0.4) are drawn for every card', () => {
    const rows = [
      { 行动力: 100, boss: false, f: 0.374, want: 37 }, { 行动力: 100, boss: false, f: 0.995, want: 100 }, { 行动力: 100, boss: true, f: 0.2, want: 100 },
      { 行动力: 75, boss: false, f: 0.5, want: 50 }, { 行动力: 50, boss: false, f: 0.9, want: 50 }, { 行动力: 0, boss: false, f: 0.3, want: 0 },
      { 行动力: 200, boss: true, f: 0.7, want: 100 },
    ];
    const fs = rows.flatMap(r => [r.f, 0.25]);
    const h = harness({ level: fs });
    const m = h.w.mode;
    const cards = rows.map((r, i) => h.enemy(`e${i}`, { 行动力: r.行动力, boss: r.boss }));
    m.敌方牌库.push(...cards);
    m.抽取特定类型卡牌到场上_碰撞(m.敌方牌库, m.敌方场上, 99, 99);
    expect(cards.map(c => c.当前行动力)).toEqual(rows.map(r => r.want));
    expect(fs).toEqual([]); // every scripted draw consumed: 2 per card
    // entrance delays: U(0, 0.4) = 0.1, except 0 for bosses (cards without an appearance animation also get 0)
    expect(m.出场动画结算数组.map(s => s?.延迟)).toEqual(rows.map(() => 0));
  });

  it('entrance delays are U(0, 0.4) for a normal card with an appearance animation, 0 for a boss', () => {
    const h = harness({ level: [0.5, 0.25, 0.5, 0.75] });
    const m = h.w.mode;
    const a = h.enemy('a'); a.精灵动画序列 = [null, null, null, 'X'];
    const b = h.enemy('b', { boss: true }); b.精灵动画序列 = [null, null, null, 'X'];
    m.敌方牌库.push(a, b);
    m.抽取特定类型卡牌到场上_碰撞(m.敌方牌库, m.敌方场上, 5, 10);
    expect(m.出场动画结算数组[0]?.延迟).toBeCloseTo(0.1, 4);
    expect(m.出场动画结算数组[1]?.延迟).toBe(0);
    expect((a as { bHiddenInGame?: boolean }).bHiddenInGame).toBe(true);
    expect((b as { bHiddenInGame?: boolean }).bHiddenInGame).toBe(false);
  });

  it('hostile draws target the hero and cost 斗志 −5 / −10 / −20 (遭遇敌人)', () => {
    const mental: number[] = [];
    const h = harness({ systems: { stamina: { BP_Actor_Player: { 精神系统: (_s, _a, b, why) => { if (why === '遭遇敌人') mental.push(b); } } } } });
    const m = h.w.mode;
    const n = h.enemy('n'); const e = h.enemy('e', { elite: true }); const b = h.enemy('b', { elite: true, boss: true });
    m.敌方牌库.push(n, e, b);
    m.抽取特定类型卡牌到场上_碰撞(m.敌方牌库, m.敌方场上, 5, 10);
    expect(mental).toEqual([-5, -10, -20]);
    expect(n.当前目标).toBe(h.hero);
  });

  it('TF-TV-39: neutrals left on the field at the room end stay as stale entries and lower the next cap', () => {
    const h = harness();
    const m = h.w.mode;
    const g1 = h.enemy('灌草1', { tags: [] }); const g2 = h.enemy('灌草2');
    for (const g of [g1, g2]) { g.OwnedGameplayTags.remove('可交互.角色.AI.仇恨'); g.OwnedGameplayTags.add('可交互.角色.AI.物品.采集'); }
    m.中立牌库.push(g1, g2);
    m.抽取特定类型卡牌到场上_碰撞(m.中立牌库, m.中立场上, 99, 999);
    expect(m.中立场上).toEqual([g1, g2]);
    m.清理房间();
    expect(m.中立场上).toHaveLength(2);
    expect(h.w.isValid(g1) || h.w.isValid(g2)).toBe(false);
    const fresh = [h.enemy('n1'), h.enemy('n2'), h.enemy('n3')];
    for (const g of fresh) g.OwnedGameplayTags.remove('可交互.角色.AI.仇恨');
    m.中立牌库.push(...fresh);
    m.抽取特定类型卡牌到场上_碰撞(m.中立牌库, m.中立场上, 3, 999); // cap 3 − 2 stale = 1
    expect(m.中立场上).toHaveLength(3);
    m.抽取特定类型卡牌到场上_碰撞(m.中立牌库, m.中立场上, 99, 999); // 99 − 3 = 96 ≥ 2 left
    expect(m.中立场上).toHaveLength(5);
  });
});

describe('TURN-037 增长行动度 / 添加行动力 / 判断行动力', () => {
  it('TF-TV-23 gauge: 37/80 after the fill, +75/+63 then +90/+60; ≥ 100 joins 可行动角色; action end keeps mod 100', () => {
    const h = harness({ level: [0.374, 0.1, 0.8, 0.1], combat: [0.375, 0.0625, 0.75, 0] });
    const m = h.w.mode;
    const a = h.enemy('眼球a'); const b = h.enemy('眼球b');
    m.敌方牌库.push(a, b);
    m.抽取特定类型卡牌到场上_碰撞(m.敌方牌库, m.敌方场上, 5, 10);
    expect([a.当前行动力, b.当前行动力]).toEqual([37, 80]);
    m.增长行动度(); // U(0.6, 1) = 0.75 and 0.625: 0.6 + 0.4 f
    expect([a.当前行动力, b.当前行动力]).toEqual([112, 143]);
    expect(m.可行动角色).toEqual([a, b]);
    a.结束行动(null, ''); b.结束行动(null, '');
    expect([a.当前行动力, b.当前行动力]).toEqual([12, 43]);
    m.增长行动度(); // 0.9 and 0.6
    expect([a.当前行动力, b.当前行动力]).toEqual([102, 103]);
    expect(m.可行动角色).toEqual([a, b]);
  });

  it('no gain at ≥ 100, under 状态.僵直 or with 行动力 0; the U is drawn only on the gain path', () => {
    const fs = [0.5];
    const h = harness({ combat: fs });
    const full = h.enemy('full', { 当前行动力: 120 });
    const zero = h.enemy('zero', { 行动力: 0 });
    const stiff = h.enemy('stiff');
    h.effect(stiff, '僵直', ['状态.僵直']);
    for (const x of [full, zero, stiff]) x.添加行动力(false, 0, 1, false, true);
    expect([full.当前行动力, zero.当前行动力, stiff.当前行动力]).toEqual([120, 0, 0]);
    expect(fs).toEqual([0.5]);
    stiff.判断行动力('');
    expect(stiff.疲劳了).toBe(true);
  });
});

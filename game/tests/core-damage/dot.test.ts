/** DoT core (combat-statuses COMBAT-011/071…081): application, merge, settlement, cleanse. */
import { describe, expect, it } from 'vitest';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci } from '../../src/core/math/sci.ts';
import { harness, n } from './harness.ts';


const bleed = (from: never, to: never, v: number) => make伤害({ 伤害来源: '装备', 伤害类型: '流血', 伤害数值: sci(v), 所需回合: 3, 来自角色: from, 目标角色: to });

describe('DoT', () => {
  it('a new instance takes at least 4; same-round applications merge into it; one quarter per settlement', () => {
    const h = harness();
    h.hero();
    const card = h.card();
    const e = h.enemy({}, 100);
    h.w.mode.总回合数 = 1;
    expect(e.受到持续伤害(bleed(card as never, e as never, 2), false).成功了).toBe(true);
    const inst = [...e.持续伤害实例映射.values()][0] as unknown as { 新增值: unknown; 持续伤害总值: unknown; 每回合伤害: unknown; 诞生数据: string };
    expect(inst.诞生数据).toBe('1//流血');
    expect(n(inst.持续伤害总值 as never)).toBe(4); // max(2, 4)
    e.受到持续伤害(bleed(card as never, e as never, 8), false);
    expect(e.持续伤害实例映射.size).toBe(1);
    expect(n(inst.持续伤害总值 as never)).toBe(12);
    expect(n(inst.每回合伤害 as never)).toBeCloseTo(3, 9); // 持续回合 3 + 1 quarters
    expect(n(e.剩余持续性伤害)).toBe(12);
    expect(e.总持续伤害映射.get('流血')).toMatchObject({ 来源数: 1 });
    e.结算持续伤害();
    expect(h.hp(e)).toBeCloseTo(97, 9);
    expect(n(e.剩余持续性伤害)).toBeCloseTo(9, 9);
    expect(e.当前回合持续伤害结算.size).toBe(0);
    expect(h.w.events.drain().filter(x => x.kind === 'log').map(x => (x as { rich: string }).rich).at(-1)).toBe('<强调>眼球</>失去了<即时伤害>3</>生命。（<持续伤害>流血</>）');
  });

  it('the application log shows the value before 伤害减免% / 持续减免%; the pool stores the reduced one', () => {
    const h = harness();
    h.hero();
    const card = h.card();
    const e = h.enemy({ '持续减免%': ['乘算', [0.5]] }, 100);
    e.受到持续伤害(bleed(card as never, e as never, 20), false);
    const rich = h.w.events.drain().filter(x => x.kind === 'log').map(x => (x as { rich: string }).rich);
    expect(rich).toEqual(['<强调>旧剑</>对<强调>眼球</>造成了<持续伤害>20流血</>伤害。']);
    expect(n(e.剩余持续性伤害)).toBe(10);
  });

  it('所需回合 −1 loses the life at once', () => {
    const h = harness();
    const card = h.card();
    const e = h.enemy({}, 100);
    e.受到持续伤害({ ...bleed(card as never, e as never, 20), 所需回合: -1 }, false);
    expect(h.hp(e)).toBe(80);
    expect(e.持续伤害实例映射.size).toBe(0);
  });

  it('settlement with the overflow credit at the pool removes the DoT (COMBAT-076)', () => {
    const h = harness();
    const card = h.card();
    const e = h.enemy({}, 100);
    e.受到持续伤害(bleed(card as never, e as never, 20), false);
    e.溢出的治疗量 = sci(20);
    e.结算持续伤害();
    expect(h.hp(e)).toBe(100);
    expect(e.持续伤害实例映射.size).toBe(0);
    expect(n(e.溢出的治疗量)).toBe(0);
  });

  it('移除减益效果 clears the DoT maps', () => {
    const h = harness();
    const card = h.card();
    const e = h.enemy({}, 100);
    e.受到持续伤害(bleed(card as never, e as never, 20), false);
    e.移除减益效果();
    expect([e.持续伤害实例映射.size, e.总持续伤害映射.size, n(e.剩余持续性伤害)]).toEqual([0, 0, 0]);
  });

  it('查询持续伤害 maps 中毒 / 燃烧 / 流血', () => {
    const h = harness();
    const card = h.card();
    const e = h.enemy({}, 100);
    e.受到持续伤害(bleed(card as never, e as never, 20), false);
    const q = h.w.sys.damage.函数库_技能!.查询持续伤害!;
    expect(q(e, e, '流血').存在).toBe(true);
    expect(q(e, e, '中毒').存在).toBe(false);
  });
});

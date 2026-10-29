import { describe, expect, it, vi } from 'vitest';
import { fixture } from '../parity-items/fixture.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { 合成数据表_技能 } from '../../src/content/demo/tables.ts';
import { 蓝图_效果_抵抗致死 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_抵抗致死.ts';
import { 蓝图_效果_延时护符加成 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_延时护符加成.ts';
import { 蓝图_效果_天赋给敌人附加效果 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_天赋给敌人附加效果.ts';

/** Sub-30%-maxHP source hits avoid adding Pain and its separate max-HP refresh branch. */
function wearDown(f: ReturnType<typeof fixture>) {
  const hit = () => f.hero.受到即时伤害(make伤害({ 伤害来源: '攻击', 伤害数值: sci(20), 来自角色: f.enemies[0], 目标角色: f.hero }), true, false);
  for (let i = 0; i < 20 && f.hpOf(f.hero) > 20; i++) { hit(); f.advance(.3); }
  expect(f.hpOf(f.hero)).toBeGreaterThan(0); expect(f.hpOf(f.hero)).toBeLessThanOrEqual(20);
  return hit;
}

describe('source damage deferral and death-resistance', () => {
  it('延时护符 cancels external physical damage then pays two real bounce debts without recursively spawning more', () => {
    const f = fixture(); f.item('延时护符'); f.enter(); const hp = f.hpOf(f.hero);
    const packet = make伤害({ 伤害来源: '攻击', 伤害类型: '物理', 伤害数值: sci(20), 触发次数: 1, 来自角色: f.enemies[0], 目标角色: f.hero });
    f.hero.受到即时伤害(packet, true, false); expect(f.hpOf(f.hero)).toBe(hp);
    const debts = () => f.w.objects().filter(x => x instanceof 蓝图_效果_延时护符加成) as 蓝图_效果_延时护符加成[];
    expect(debts()).toHaveLength(1); expect(科学数变普通(debts()[0].每次伤害)).toBe(10);
    f.bounce(); expect(f.hpOf(f.hero)).toBeCloseTo(hp - 10); expect(debts()).toHaveLength(1); expect(debts()[0].计数).toBe(1);
    f.bounce(); expect(f.hpOf(f.hero)).toBeCloseTo(hp - 20); expect(debts()).toHaveLength(0);
    f.hero.受到即时伤害(packet, true, false); f.w.mode.结束层时机(); expect(debts()).toHaveLength(0);
  });

  it('separate hits keep separate debts; self damage and unlisted burn type bypass deferral', () => {
    const f = fixture(); f.item('延时护符'); f.enter(); const hp = f.hpOf(f.hero);
    const hit = (type: '物理' | '燃烧', self: boolean) => f.hero.受到即时伤害(make伤害({ 伤害类型: type, 伤害数值: sci(10), 触发次数: 1, 来自角色: self ? f.hero : f.enemies[0], 目标角色: f.hero }), true, false);
    hit('物理', false); hit('物理', false); expect(f.w.objects().filter(x => x instanceof 蓝图_效果_延时护符加成)).toHaveLength(2);
    hit('物理', true); hit('燃烧', false); expect(f.hpOf(f.hero)).toBeCloseTo(hp - 20);
    f.bounce(); expect(f.hpOf(f.hero)).toBeCloseTo(hp - 30);
  });

  it('绝命 real lethal damage restores1+10% HP, immunity, source animation and exact .5s shock, then cannot rescue twice in one battle', () => {
    const f = fixture(); f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: '绝命' }, 1, 0); f.enter();
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_抵抗致死) as 蓝图_效果_抵抗致死;
    expect(e).toBeDefined();
    const hit = wearDown(f);
    const hp = 科学数变普通(f.hero.当前最大生命), shock = vi.spyOn(函数库_工具, '以目标为中心释放冲击');
    hit();
    expect(f.hero.死掉了).toBe(false); expect(f.hpOf(f.hero)).toBeCloseTo(1 + hp * .1);
    expect(e.触发次数_0).toBe(1); expect(f.hero.HasMatchingGameplayTag('状态.濒死')).toBe(true); expect(f.hero.HasMatchingGameplayTag('状态.免疫')).toBe(true);
    expect(f.events('time.dilation').some(x => x.curve === 'deathResist')).toBe(true);
    expect(f.events('actor.anim').some(x => x.sequence.endsWith('Actor_C01_绝命'))).toBe(true);
    f.advance(.49); expect(shock).not.toHaveBeenCalled(); f.advance(.02); expect(shock).toHaveBeenCalledOnce();
    const args = shock.mock.calls[0]; expect(args[0].id).toBe(e.id); expect(args[1]?.id).toBe(f.hero.id);
    expect(args.slice(2, 6)).toEqual([300, 50000, false, 0]); expect(args.slice(7)).toEqual([false, { x: 0, y: 0, z: 0 }]);
    f.w.mode.新回合触发时机(); expect(f.hero.HasMatchingGameplayTag('状态.濒死')).toBe(false); expect(f.hero.HasMatchingGameplayTag('状态.免疫')).toBe(false);
    hit();
    expect(f.hero.死掉了).toBe(true); expect(e.触发次数_0).toBe(1);
  });

  it('new combat resets rescue count; forced death bypasses 死亡前 and a destroyed source cannot run timeline shock', () => {
    const f = fixture(); f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: '绝命' }, 1, 0); f.enter();
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_抵抗致死) as 蓝图_效果_抵抗致死;
    wearDown(f)();
    expect(e.触发次数_0).toBe(1); f.w.mode.新一层触发时机(); expect(e.触发次数_0).toBe(0);
    const shock = vi.spyOn(函数库_工具, '以目标为中心释放冲击'); e.销毁效果(); f.advance(.6); expect(shock).not.toHaveBeenCalled();
    f.hero.检查死亡(true, false); expect(f.hero.死掉了).toBe(true);
  });

  it('boss talent parent dispatches exact source child on live enemies and refreshes unique instance without reactivation; child remains explicit missing dependency', () => {
    const f = fixture(); f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: '高压电' }, 1, 0); f.enter();
    const parent = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_天赋给敌人附加效果)!; expect(parent).toBeDefined();
    const cls = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_高压电';
    const children = () => f.enemies[0].拥有的效果.filter(x => x?.def.path === cls);
    expect(children()).toHaveLength(1); const child = children()[0]!;
    expect(child.释放者).toBe(f.hero); expect(child.拥有者).toBe(f.enemies[0]);
    const activate = vi.spyOn(child, '激活效果'); f.w.mode.新回合触发时机(); expect(children()).toHaveLength(1); expect(activate).not.toHaveBeenCalled();
    expect(f.w.coverage.counts.get('stub ' + cls)).toBeGreaterThan(0); // no claim of 高压电 child behaviour
  });
});

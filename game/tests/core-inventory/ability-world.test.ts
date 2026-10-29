import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { 数据表_玩家 } from '../../src/content/demo/index.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条, 词条映射From } from '../../src/core/math/stats.ts';
import type { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import type { BpCtor } from '../../src/core/sim/types.ts';
import { doubles, newCalls } from './doubles.ts';
import { layout } from './world.ts';

/**
 * The item flows with the real kernel and ability modules (wa/ability): 激活角色 → 初始化 adds the row's skills,
 * 蓝图_能力.初始化 → 更新技能描述 renders through module text, equipping moves the item's effects to the hero
 * (ABILIT-057). Damage and rewards stay doubles.
 */
function setup() {
  const calls = newCalls();
  const { damage, rewards } = doubles(calls);
  const w = createWorld({ content: registry, seed: 5, systems: { damage: damage!, rewards: rewards! } });
  w.cult.激活修炼系统();
  const hero = w.spawn(BP_Actor_Player as unknown as BpCtor<BP_Actor_Player>, h => { h.名字 = '幽冥骑士'; h.词条 = 词条映射From(数据表_玩家.rows.幽冥骑士.科学词条); });
  w.mode.玩家角色 = hero;
  w.mode.金币 = 999;
  const make = (name: string, 品质: number): BP_Actor_Card => {
    const c = w.cult.生成卡牌('CatapultHero/数据表/合成数据表_修炼物品', name, { x: 0, y: 0, z: 0 }, 'None', false, 品质, 0, [], new Map(), false, -1, -1).卡牌实例!;
    c.已揭示 = true;
    return c;
  };
  return { w, calls, hero, make };
}

const tooltip = (c: BP_Actor_Card) => c.拥有的能力.map(a => a!.描述.zh);

describe('items on the real kernel and ability modules', () => {
  it('旧剑 / 旧盾 tooltips at Bronze and Gold come out of 初始化 → 更新技能描述', () => {
    const { make } = setup();
    expect(tooltip(make('旧剑', 1))).toEqual(['下 <天赋>3</> 次攻击额外造成 <天赋>20</> 伤害。']);
    expect(tooltip(make('旧剑', 3))).toEqual(['下 <天赋>3</> 次攻击额外造成 <天赋>80</> 伤害。']);
    expect(tooltip(make('旧盾', 1))).toEqual(['<强调>强固</> <天赋>10</> 。', '获得 <天赋>1</> 层<强调>格挡</>。']);
    expect(tooltip(make('旧盾', 3))).toEqual(['<强调>强固</> <天赋>40</> 。', '获得 <天赋>1</> 层<强调>格挡</>。']);
  });

  it('旧盾 equipped: charge completion shields the hero and gives a Block stack', () => {
    const { w, calls, hero, make } = setup();
    const shield = make('旧盾', 1);
    expect(w.cult.获取牌(shield).成功).toBe(true);
    expect(layout(w, 'equip')).toBe('........旧旧');
    const charged = shield.拥有的效果.filter(e => e?.HasMatchingGameplayTag('效果.时机.自身完成充能'));
    expect(charged.length).toBe(2);
    expect(charged.every(e => e!.拥有者 === hero)).toBe(true);
    for (const e of [...charged]) { e!.触发次数 = 1; e!.触发时机 = '效果.时机.自身完成充能'; e!.持续中触发('效果.时机.自身完成充能'); }
    expect(calls.heals.map(h => [h.on === hero, 科学数变普通(h.heal.治疗整数), h.heal.生命护甲])).toEqual([[true, 10, true]]);
    const block = hero.拥有的效果.filter(e => e?.def.path.endsWith('蓝图_效果_精神状态_格挡'));
    expect(block.length).toBe(1);
    expect(block[0]!.叠加层数).toBe(1);
  });

  it('生命药剂: 治愈 follows the hero 最大生命 and the tooltip shows it', () => {
    const { w, make } = setup();
    const potion = make('生命药剂', 1);
    w.cult.获取牌(potion);
    expect(科学数变普通(获取科学映射词条(potion.词条, '治愈').输出值)).toBeCloseTo(22.5, 12);
    for (const a of potion.拥有的能力) a!.更新技能描述(false, 0);
    expect(tooltip(potion)).toEqual(['创建空瓶。', '此物品的<强调>治愈</>等同 <天赋>15%</> 生命上限。', '<强调>治愈</> <天赋>22</> 。']);
  });

  it('item.use on a 生命药剂: the hero is healed, and after the cast one use is spent (使用牌后处理)', () => {
    const { w, calls, hero, make } = setup();
    const potion = make('生命药剂', 1);
    w.cult.获取牌(potion);
    expect(w.sys.inventory.commands!['item.use']!(w, { type: 'item.use', item: potion.id })).toEqual({ ok: true });
    w.clock.advance(1);
    expect(calls.heals.filter(h => h.on === hero).map(h => 科学数变普通(h.heal.治疗整数))).toEqual([expect.closeTo(22.5, 12)]);
    expect(科学数变普通(获取科学映射词条(potion.词条, '生命').输出值)).toBe(2);
    expect(calls.deaths).toContain(potion);
  });
});

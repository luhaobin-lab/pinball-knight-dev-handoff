import { describe, expect, it } from 'vitest';
import type { 结构_角色 } from '../../src/content/demo/types.ts';
import { composeLegal, routeCommand } from '../../src/core/api/compose.ts';
import { MakeRandomStream } from '../../src/core/rng/ue.ts';
import { TagSet } from '../../src/core/sim/tags.ts';
import { rewards } from '../../src/core/sys/rewards/index.ts';
import { 盒子 } from '../../src/core/sys/rewards/box.ts';
import { ITEM_TABLE } from '../../src/core/sys/rewards/shared.ts';
import type { 蓝图_奖励_获取物品 } from '../../src/content/bp/Skill/Ability/奖励/蓝图_奖励_获取物品.ts';
import { REWARD_TABLE, rewardWorld } from './fixture.ts';

type Spy = { calls: unknown[][] };
function spyRefresh(): { spy: Spy; systems: { rewards: typeof rewards } } {
  const spy: Spy = { calls: [] };
  const real = rewards.修炼系统!.刷新生成牌!;
  return { spy, systems: { rewards: { ...rewards, 修炼系统: { ...rewards.修炼系统, 刷新生成牌: (...a: Parameters<typeof real>) => { spy.calls.push(a.slice(1)); real(...a); } } } } };
}

describe('筛选物品生成 (修炼系统 ln 829)', () => {
  const rowsOf = (w: ReturnType<typeof rewardWorld>['w']) => w.data.table(ITEM_TABLE)!.rows as Record<string, 结构_角色>;

  it('全职业 false drops the other heroes\' items; the literal true keeps them (R-GI ln 266)', () => {
    const { w } = rewardWorld();
    w.mode.当前总层数 = 99;
    const all = (全职业: boolean) => w.cult.筛选物品生成(false, new TagSet(), new TagSet(), 1, -2, MakeRandomStream(1), 全职业, false, 'None').筛选后物品;
    const hunterOnly = Object.entries(rowsOf(w)).filter(([, r]) => r.标签.includes('可交互.角色.玩家.灵魂猎手')).map(([n]) => n);
    expect(hunterOnly.length).toBeGreaterThan(0);
    expect(all(false).filter(n => hunterOnly.includes(n))).toEqual([]);
    expect(all(true)).toEqual(expect.arrayContaining(hunterOnly.filter(n => !rowsOf(w)[n]!.标签.includes('忽略'))));
  });

  it('需求标签 / 排除标签 / 解锁.层数 / 忽略 filter the rows', () => {
    const { w } = rewardWorld();
    w.mode.当前总层数 = 1;
    const out = w.cult.筛选物品生成(false, new TagSet(['可交互.修炼牌.小型']), new TagSet(['可交互.修炼牌.废品']), 1, -2, MakeRandomStream(1), true, false, 'None').筛选后物品;
    expect(out.length).toBeGreaterThan(0);
    for (const n of out) {
      const r = rowsOf(w)[n]!;
      const t = new TagSet(r.标签);
      expect(t.has('可交互.修炼牌.小型')).toBe(true);
      expect(t.has('可交互.修炼牌.废品') || t.has('忽略')).toBe(false);
      expect(r.解锁.层数).toBeLessThanOrEqual(1);
    }
  });

  it('数量 −1 fills three 4-high columns: the picked sizes add up to 12 (CS L3765)', () => {
    const { w } = rewardWorld({ seed: 9 });
    w.mode.当前总层数 = 99;
    for (let k = 0; k < 20; k++) {
      const out = w.cult.筛选物品生成(false, new TagSet(), new TagSet(), 1, -1, MakeRandomStream(k), true, false, 'None').筛选后物品;
      const size = (n: string) => { const t = rowsOf(w)[n]!.标签; return t.includes('可交互.修炼牌.大型') ? 3 : t.includes('可交互.修炼牌.中型') ? 2 : 1; };
      expect(out.reduce((s, n) => s + size(n), 0)).toBe(12);
    }
  });

  it('数量 n draws n weighted names from the given stream (with replacement), 0 draws none', () => {
    const { w } = rewardWorld();
    w.mode.当前总层数 = 99;
    const pick = (n: number, seed: number) => w.cult.筛选物品生成(false, new TagSet(), new TagSet(), 1, n, MakeRandomStream(seed), true, false, 'None').筛选后物品;
    expect(pick(3, 4)).toHaveLength(3);
    expect(pick(3, 4)).toEqual(pick(3, 4));
    expect(pick(0, 4)).toEqual([]);
  });
});

describe('蓝图_奖励_获取物品: counts, quality floors, the all-hero flag, the box', () => {
  it('获取物品_小型: 3 paid small items, 1 refresh, no take limit, 全职业 true, random quality', () => {
    const { spy, systems } = spyRefresh();
    const { w, ability } = rewardWorld({ systems });
    w.mode.当前总层数 = 5;
    const a = ability<蓝图_奖励_获取物品>(REWARD_TABLE, '获取物品_小型');
    a.执行技能(false);
    expect(w.modal.current?.kind).toBe('loot');
    expect(w.cult.盒子关闭了).toBe(false);
    expect(w.cult.当前可获取数量).toBe(-1);
    expect(盒子(w.cult).可刷新次数).toBe(1);
    expect(盒子(w.cult).刷新价格).toBe(1); // the row 消耗 (1) + 刷新费用修正 (0)
    const [补充, 免费, 随机品质, 品质, 数量, , , , 全职业] = spy.calls[0]!;
    expect([补充, 免费, 随机品质, 品质, 数量, 全职业]).toEqual([false, false, true, 1, 3, true]);
    expect(w.cult.未拾取牌).toHaveLength(3);
  });

  it('初始奖励B: one free silver (quality 2, fixed) small item with an enchant, take limit 1', () => {
    const { spy, systems } = spyRefresh();
    const { w, ability, log } = rewardWorld({ systems });
    const a = ability<蓝图_奖励_获取物品>(REWARD_TABLE, '初始奖励B');
    a.执行技能(false);
    const [, 免费, 随机品质, 品质, 数量] = spy.calls[0]!;
    expect([免费, 随机品质, 品质, 数量]).toEqual([true, false, 2, 1]);
    expect(w.cult.当前可获取数量).toBe(1);
    expect(log.filter(l => l.startsWith('添加附魔'))).toHaveLength(1); // 参数6 = 1.0
    expect(w.cult.未拾取牌[0]?.当前价格).toBe(0);
  });

  it('获取物品_全随机 at level 1: quality floor 1 (参数5 = 0 + 1/lv), one free item', () => {
    const { spy, systems } = spyRefresh();
    const { ability } = rewardWorld({ systems });
    ability<蓝图_奖励_获取物品>(REWARD_TABLE, '获取物品_全随机').执行技能(false);
    const [, 免费, 随机品质, 品质, 数量, , , , 全职业] = spy.calls[0]!;
    expect([免费, 随机品质, 品质, 数量, 全职业]).toEqual([true, true, 1, 1, true]);
  });

  it('loot.take buys through 获取牌; modal.reroll costs 刷新价格 and refills; loot.close closes and ends the floor', () => {
    const { w, ability, log } = rewardWorld({ tasks: { 未完成: false } });
    w.mode.当前总层数 = 5;
    w.mode.金币 = 10;
    ability<蓝图_奖励_获取物品>(REWARD_TABLE, '获取物品_小型').执行技能(false);
    const legal = composeLegal(w);
    expect(legal.map(s => s.type)).toEqual(['loot.take', 'modal.reroll', 'loot.close']);
    const first = w.cult.未拾取牌[0]!;
    expect(routeCommand(w, { type: 'loot.take', item: first.id }).ok).toBe(true);
    expect(w.cult.背包里牌).toContain(first);
    expect(routeCommand(w, { type: 'modal.reroll' }).ok).toBe(true);
    expect(w.mode.金币).toBe(9);
    expect(盒子(w.cult).可刷新次数).toBe(0);
    expect(w.cult.未拾取牌.filter(c => c?.valid)).toHaveLength(3);
    expect(composeLegal(w).map(s => s.type)).not.toContain('modal.reroll');
    expect(routeCommand(w, { type: 'loot.close' }).ok).toBe(true);
    expect(w.modal.current).toBeNull();
    expect(w.cult.盒子关闭了).toBe(true);
    expect(log.at(-1)).toBe('结束当前层:true');
  });

  it('盒子关闭后 keeps the floor when the task is still open and 特殊处理 set 不结束层, or on the map (phase 9)', () => {
    const { w, ability, log } = rewardWorld({ tasks: { 未完成: true } });
    const a = ability<蓝图_奖励_获取物品>(REWARD_TABLE, '获取物品_小型');
    a.特殊处理();
    a.执行技能(false);
    routeCommand(w, { type: 'loot.close' });
    expect(log).not.toContain('结束当前层:true');
    const b = rewardWorld({ tasks: { 未完成: false } });
    b.w.mode.当前环节 = '选择地图';
    b.ability<蓝图_奖励_获取物品>(REWARD_TABLE, '获取物品_小型').执行技能(false);
    routeCommand(b.w, { type: 'loot.close' });
    expect(b.log).not.toContain('结束当前层:true');
  });
});

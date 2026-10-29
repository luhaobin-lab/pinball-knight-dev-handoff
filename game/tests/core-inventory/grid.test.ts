import { describe, expect, it } from 'vitest';
import type { BP_Actor_Card } from '../../src/core/sim/card.ts';
import type { 修炼物品格子组 } from '../../src/core/sim/cult-grid.ts';
import {
  cells, cellX, coveredCells, setLocalX, 整理并寻找可摆位置, 整理物品排列, 放入物品到指定格, 检查空间, 向上下检查并偏移, 更新格子信息,
} from '../../src/core/sys/inventory/grid.ts';
import { invWorld, layout, testCard, type InvWorld } from './world.ts';

const bag = (w: InvWorld) => w.cult.修炼物品格_在背包!;
const equip = (w: InvWorld) => w.cult.修炼物品格_已装备!;

/** Put a card covering cells [r, r + 尺寸 − 1] (a drop with an upward bias for 2-cell items). */
function putAt(g: 修炼物品格子组, c: BP_Actor_Card, r: number): void {
  const start = c.尺寸 === 3 ? r + 1 : r;
  c.所在格子组 = g;
  setLocalX(g, c, cellX(g, start) + (c.尺寸 === 2 ? 26 : 0));
  放入物品到指定格(c, cells(g)[start]!, true);
}

/** 获取牌's placement: 整理并寻找可摆位置 then 放入物品到指定格 without bias. */
function gain(g: 修炼物品格子组, c: BP_Actor_Card): boolean {
  const r = 整理并寻找可摆位置(g, c, false);
  if (!r.找到了空间 || !r.找到的起始格) return false;
  放入物品到指定格(c, r.找到的起始格, false);
  return true;
}

describe('修炼物品格子组 placement (sizes 1/2/3, locks, moves)', () => {
  it('ReceiveBeginPlay builds 10 empty cells 104 uu apart for each column', () => {
    const w = invWorld();
    const g = bag(w);
    expect(cells(g).map(c => c.序号)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(cells(g)[9]!.K2_GetActorLocation().x - cells(g)[0]!.K2_GetActorLocation().x).toBe(9 * 104);
    expect(cellX(g, 0)).toBe(-468);
    expect(g.空格子数组.length).toBe(10);
    expect(equip(w).标签.toArray()).toEqual(['UI.修炼物品已装备']);
    expect(g.标签.toArray()).toEqual(['UI.修炼物品在背包']);
  });

  it('gaining fills from the top: size 1 at 9, size 2 at 7–8, size 3 at 4–6', () => {
    const w = invWorld();
    const g = bag(w);
    expect(gain(g, testCard(w, 'a', 1))).toBe(true);
    expect(gain(g, testCard(w, 'b', 2))).toBe(true);
    expect(gain(g, testCard(w, 'c', 3))).toBe(true);
    expect(layout(w, 'backpack')).toBe('....cccbba');
    expect(g.拥有的物品.map(c => c!.名字)).toEqual(['c', 'b', 'a']);
    expect(g.拥有的物品.map(c => c!.所在起始格序号)).toEqual([5, 8, 9]);
  });

  it('three 锁定格 at cells 5, 3, 1 cover 0–5 and leave 6–9 for two 2-cell items', () => {
    const w = invWorld();
    const g = equip(w);
    for (let i = 0; i <= 2; i++) 放入物品到指定格(testCard(w, '锁定格', 2, ['忽略']), cells(g)[(2 - i) * 2 + 1]!, false);
    expect(layout(w, 'equip')).toBe('锁锁锁锁锁锁....');
    expect(gain(g, testCard(w, 's', 2))).toBe(true);
    expect(gain(g, testCard(w, 't', 2))).toBe(true);
    expect(layout(w, 'equip')).toBe('锁锁锁锁锁锁ttss');
    expect(gain(g, testCard(w, 'u', 1))).toBe(false);
  });

  it('no gap but room in total → compaction; a full column → no space', () => {
    const w = invWorld();
    const g = bag(w);
    for (const [n, r] of [['a', 0], ['b', 2], ['c', 4], ['d', 6], ['e', 8]] as const) putAt(g, testCard(w, n, 1), r);
    expect(layout(w, 'backpack')).toBe('a.b.c.d.e.');
    expect(gain(g, testCard(w, 'f', 2))).toBe(true);
    // compaction pushes a up from cell 0 (a → 1), then a b up from cell 1 (→ 2, 3); the item lands at 0–1
    expect(layout(w, 'backpack')).toBe('ffabc.d.e.');
    const w2 = invWorld();
    for (let r = 0; r < 10; r++) putAt(bag(w2), testCard(w2, String(r), 1), r);
    expect(整理并寻找可摆位置(bag(w2), testCard(w2, 'x', 1), false)).toEqual({ 找到了空间: false, 找到的起始格: null });
  });

  it('QUIRK (L902): a 3-cell item found by compaction gets start cell 整理序号 − 2', () => {
    const w = invWorld();
    const g = bag(w);
    for (const [n, r] of [['a', 1], ['b', 3], ['c', 5], ['d', 7], ['e', 9]] as const) putAt(g, testCard(w, n, 1), r);
    const big = testCard(w, 'x', 3);
    const r = 整理并寻找可摆位置(g, big, false);
    expect(r.找到了空间).toBe(true);
    // compaction pushes everything up until no shift is possible at 整理序号 = 5: start 5 − 2 = 3 (cells 2–4, all free)
    expect(r.找到的起始格!.序号).toBe(3);
    expect(layout(w, 'backpack')).toBe('.....abcde');
    放入物品到指定格(big, r.找到的起始格!, false);
    expect(layout(w, 'backpack')).toBe('..xxxabcde');
  });

  it('检查空间 with bias: a 2-cell item hovering a quarter cell up needs that cell and the one above', () => {
    const w = invWorld();
    const g = bag(w);
    putAt(g, testCard(w, 'a', 1), 5);
    const held = testCard(w, 'h', 2);
    held.所在格子组 = g;
    setLocalX(g, held, cellX(g, 3) + 26);
    expect(检查空间(g, held, cells(g)[3]!, true, false).有现成空间).toBe(true);
    setLocalX(g, held, cellX(g, 4) + 26);
    expect(检查空间(g, held, cells(g)[4]!, true, false)).toMatchObject({ 有现成空间: false, 整体有空间: true, 未通过需求格子: [5] });
  });

  it('向上/下检查并偏移 pushes the run of cards into the first free cell; 锁定格 never moves (QUIRK)', () => {
    const w = invWorld();
    const g = bag(w);
    putAt(g, testCard(w, 'a', 1), 3);
    putAt(g, testCard(w, 'b', 2), 4);
    expect(layout(w, 'backpack')).toBe('...abb....');
    expect(向上下检查并偏移(g, false, 3, null)).toBe(true);
    更新格子信息(g);
    expect(layout(w, 'backpack')).toBe('....abb...');
    expect(向上下检查并偏移(g, true, 6, null)).toBe(true);
    更新格子信息(g);
    expect(layout(w, 'backpack')).toBe('...abb....');
    const full = invWorld();
    for (let r = 0; r < 10; r++) putAt(bag(full), testCard(full, String(r), 1), r);
    expect(向上下检查并偏移(bag(full), false, 0, null)).toBe(false);
    const locked = invWorld();
    放入物品到指定格(testCard(locked, '锁定格', 2, ['忽略']), cells(equip(locked))[1]!, false);
    putAt(equip(locked), testCard(locked, 'a', 1), 2);
    expect(向上下检查并偏移(equip(locked), true, 2, null)).toBe(false);
  });

  it('整理物品排列 makes room for a drop and the drop lands', () => {
    const w = invWorld();
    const g = bag(w);
    putAt(g, testCard(w, 'a', 1), 4);
    putAt(g, testCard(w, 'b', 1), 5);
    const held = testCard(w, 'h', 2);
    held.所在格子组 = g;
    setLocalX(g, held, cellX(g, 4) + 26);
    const start = cells(g)[4]!;
    const r = 检查空间(g, held, start, true, false);
    expect(r.有现成空间).toBe(false);
    整理物品排列(g, r.未通过需求格子, held, start);
    expect(检查空间(g, held, start, true, false).有现成空间).toBe(true);
    放入物品到指定格(held, start, true);
    expect(layout(w, 'backpack')).toBe('...ahhb...');
    expect(coveredCells(held)).toEqual([4, 5]);
  });

  it('a card moved to the other column leaves the first', () => {
    const w = invWorld();
    const c = testCard(w, 's', 2);
    putAt(bag(w), c, 0);
    expect(layout(w, 'backpack')).toBe('ss........');
    putAt(equip(w), c, 8);
    更新格子信息(bag(w));
    expect(layout(w, 'backpack')).toBe('..........');
    expect(layout(w, 'equip')).toBe('........ss');
    expect(c.所在格子组标签).toBe('UI.修炼物品已装备');
    expect(c.所在起始格序号).toBe(9);
  });
});

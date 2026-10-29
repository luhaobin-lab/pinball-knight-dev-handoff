import { describe, expect, it } from 'vitest';
import type { BP_Actor_Card } from '../../src/core/sim/card.ts';
import type { 修炼物品格子组 } from '../../src/core/sim/cult-grid.ts';
import { cells, 放入物品到指定格 } from '../../src/core/sys/inventory/grid.ts';
import { 套装判断, 筛选修炼物品, 获取相邻牌, 统计装备相同物品 } from '../../src/core/sys/inventory/positions.ts';
import { invWorld, testCard, type InvWorld } from './world.ts';

/**
 * A layout string, cell 0 first: a letter per cell of a card ("aa" = one 2-cell card), "." empty, "#" a 锁定格 (2 cells).
 * Upper-case letters carry the tag 可交互.修炼牌.武器 (品质 1), lower-case 可交互.修炼牌.护甲 (品质 2).
 */
function build(w: InvWorld, layout: string, g: 修炼物品格子组): Map<string, BP_Actor_Card> {
  const out = new Map<string, BP_Actor_Card>();
  const cs = [...layout];
  for (let i = 0; i < cs.length;) {
    const ch = cs[i]!;
    if (ch === '.') { i++; continue; }
    let n = 1;
    while (cs[i + n] === ch && !(ch === '#' && n === 2)) n++;
    const lock = ch === '#';
    const tags = lock ? ['忽略'] : ch === ch.toUpperCase() ? ['可交互.修炼牌.武器'] : ['可交互.修炼牌.护甲'];
    const c = testCard(w, lock ? '锁定格' : ch, n, tags, /[a-z]/.test(ch) ? 2 : 1);
    放入物品到指定格(c, cells(g)[n === 3 ? i + 1 : i + n - 1]!, false);
    out.set(lock ? `#${i}` : ch, c);
    i += n;
  }
  return out;
}

const names = (cs: readonly (BP_Actor_Card | null)[]) => cs.map(c => c?.名字 ?? null);

// [equip layout, backpack layout, 最下方 / 最上方 of 装备, of 武器 in 装备和背包, 上方牌 / 下方牌 of the card named in col 5]
const CASES: [string, string, [string | null, string | null], [string | null, string | null], string, [string | null, string | null]][] = [
  ['A.........', '..........', ['A', 'A'], ['A', 'A'], 'A', [null, null]],
  ['A.B.......', '..........', ['A', 'B'], ['A', 'B'], 'A', [null, null]],
  ['ABc.......', '..........', ['A', 'c'], ['A', 'B'], 'B', ['c', 'A']],
  ['aaBBccc...', '..........', ['a', 'c'], ['B', 'B'], 'B', ['c', 'a']],
  ['######AAbb', '..........', ['A', 'b'], ['A', 'A'], 'A', ['b', null]],
  ['######.AAb', 'C.........', ['A', 'b'], ['A', 'C'], 'b', [null, 'A']],
  ['....DDDeef', '..........', ['D', 'f'], ['D', 'D'], 'e', ['f', 'D']],
  ['g.h.i.j.k.', 'LL........', ['g', 'k'], ['L', 'L'], 'i', [null, null]],
  ['##MM##NNNo', 'pp.Q......', ['M', 'o'], ['M', 'Q'], 'M', [null, null]],
  ['..........', 'RRsT......', [null, null], ['R', 'T'], 'R', ['s', null]],
];

describe('positions: 筛选修炼物品 (最上方 = last) and 获取相邻牌 for 10 handmade layouts', () => {
  CASES.forEach(([equipL, bagL, equipEnds, weaponEnds, who, [up, down]], n) => {
    it(`layout ${n + 1}: ${equipL} | ${bagL}`, () => {
      const w = invWorld();
      const all = new Map([...build(w, equipL, w.cult.修炼物品格_已装备!), ...build(w, bagL, w.cult.修炼物品格_在背包!)]);
      const e = 筛选修炼物品(w.cult, '装备', false, [], false, [], -1);
      expect(names([e.最下方, e.最上方])).toEqual(equipEnds);
      expect(e.是否存在).toBe(equipEnds[0] !== null);
      expect(e.筛选后.every(c => c.名字 !== '锁定格')).toBe(true);
      const wp = 筛选修炼物品(w.cult, '装备和背包', false, ['可交互.修炼牌.武器'], false, [], -1);
      expect(names([wp.最下方, wp.最上方])).toEqual(weaponEnds);
      const c = all.get(who)!;
      获取相邻牌(c, null, [], false);
      expect(names([c.上方牌, c.下方牌])).toEqual([up, down]);
      expect(names(c.相邻牌)).toEqual([up, down].filter(x => x !== null));
    });
  });

  it('quality, exclusion and all-tags filters; 新生成 selects nothing', () => {
    const w = invWorld();
    build(w, 'ABcd......', w.cult.修炼物品格_已装备!);
    expect(names(筛选修炼物品(w.cult, '装备', false, [], false, [], 2).筛选后)).toEqual(['c', 'd']);
    expect(names(筛选修炼物品(w.cult, '装备', false, [], false, ['可交互.修炼牌.护甲'], -1).筛选后)).toEqual(['A', 'B']);
    expect(names(筛选修炼物品(w.cult, '装备', true, ['可交互.修炼牌.武器', '可交互.修炼牌.护甲'], false, [], -1).筛选后)).toEqual([]);
    expect(筛选修炼物品(w.cult, '新生成', false, [], false, [], -1).是否存在).toBe(false);
  });

  it('adjacency tag filter and 统计装备相同物品', () => {
    const w = invWorld();
    const cs = build(w, 'aBc.......', w.cult.修炼物品格_已装备!);
    获取相邻牌(cs.get('B')!, null, ['可交互.修炼牌.护甲'], false);
    expect(names([cs.get('B')!.上方牌, cs.get('B')!.下方牌])).toEqual(['c', 'a']);
    获取相邻牌(cs.get('a')!, null, ['可交互.修炼牌.武器'], false);
    expect(cs.get('a')!.上方牌?.名字).toBe('B');
    获取相邻牌(cs.get('a')!, null, ['可交互.修炼牌.护甲'], false);
    expect(cs.get('a')!.上方牌).toBeNull();
    const [x, y, z] = [testCard(w, '旧剑', 2), testCard(w, '旧盾', 2), testCard(w, '旧剑', 2)];
    expect([...统计装备相同物品([x, y, z])]).toEqual([['旧剑', 2], ['旧盾', 1]]);
    expect(套装判断([x, y, z], new Map([['旧剑', 2], ['旧盾', 1]])).满足).toBe(true);
    expect(套装判断([x, y], new Map([['旧剑', 2]])).满足).toBe(false);
    expect(套装判断([], new Map()).满足).toBe(true);
  });
});

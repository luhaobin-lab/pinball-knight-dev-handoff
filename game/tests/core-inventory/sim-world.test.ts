import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { 数据表_玩家 } from '../../src/content/demo/index.ts';
import { 词条映射From } from '../../src/core/math/stats.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import type { BpCtor } from '../../src/core/sim/types.ts';
import { doubles, newCalls } from './doubles.ts';
import { layout } from './world.ts';

/** The same flows on core-sim's real world (wa/sim): spawn, IsValid, destroy, the latent service. */
describe('inventory on createWorld', () => {
  it('boot the columns, lock cells, gain, move, unequip and remove an item', () => {
    const calls = newCalls();
    const w = createWorld({ content: registry, seed: 3, systems: doubles(calls) });
    w.cult.激活修炼系统();
    const hero = w.spawn(BP_Actor_Player as unknown as BpCtor<BP_Actor_Player>, h => { h.词条 = 词条映射From(数据表_玩家.rows.幽冥骑士.科学词条); });
    w.mode.玩家角色 = hero;
    w.mode.金币 = 50;
    w.cult.创建锁定格();
    expect(layout(w, 'equip')).toBe('锁锁锁锁锁锁....');
    const sword = w.cult.生成卡牌('CatapultHero/数据表/合成数据表_修炼物品', '旧剑', { x: 0, y: 0, z: 0 }, 'None', false, 2, 0, [], new Map(), false, -1, -1).卡牌实例!;
    sword.已揭示 = true;
    expect(sword.当前价格).toBe(8);
    expect(w.cult.获取牌(sword).成功).toBe(true);
    expect(w.mode.金币).toBe(42);
    expect(layout(w, 'equip')).toBe('锁锁锁锁锁锁..旧旧');
    expect(w.sys.inventory.commands!['item.move']!(w, { type: 'item.move', item: sword.id, to: { grid: 'backpack', row: 4, col: 0 } })).toEqual({ ok: true });
    expect(layout(w, 'backpack')).toBe('....旧旧....');
    const view = w.sys.inventory.view!(w).inventory!;
    expect(view.backpack.map(c => [c.row, c.quality, c.place, c.size])).toEqual([['旧剑', 2, { grid: 'backpack', row: 4, col: 0 }, [1, 2]]]);
    w.cult.移除物品(sword);
    expect(w.isValid(sword)).toBe(false);
    expect(layout(w, 'backpack')).toBe('....旧旧....'); // the cells refresh on the next 更新格子信息 (as in the Demo)
    w.cult.修炼物品格_在背包!.更新格子信息(0);
    expect(layout(w, 'backpack')).toBe('..........');
  });
});

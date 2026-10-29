import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { BP_Actor_Card } from '../../src/core/sim/card';
import { InputMapper, DRAG_HOLD } from '../../src/game/input';
import { Shell } from '../../src/game/loop';
import { inventoryExpanded, inventoryTip } from '../../src/game/bind/inventory';
import { itemCards } from '../../src/game/bind/hud';
import { BACKPACK_SHIFT, BackpackPanel } from '../../src/ui/pages/backpack/panel';
import { HudModel } from '../../src/ui/hud/model';
import { HitMap } from '../../src/ui/core/hit';
import { GRID, rowTop } from '../../src/ui/hud/layout';
import type { Command, ItemPlace } from '../../src/game/api';

function firstReward() {
  const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  for (const cmd of [{ type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' }] as const) {
    game.runUntilInput(); expect(game.send(cmd).ok).toBe(true);
  }
  game.runUntilInput(); expect(game.send({ type: 'interact', actor: game.view.field.find(a => a.kind === 'neutral')!.id }).ok).toBe(true);
  game.runUntilInput();
  const item = Number(game.legal().find(c => c.type === 'loot.take')!.params!.item![0]);
  expect(game.send({ type: 'loot.take', item }).ok).toBe(true);
  game.runUntilInput();
  if (game.legal().some(c => c.type === 'loot.close')) { expect(game.send({ type: 'loot.close' }).ok).toBe(true); game.runUntilInput(); }
  return { game, item };
}

function shellFor(game: ReturnType<typeof createGame>) {
  const shell = Object.create(Shell.prototype) as { placeOf(t: string): ItemPlace | null };
  Object.defineProperty(shell, 'o', { value: { game } });
  return shell;
}

describe('the two source inventory columns', () => {
  it('projects the source root endpoints to 111px and keeps cards above ten explicit backpack drop cells', () => {
    expect(BACKPACK_SHIFT).toBe(111); // raw SCS + open/closed ActorSequence endpoints, 296u × 0.375px/u
    const panel = new BackpackPanel(); panel.setItems([{ id: '1', row: 2, size: 2, icon: 'shield', type: 'armor' }]);
    expect(panel.regions().filter(r => r.id.startsWith('slot:backpack:'))).toHaveLength(10);
    expect(panel.hitTest(GRID.rect.x + 8, rowTop(2) + 9)).toBe('item:1');
    expect(panel.hitTest(GRID.rect.x + 8, rowTop(3) + 9)).toBe('item:1');
    expect(panel.hitTest(GRID.rect.x + 8, rowTop(9) + 9)).toBe('slot:backpack:9');
    const hud = new HudModel(); hud.sideOffset = BACKPACK_SHIFT;
    const hits = new HitMap(); hits.set(hud.regions(960, 540));
    expect(hits.test(GRID.rect.x + 8, rowTop(9) + 9)).toBeNull();
    expect(hits.test(GRID.rect.x + 119, rowTop(9) + 9)?.id).toBe('slot:equip:9');
  });

  it('moves a real first-room reward equip → backpack → equip through held-pointer ItemPlace commands and refreshes its tooltip', () => {
    const { game, item } = firstReward(), shell = shellFor(game), mapper = new InputMapper();
    expect(inventoryExpanded(game.view, game.legal())).toBe(true);
    const original = game.view.inventory.equip.find(c => c.id === item)!;
    const move = (target: string) => {
      mapper.down(0, { floor: null, hud: `item:${item}` }); mapper.update(DRAG_HOLD);
      const out = mapper.up(0, { floor: null, hud: target, place: shell.placeOf(target) });
      expect(out).toHaveLength(1); expect(game.send((out[0] as { cmd: Command }).cmd).ok).toBe(true);
    };
    move('slot:backpack:4');
    const bagCard = game.view.inventory.backpack.find(c => c.id === item)!;
    expect(bagCard.place).toEqual({ grid: 'backpack', row: 4, col: 0 });
    const tip = inventoryTip(game.view, `item:${item}`, BACKPACK_SHIFT)!;
    expect(tip.tip.body).toEqual(bagCard.tooltip); expect(tip.tip.title).toBe(bagCard.row);
    const panel = new BackpackPanel(); panel.setItems(itemCards(game.view.inventory.backpack));
    expect(panel.hitTest(GRID.rect.x + 8, rowTop(4) + 9)).toBe(`item:${item}`);
    expect(shell.placeOf(`slot:equip:${game.view.inventory.lockedRows[0]}`)).toBeNull();
    move(`slot:equip:${original.place!.row}`);
    expect(game.view.inventory.equip.find(c => c.id === item)?.place).toEqual(original.place);
    expect(game.view.inventory.backpack).toHaveLength(0);
  });

  it('retains the core rejection and restores the original card when the other column is occupied', () => {
    const { game, item } = firstReward(), w = game.world, bag = w.cult.修炼物品格_在背包!;
    // Explicit full-capacity fixture on real grid actors; no game rule/slot/lock is changed.
    for (const group of [w.cult.修炼物品格_已装备!, bag]) for (const cell of [...group.空格子数组]) {
      const row = group.格子实例数组.indexOf(cell);
      if (group === bag && row === 5) continue;
      const c = w.spawn(BP_Actor_Card, card => { card.名字 = `full grid ${group.id}:${row}`; card.尺寸 = group === bag && row === 4 ? 2 : 1; card.已揭示 = true; });
      group.放入物品到指定格(c, cell, false);
      (group === bag ? w.cult.背包里牌 : w.cult.已装备牌).push(c);
    }
    const before = game.view.inventory, coins=w.mode.金币,hero=w.mode.玩家角色!,hpBefore=game.view.hero!.hp;
    const maxDuringDrop:number[]=[],update=hero.更新最大生命魔力.bind(hero);
    vi.spyOn(hero,'更新最大生命魔力').mockImplementation(()=>{update();maxDuringDrop.push(game.view.hero!.maxHp);});
    expect(game.send({ type: 'item.move', item, to: { grid: 'backpack', row: 4, col: 0 } }).ok).toBe(false);
    expect(game.view.inventory.equip).toEqual(before.equip);
    expect(game.view.inventory.backpack).toEqual(before.backpack);
    // Source Card grab unequips first; hero enchant removal refreshes/clamps HP (ManeActor2895–2906).
    // The rejected drop restores equipment but does not heal the HP clamped while its max was lower.
    expect(maxDuringDrop.length).toBeGreaterThan(0);expect(game.view.hero!.hp).toBe(Math.min(hpBefore,...maxDuringDrop));
    expect(w.mode.金币).toBe(coins);
  });

  it('follows the source closed flag even for empty columns and leaves combat rearrangement forbidden', () => {
    const { game, item } = firstReward();
    game.world.cult.切换修炼背包(true);
    expect(game.view.inventory.canRearrange).toBe(false);
    expect(inventoryExpanded(game.view, game.legal())).toBe(false);
    expect(game.legal().some(s => s.type === 'item.move')).toBe(false);
    expect(game.send({ type: 'item.move', item, to: { grid: 'backpack', row: 0, col: 0 } }).ok).toBe(false);
    game.world.cult.切换修炼背包(false);
    expect(game.view.inventory.canRearrange).toBe(true);
    expect(inventoryExpanded({ ...game.view, inventory: { ...game.view.inventory, equip: [], backpack: [] } }, [])).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import type { 修炼物品格子组 } from '../../src/core/sim/cult-grid.ts';
import { TagSet } from '../../src/core/sim/tags.ts';
import { canFitIncomingItem } from '../../src/core/sys/inventory/index.ts';
import { coveredCells } from '../../src/core/sys/inventory/grid.ts';
import type { BotGame } from '../../src/bot/api.ts';
import { playRun } from '../../src/bot/runner.ts';
import { scriptedPolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';

function start() {
  const game = createGame({ seed: 7, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  game.runUntilInput(); game.send({ type: 'title.newRun' });
  game.runUntilInput(); game.send({ type: 'hero.start' }); game.runUntilInput();
  return game;
}

/** Capacity fixture on real grid actors. No capacity is expanded and locked cells are left untouched. */
function placeFiller(game: ReturnType<typeof start>, group: 修炼物品格子组, row: number): BP_Actor_Card {
  const c = game.world.spawn(BP_Actor_Card, card => {
    card.名字 = `capacity fixture ${group.id}:${row}`; card.尺寸 = 1; card.品质 = 1; card.已揭示 = true;
  });
  group.放入物品到指定格(c, group.格子实例数组[row]!, false);
  const cult = game.world.cult;
  (group === cult.修炼物品格_已装备 ? cult.已装备牌 : cult.背包里牌).push(c);
  return c;
}
function fill(game: ReturnType<typeof start>, group: 修炼物品格子组): void {
  const empty = [...group.空格子数组];
  for (const cell of empty) placeFiller(game, group, group.格子实例数组.indexOf(cell));
}
function offer(game: ReturnType<typeof start>, name: string): BP_Actor_Card {
  const cult = game.world.cult;
  cult.切换物品盒子(false, true, 2, 0, null);
  cult.刷新生成牌(false, false, false, 1, 1, false, new TagSet(), new TagSet(), true, false, [name], [], new Map());
  return cult.未拾取牌[0]!;
}

describe('loot capacity is a pure admission query', () => {
  it('with both columns full excludes takes, pays nothing, preserves the source failure response and lets the player close/manage inventory', () => {
    const game = start(), w = game.world, cult = w.cult;
    const equip = cult.修炼物品格_已装备!, bag = cult.修炼物品格_在背包!;
    fill(game, equip); fill(game, bag);
    const card = offer(game, '旧剑'); w.mode.金币 = 100;
    const before = game.digest(), rng = w.rng.save();
    game.drainEvents();
    for (let i = 0; i < 20; i++) {
      expect(canFitIncomingItem(cult, card)).toBe(false);
      expect(game.legal().some(s => s.type === 'loot.take')).toBe(false);
    }
    expect(game.digest()).toBe(before);
    expect(w.rng.save()).toEqual(rng);
    expect(game.drainEvents()).toEqual([]); // no compaction / aura / presentation work while listing legal actions
    expect(game.send({ type: 'loot.take', item: card.id }).ok).toBe(false);
    expect(cult.获取牌(card)).toEqual({ 成功: false }); // source method retains its 没有空间 feedback
    expect(game.drainEvents().some(e => e.kind === 'headUp')).toBe(true);
    expect(w.mode.金币).toBe(100);
    expect(cult.当前可获取数量).toBe(2);
    expect(cult.未拾取牌).toContain(card);
    expect([equip.格子数量, bag.格子数量]).toEqual([10, 10]);
    const decision = scriptedPolicy().choose({ game: game as unknown as BotGame, legal: game.legal(), rng: botRng(7, 6), step: 0 });
    expect(decision).toEqual({ type: 'loot.close' });
    expect(game.send({ type: 'loot.close' }).ok).toBe(true);
    expect(game.legal().some(s => s.type === 'item.move')).toBe(true);
  });

  it.each(['旧盾', '旧盔甲'])('allows %s when fragmented free space can be compacted, without moving anything during legal()', name => {
    const game = start(), w = game.world, cult = w.cult;
    const equip = cult.修炼物品格_已装备!, bag = cult.修炼物品格_在背包!;
    fill(game, equip);
    for (const row of [0, 2, 4, 6, 8]) placeFiller(game, bag, row);
    const card = offer(game, name); w.mode.金币 = 100;
    expect(bag.空格子数组).toHaveLength(5);
    const before = game.digest(), rng = w.rng.save(), gold = w.mode.金币, price = card.当前价格;
    const locks = cult.已装备牌.filter(c => c?.名字 === '锁定格').map(c => c!.K2_GetActorLocation());
    for (let i = 0; i < 20; i++) expect(game.legal().find(s => s.type === 'loot.take')?.params?.item).toContain(card.id);
    expect(game.digest()).toBe(before); expect(w.rng.save()).toEqual(rng);
    expect(game.send({ type: 'loot.take', item: card.id })).toEqual({ ok: true });
    expect(cult.背包里牌).toContain(card);
    expect(coveredCells(card)).toHaveLength(card.尺寸);
    expect(bag.空格子数组).toHaveLength(5 - card.尺寸);
    expect(w.mode.金币).toBe(gold - price);
    expect(cult.已装备牌.filter(c => c?.名字 === '锁定格').map(c => c!.K2_GetActorLocation())).toEqual(locks);
  });

  it('does not combine one free slot in each separate column to admit a two-slot card', () => {
    const game = start(), cult = game.world.cult;
    for (const group of [cult.修炼物品格_已装备!, cult.修炼物品格_在背包!]) {
      const empty = [...group.空格子数组];
      for (const cell of empty.slice(1)) placeFiller(game, group, group.格子实例数组.indexOf(cell));
      expect(group.空格子数组).toHaveLength(1);
    }
    const card = offer(game, '旧盾'); game.world.mode.金币 = 100;
    expect(card.尺寸).toBe(2);
    expect(canFitIncomingItem(cult, card)).toBe(false);
    expect(game.legal().some(s => s.type === 'loot.take')).toBe(false);
  });

  it('seed 7 / runIndex 6 reaches a normal ending without repeating a full-backpack take', () => {
    const result = playRun(o => createGame({ ...o, content: registry }) as unknown as BotGame,
      { seed: 7, runIndex: 6, policy: 'scripted', filter: 'ported', maxCommands: 500, maxSim: 600 });
    expect(result.outcome, result.reason).toBe('ended');
    // Reward projection and real gravity can change survival; capacity admission must not force the old victory.
    expect(result.floors).toBeGreaterThan(0);
    expect(result.floors).toBeLessThanOrEqual(12);
    expect(result.commandLog.some(c => c.type === 'loot.close')).toBe(true);
  }, 60_000);
});

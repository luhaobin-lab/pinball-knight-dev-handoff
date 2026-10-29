import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { 蓝图_效果_探索 } from '../../src/content/bp/Skill/效果/蓝图_效果_探索.ts';
import { createGame } from '../../src/core/api/game.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { SetActorHiddenInGame, isHiddenInGame } from '../../src/core/sim/engine.ts';
import { TagSet } from '../../src/core/sim/tags.ts';

function start() {
  const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  game.runUntilInput(); expect(game.send({ type: 'title.newRun' }).ok).toBe(true);
  game.runUntilInput(); expect(game.send({ type: 'hero.start' }).ok).toBe(true); game.runUntilInput();
  return game;
}
function firstLoot() {
  const game = start();
  const tile = game.view.map!.cells.find(c => c.enterable && c.reward === '初始奖励B')!;
  expect(game.send({ type: 'map.enter', cell: tile.id }).ok).toBe(true);
  game.advance(2);
  const chest = game.world.mode.场上所有.find(a => a?.名字 === '任务宝箱')!;
  expect(game.send({ type: 'interact', actor: chest.id }).ok).toBe(true);
  game.advance(3);
  expect(game.view.modal?.kind).toBe('loot');
  return game;
}

describe('loot reveal through the real reward and inventory modules', () => {
  it('takes first-room equipment through normal commands, charges the free source price once, and closes the one-pick box', () => {
    const game = firstLoot();
    const w = game.world, cult = w.cult;
    const card = cult.未拾取牌[0]!;
    expect(card).toBeInstanceOf(BP_Actor_Card);
    // Same real first-room source entry; expanding the reviewed pool changes its seeded draw from 投手之握.
    expect(card.名字).toBe('淬毒利刃');
    expect(card.已揭示).toBe(true);
    expect(card.当前价格).toBe(0);
    expect(cult.当前可获取数量).toBe(1);
    const gold = w.mode.金币;
    const before = [...cult.已装备牌, ...cult.背包里牌].filter(c => c?.valid).length;
    expect(game.send({ type: 'loot.take', item: card.id })).toEqual({ ok: true });
    expect(cult.未拾取牌).not.toContain(card);
    expect([...cult.已装备牌, ...cult.背包里牌]).toContain(card);
    expect([...cult.已装备牌, ...cult.背包里牌].filter(c => c?.valid)).toHaveLength(before + 1);
    expect(w.mode.金币).toBe(gold);
    expect(cult.盒子关闭了).toBe(true);
    expect(game.view.modal?.kind).not.toBe('loot');
    expect(game.send({ type: 'loot.take', item: card.id }).ok).toBe(false);
    expect(w.mode.金币).toBe(gold);
    expect([...cult.已装备牌, ...cult.背包里牌].filter(c => c === card)).toHaveLength(1);
  });

  it('keeps eligibility synchronous but displays by index delay + the imported .75s timeline, then destroys only the effect', () => {
    const game = start(), w = game.world;
    const card = w.spawn(BP_Actor_Card, c => { c.品质 = 1; c.当前价格 = 7; c.尺寸 = 1; });
    SetActorHiddenInGame(card, true);
    const effect = w.spawn(蓝图_效果_探索, e => { e.拥有者 = card; e.序号 = 2; e.免费 = true; e.持续时长 = -1; });
    effect.K2_AttachToActor(card); card.拥有的效果.push(effect);
    const time = w.clock.now;
    effect.激活效果('');
    expect(card.已揭示).toBe(true);
    expect(card.当前价格).toBe(0);
    expect(isHiddenInGame(card)).toBe(true);
    game.advance(1.49);
    expect(isHiddenInGame(card)).toBe(true);
    game.advance(0.02);
    expect(isHiddenInGame(card)).toBe(false);
    const shown = game.drainEvents().find(e => e.kind === 'actor.hide' && e.id === card.id && !e.hidden)!;
    expect(shown.t).toBeCloseTo(time + 1.5, 8);
    expect(effect.valid).toBe(true);
    game.advance(0.75);
    expect(effect.valid).toBe(false);
    expect(card.valid).toBe(true);
    expect(card.拥有的效果).not.toContain(effect);
  });

  it('uses the actual non-free price and prevents modal fallback from reintroducing unrevealed, unaffordable or dead-hero takes', () => {
    const game = start(), w = game.world, c = w.cult;
    c.切换物品盒子(false, true, 2, 0, null);
    c.刷新生成牌(false, false, false, 1, 1, false, new TagSet(), new TagSet(), true, false, ['旧剑'], [], new Map());
    const card = c.未拾取牌[0]!;
    const price = card.当前价格;
    expect(price).toBeGreaterThan(0);
    w.mode.金币 = price + 5;
    card.已揭示 = false; // explicit blocked-state probe for the API fallback regression
    expect(game.legal().some(s => s.type === 'loot.take')).toBe(false);
    expect(game.send({ type: 'loot.take', item: card.id }).ok).toBe(false);
    card.已揭示 = true;
    w.mode.金币 = price - 1;
    expect(game.legal().some(s => s.type === 'loot.take')).toBe(false);
    w.mode.金币 = price + 5;
    w.mode.玩家角色!.死掉了 = true;
    expect(game.legal().some(s => s.type === 'loot.take')).toBe(false);
    w.mode.玩家角色!.死掉了 = false;
    expect(game.send({ type: 'loot.take', item: card.id })).toEqual({ ok: true });
    expect(w.mode.金币).toBe(5);
    expect(c.当前可获取数量).toBe(1);
    expect(game.send({ type: 'loot.take', item: card.id }).ok).toBe(false);
    expect(w.mode.金币).toBe(5);
    expect(c.当前可获取数量).toBe(1);
  });

  it('cancels pending reveal callbacks when the box closes, without resurrecting removed cards', () => {
    const game = start(), w = game.world, c = w.cult;
    c.切换物品盒子(false, true, 2, 0, null);
    c.刷新生成牌(false, true, false, 1, 2, false, new TagSet(), new TagSet(), true, false, ['旧剑', '旧盾'], [], new Map());
    const cards = [...c.未拾取牌];
    const effects = cards.flatMap(card => card!.拥有的效果.filter(e => e instanceof 蓝图_效果_探索));
    expect(effects).toHaveLength(2);
    expect(game.send({ type: 'loot.close' }).ok).toBe(true);
    game.drainEvents(); game.advance(3);
    expect(cards.every(card => !w.isValid(card))).toBe(true);
    expect(effects.every(e => !w.isValid(e))).toBe(true);
    expect(game.drainEvents().filter(e => e.kind === 'actor.hide' && !e.hidden && cards.some(c => c!.id === e.id))).toEqual([]);
  });
});

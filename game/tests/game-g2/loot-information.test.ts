import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { scriptedPolicy } from '../../src/bot/policies';
import { botRng } from '../../src/bot/rng';
import type { BotGame } from '../../src/bot/api';
import type { Command } from '../../src/core/api/commands';
import { lootPositions, 盒子 } from '../../src/core/sys/rewards/box';
import { TagSet } from '../../src/core/sim/tags';
import { lootModel } from '../../src/game/bind/pages/modal-loot';
import { cardRect } from '../../src/ui/pages/loot/page';
import { itemCards } from '../../src/game/bind/hud';
import { inventoryTip } from '../../src/game/bind/inventory';
import rewards from '../../src/content/demo/data/数据表_技能_奖励.ts';
import { 蓝图_奖励_获取物品 } from '../../src/content/bp/Skill/Ability/奖励/蓝图_奖励_获取物品.ts';

describe('source loot information reaches the browser', () => {
  it.each([1, 4])('keeps source quality %s identical on the offer, equipment face and inventory tooltip', quality => {
    const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    game.runUntilInput(); game.send({ type: 'title.newRun' }); game.runUntilInput(); game.send({ type: 'hero.start' }); game.runUntilInput();
    const cult = game.world.cult;
    cult.切换物品盒子(false, true, -1, 0, null);
    cult.刷新生成牌(false, true, false, quality, 1, false, new TagSet(), new TagSet(), true, false, ['旧匕首'], [], new Map());
    const m = game.view.modal; expect(m?.kind).toBe('loot'); if (m?.kind !== 'loot') return;
    const item = m.cells[0]!.item, offered = lootModel(game.view, game.legal()).items[0]!;
    expect(offered.face.quality).toBe(quality - 1); expect(offered.tip?.quality).toBe(quality - 1);
    expect(game.send({ type: 'loot.take', item }).ok).toBe(true);
    expect(itemCards(game.view.inventory.equip).find(c => c.id === String(item))?.quality).toBe(quality - 1);
    expect(inventoryTip(game.view, `item:${item}`, 111)?.tip.quality).toBe(quality - 1);
  });

  it('retains source column order and 128uu size accumulation rather than stacking every card as size one', () => {
    expect(lootPositions([2, 3, 1, 1, 2, 3], 6)).toEqual([
      { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
      { col: 0, row: 2 }, { col: 1, row: 3 }, { col: 2, row: 1 },
    ]);
    expect(lootPositions([3, 1, 2, 2, 1, 3], -1)).toEqual([
      { col: 0, row: 0 }, { col: 0, row: 3 }, { col: 1, row: 0 },
      { col: 1, row: 2 }, { col: 2, row: 0 }, { col: 2, row: 1 },
    ]);
    const r = (size: 1 | 2 | 3) => cardRect({ col: 0, row: 0, size, sourcePosition: { col: 0, row: 0 } });
    expect([r(1).h, r(2).h, r(3).h]).toEqual([37, 76, 115]);
    expect(cardRect({ col: 0, row: 0, size: 1, sourcePosition: { col: 1, row: 0 } }).x - r(1).x).toBe(87);
  });

  it('naturally exposes paid large-card offers with read-pure view and source card information', () => {
    const game = createGame({ seed: 6, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    const policy = scriptedPolicy(), rng = botRng(6, 0);
    let paid = false;
    for (let step = 0; step < 140; step++) {
      game.runUntilInput();
      const v = game.view, m = v.modal, legal = game.legal();
      if (m?.kind === 'loot') {
        const before = game.digest(), random = game.world.rng.save();
        const model = lootModel(v, legal);
        for (let i = 0; i < 10; i++) lootModel(game.view, game.legal());
        expect(game.digest()).toBe(before); expect(game.world.rng.save()).toEqual(random);
        for (const c of m.cells) {
          const actual = game.world.cult.未拾取牌.find(a => a?.id === c.item)!;
          expect(c.price).toBe(actual.当前价格); expect(c.size).toBe(actual.尺寸);
          expect(c.tooltip).toEqual(v.inventory.side.find(a => a.id === c.item)?.tooltip);
          const ui = model.items.find(a => a.id === String(c.item))!;
          expect(ui.price).toBe(c.price); expect(ui.size).toBe(c.size); expect(ui.tip?.body).toEqual(c.tooltip);
          expect(ui.tip?.quality).toBe(c.quality - 1); expect(ui.face.quality).toBe(c.quality - 1);
        }
        // This checks the real paid offer UI. Its floor changes when source combat and talent pools are restored.
        // Require an actually generated paid large card, preserving every price/size/quality/purity assertion.
        if (!paid && m.cells.some(c => c.size === 3 && c.price! > 0)) {
          expect(m.cells.some(c => c.price! > 0)).toBe(true);
          expect(model.items.some(c => c.size === 3 && c.price! > 0)).toBe(true);
          paid = true;
          break;
        }
      }
      const cmd = policy.choose({ game: game as unknown as BotGame, legal, rng, step });
      if (!cmd) break;
      expect(game.send(cmd as Command).ok, JSON.stringify(cmd)).toBe(true);
    }
    expect(paid).toBe(true);
  }, 30_000);

  it.each([['获取物品_剧毒', ['疫病虫巢', '蛛后毒囊']], ['获取物品_闪避', ['幻影轻弩', '幻影轻弩']]] as const)('%s keeps source contents, refresh payment and count semantics', (reward, names) => {
    const game = createGame({ seed: 6, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    game.runUntilInput(); game.send({ type: 'title.newRun' }); game.runUntilInput(); game.send({ type: 'hero.start' }); game.runUntilInput();
    // Real reward-entry boundaries after restoring the source item pools, including source draws with replacement.
    // Both source rows allow one refresh at cost2; no empty list, price or pool is injected.
    const offer = game.world.spawn(蓝图_奖励_获取物品, a => { a.拥有者 = game.world.mode.玩家角色; a.能力名 = reward; });
    offer.技能配置 = rewards.rows[reward]; offer.等级 = 1; offer.初始化(); offer.子初始化(); offer.执行技能(false);
    const m = game.view.modal;
    expect(m?.kind).toBe('loot'); if (m?.kind !== 'loot') throw Error('missing real source offer');
    expect(m.cells.map(c => c.row)).toEqual([...names]);
    expect(game.legal().some(s => s.type === 'modal.reroll')).toBe(true);
    expect(lootModel(game.view, game.legal()).button).toMatchObject({ kind: 'reroll', enabled: true, cost: 2 });
    const gold = game.world.mode.金币, remaining = 盒子(game.world.cult).可刷新次数, cost = m.reroll!.cost;
    expect(remaining).toBe(1); expect(cost).toBe(2);
    const before = game.digest(), random = game.world.rng.save();
    for (let i = 0; i < 10; i++) lootModel(game.view, game.legal());
    expect(game.digest()).toBe(before); expect(game.world.rng.save()).toEqual(random);
    expect(game.send({ type: 'modal.reroll' }).ok).toBe(true);
    expect(game.world.mode.金币).toBe(gold - cost);
    expect(盒子(game.world.cult).可刷新次数).toBe(remaining - 1);
    const after = lootModel(game.view, game.legal());
    expect(after.button?.enabled).toBe(game.legal().some(c => c.type === 'modal.reroll'));
    expect(after.button?.enabled).toBe(false);
  });

  it('preserves the historical mixed-size paid-offer boundary independently of newly restored room RNG draws', () => {
    const game = createGame({ seed: 6, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    game.runUntilInput(); game.send({ type: 'title.newRun' }); game.runUntilInput(); game.send({ type: 'hero.start' }); game.runUntilInput();
    // Boundary is the original observed set, explicitly supplied to the real reward generator; it is not a
    // claim that a current natural seed must draw the pre-room-recovery eight-item sequence.
    const names = ['旧鞋','旧匕首','旧匕首','空瓶','旧盔甲','旧鞋','旧项链','空瓶'];
    const cult = game.world.cult;
    cult.切换物品盒子(false, true, -1, 0, null);
    cult.刷新生成牌(false, false, false, 1, -1, false, new TagSet(), new TagSet(), true, false, names, [], new Map());
    const m = game.view.modal;
    expect(m?.kind).toBe('loot'); if (m?.kind !== 'loot') throw Error('missing paid boundary box');
    expect(m.cells.map(c => [c.row,c.price,c.size])).toEqual([
      ['旧鞋',4,2],['旧匕首',2,1],['旧匕首',2,1],['空瓶',2,1],
      ['旧盔甲',6,3],['旧鞋',4,2],['旧项链',2,1],['空瓶',2,1],
    ]);
    expect(lootModel(game.view, game.legal()).items.map(c => c.sourcePosition)).toEqual([
      {col:0,row:0},{col:0,row:2},{col:0,row:3},{col:1,row:0},
      {col:1,row:1},{col:2,row:0},{col:2,row:2},{col:2,row:3},
    ]);
  });

  it.each(['ported', 'all'] as const)('%s keeps holes after a take and exposes the disabled source reroll without changing prices', filter => {
    const game = createGame({ seed: 1, content: registry, filter, debug: { skipPrologue: true } });
    game.runUntilInput(); game.send({ type: 'title.newRun' }); game.runUntilInput(); game.send({ type: 'hero.start' }); game.runUntilInput();
    const cult = game.world.cult;
    cult.切换物品盒子(false, true, -1, 0, null);
    cult.刷新生成牌(false, true, false, 1, 3, false, new TagSet(), new TagSet(), true, false, ['旧鞋', '旧盔甲', '旧匕首'], [], new Map());
    const m = game.view.modal; expect(m?.kind).toBe('loot'); if (m?.kind !== 'loot') return;
    const before = m.cells.map(c => ({ ...c }));
    expect(game.send({ type: 'loot.take', item: before[0]!.item }).ok).toBe(true);
    expect(m.cells.map(c => c.position)).toEqual(before.slice(1).map(c => c.position));
    const model = lootModel(game.view, game.legal());
    expect(model.button).toMatchObject({ kind: 'reroll', enabled: false });
    expect(model.items.map(c => c.size)).toEqual([3, 1]);
    expect(model.items.map(c => c.price)).toEqual([0, 0]);
  });
});

import { describe, expect, it } from 'vitest';
import { baseAttribute, 数据表_玩家 } from '../../src/content/demo/index.ts';
import { changeStamina, firstQuest, heroStart, HERO_ROW, STAMINA_PER_ACTION } from '../../src/game/hero';
import { chargeBounce, LOADOUT, startingLoadout, type ChargeCard } from '../../src/game/loadout';

/**
 * The HUD's numbers come from the Demo data (src/content/demo): the hero is 数据表_玩家.幽冥骑士 (the beetle knight
 * reskins it) and the cards are rows of 数据表_修炼物品_通用. Charge vectors from spec-drafts/charge-infuse-echocast.
 */
describe('hero at run start', () => {
  it('is 幽冥骑士: 150/150 HP and 100/100 Stamina from 数据表_玩家', () => {
    const row = 数据表_玩家.rows.幽冥骑士;
    expect(HERO_ROW).toBe(row);
    expect(baseAttribute(row.科学词条, '生命')?.值).toBe(150);
    const h = heroStart();
    expect(h).toMatchObject({ hp: 150, hpMax: 150, stamina: 100, staminaMax: 100, armor: 0, dotPending: 0, dead: false });
  });

  it('starts at level 1 with 0/150 EXP and 0/100 Corruption (蓝图_动作游戏模式 run start)', () => {
    expect(heroStart()).toMatchObject({ level: 1, exp: 0, expMax: 150, corruption: 0, corruptionMax: 100 });
  });

  it('pays 5 Stamina at every action end and never goes below 0 (SCM-011/013)', () => {
    expect(STAMINA_PER_ACTION).toBe(-5);
    let s = 100;
    const seen: number[] = [];
    for (let i = 0; i < 21; i++) seen.push((s = changeStamina(s, 100, STAMINA_PER_ACTION)));
    expect(seen.slice(0, 3)).toEqual([95, 90, 85]);
    expect(seen[19]).toBe(0);
    expect(seen[20]).toBe(0);
    expect(changeStamina(98, 100, 30)).toBe(100);
  });

  it('shows the first main quest 序幕 with its requirement line', () => {
    expect(firstQuest()).toEqual({ title: '序幕', line: '通过第<数值>1/7</>层' });
  });
});

describe('starting loadout', () => {
  const cards = startingLoadout();
  const byId = new Map(cards.map(c => [c.card.id, c]));

  it('stacks 生命药剂, 体力药剂 and 旧剑 from the top by their size tags', () => {
    expect(cards.map(c => c.card.id)).toEqual([...LOADOUT]);
    expect(cards.map(c => [c.card.row, c.card.size])).toEqual([
      [0, 1],
      [1, 1],
      [2, 2],
    ]);
  });

  it('gives 旧剑 its 20 base damage badge and 15 charge per bounce (属性.行动力, 有充能)', () => {
    const sword = byId.get('旧剑')!;
    expect(sword.card).toMatchObject({ icon: 'sword', type: 'weapon', damage: 20, charge: 0, quality: 0 });
    expect(sword.card.durability).toBeUndefined();
    expect(sword.perBounce).toBe(15);
  });

  it('heals with 生命药剂 for 0.15 of the hero max HP (治愈等于生命上限), three uses each potion', () => {
    const health = byId.get('生命药剂')!;
    expect(health.card).toMatchObject({ icon: 'potion', type: 'consumable', heal: 22.5, durability: 3 });
    expect(health.perBounce).toBeNull();
    const stamina = byId.get('体力药剂')!;
    expect(stamina.card.durability).toBe(3);
    // no 治疗 tag, so no heal badge (UI_修炼牌 HorizontalBox_50)
    expect(stamina.card.heal).toBeUndefined();
    expect(stamina.perBounce).toBeNull();
  });
});

describe('charge per bounce (给装备的物品充能)', () => {
  const sword = (): ChargeCard[] => [{ id: '旧剑', perBounce: 15, current: 0 }];

  it('CHARGE-TV-01: seven bounces of 旧剑 charge 15 each and complete once on the seventh, keeping 5', () => {
    const cards = sword();
    const events = Array.from({ length: 7 }, () => chargeBounce(cards, true)[0]);
    expect(events.map(e => e.current)).toEqual([15, 30, 45, 60, 75, 90, 5]);
    expect(events.map(e => e.shown)).toEqual(Array(7).fill(15));
    expect(events.map(e => e.completions)).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });

  it('does nothing without an enemy on the field (CHARGE-020)', () => {
    const cards = sword();
    cards[0].current = 30;
    expect(chargeBounce(cards, false)).toEqual([]);
    expect(cards[0].current).toBe(30);
  });

  it('refuses the add at or above 100 but still shows the popup and completes (添加行动力 entry gate, CHARGE-TV-08)', () => {
    const cards: ChargeCard[] = [{ id: '旧剑', perBounce: 15, current: 120 }];
    const [e] = chargeBounce(cards, true);
    expect(e).toEqual({ id: '旧剑', shown: 15, current: 20, completions: 1 });
  });

  it('completes several times in one event when the charge holds several hundreds', () => {
    const cards: ChargeCard[] = [{ id: 'x', perBounce: 150, current: 90 }];
    expect(chargeBounce(cards, true)[0]).toEqual({ id: 'x', shown: 150, current: 40, completions: 2 });
  });
});

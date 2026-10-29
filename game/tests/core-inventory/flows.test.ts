import { describe, expect, it } from 'vitest';
import { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import type { 结构_参数 } from '../../src/content/demo/types.ts';
import { 数据表_技能_修炼物品, 数据表_玩家 } from '../../src/content/demo/index.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条, 词条映射From } from '../../src/core/math/stats.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import type { BP_Actor_Card } from '../../src/core/sim/card.ts';
import type { BpCtor } from '../../src/core/sim/types.ts';
import { inventory } from '../../src/core/sys/inventory/index.ts';
import { 格式化技能描述 } from '../../src/core/sys/text/describe.ts';
import batch from '../../src/content/bp/batches/core-inventory.ts';
import { 蓝图_能力_恢复生命和强固 } from '../../src/content/bp/Skill/Ability/道具/蓝图_能力_恢复生命和强固.ts';
import { 蓝图_效果_死亡创建物品 } from '../../src/content/bp/Skill/效果/道具/蓝图_效果_死亡创建物品.ts';
import { 蓝图_效果_XX等于XX } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_XX等于XX.ts';
import { 蓝图_效果_蓄能获得生命or护甲 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_蓄能获得生命or护甲.ts';
import { 蓝图_效果_充能闪避格挡 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_充能闪避格挡.ts';
import { doubles, newCalls, type Calls } from './doubles.ts';
import { invWorld, layout, type InvWorld } from './world.ts';

const 表 = 'CatapultHero/数据表/合成数据表_修炼物品';

function setup(): { w: InvWorld; calls: Calls; hero: BP_Actor_Player } {
  const calls = newCalls();
  const w = invWorld(doubles(calls), batch);
  const hero = w.spawn(BP_Actor_Player as unknown as BpCtor<BP_Actor_Player>, h => { h.名字 = '幽冥骑士'; h.词条 = 词条映射From(数据表_玩家.rows.幽冥骑士.科学词条); });
  w.mode.玩家角色 = hero;
  w.mode.金币 = 100;
  return { w, calls, hero };
}

function spawnCard(w: InvWorld, name: string, 品质 = 1): BP_Actor_Card {
  const c = w.cult.生成卡牌(表, name, { x: 0, y: 0, z: 0 }, 'None', false, 品质, 0, [], new Map(), false, -1, -1).卡牌实例!;
  c.已揭示 = true;
  return c;
}

/** An ability of a 数据表_技能_修炼物品 row on a card (what 添加技能 + 初始化 produce, reduced to the fields used here). */
function skillOn(w: InvWorld, card: BP_Actor_Card, row: keyof typeof 数据表_技能_修炼物品.rows, cls: BpCtor<蓝图_能力> = 蓝图_能力 as unknown as BpCtor<蓝图_能力>): 蓝图_能力 {
  const r = 数据表_技能_修炼物品.rows[row];
  const a = w.spawn(cls, o => {
    o.能力名 = row; o.技能配置 = r; o.参数 = [...r.参数] as 结构_参数[]; o.拥有者 = card; o.等级 = card.等级; o.品质 = card.品质;
    o.原始描述 = r.描述; o.条件 = r.主条件; o.唯一ID = `${card.id}//数据表_技能_修炼物品//${row}`;
  });
  card.拥有的被动能力.push(a);
  card.拥有的能力 = [...card.拥有的被动能力, ...card.拥有的主动能力];
  return a;
}

function effectOn<T extends 蓝图_效果>(w: InvWorld, cls: BpCtor<T>, skill: 蓝图_能力, owner: BP_Actor_Card | BP_Actor_Player): T {
  const e = w.spawn(cls, o => { o.来自技能 = skill; o.拥有者 = owner; o.游戏模式 = w.mode; });
  owner.拥有的效果.push(e);
  return e;
}

/** 蓝图_能力.更新技能描述's text: 生成能力描述参数 then Format (CORE-M-080). */
function describeSkill(a: 蓝图_能力): string {
  const args = a.world.sys.text.函数库_工具!.生成能力描述参数!(a, a, a.等级, false, 0).描述中参数.map(t => t.zh);
  return 格式化技能描述(a.原始描述.zh, [], args).描述;
}

describe('card actors: 生成卡牌, 升级此牌, growth and price', () => {
  it('旧剑 base damage 20/40/80/160 by quality; 等级 = 2^(品质−1)', () => {
    const { w } = setup();
    const cards = [1, 2, 3, 4].map(q => spawnCard(w, '旧剑', q));
    expect(cards.map(c => c.等级)).toEqual([1, 2, 4, 8]);
    expect(cards.map(c => 科学数变普通(获取科学映射词条(c.词条, '基础伤害').输出值))).toEqual([20, 40, 80, 160]);
    expect(cards.map(c => c.尺寸)).toEqual([2, 2, 2, 2]);
  });

  it('price: ⌊尺寸 × 价格 × 等级 × (1 − 折扣)⌋ in the offer, half outside', () => {
    const { w } = setup();
    const sword = spawnCard(w, '旧剑', 3);
    expect([sword.原始价格, sword.当前价格]).toEqual([16, 16]);
    w.cult.未拾取牌.splice(w.cult.未拾取牌.indexOf(sword), 1);
    sword.更新价格(false);
    expect(sword.当前价格).toBe(8);
    w.cult.购买折扣 = 0.25;
    sword.更新价格(true);
    expect([sword.原始价格, sword.当前价格]).toEqual([12, 6]);
  });

  it('生成卡牌 always draws the 全局种子 stream (QUIRK L1590) and skips a row with the 忽略 tag', () => {
    const { w } = setup();
    const before = w.rng.全局种子.Seed;
    w.cult.生成卡牌(表, '旧剑', { x: 0, y: 0, z: 0 }, 'None', false, 1, 0, [], new Map(), false, -1, 7);
    expect(w.rng.全局种子.Seed).not.toBe(before);
    expect(w.cult.生成卡牌(表, '锁定格', { x: 0, y: 0, z: 0 }, '忽略', false, 1, 0, [], new Map(), false, -1, -1).卡牌实例).toBeNull();
  });
});

describe('item flows: locks, 获取牌, equip hooks, item.move, item.use', () => {
  it('创建锁定格 equips three 锁定格 covering cells 0–5; the view reports them as locked rows', () => {
    const { w } = setup();
    w.cult.创建锁定格();
    expect(layout(w, 'equip')).toBe('锁锁锁锁锁锁....');
    expect(w.cult.已装备牌.map(c => c!.名字)).toEqual(['锁定格', '锁定格', '锁定格']);
    expect(w.cult.未拾取牌).toEqual([]);
    const v = inventory.view!(w).inventory!;
    expect(v.lockedRows).toEqual([0, 1, 2, 3, 4, 5]);
    expect(v.equip).toEqual([]);
  });

  it('获取牌 pays, fills the equipment column first, then the backpack; no space / not enough gold', () => {
    const { w, calls } = setup();
    w.cult.创建锁定格();
    const [a, b, c] = ['旧剑', '旧盾', '旧鞋'].map(n => spawnCard(w, n));
    expect(w.cult.获取牌(a!).成功).toBe(true);
    expect(calls.gold).toEqual([-4]);
    expect(w.mode.金币).toBe(96);
    expect(w.cult.获取牌(b!).成功).toBe(true);
    expect(layout(w, 'equip')).toBe('锁锁锁锁锁锁旧旧旧旧');
    expect(w.mode.已装备.map(x => x!.名字)).toEqual(['锁定格', '锁定格', '锁定格', '旧剑', '旧盾']);
    expect(w.cult.获取牌(c!).成功).toBe(true);
    expect(w.cult.背包里牌).toEqual([c]);
    expect(layout(w, 'backpack')).toBe('........旧旧');
    expect(c!.当前价格).toBe(2); // ⌊2 × 2 × 1⌋ / 2 + 0 after leaving the offer
    w.mode.金币 = 0;
    const d = spawnCard(w, '旧剑');
    expect(w.cult.获取牌(d).成功).toBe(false);
    expect(w.headUps.at(-1)!.text.key).toBe('44D6CC4B4D2E097C6BBBB98BCEBDFE2E');
  });

  it('装备目标 / 卸载目标 fire 装上时触发 / 卸下时触发 once; moving between the columns equips and unequips', () => {
    const { w } = setup();
    let on = 0;
    let off = 0;
    class Spy extends 蓝图_效果 {
      override 装上时触发(): void { on += 1; }
      override 卸下时触发(): void { off += 1; }
    }
    const sword = spawnCard(w, '旧剑');
    const spy = w.spawn(Spy as unknown as BpCtor<Spy>, s => { s.OwnedGameplayTags.add('效果.时机.装上'); s.OwnedGameplayTags.add('效果.时机.卸下'); });
    sword.拥有的效果.push(spy);
    w.cult.获取牌(sword);
    expect([on, off]).toEqual([1, 0]);
    expect(inventory.commands!['item.move']!(w, { type: 'item.move', item: sword.id, to: { grid: 'backpack', row: 0, col: 0 } })).toEqual({ ok: true });
    expect([on, off]).toEqual([1, 1]);
    expect(layout(w, 'backpack')).toBe('旧旧........');
    expect(layout(w, 'equip')).toBe('..........');
    expect(w.mode.已装备).toEqual([]);
    expect(w.cult.背包里牌).toEqual([sword]);
    expect(inventory.commands!['item.move']!(w, { type: 'item.move', item: sword.id, to: { grid: 'equip', row: 3, col: 0 } })).toEqual({ ok: true });
    expect(layout(w, 'equip')).toBe('...旧旧.....');
    expect([on, off]).toEqual([2, 1]);
    expect(w.cult.已装备牌).toEqual([sword]);
  });

  it('every 更新格子信息 fires 效果.时机.物品发生变更 once per effect (hero and column cards, de-duplicated)', () => {
    const { w, hero } = setup();
    const seen: string[] = [];
    class Aura extends 蓝图_效果 {
      override 持续中触发(t: string): void { seen.push(`${this.拥有者?.名字}:${t}`); }
    }
    const aura = w.spawn(Aura as unknown as BpCtor<Aura>, a => { a.OwnedGameplayTags.add('效果.时机.物品发生变更'); a.拥有者 = hero; });
    hero.拥有的效果.push(aura);
    const sword = spawnCard(w, '旧剑');
    sword.拥有的效果.push(aura); // an equipped item's effect is in both lists (ABILIT-057)
    w.cult.获取牌(sword);
    expect(seen).toEqual(['幽冥骑士:效果.时机.物品发生变更']);
  });

  it('item.move: swap inside a full column, refusal on a 锁定格, push aside on hover, combat lock', () => {
    const { w } = setup();
    w.cult.创建锁定格();
    const [a, b, c] = ['生命药剂', '体力药剂', '旧剑'].map(n => spawnCard(w, n)) as [BP_Actor_Card, BP_Actor_Card, BP_Actor_Card];
    for (const x of [a, b, c]) w.cult.获取牌(x);
    const L = () => layout(w, 'equip').replace(/锁/g, '#').replace(/生/g, 'a').replace(/体/g, 'b').replace(/旧/g, 'c');
    expect(L()).toBe('######ccba');
    const move = (card: BP_Actor_Card, grid: 'equip' | 'backpack', row: number) => inventory.commands!['item.move']!(w, { type: 'item.move', item: card.id, to: { grid, row, col: 0 } });
    // the column is full: dropping 生命药剂 on 体力药剂 swaps them (物品交换判断 moves the blocker into the freed cell)
    expect(move(a, 'equip', 8)).toEqual({ ok: true });
    expect(L()).toBe('######ccab');
    // a 锁定格 under the drop (忽略): refused, the card goes back
    expect(move(c, 'equip', 0)).toMatchObject({ ok: false });
    expect(L()).toBe('######ccab');
    expect(w.cult.已装备牌.includes(c)).toBe(true);
    // to the backpack and back to an empty cell
    expect(move(c, 'backpack', 0)).toEqual({ ok: true });
    expect(L()).toBe('######..ab');
    expect(move(b, 'equip', 6)).toEqual({ ok: true });
    expect(L()).toBe('######b.a.');
    // hovering 生命药剂 over 体力药剂 with room in the column pushes 体力药剂 down (整理物品排列), then the drop lands
    expect(move(a, 'equip', 6)).toEqual({ ok: true });
    expect(L()).toBe('######ab..');
    w.cult.背包关闭了 = true;
    expect(move(c, 'equip', 8)).toMatchObject({ ok: false });
    expect(w.headUps.at(-1)!.text.key).toBe('556414644ABA263F9B6FDFA691FF5506');
    expect(inventory.legal!(w).some(s => s.type === 'item.move')).toBe(false);
  });

  it('item.use runs the card\'s first active through 使目标执行自身技能; 使用牌后处理 spends one use (生命 −1 under 被使用)', () => {
    const { w, calls } = setup();
    const potion = spawnCard(w, '生命药剂');
    w.cult.获取牌(potion);
    expect(inventory.legal!(w).find(s => s.type === 'item.use')).toBeUndefined(); // no active ability yet (kernel double)
    const use = skillOn(w, potion, '使用恢复生命', 蓝图_能力_恢复生命和强固 as unknown as BpCtor<蓝图_能力>);
    potion.拥有的被动能力.pop();
    potion.拥有的主动能力.push(use);
    expect(inventory.legal!(w).find(s => s.type === 'item.use')?.params?.item).toEqual([potion.id]);
    w.cult.使用牌后处理(potion);
    expect(科学数变普通(获取科学映射词条(potion.词条, '生命').输出值)).toBe(2);
    expect(calls.deaths).toEqual([potion]);
  });
});

describe('item classes (G2): 恢复生命和强固, XX等于XX, 死亡创建物品, 蓄能获得生命or护甲, 充能闪避格挡', () => {
  it('生命药剂: 治愈 = 15 % × 品质 of the hero 最大生命 (XX等于XX); using it heals the hero; its death leaves a 空瓶', () => {
    const { w, calls, hero } = setup();
    const potion = spawnCard(w, '生命药剂');
    w.cult.获取牌(potion);
    const eq = skillOn(w, potion, '治愈等于生命上限');
    effectOn(w, 蓝图_效果_XX等于XX as unknown as BpCtor<蓝图_效果_XX等于XX>, eq, potion).持续中触发('效果.时机.创建时');
    // 0.15 normalises to 1.4999999999999998e-1 (科学数标准化), so the product is 22.499999999999996, as in the Demo
    expect(科学数变普通(获取科学映射词条(potion.词条, '治愈').输出值)).toBeCloseTo(22.5, 12);
    const use = skillOn(w, potion, '使用恢复生命', 蓝图_能力_恢复生命和强固 as unknown as BpCtor<蓝图_能力>);
    potion.当前目标 = hero;
    use.执行技能(false);
    expect(calls.heals).toHaveLength(1);
    expect(calls.heals[0]!.on).toBe(hero);
    expect(科学数变普通(calls.heals[0]!.heal.治疗整数)).toBeCloseTo(22.5, 12);
    expect(calls.heals[0]!.heal.生命护甲).toBe(false);
    expect(calls.heals[0]!.heal.触发次数).toBe(1);
    const bottle = skillOn(w, potion, '生成空瓶');
    const die = effectOn(w, 蓝图_效果_死亡创建物品 as unknown as BpCtor<蓝图_效果_死亡创建物品>, bottle, potion);
    die.激活后触发('');
    w.mode.当前死亡角色 = potion;
    die.持续中触发('效果.时机.死亡前');
    expect(calls.sideBar).toEqual([{ 名字: '空瓶', 品质: 1, cell: potion.所在起始格序号 }]);
    expect(die.计数).toBe(1); // 参数[0] = 0 + 1 × 等级
  });

  it('旧盾: charge completion shields the hero by 护甲 × 等级 and gives 每格挡层 Block stacks (cap 格挡层上限)', () => {
    for (const [q, armour] of [[1, 10], [3, 40]] as const) {
      const { w, calls, hero } = setup();
      const shield = spawnCard(w, '旧盾', q);
      w.cult.获取牌(shield);
      const gen = effectOn(w, 蓝图_效果_蓄能获得生命or护甲 as unknown as BpCtor<蓝图_效果_蓄能获得生命or护甲>, skillOn(w, shield, '生成护甲'), hero);
      const block = effectOn(w, 蓝图_效果_充能闪避格挡 as unknown as BpCtor<蓝图_效果_充能闪避格挡>, skillOn(w, shield, '获得格挡层'), hero);
      for (const e of [gen, block]) { e.触发次数 = 1; e.持续中触发('效果.时机.自身完成充能'); }
      expect(calls.heals.map(h => [h.on, 科学数变普通(h.heal.治疗整数), h.heal.生命护甲, h.heal.触发次数])).toEqual([[hero, armour, true, 1]]);
      const stacks = hero.拥有的效果.filter(e => e?.def.path.endsWith('蓝图_效果_精神状态_格挡'));
      expect(stacks).toHaveLength(1);
      expect(stacks[0]!.叠加层数).toBe(1);
      expect(stacks[0]!.拥有者).toBe(hero);
      expect(stacks[0]!.HasMatchingGameplayTag('效果.时机.装上')).toBe(true);
    }
  });
});

describe('tooltips at Bronze and Gold (the Demo strings, trailing-space rule)', () => {
  const tips = (w: InvWorld, card: BP_Actor_Card, rows: (keyof typeof 数据表_技能_修炼物品.rows)[]) => rows.map(r => describeSkill(skillOn(w, card, r)));

  it('旧剑', () => {
    for (const [q, dmg] of [[1, 20], [3, 80]] as const) {
      const { w } = setup();
      expect(tips(w, spawnCard(w, '旧剑', q), ['造成普伤'])).toEqual([`下 <天赋>3</> 次攻击额外造成 <天赋>${dmg}</> 伤害。`]);
    }
  });

  it('生命药剂 (hero 最大生命 150)', () => {
    for (const [q, heal, pct] of [[1, '22', '15%'], [3, '67', '45%']] as const) {
      const { w } = setup();
      const potion = spawnCard(w, '生命药剂', q);
      const eq = skillOn(w, potion, '治愈等于生命上限');
      effectOn(w, 蓝图_效果_XX等于XX as unknown as BpCtor<蓝图_效果_XX等于XX>, eq, potion).持续中触发('效果.时机.创建时');
      expect(tips(w, potion, ['使用恢复生命', '生成空瓶', '治愈等于生命上限'])).toEqual([
        `<强调>治愈</> <天赋>${heal}</> 。`, '创建空瓶。', `此物品的<强调>治愈</>等同 <天赋>${pct}</> 生命上限。`]);
    }
  });

  it('旧盾', () => {
    for (const [q, armour] of [[1, 10], [3, 40]] as const) {
      const { w } = setup();
      expect(tips(w, spawnCard(w, '旧盾', q), ['生成护甲', '获得格挡层'])).toEqual([`<强调>强固</> <天赋>${armour}</> 。`, '获得 <天赋>1</> 层<强调>格挡</>。']);
    }
  });
});

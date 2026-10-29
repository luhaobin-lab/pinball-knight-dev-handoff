import { describe, expect, it } from 'vitest';
import type { 结构_层组, 结构_技能, 结构_权重数据表 } from '../../src/content/demo/types.ts';
import { 拆分权重数据表, 权重选取 } from '../../src/core/math/prob.ts';
import { sciOf } from '../../src/core/math/sci.ts';
import { MakeRandomStream } from '../../src/core/rng/ue.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { TagSet } from '../../src/core/sim/tags.ts';
import { 合并权重掉落池, 获取层数品质 } from '../../src/core/sys/rewards/drops.ts';
import { dropPoolOf } from '../../src/core/sys/rewards/shared.ts';
import { chi2Bound, chiSquare, OTHER_HEROES, REWARD_TABLE, rewardWorld } from './fixture.ts';

const ROOMS = 'CatapultHero/数据表/地图/数据表_关卡_固定地点';
const TILES = 'CatapultHero/数据表/地图/数据表_地图格';

describe('复合奖励 drop pools (合并权重掉落池 + 权重选取 on 全局种子)', () => {
  const { w } = rewardWorld();
  const rooms = w.data.table(ROOMS)!.rows as Record<string, 结构_层组>;
  const cases = ['战斗房_简单', '战斗房_普通', '战斗房_困难', '战斗房_首领'].flatMap(r => rooms[r]!.层类型.map((l, i) => ({ room: r, i, l })));

  it('every combat layer has a non-empty merged pool (指定数据筛选 ++ 通用数据筛选 掉落池)', () => {
    for (const { l } of cases) {
      const merged = 合并权重掉落池(w.mode, [...l.指定数据筛选], [...l.通用数据筛选]).权重数据表数组;
      const general = l.通用数据筛选.flatMap(h => dropPoolOf(w, h)?.掉落池 ?? []);
      expect(merged).toEqual([...l.指定数据筛选, ...general]);
      expect(merged.some(e => e.权重 > 0)).toBe(true);
      expect(merged.slice(0, l.指定数据筛选.length)).toEqual(l.指定数据筛选);
    }
  });

  it('PROTOTYPE_SCOPE §7.2: 简单 / 普通 pools = 常见杂物 + 消耗品 + 无 + 4 monster parts at 50', () => {
    const l = rooms['战斗房_简单']!.层类型[0]!;
    const merged = 合并权重掉落池(w.mode, [...l.指定数据筛选], [...l.通用数据筛选]).权重数据表数组;
    const live = merged.filter(e => e.权重 > 0).map(e => `${e.数据表行.RowName}:${e.权重}`);
    expect(live).toEqual(expect.arrayContaining(['鲜血:25', '精矿:10', '空附魔石:75', '空瓶:25', '无字书:25']));
    expect(l.指定数据筛选.filter(e => e.权重 === 50)).toHaveLength(4);
  });

  it('sampling matches the weights: χ² over 10 000 seeded draws per pool', () => {
    let seed = 11;
    for (const { room, i, l } of cases) {
      const merged: 结构_权重数据表[] = 合并权重掉落池(w.mode, [...l.指定数据筛选], [...l.通用数据筛选]).权重数据表数组;
      const { 权重数组 } = 拆分权重数据表(merged);
      const s = MakeRandomStream(seed++);
      const counts = 权重数组.map(() => 0);
      for (let k = 0; k < 10_000; k++) counts[权重选取(权重数组, s)]! += 1;
      const r = chiSquare(counts, 权重数组);
      expect(r.zeroHits, `${room}[${i}] zero-weight rows`).toBe(0);
      expect(r.chi2, `${room}[${i}] χ²=${r.chi2.toFixed(1)} dof=${r.dof}`).toBeLessThan(chi2Bound(r.dof));
    }
  });
});

describe('宝箱房 offers (PROTOTYPE_SCOPE §7.4): hero filter, then 创建奖励 weights', () => {
  it('the Knight sees 废料 150, 小型/中型/大型 120, 武器/非武器 75, 护甲/格挡 50 and nothing else with weight', () => {
    const { w } = rewardWorld({ seed: 3 });
    const tile = (w.data.table(TILES)!.rows as Record<string, { 奖励类型: readonly 结构_权重数据表[]; 奖励等级: number }>)["宝箱房"]!;
    const skills = w.data.table(REWARD_TABLE)!.rows as Record<string, 结构_技能>;
    const others = OTHER_HEROES;
    // UI_地图格 L6058: rows whose 类型 has another hero's tag are dropped.
    const filtered = tile.奖励类型.filter(e => !new TagSet(skills[e.数据表行.RowName]!.类型).hasAny(others));
    const live = Object.fromEntries(filtered.filter(e => e.权重 > 0).map(e => [e.数据表行.RowName, e.权重]));
    expect(live).toEqual({
      获取物品_废料: 150, 获取物品_小型: 120, 获取物品_中型: 120, 获取物品_大型: 120,
      获取物品_武器: 75, 获取物品_非武器: 75, 获取物品_护甲: 50, 获取物品_格挡: 50,
    });
    const names = filtered.map(e => e.数据表行.RowName);
    const counts = names.map(() => 0);
    const task = { 奖励类型: filtered, 奖励等级: tile.奖励等级 } as unknown as Parameters<typeof w.mode.创建奖励>[0];
    for (let k = 0; k < 10_000; k++) {
      const { 实例 } = w.mode.创建奖励(task);
      counts[names.indexOf(w.mode.当前奖励配置.RowName)]! += 1;
      if (实例) w.destroy(实例);
    }
    const r = chiSquare(counts, filtered.map(e => e.权重));
    expect(r.zeroHits).toBe(0);
    expect(r.chi2).toBeLessThan(chi2Bound(r.dof));
  });

  it('创建奖励 spawns the row class with 等级 = min(奖励等级, 单次级别上限) and 初始化 copies the row', () => {
    const { w, hero } = rewardWorld();
    const h = { DataTable: REWARD_TABLE, RowName: '复合奖励' };
    const { 实例 } = w.mode.创建奖励({ 奖励类型: [{ 权重: 100, 数据表行: h }], 奖励等级: 3 } as never);
    expect(实例?.def.path).toBe('CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_复合奖励');
    expect(实例?.能力名).toBe('复合奖励');
    expect(实例?.拥有者).toBe(hero);
    expect(实例?.等级).toBe(Math.min(3, (w.data.table(REWARD_TABLE)!.rows as Record<string, 结构_技能>)['复合奖励']!.单次级别上限));
    expect(w.mode.当前奖励实例).toBe(实例);
  });
});

describe('currencies', () => {
  it('增加金币/收入 clamps 精核 to 0–999 and 感知 to 0–99; the hint only for positive 精核', () => {
    const { w } = rewardWorld();
    w.mode.金币 = 990;
    w.mode.增加金币_收入(false, true, 20, null);
    expect(w.mode.金币).toBe(999);
    w.mode.增加金币_收入(false, true, -2000, null);
    expect(w.mode.金币).toBe(0);
    w.mode.收入 = 95;
    w.mode.增加金币_收入(true, true, 10, null);
    expect(w.mode.收入).toBe(99);
    w.mode.增加金币_收入(true, true, -500, null);
    expect(w.mode.收入).toBe(0);
    const popups = w.events.drain().filter(e => e.kind === 'popup');
    expect(popups).toHaveLength(1);
  });

  it('掉落货币(n) spawns n + 1 灵魂碎片 for a hostile actor (QUIRK L226) and none for others', () => {
    const { w } = rewardWorld();
    const e = w.spawn(BP_Actor_Other);
    const shards = () => w.objects().filter(o => o.valid && o.def.path.endsWith('蓝图_货币')).length;
    e.掉落货币(3);
    expect(shards()).toBe(0);
    e.OwnedGameplayTags.add('可交互.角色.AI.仇恨');
    e.掉落货币(3);
    expect(shards()).toBe(4);
    expect(w.mode.场上可拾取物).toHaveLength(4);
  });

  it('a 灵魂碎片 is collected by the hero after 0.3 s: +1 Stamina, destroyed', () => {
    const { w, hero, log } = rewardWorld();
    const e = w.spawn(BP_Actor_Other);
    e.OwnedGameplayTags.add('可交互.角色.AI.仇恨');
    e.掉落货币(1); // 2 shards (n + 1)
    const shard = w.objects().find(o => o.def.path.endsWith('蓝图_货币')) as unknown as { 开始重叠(o: unknown): void; valid: boolean };
    hero.OwnedGameplayTags.add('可交互.角色.玩家');
    shard.开始重叠(hero);
    expect(shard.valid).toBe(true); // not initialised yet
    w.clock.advance(0.35);
    shard.开始重叠(hero);
    expect(shard.valid).toBe(false);
    expect(log).toContain(`修改体力点:${sciOf(1, 0).系数}`);
  });
});

describe('material drops (添加材料掉落)', () => {
  it('a normal 眼球 rolls 3 × 20 % over [铁矿, 灌草]; 10 000 kills give ≈ 0.6 materials each', () => {
    const { w } = rewardWorld({ seed: 5 });
    const eye = (w.data.table('CatapultHero/数据表/角色/数据表_敌人_普通')!.rows as Record<string, { 材料掉落: never[] }>)['眼球']!;
    const e = w.spawn(BP_Actor_Other);
    e.OwnedGameplayTags.add('可交互.角色.AI.仇恨');
    e.材料掉落 = eye.材料掉落;
    expect(eye.材料掉落).toHaveLength(1);
    w.mode.材料包.clear();
    for (let k = 0; k < 10_000; k++) w.mode.添加材料掉落(e);
    // QUIRK (L775): the name and the count come from two picks, so the sum is not the number of successes; the number of
    // settlements is.
    const flights = w.objects().filter(o => o.def.path.endsWith('蓝图_动画结算') && (o as unknown as { 延迟: number }).延迟 === 0.2).length;
    expect(flights / 10_000).toBeGreaterThan(0.55);
    expect(flights / 10_000).toBeLessThan(0.65);
  });

  it('a dropper without the item / AI tags drops nothing', () => {
    const { w, log } = rewardWorld();
    const e = w.spawn(BP_Actor_Other);
    e.材料掉落 = [{ '成长？': false, 数量: 3, 内容: [{ 权重: 100, 数据表行: { DataTable: null, RowName: '铁矿' } }], 概率: 1 }];
    w.mode.添加材料掉落(e);
    expect(log).not.toContain('开始动画结算');
  });
});

it('获取层数品质 = 层数 / 阈值 + 1 (integer division)', () => {
  const { w } = rewardWorld();
  expect([0, 23, 24, 47, 48].map(n => 获取层数品质(w.mode, n, 24))).toEqual([1, 1, 2, 2, 3]);
});

describe('感知 payout (SPEC-GAP: text rule R55, no code path in the Demo)', () => {
  it('pays 收入 as 精核 every 6 floors; the HUD dots count 当前总层数 % 6', async () => {
    const { 感知发放, 感知点数 } = await import('../../src/core/sys/rewards/drops.ts');
    const { w } = rewardWorld();
    w.mode.金币 = 0;
    w.mode.收入 = 5;
    const paid: number[] = [];
    for (let f = 1; f <= 12; f++) {
      w.mode.当前总层数 = f;
      if (感知发放(w.mode)) paid.push(f);
    }
    expect(paid).toEqual([6, 12]);
    expect(w.mode.金币).toBe(10);
    w.mode.当前总层数 = 8;
    expect(感知点数(w.mode)).toBe(2);
  });
});

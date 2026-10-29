import { describe, expect, it } from 'vitest';
import type { 结构_层组 } from '../../src/content/demo/types.ts';
import { routeCommand } from '../../src/core/api/compose.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { isHiddenInGame } from '../../src/core/sim/engine.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { registry } from '../../src/content/bp/index.ts';
import batch from '../../src/content/bp/batches/core-rewards.ts';
import type { 蓝图_奖励_复合奖励 } from '../../src/content/bp/Skill/Ability/奖励/蓝图_奖励_复合奖励.ts';
import type { 蓝图_能力_点击交互_打开盒子 } from '../../src/content/bp/Skill/Ability/道具/蓝图_能力_点击交互_打开盒子.ts';
import { 蓝图_效果_交互物被动 } from '../../src/content/bp/Skill/效果/道具/蓝图_效果_交互物被动.ts';
import { 蓝图_效果_物品被使用 } from '../../src/content/bp/Skill/效果/道具/蓝图_效果_物品被使用.ts';
import { 蓝图_效果_获取地图宝藏 } from '../../src/content/bp/Skill/效果/玩家/蓝图_效果_获取地图宝藏.ts';
import { PROP_TABLE, REWARD_TABLE, rewardWorld } from './fixture.ts';

const ROOMS = 'CatapultHero/数据表/地图/数据表_关卡_固定地点';

it('the batch registers the 14 classes of the card under their Demo paths', () => {
  expect(batch).toHaveLength(14);
  for (const c of batch) expect(registry.get(c.path)).toBe(c);
});

describe('Victory → loot → 结束当前层 (TF-TV-22 case a shape, turn doubles)', () => {
  it('获取地图宝藏 runs the tile reward 复合奖励: 1 s later a free 1-drop box opens; closing it ends the floor', () => {
    const { w, hero, ability, log } = rewardWorld({ seed: 21, tasks: { 未完成: false } });
    w.mode.当前层地图格配置表 = { DataTable: 'CatapultHero/数据表/地图/数据表_地图格', RowName: '简单战斗' };
    const reward = ability<蓝图_奖励_复合奖励>(REWARD_TABLE, '复合奖励', 1); // 奖励等级 1 (简单)
    const layer = (w.data.table(ROOMS)!.rows as Record<string, 结构_层组>)['战斗房_简单']!.层类型[0]!;
    reward.奖励配置(layer, 0);
    Object.assign(w.sys, { map: { ...w.sys.map, 当前所在格: () => ({ 奖励技能实例: reward, 已清理: false }) } });
    // 完成任务 attaches 获取地图宝藏 to the hero (core-turn); here the effect is spawned and activated directly.
    const fx = w.spawn(蓝图_效果_获取地图宝藏, e => { e.拥有者 = hero; });
    fx.激活效果('');
    expect(w.mode.玩家控制器!.玩家可与环境交互).toBe(true);
    expect(fx.valid).toBe(false); // destroyed after running the reward
    expect(w.modal.current).toBeNull();
    w.clock.advance(1.0);
    expect(w.modal.current?.kind).toBe('loot');
    const cells = (w.modal.current as { cells: readonly { row: string }[] }).cells;
    expect(cells).toHaveLength(1); // ceil(0.5 × 1)
    expect(w.cult.未拾取牌[0]?.当前价格).toBe(0); // free box
    expect(log).toContain('释放结束:复合奖励');
    expect(log).not.toContain('结束当前层:true');
    routeCommand(w, { type: 'loot.close' });
    expect(log.at(-1)).toBe('结束当前层:true');
    const order = log.filter(l => l.startsWith('销毁效果') || l.startsWith('生成卡牌') || l.startsWith('释放结束') || l.startsWith('结束当前层'));
    expect(order.map(l => l.split(':')[0])).toEqual(['销毁效果', '生成卡牌', '释放结束', '结束当前层']);
  });

  it('a boss-floor 复合奖励 draws 2 drops (lv 4) plus 破损的神像 while 永恒神像 is locked; on 首领战斗 closing gives 首领天赋获取', () => {
    const { w, hero, ability, log } = rewardWorld({ seed: 4 });
    const reward = ability<蓝图_奖励_复合奖励>(REWARD_TABLE, '复合奖励', 4);
    reward.奖励配置((w.data.table(ROOMS)!.rows as Record<string, 结构_层组>)['战斗房_首领']!.层类型[0]!, 0);
    w.mode.当前层配置 = { ...w.mode.当前层配置, 预览图标: 'CatapultHero/精灵片/_UI/敌人地图缩略_Sprite_5' };
    w.mode.当前层地图格配置表 = { DataTable: 'CatapultHero/数据表/地图/数据表_地图格', RowName: '首领战斗' };
    reward.执行技能(false);
    w.clock.advance(1.0);
    expect(reward.指定名组).toHaveLength(3);
    expect(reward.指定名组[2]).toBe('破损的神像');
    expect(log.filter(l => l.startsWith('生成卡牌'))).toHaveLength(3);
    routeCommand(w, { type: 'loot.close' });
    expect(hero.拥有的效果.some(e => e?.def.path.endsWith('蓝图_效果_首领天赋获取'))).toBe(true);
    expect(log).not.toContain('结束当前层:true');
  });
});

describe('room rewards and props', () => {
  it('初始奖励A gives +12 精核, 生命药剂 and 体力药剂 in the side bar, and ends the floor 1.2 s later', () => {
    const { w, ability, log } = rewardWorld();
    w.mode.金币 = 8;
    ability(REWARD_TABLE, '初始奖励A').执行技能(false);
    expect(w.mode.金币).toBe(20);
    expect(log.filter(l => l.startsWith('生成卡牌')).map(l => l.split(':')[1])).toEqual(['生命药剂', '体力药剂']);
    expect(w.cult.已装备牌.map(c => c?.名字)).toEqual(['生命药剂', '体力药剂']);
    expect(log).not.toContain('结束当前层:false');
    w.clock.advance(1.2);
    expect(log.slice(-2)).toEqual(['结束当前层:false', '释放结束:初始奖励A']);
  });

  it('a chest room completes its task: 任务宝箱 clears 未完成 and ends the hero action on the next tick', () => {
    const { w, ability, log } = rewardWorld({ tasks: { 未完成: true } });
    const chest = ability(PROP_TABLE, '交互任务宝箱');
    chest.执行技能(false);
    expect((w.mode.当前任务实例 as unknown as { 未完成: boolean }).未完成).toBe(false);
    expect(log).not.toContain('结束行动');
    w.clock.advance(1 / 60);
    expect(log).toContain('结束行动');
  });

  it('精核矿 gives 2–4 精核 and ends the hero action', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { w, ability, log } = rewardWorld({ seed });
      w.mode.金币 = 0;
      ability(PROP_TABLE, '精核矿').执行技能(false);
      expect(w.mode.金币).toBeGreaterThanOrEqual(2);
      expect(w.mode.金币).toBeLessThanOrEqual(4);
      expect(log).toContain('结束行动');
    }
  });

  it('获取经验 gives a whole 100–200 EXP; 获取精矿 creates 2 精矿 in the side bar', () => {
    const a = rewardWorld({ seed: 2 });
    a.ability(REWARD_TABLE, '获取经验').执行技能(false);
    const exp = Number(a.log.find(l => l.startsWith('增加经验'))!.split(':')[1]);
    expect(Number.isInteger(exp) && exp >= 100 && exp <= 200).toBe(true);
    const b = rewardWorld();
    b.ability(REWARD_TABLE, '获取精矿').执行技能(false);
    expect(b.log.filter(l => l.startsWith('生成卡牌')).map(l => l.split(':')[1])).toEqual(['精矿', '精矿']);
    expect(b.log).toContain('释放结束:获取精矿');
  });

  it('打开盒子 opens an item box; closing it starts combat and ends the hero action', () => {
    const { w, ability, log } = rewardWorld();
    w.mode.当前总层数 = 5;
    ability<蓝图_能力_点击交互_打开盒子>(PROP_TABLE, '点击交互_武器').执行技能(false);
    expect(w.modal.current?.kind).toBe('loot');
    routeCommand(w, { type: 'loot.close' });
    expect(log.slice(-2)).toEqual(['进入战斗状态', '结束行动']);
  });

  it('交互物被动 plays 可控反弹动画 on the prop when the hero bounces into it, with the normal flipped', () => {
    const { w, hero } = rewardWorld();
    const prop = w.spawn(BP_Actor_Other);
    const e = w.spawn(蓝图_效果_交互物被动, x => { x.拥有者 = prop; });
    hero.OwnedGameplayTags.add('可交互.角色.玩家');
    e.命中数据 = { ...e.命中数据, actor: hero, impactNormal: { x: 1, y: 0, z: 0 } };
    e.持续中触发('效果.时机.反弹时');
    const anim = prop.拥有的效果.find(x => x?.def.path.endsWith('蓝图_效果_可控反弹动画')) as 蓝图_效果 | undefined;
    expect(anim?.命中数据.impactNormal).toEqual({ x: -1, y: -0, z: -0 });
    expect(anim?.持续时长).toBe(1);
  });

  it('物品被使用 hides the prop, turns its collision off and moves it to 牌库坐标 after 1 s', () => {
    const { w } = rewardWorld();
    const prop = w.spawn(BP_Actor_Other);
    const e = w.spawn(蓝图_效果_物品被使用, x => { x.拥有者 = prop; });
    e.激活效果('');
    expect(isHiddenInGame(prop)).toBe(false);
    w.clock.advance(1.0);
    expect(isHiddenInGame(prop)).toBe(true);
    expect(prop.K2_GetActorLocation()).toEqual(w.mode.牌库坐标);
    expect(e.valid).toBe(false);
  });
});

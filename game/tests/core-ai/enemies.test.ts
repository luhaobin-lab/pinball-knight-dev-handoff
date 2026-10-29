/**
 * The seven classes of batch core-ai (pseudo labels cited per test) and a 10-round 眼球 room loop with doubles for the
 * turn machine (gauge, 执行AI行动, 进入战斗状态) and physics (the launch stops at once).
 */
import { describe, expect, it } from 'vitest';
import { 蓝图_能力_大肠酸液 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_大肠酸液.ts';
import { 蓝图_能力_弹射 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_弹射.ts';
import { 蓝图_能力_治愈_强固 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_治愈_强固.ts';
import { 蓝图_效果_弹射 } from '../../src/content/bp/Skill/效果/蓝图_效果_弹射.ts';
import { 蓝图_效果_意图 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_意图.ts';
import { 蓝图_效果_肉弹战车 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_肉弹战车.ts';
import { 蓝图_效果_血卵孵化 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_血卵孵化.ts';
import batch from '../../src/content/bp/batches/core-ai.ts';
import { registry } from '../../src/content/bp/index.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { Array_Random, makeRand15 } from '../../src/core/rng/ue.ts';
import { isHiddenInGame } from '../../src/core/sim/engine.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { ability, aiWorld, type AiTestWorld } from './helpers.ts';

const effectsOf = (a: BP_ManeActor, name: string): 蓝图_效果[] => a.拥有的效果.filter((e): e is 蓝图_效果 => !!e && e.valid && e.def.name === name);

describe('batch core-ai', () => {
  it('registers the 7 classes under their manifest paths', () => {
    expect(batch.map(c => c.path).sort()).toEqual([
      蓝图_效果_意图, 蓝图_效果_血卵孵化, 蓝图_效果_肉弹战车, 蓝图_效果_弹射, 蓝图_能力_弹射, 蓝图_能力_治愈_强固, 蓝图_能力_大肠酸液,
    ].map(c => c.path).sort());
    for (const c of batch) expect(registry.get(c.path)).toBe(c);
  });
});

describe('蓝图_能力_弹射 (ENEMY--053)', () => {
  it('被选中 (L4665): a combat-random spot of 5 becomes 目标位置; none → the zero vector (QUIRK)', () => {
    const t = aiWorld();
    const a = t.enemy('眼球', { x: 100, y: 100, z: 40 });
    const s = ability<蓝图_能力_弹射>(t, a, '眼球弹射');
    t.spots = [{ x: 150, y: 100, z: 5 }, { x: 115, y: 147, z: 5 }, { x: 60, y: 129, z: 5 }];
    a.当前目标 = a;
    const want = t.spots[Array_Random(makeRand15(t.w.rng.combat.state), t.spots)];
    s.被选中();
    expect(a.目标位置).toEqual(want);
    expect(a.当前目标).toBeNull();
    t.spots = [];
    s.被选中();
    expect(a.目标位置).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('检查子条件 (L5079): castable unless moving', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const s = ability(t, a, '眼球弹射');
    a.移动中 = true; s.检查子条件(); expect(s.子条件通过).toBe(false);
    a.移动中 = false; s.检查子条件(); expect(s.子条件通过).toBe(true);
  });

  it('执行技能 (L4342): 效果配置[0] then [1] on the owner; none for a dead owner', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const s = ability(t, a, '眼球弹射');
    s.执行技能(false);
    expect(t.called('激活效果').map(c => c[1])).toEqual(['蓝图_效果_弹射', '蓝图_效果_反弹时攻击']);
    const launch = effectsOf(a, '蓝图_效果_弹射')[0];
    expect(launch.来自技能).toBe(s);
    expect(launch.拥有者).toBe(a);
    const b = t.enemy('眼球'); const s2 = ability(t, b, '眼球弹射');
    b.死掉了 = true;
    s2.执行技能(false);
    expect(effectsOf(b, '蓝图_效果_弹射')).toEqual([]);
  });

  it('an existing instance of 效果配置[0] ends the skill (goto L5149)', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const s = ability(t, a, '眼球弹射');
    t.existing = t.w.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/蓝图_效果_冷却');
    s.执行技能(false);
    expect(t.called('激活效果')).toEqual([]);
  });
});

describe('蓝图_效果_弹射 (ENEMY--055)', () => {
  const launch = (t: AiTestWorld, a: BP_ManeActor) => {
    const s = ability(t, a, '眼球弹射');
    s.执行技能(false);
    return effectsOf(a, '蓝图_效果_弹射')[0] as 蓝图_效果_弹射;
  };

  it('L469: impulse 1500 × 冲击力 toward 目标位置, 移动中, then the stop gate after 0.2 s', () => {
    const t = aiWorld();
    const a = t.enemy('眼球', { x: 0, y: 0, z: 40 });
    a.目标位置 = { x: 0, y: 50, z: 5 };
    a.当前物理速度 = 0;
    const e = launch(t, a);
    expect(t.called('根据体重添加冲击')[0][2]).toEqual({ x: 0, y: 1500 * 60, z: 0 });
    expect(a.移动中).toBe(true);
    expect(e.轨迹).toBe(true); // 眼球弹射 参数[1] = 1
    t.w.clock.advance(0.1);
    expect(e.valid).toBe(true);
    t.w.clock.advance(0.2);
    expect(e.valid).toBe(false);
    expect(t.called('释放结束').map(c => c[1])).toEqual(['蓝图_能力_弹射']);
    expect(t.called('结束行动').map(c => c[1])).toEqual(['眼球']);
    expect(e.已完结).toBe(true);
  });

  it('L1888: an unstoppable, untired owner below 1000 uu/s is re-launched along its last bounce', () => {
    const t = aiWorld();
    const a = t.enemy('眼球包');
    a.目标位置 = { x: 1, y: 0, z: 0 };
    a.OwnedGameplayTags.add('状态.不可阻挡');
    a.疲劳 = 0; a.最大疲劳 = 2; a.当前物理速度 = 500;
    a.反弹角度历史.push({ x: 0, y: -1, z: 0 });
    const s = ability(t, a, '眼球弹射');
    s.执行技能(false);
    t.w.clock.advance(0.25);
    const kicks = t.called('根据体重添加冲击');
    expect(kicks.length).toBeGreaterThan(1);
    expect(kicks[1][2]).toEqual({ x: 0, y: -1000 * 60, z: 0 });
    a.疲劳 = 2; a.当前物理速度 = 3;
    t.w.clock.advance(0.05);
    expect(a.HasMatchingGameplayTag('状态.不可阻挡')).toBe(false);
    expect(t.called('结束行动')).toHaveLength(1);
  });
});

describe('蓝图_效果_肉弹战车 (ENEMY--056)', () => {
  it('发动肉弹 → attack on 创建时 → stop after 0.5 s: 退出攻击状态, the collision damage destroyed, 释放结束, 结束行动', () => {
    const t = aiWorld();
    const a = t.enemy('守门人');
    a.目标方向 = { x: 0, y: 2, z: 0 };
    a.当前物理速度 = 0;
    const s = ability(t, a, '肉弹战车');
    s.执行技能(false);
    const tank = effectsOf(a, '蓝图_效果_肉弹战车')[0] as 蓝图_效果_肉弹战车;
    expect(tank).toBeDefined();
    expect(t.called('根据体重添加冲击')[0][2]).toEqual({ x: 0, y: 1000 * 75, z: 0 });
    expect(t.called('激活效果').map(c => c[1])).toEqual(['蓝图_效果_肉弹战车', '蓝图_效果_碰撞伤害']);
    expect(t.called('发动攻击')).toHaveLength(1);
    expect(a.移动中).toBe(true);
    expect(a.HasMatchingGameplayTag('状态.不可阻挡')).toBe(true);
    const hit = tank.效果实例!;
    t.w.clock.advance(0.45);
    expect(tank.valid).toBe(true);
    t.w.clock.advance(0.1);
    expect(tank.valid).toBe(false);
    expect(hit.valid).toBe(false);
    expect(t.called('退出攻击状态')).toHaveLength(1);
    expect(a.HasMatchingGameplayTag('状态.不可阻挡')).toBe(false);
    expect(t.called('释放结束').map(c => c[1])).toEqual(['蓝图_能力_弹射']);
    expect(t.called('结束行动')).toHaveLength(1);
  });

  it('a dead owner ends it on the next tick (DoOnce)', () => {
    const t = aiWorld();
    const a = t.enemy('守门人');
    a.当前物理速度 = 800;
    ability(t, a, '肉弹战车').执行技能(false);
    const tank = effectsOf(a, '蓝图_效果_肉弹战车')[0];
    a.死掉了 = true;
    t.w.clock.advance(0.05);
    expect(tank.valid).toBe(false);
    expect(t.called('结束行动')).toHaveLength(1);
  });
});

describe('蓝图_能力_治愈_强固 (ENEMY--060)', () => {
  it('L129: heals by the 治愈 stat (not shield), ends 0.5 s later', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const s = ability<蓝图_能力_治愈_强固>(t, a, '自愈');
    s.执行技能(false);
    expect(t.called('获得治疗')).toEqual([['获得治疗', '眼球', 25, false, true, false]]);
    t.w.clock.advance(0.4);
    expect(t.called('结束行动')).toEqual([]);
    t.w.clock.advance(0.2);
    expect(t.called('释放结束')).toHaveLength(1);
    expect(t.called('结束行动')).toHaveLength(1);
  });

  it('铸甲 (词条 护甲) shields and is always castable', () => {
    const t = aiWorld();
    const a = t.enemy('结晶');
    const s = ability(t, a, '铸甲');
    a.生命百分比 = 1; s.检查子条件();
    expect(s.子条件通过).toBe(true);
    s.执行技能(false);
    expect(t.called('获得治疗')[0][3]).toBe(true);
  });
});

describe('蓝图_效果_血卵孵化 (enemies-intestine)', () => {
  it('on expiry: U[0.1,0.3] s → a hidden 大肠 at the egg, the egg dies; 0.6 s → shown, collision on, its action ended', () => {
    const t = aiWorld();
    const egg = t.enemy('大肠血卵', { x: 64, y: 128, z: 55 });
    const e = t.w.spawn<蓝图_效果_血卵孵化>(蓝图_效果_血卵孵化.path, x => { x.拥有者 = egg; x.持续回合 = 2; });
    egg.拥有的效果.push(e);
    e.激活效果('');
    expect(e.销毁延迟).toBe(1.0);
    e.销毁效果();
    expect(t.called('召唤角色到场上')).toEqual([]);
    t.w.clock.advance(0.3);
    expect(t.called('召唤角色到场上')).toEqual([['召唤角色到场上', '大肠', { x: 64, y: 128, z: 55 }]]);
    expect(科学数变普通(egg.当前生命)).toBe(0);
    expect(t.called('检查死亡')).toEqual([['检查死亡', '大肠血卵', false, false]]);
    expect(egg.指定死亡文本.zh).toBe('大肠血卵孵化出了大肠。');
    t.w.clock.advance(0.6);
    expect(t.called('开启碰撞').map(c => c[1])).toEqual(['大肠']);
    expect(t.called('结束行动').map(c => c[1])).toEqual(['大肠']);
    const maggot = t.w.objects().find(o => (o as BP_ManeActor).名字 === '大肠')!;
    expect(isHiddenInGame(maggot)).toBe(false);
  });
});

describe('蓝图_能力_大肠酸液', () => {
  it('被选中 (L208) then 执行技能 (L1243): 疲劳了 false, 0.3 s → 地形管理组 主动激活, 释放结束, 结束行动', () => {
    const t = aiWorld();
    const a = t.enemy('大肠');
    const s = ability<蓝图_能力_大肠酸液>(t, a, '大肠酸液');
    s.被选中();
    const fired: string[] = [];
    const group = t.w.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/物品/蓝图_效果_地形管理组');
    group.持续中触发 = (tag: string) => { fired.push(tag); };
    s.地形管理组 = group;
    a.疲劳了 = true;
    s.执行技能(false);
    expect(a.疲劳了).toBe(false);
    t.w.clock.advance(0.25);
    expect(fired).toEqual([]);
    t.w.clock.advance(0.1);
    expect(fired).toEqual(['效果.时机.主动激活']);
    expect((group as unknown as { 销毁结束技能释放: boolean }).销毁结束技能释放).toBe(true);
    expect(t.called('释放结束')).toHaveLength(1);
    expect(t.called('结束行动')).toHaveLength(1);
  });

  it('without a 地形管理组 the skill still ends (SPEC-GAP: the indicator that creates it is unported)', () => {
    const t = aiWorld();
    const a = t.enemy('大肠');
    ability(t, a, '大肠酸液').执行技能(false);
    t.w.clock.advance(0.5);
    expect(t.called('结束行动')).toHaveLength(1);
  });
});

describe('a 眼球 room (two 眼球) runs 10 rounds without a stall', () => {
  it('intent → combat → casts → every caster ends its action, each round', () => {
    const t = aiWorld({
      ability: { 蓝图_能力: { 释放开始(a) { a.执行技能(false); } } }, // ENEMY--023 (cooldowns and stagger are core-ability / core-turn)
    });
    const m = t.w.mode;
    const eyes = [t.enemy('眼球', { x: -100, y: 0, z: 40 }), t.enemy('眼球', { x: 100, y: 0, z: 40 })];
    for (const e of eyes) { ability(t, e, '眼球弹射'); ability(t, e, '自愈'); e.当前物理速度 = 0; e.生命百分比 = 0.5; m.场上所有.push(e); }
    t.spots = [{ x: 0, y: 64, z: 5 }];
    for (let round = 1; round <= 10; round++) {
      m.可行动角色.length = 0;
      for (const e of eyes) { e.当前行动力 = 100; m.可行动角色.push(e); } // 增长行动度 + 判断行动力 (module turn)
      m.预测AI行动();
      for (const e of eyes) {
        expect(e.当前能力, `round ${round}`).not.toBeNull();
        expect(e.拥有的效果.some(x => x instanceof 蓝图_效果_意图 && x.valid)).toBe(true);
      }
      for (const e of eyes) for (const x of [...e.拥有的效果]) if (x?.HasMatchingGameplayTag('效果.时机.进入战斗时')) x.持续中触发('效果.时机.进入战斗时'); // 进入战斗状态
      m.AI行动前();
      const before = t.called('结束行动').length;
      for (const e of [...m.可行动角色]) e!.当前能力!.释放开始(); // 执行AI行动 (stagger 0)
      // advance frame by frame: the launch ends on a (weak) tick, which runUntil alone would report as idle (see needs)
      let frames = 0;
      while (t.called('结束行动').length - before < eyes.length && frames < 300) { t.w.clock.advance(1 / 60); frames++; }
      expect(frames, `round ${round}`).toBeLessThan(300);
      for (const e of eyes) { expect(e.当前能力).toBeNull(); e.移动中 = false; }
    }
    expect(t.called('结束行动')).toHaveLength(20);
  });
});

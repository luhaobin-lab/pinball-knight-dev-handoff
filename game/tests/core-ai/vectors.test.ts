/**
 * EAI-TV vectors (spec-drafts/enemy-ai-intents.md §15) owned by module `ai`: growth (27–30), elites (33–37), selection
 * and skips (06, 11–15), intents (17–26), custom monster attributes (43). The gauge (01–05), the cast loop and its stagger
 * (16), cooldown ticking (08–10), the spawn draws (31, 32, 45) and the affix behaviours (38–42) belong to other cards
 * (turn, ability, wave-B enemy-elites) and are listed in the result.
 */
import { describe, expect, it } from 'vitest';
import { 蓝图_效果_意图 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_意图.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { sciOf, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值, 获取科学映射词条 } from '../../src/core/math/stats.ts';
import { Array_Random, makeRand15 } from '../../src/core/rng/ue.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { ability, aiWorld } from './helpers.ts';

const num = (a: BP_ManeActor, s: string): number => 科学数变普通(获取科学映射词条(a.词条, s).输出值);
const setStat = (a: BP_ManeActor, s: string, v: number): void => 添加科学映射值(a.词条, s, '', sciOf(v, 0), false);
const intentOf = (a: BP_ManeActor): 蓝图_效果_意图 | undefined =>
  a.拥有的效果.find((e): e is 蓝图_效果_意图 => e instanceof 蓝图_效果_意图 && e.valid);

describe('growth (ENEMY--073…075)', () => {
  it('EAI-TV-27: g at node level 1, 通过关卡数 0', () => {
    const t = aiWorld();
    const g = (n: number): number => { t.w.mode.当前总层数 = n; return t.w.mode.获取当前层成长率(-1, 0).OutXY; };
    const want: Record<number, number> = { 0: 0.05, 1: 0.0530691, 6: 0.0866388, 12: 0.2, 30: 0.5917335, 60: 1.0, 72: 1.0 };
    for (const [n, v] of Object.entries(want)) expect(g(Number(n))).toBeCloseTo(v, 6);
  });

  it('EAI-TV-28: loops, endless mode and node levels', () => {
    const t = aiWorld();
    const m = t.w.mode;
    const cases = [
      { n: 1, loops: 1, endless: false, level: 1, g: 0.0955245 },
      { n: 1, loops: 1, endless: true, level: 1, g: 0.1061383 },
      { n: 6, loops: 0, endless: false, level: 3, g: 0.2599165 },
      { n: 12, loops: 0, endless: false, level: 4, g: 0.8 },
      { n: 12, loops: 0, endless: false, level: 5, g: 0.0 },
    ];
    for (const c of cases) {
      m.当前总层数 = c.n; m.通过关卡数 = c.loops; m.无尽模式 = c.endless;
      expect(m.获取当前层成长率(c.level, 0).OutXY).toBeCloseTo(c.g, 6);
    }
  });

  it('EAI-TV-29: 成长属性 normal, elite (力场), elite (强韧)', () => {
    const t = aiWorld({
      ability: {
        BP_ManeActor: {
          添加技能(self, h) { if (h.RowName === '强韧') 添加科学映射值(self.词条, '额外生命%', '强韧', sciOf(0.25, 0), false); },
        },
      },
    });
    const grow = (elite: boolean, affix: string | null): BP_ManeActor => {
      const a = t.enemy('眼球');
      a.成长率 = 0.2; a.是精英 = elite;
      a.随机精英技能 = affix ? [{ DataTable: 'CatapultHero/数据表/技能/数据表_技能_默认', RowName: affix }] : [];
      a.成长属性();
      return a;
    };
    const n = grow(false, null);
    expect(num(n, '基础伤害')).toBeCloseTo(36.0, 4);
    expect(科学数变普通(n.当前最大生命)).toBeCloseTo(50.7, 4);
    expect(num(n, '治愈')).toBeCloseTo(32.5, 4);
    expect(num(n, '经验')).toBe(50);
    expect(num(n, '魔力')).toBe(30); // QUIRK: the elite ×2 of 魔力 / 最大魔力 is lost
    const e = grow(true, '力场');
    expect(num(e, '基础伤害')).toBeCloseTo(43.2, 4);
    expect(科学数变普通(e.当前最大生命)).toBeCloseTo(101.4, 4);
    expect(num(e, '经验')).toBe(100);
    expect(num(e, '最大魔力')).toBe(30);
    const tough = grow(true, '强韧');
    expect(科学数变普通(tough.当前最大生命)).toBeCloseTo(126.75, 4);
    expect(科学数变普通(tough.当前生命)).toBeCloseTo(126.75, 4);
    expect(tough.生命百分比).toBe(1);
  });

  it('EAI-TV-30: the difficulty-star growth preview (g\' and the four numbers before formatting)', () => {
    const t = aiWorld();
    t.w.mode.当前总层数 = 0; t.w.mode.通过关卡数 = 0;
    const g = t.w.mode.获取当前层成长率(0 + 1, 0 * 12 + 12 - 0).OutXY;
    expect(g).toBeCloseTo(0.2, 6);
    expect(30 * (g + 1)).toBeCloseTo(36, 4);
    expect(30 * (1.5 * g + 1) ** 2).toBeCloseTo(50.7, 4);
  });

  it('函数库_工具.乘数强化属性 and BP_ManeActor.乘数强化属性 (CORE-M-109, line 4907)', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    a.成长率 = 0.2; a.等级 = 1;
    expect(科学数变普通(a.乘数强化属性(sciOf(30, 0), 1.5, 1).强化后)).toBeCloseTo(30 * (1.5 * 0.2 * 2 + 1), 6);
    expect(t.w.sys.ai.函数库_工具!.乘数强化属性!(a, 10, 1.5, 0.2, 1).强化后).toBeCloseTo(13, 6);
  });
});

describe('elites (ENEMY--079/080)', () => {
  const setup = (floor: number, chance: number, cap: number, acc: number, count: number, task: string) => {
    const t = aiWorld();
    const m = t.w.mode;
    m.当前总层数 = floor; m.精英几率累加 = acc; m.当前层精英数量 = count;
    m.当前层配置 = { ...m.当前层配置, 精英几率: chance, 精英上限: cap };
    const mission = t.w.spawn('CatapultHero/BP/Skill/蓝图_能力', x => { (x as unknown as { 能力名: string }).能力名 = task; });
    m.当前任务实例 = mission;
    return t;
  };

  it('EAI-TV-33: roll 1 succeeds (accumulator reset), roll 2 at the base chance fails', () => {
    const t = setup(6, 0.05, 1, 0, 0, '消灭所有敌人');
    t.rolls.push(0.01, 0.5);
    expect(t.w.mode.精英化敌人()).toBe(false);
    expect(t.w.mode.精英几率累加).toBe(0);
    expect(t.called('传统概率判断').map(c => c[1])).toEqual([0.05, 0.05]);
  });

  it('EAI-TV-34: roll 1 fails, the accumulator grows, roll 2 at 0.1 succeeds', () => {
    const t = setup(6, 0.05, 1, 0, 0, '消灭所有敌人');
    t.rolls.push(0.9, 0.07);
    expect(t.w.mode.精英化敌人()).toBe(true);
    expect(t.w.mode.精英几率累加).toBeCloseTo(0.05, 12);
    expect(t.called('传统概率判断').map(c => c[1])).toEqual([0.05, expect.closeTo(0.1, 12)]);
  });

  it('EAI-TV-35: floor ≤ 3, the cap, and a non-kill task', () => {
    const a = setup(3, 0.05, 2, 0.1, 0, '消灭所有敌人');
    a.rolls.push(0, 0);
    expect(a.w.mode.精英化敌人()).toBe(false);
    expect(a.w.mode.精英几率累加).toBeCloseTo(0.1, 12);
    const b = setup(8, 0.05, 1, 0.2, 1, '消灭所有敌人');
    b.rolls.push(0, 0);
    expect(b.w.mode.精英化敌人()).toBe(false);
    expect(b.w.mode.精英几率累加).toBeCloseTo(0.25, 12);
    const c = setup(8, 0.05, 1, 0.2, 0, '探索房间');
    c.rolls.push(0.9, 0.9);
    expect(c.w.mode.精英化敌人()).toBe(false);
    expect(c.w.mode.精英几率累加).toBeCloseTo(0.2, 12);
    expect(a.called('传统概率判断')).toHaveLength(2);
  });

  it('EAI-TV-36: the 战斗房_困难 [0] sequence (two 眼球 rolls, then the forced 眼球包)', () => {
    const t = setup(8, 0.05, 2, 0, 0, '消灭所有敌人');
    t.rolls.push(0.9, 0.01, 0.9, 0.01, 0.9, 0.01);
    const m = t.w.mode;
    const elite1 = m.精英化敌人(); m.当前层精英数量 += Number(elite1); // 添加到牌库 counts Conv_BoolToInt(是精英？)
    const elite2 = m.精英化敌人(); m.当前层精英数量 += Number(elite2);
    const elite3 = m.精英化敌人(); m.当前层精英数量 += 1; // 噩梦: forced elite by 初始化
    expect([elite1, elite2, elite3]).toEqual([true, true, false]);
    expect(m.当前层精英数量).toBe(3);
    expect(m.精英几率累加).toBeCloseTo(0.15, 12);
  });

  it('EAI-TV-37: one affix from the row pool (combat Array_Random), added as a skill', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    a.是精英 = true;
    const g = makeRand15(t.w.rng.combat.state);
    const want = a.随机精英技能[Array_Random(g, a.随机精英技能)].RowName;
    a.成长属性();
    expect(t.called('添加技能').map(c => c[2])).toEqual([want]);
    expect(a.拥有的主动能力).toEqual([]);
  });

  it('forced elites and normal rows without a pool get no affix', () => {
    const t = aiWorld();
    const a = t.enemy('眼球包');
    a.是精英 = true;
    a.成长属性();
    expect(t.called('添加技能')).toEqual([]);
  });
});

describe('selection (ENEMY--027…036)', () => {
  it('EAI-TV-06: every active blocked → 跳过本回合: gauge kept, out of 可行动角色, no 结束行动', () => {
    const t = aiWorld();
    const a = t.enemy('大肠');
    const s1 = ability(t, a, '大肠弹射'); const s2 = ability(t, a, '大肠酸液');
    s1.冷却效果 = s2.冷却效果 = t.w.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/蓝图_效果_冷却');
    a.当前行动力 = 120;
    t.w.mode.可行动角色.push(a);
    t.w.mode.预测AI行动();
    expect(a.当前能力).toBeNull();
    expect(a.当前行动力).toBe(120);
    expect(a.疲劳了).toBe(true);
    expect(t.w.mode.可行动角色).toEqual([]);
    expect(t.called('结束行动')).toEqual([]);
    expect(intentOf(a)).toBeUndefined();
  });

  it('EAI-TV-11: 治愈_强固 sub-condition at 生命百分比 0.8 / 0.79 / 1.0', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const heal = ability(t, a, '自愈');
    const r = [0.8, 0.79, 1.0].map(p => { a.生命百分比 = p; heal.检查子条件(); return heal.子条件通过; });
    expect(r).toEqual([false, true, false]);
  });

  it('EAI-TV-12: 选择技能 picks uniformly (combat Array_Random), 被选中, rotation step, the intent', () => {
    const t = aiWorld();
    const a = t.enemy('眼球', { x: 100, y: 0, z: 40 });
    const s1 = ability(t, a, '眼球弹射'); const s2 = ability(t, a, '自愈');
    a.可释放能力.push(s1, s2);
    const want = a.可释放能力[Array_Random(makeRand15(t.w.rng.combat.state), a.可释放能力)];
    a.选择技能();
    expect(a.当前能力).toBe(want);
    expect(a.当前能力备份).toBe(want);
    const intent = intentOf(a)!;
    expect(intent).toBeDefined();
    expect(intent.widgetPage).toBe(want === s1 ? 0 : 1);
    expect(intent.拥有者).toBe(a);
    expect(t.called('激活效果').map(c => c[1])).toEqual(['蓝图_效果_意图']);
  });

  it('EAI-TV-13: 技能距离 is not read by the AI path', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const s = ability(t, a, '眼球弹射');
    s.技能距离 = 110; a.与目标距离 = 1000;
    t.w.mode.可行动角色.push(a);
    t.w.mode.预测AI行动();
    expect(a.当前能力).toBe(s);
  });

  it('EAI-TV-14: 幽焰龙 rotation [1, 0, 2, 3] over five selections', () => {
    const t = aiWorld();
    const a = t.enemy('幽焰龙');
    const names = ['肉弹战车', '首领_幽焰龙_火环', '首领_幽焰龙_闪现', '首领_幽焰龙_召唤齐刘海'];
    for (const n of names) ability(t, a, n);
    const picked: string[] = []; const idx: number[] = []; const sizes: number[] = [];
    for (let k = 0; k < 5; k++) {
      a.当前能力 = null;
      a.检查技能条件();
      sizes.push(a.可释放能力.length);
      picked.push(a.当前能力!.能力名);
      idx.push(a.当前预制技能序号);
    }
    expect(picked).toEqual(['首领_幽焰龙_火环', '肉弹战车', '首领_幽焰龙_闪现', '首领_幽焰龙_召唤齐刘海', '首领_幽焰龙_火环']);
    expect(idx).toEqual([1, 2, 3, 0, 1]);
    expect(sizes).toEqual([1, 1, 1, 1, 1]);
  });

  it('EAI-TV-15: 结晶骑士 at step 3 with 反击（主动） on cooldown skips and keeps the step', () => {
    const t = aiWorld();
    const a = t.enemy('结晶骑士');
    const names = ['肉弹战车', '旋风地震', '首领_结晶骑士_结晶', '反击（主动）'];
    const abs = names.map(n => ability(t, a, n));
    abs[3].冷却效果 = t.w.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/蓝图_效果_冷却');
    a.当前预制技能序号 = 3; a.当前行动力 = 100;
    t.w.mode.可行动角色.push(a);
    t.w.mode.预测AI行动();
    expect(a.可释放能力).toEqual([]);
    expect(a.当前能力).toBeNull();
    expect(a.当前预制技能序号).toBe(3);
    expect(a.当前行动力).toBe(100);
    expect(intentOf(a)).toBeUndefined();
  });

  it('预测AI行动 keeps an existing intent and iterates a copy of 可行动角色', () => {
    const t = aiWorld();
    const a = t.enemy('眼球'); const b = t.enemy('大肠');
    const kept = ability(t, a, '眼球弹射'); ability(t, b, '大肠弹射');
    a.当前能力 = kept;
    t.w.mode.可行动角色.push(a, b);
    t.w.mode.预测AI行动();
    expect(a.当前能力).toBe(kept);
    expect(intentOf(a)).toBeUndefined();
    expect(b.当前能力!.能力名).toBe('大肠弹射');
  });

  it('交互-typed actives are skipped', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const s = ability(t, a, '眼球弹射');
    s.类型.add('能力.类型.交互');
    a.检查技能条件();
    expect(a.当前能力).toBeNull();
  });
});

describe('intents (ENEMY--041…048)', () => {
  const pick = (t: ReturnType<typeof aiWorld>, a: BP_ManeActor, row: string, types?: string[]) => {
    const s = ability(t, a, row);
    if (types) { for (const x of s.类型.toArray()) s.类型.remove(x); for (const x of types) s.类型.add(x); }
    a.可释放能力.length = 0; a.可释放能力.push(s);
    for (const e of [...a.拥有的效果]) if (e instanceof 蓝图_效果_意图) a.拥有的效果.splice(a.拥有的效果.indexOf(e), 1);
    a.选择技能();
    return intentOf(a)!;
  };

  it('EAI-TV-17: page by the first 类型 tag', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const rows = ['眼球弹射', '自愈', '铸甲', '齐刘海闪现', '召唤水母脑', '举盾'];
    const pages = rows.map(r => pick(t, a, r).widgetPage);
    expect(pages).toEqual([0, 1, 2, 3, 3, 3]);
    expect(pick(t, a, '齐刘海闪现').widgetText).toBe('');
  });

  it('EAI-TV-18 / 19: 眼球 attack 36 and heal 26.9901 → "36", "27"', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    setStat(a, '基础伤害', 36.0);
    setStat(a, '治愈', 26.9901);
    expect(pick(t, a, '眼球弹射').widgetText).toBe('36');
    const h = pick(t, a, '自愈');
    expect([h.widgetPage, h.widgetText]).toEqual([1, '27']);
  });

  it('EAI-TV-20: 大肠 基础伤害 27.166 → 大肠弹射 "27", 大肠酸液 "7"', () => {
    const t = aiWorld();
    const a = t.enemy('大肠');
    setStat(a, '基础伤害', 27.166);
    expect(pick(t, a, '大肠弹射').widgetText).toBe('27');
    expect(pick(t, a, '大肠酸液').widgetText).toBe('7');
  });

  it('EAI-TV-21 / 22: 连击-typed attack text', () => {
    const t = aiWorld();
    const a = t.enemy('结晶簇');
    setStat(a, '基础伤害', 26.0793);
    expect(pick(t, a, '发射8个晶刺').widgetText).toBe('261');
    setStat(a, '基础伤害', 30);
    setStat(a, '连击', 3);
    expect(pick(t, a, '发射8个晶刺').widgetText).toBe('300×3');
    setStat(a, '连击', 1);
    expect(pick(t, a, '发射8个晶刺').widgetText).toBe('300');
  });

  it('EAI-TV-23: 大肠弹射 text at n = 2, 3, 7, 8, 12 (growth → 成长属性 → intent)', () => {
    const out = [2, 3, 7, 8, 12].map(n => {
      const t = aiWorld();
      t.w.mode.当前总层数 = n;
      const a = t.enemy('大肠');
      a.成长率 = t.w.mode.获取当前层成长率(-1, 0).OutXY;
      a.成长属性();
      return pick(t, a, '大肠弹射').widgetText;
    });
    expect(out).toEqual(['26', '27', '27', '28', '30']);
  });

  it('EAI-TV-24: placement Snap4(owner + (高度 + 15, 0, 200))', () => {
    const t = aiWorld();
    const a = t.enemy('眼球', { x: 1000, y: 500, z: 40 });
    const i = pick(t, a, '眼球弹射');
    expect(i.K2_GetActorLocation()).toEqual({ x: 1056, y: 500, z: 240 });
  });

  it('EAI-TV-25 / 26: hidden and destroyed on 进入战斗时 or 死亡前, ignores 新一天时, the skill is kept', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const i = pick(t, a, '眼球弹射');
    i.持续中触发('效果.时机.新一天时');
    expect(i.valid && i.widgetVisible).toBe(true);
    i.持续中触发('效果.时机.进入战斗时');
    expect(i.valid).toBe(false);
    expect(i.widgetVisible).toBe(false);
    expect(a.当前能力!.能力名).toBe('眼球弹射');
    const j = pick(t, a, '眼球弹射');
    j.持续中触发('效果.时机.死亡前');
    expect(j.valid).toBe(false);
  });

  it('an existing unique intent is re-activated instead of a second one (ENEMY--048)', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const first = pick(t, a, '眼球弹射');
    t.existing = first;
    a.选择技能();
    expect(a.拥有的效果.filter(e => e instanceof 蓝图_效果_意图)).toHaveLength(1);
    expect(t.called('激活效果')).toHaveLength(2);
  });

  it('no intent for a dead owner', () => {
    const t = aiWorld();
    const a = t.enemy('眼球');
    const s = ability(t, a, '眼球弹射');
    a.可释放能力.push(s); a.死掉了 = true;
    a.选择技能();
    expect(intentOf(a)).toBeUndefined();
    expect(a.当前能力).toBe(s);
  });
});

describe('custom monster attributes (ENEMY--090)', () => {
  it('EAI-TV-43', () => {
    const t = aiWorld();
    const x = t.enemy('重生傀儡');
    const m = t.w.mode;
    m.写入怪物自定义属性(x, '电量', 3.0, false);
    m.写入怪物自定义属性(x, '电量', 3.0, false);
    expect(m.查询怪物自定义属性(x, '电量')).toEqual({ 值: 6.0, 存在: true });
    m.写入怪物自定义属性(x, '电量', 0.0, true);
    expect(m.查询怪物自定义属性(x, '电量')).toEqual({ 值: 0.0, 存在: true });
    expect(m.查询怪物自定义属性(x, '温度')).toEqual({ 值: 0, 存在: false });
    expect(m.怪物自定义属性映射.size).toBe(1);
  });
});

describe('AI行动前 (ENEMY--021)', () => {
  it('fires 效果.时机.AI行动前 on every field actor in order', () => {
    const t = aiWorld();
    const a = t.enemy('眼球'); const b = t.enemy('大肠');
    const seen: string[] = [];
    for (const who of [a, b]) {
      const e = t.w.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/蓝图_效果_冷却', x => { x.拥有者 = who; x.OwnedGameplayTags.add('效果.时机.AI行动前'); });
      e.持续中触发 = (tag: string) => { seen.push(`${who.名字}:${tag}:${e.触发时机}`); };
      who.拥有的效果.push(e);
    }
    t.w.mode.场上所有.push(a, b);
    t.w.mode.AI行动前();
    expect(seen).toEqual(['眼球:效果.时机.AI行动前:效果.时机.AI行动前', '大肠:效果.时机.AI行动前:效果.时机.AI行动前']);
  });
});

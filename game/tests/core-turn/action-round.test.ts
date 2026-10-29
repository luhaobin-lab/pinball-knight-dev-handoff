/**
 * TF-TV-13, 14, 15, 16, 17, 26, 33, 34, 38: the launch gate, action end and its barrier, the AI hook, the round end
 * and its re-entrancy (turn-flow §4.5–§4.8). The hero passive (core-stamina) is a recording double.
 */
import { describe, expect, it } from 'vitest';
import { harness, 测试能力, type Harness } from './harness.ts';
import { frame } from '../../src/core/sys/turn/util.ts';
import { BP_Mission } from '../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';

/** 蓝图_效果_玩家被动 on 行动结束后 (TURN-052): −5 Stamina, then 执行AI行动 when the cached flag says so. */
function passive(h: Harness): void {
  h.effect(h.hero, 'P', ['效果.时机.行动结束后'], {
    hook: () => {
      h.calls.push('P: −5 体力');
      if (h.w.mode.场上有敌人) { h.calls.push('执行AI行动'); h.w.mode.执行AI行动(); }
    },
  });
}

function withMission(h: Harness): BP_Mission {
  const m = h.w.spawn(BP_Mission, x => { x.拥有者 = h.hero; x.能力名 = '消灭所有敌人'; });
  m.类型.add('能力.类型.任务.杀敌');
  h.w.mode.当前任务实例 = m;
  return m;
}

describe('TURN-042/043 the launch gate on release', () => {
  it('TF-TV-13: release in phase 2 with input on launches; phase 3, input off, or an interactable under the cursor do not', () => {
    const cases: { phase: '交互场牌' | '进行战斗'; input: boolean; target: boolean; want: string }[] = [
      { phase: '交互场牌', input: true, target: false, want: 'launch' },
      { phase: '进行战斗', input: true, target: false, want: 'none' },
      { phase: '交互场牌', input: false, target: false, want: 'none' },
      { phase: '交互场牌', input: true, target: true, want: 'interact' },
    ];
    for (const c of cases) {
      const h = harness();
      withMission(h);
      const m = h.w.mode;
      m.当前环节 = c.phase;
      m.玩家控制器!.玩家可与环境交互 = c.input;
      const chest = h.enemy('任务宝箱');
      chest.OwnedGameplayTags.remove('可交互.角色.AI.仇恨');
      chest.OwnedGameplayTags.add('可交互.角色.AI.物品.关卡');
      m.场上所有.push(chest);
      const r = c.target ? h.w.sys.turn.commands!.interact!(h.w, { type: 'interact', actor: chest.id }) : h.w.sys.turn.commands!['aim.release']!(h.w, { type: 'aim.release', aim: { x: 100, y: 0 } });
      expect(r.ok).toBe(c.input); // The command adapter rejects a closed input gate; the source controller still ignores it.
      const got = h.calls.find(s => s.startsWith('使目标执行自身技能')) ?? 'none';
      expect(got).toBe(c.want === 'launch' ? '使目标执行自身技能(0, 幽冥骑士)' : c.want === 'interact' ? '使目标执行自身技能(0, 任务宝箱)' : 'none');
    }
  });

  it('TURN-053 (b): a failed release in phase 2 is a full hero action end (打断当前动画(true) → 打断技能(true))', () => {
    const h2 = harness();
    withMission(h2);
    const m = h2.w.mode;
    m.当前环节 = '交互场牌';
    m.玩家控制器!.玩家可与环境交互 = true;
    const ab = (h2.w.sys.ability.函数库_工具 as Record<string, unknown>);
    ab.使目标执行自身技能 = () => ({ 技能实例: null, 条件通过: false, 完成释放: false });
    passive(h2);
    m.玩家控制器!.左_中_右键 = { x: 1, y: 0 };
    m.玩家控制器!.进行交互();
    expect(h2.calls).toEqual(['幽冥骑士.打断技能(true)', 'P.持续中触发(行动结束后)', 'P: −5 体力']);
    expect(m.当前环节).toBe('交互场牌');
  });
});

describe('TURN-049/050 结束行动 and its barrier', () => {
  it('TF-TV-14: gauge mod 100, 疲劳了, 行动结束后, 退出战斗状态; a registered instance holds the end', () => {
    const h = harness();
    const m = h.w.mode;
    for (const [g, want] of [[160, 60], [100, 0], [95, 95]] as const) {
      const a = h.enemy('a', { 当前行动力: g });
      h.effect(a, 'A', ['效果.时机.行动结束后']);
      a.疲劳了 = false; a.移动中 = true;
      h.calls.length = 0;
      a.结束行动(null, 'x');
      expect([a.当前行动力, a.疲劳了, a.移动中]).toEqual([want, true, false]);
      expect(h.calls).toEqual(['A.持续中触发(行动结束后)']);
      expect(frame(m).prints.at(-1)).toBe('a//x'); // 退出战斗状态 ran and printed (no round end outside phase 3)
    }
    const b = h.enemy('b', { 当前行动力: 250 });
    m.当前环节 = '进行战斗';
    const PRJ1 = h.w.spawn(测试能力);
    b.加入行动结束(PRJ1);
    b.结束行动(null, '');
    expect(b.当前行动力).toBe(250);
    b.结束行动(PRJ1, '');
    expect(b.当前行动力).toBe(50);
  });

  it('加入行动结束 registers only in phase 3', () => {
    const h = harness();
    const a = h.enemy('a');
    const x = h.w.spawn(测试能力);
    h.w.mode.当前环节 = '交互场牌'; a.加入行动结束(x);
    expect(a.行动结束实例).toEqual([]);
    h.w.mode.当前环节 = '进行战斗'; a.加入行动结束(x);
    expect(a.行动结束实例).toEqual([x]);
  });
});

describe('TURN-059/060 执行AI行动', () => {
  it('TF-TV-15 (a): AI行动前, E1 casts with 吟唱 0, E2 after 1 × U(0.1, 0.25); the hero round end waits', () => {
    const hh = harness({ level: [0, 0.5] });
    const m = hh.w.mode;
    const E1 = hh.enemy('E1', { field: true }); const E2 = hh.enemy('E2', { field: true });
    for (const [e, n] of [[E1, 'c1'], [E2, 'c2']] as const) {
      const ab = hh.w.spawn(测试能力, x => { x.label = n; x.拥有者 = e; });
      e.当前能力 = ab; e.疲劳了 = false;
    }
    m.可行动角色.push(E1, E2);
    m.场上有敌人 = true;
    m.当前环节 = '进行战斗';
    passive(hh);
    hh.hero.疲劳了 = false;
    hh.hero.结束行动(null, '');
    expect(hh.calls).toEqual(['P.持续中触发(行动结束后)', 'P: −5 体力', '执行AI行动', 'c1.释放开始(吟唱=0.0000)', `c2.释放开始(吟唱=${(1 * (0.1 + 0.15 * Math.fround(Math.ceil(0.5 * 32767) * Math.fround(1 / 32767)))).toFixed(4)})`]);
    expect(m.当前环节).toBe('进行战斗'); // E1 and E2 are not fatigued: no round end
  });

  it('TF-TV-15 (b): with the cached flag false the passive runs no AI phase and the hero ends the round', () => {
    const h = harness();
    const m = h.w.mode;
    m.场上有敌人 = false;
    m.当前环节 = '进行战斗';
    passive(h);
    h.hero.疲劳了 = false;
    h.hero.结束行动(null, '');
    expect(h.calls.slice(0, 2)).toEqual(['P.持续中触发(行动结束后)', 'P: −5 体力']);
    expect(m.总回合数).toBe(1); // round end → 新回合前
  });

  it('TF-TV-26: a corpse still in 可行动角色 takes the no-intent branch; only E2 draws the stagger', () => {
    const fs = [0.5];
    const h = harness({ level: fs });
    const m = h.w.mode;
    const E1 = h.enemy('E1'); const E2 = h.enemy('E2', { field: true });
    E1.死掉了 = true; E1.当前能力 = null;
    h.effect(E1, 'E1e', ['效果.时机.行动结束后']);
    E1.当前行动力 = 130;
    E2.当前能力 = h.w.spawn(测试能力, x => { x.label = 'c2'; });
    m.可行动角色.push(E1, E2);
    m.执行AI行动();
    expect(h.calls).toEqual(['E1e.持续中触发(行动结束后)', expect.stringMatching(/^c2\.释放开始\(吟唱=0\.1750\)$/)]);
    expect(E1.当前行动力).toBe(30);
    expect(fs).toEqual([]);
    expect(frame(m).prints).toContain('E1无可释放能力');
  });

  it('TF-TV-34: an empty 可行动角色 still runs AI行动前 and draws nothing', () => {
    const fs = [0.5];
    let before = 0;
    const h = harness({ level: fs, systems: { ai: { 蓝图_动作游戏模式: { AI行动前: () => { before++; } } } } });
    h.w.mode.执行AI行动();
    expect(before).toBe(1);
    expect(fs).toEqual([0.5]);
  });
});

describe('TURN-065…068 退出战斗状态 and the round end', () => {
  it('TF-TV-16: one unfatigued field actor blocks; its own action end ends the round in order', () => {
    const order: string[] = [];
    const h = harness({
      systems: {
        damage: {
          BP_ManeActor: { 结算持续伤害: s => order.push(`${s.名字}.结算持续伤害`), 清空日志数据: () => {} },
        },
      },
    });
    const m = h.w.mode;
    const E1 = h.enemy('E1', { field: true }); const E2 = h.enemy('E2', { field: true }); const N1 = h.enemy('N1', { field: true });
    E1.疲劳了 = true; E2.疲劳了 = false; N1.疲劳了 = false; N1.死掉了 = true;
    h.hero.疲劳了 = true; h.hero.移动中 = false;
    m.当前环节 = '进行战斗';
    m.退出战斗状态('x');
    expect(m.未疲劳计数).toBe(1);
    expect(frame(m).prints.at(-1)).toBe('x');
    E2.当前行动力 = 0;
    E2.结束行动(null, '');
    expect(order).toEqual(['幽冥骑士.结算持续伤害', 'E1.结算持续伤害', 'E2.结算持续伤害', 'N1.结算持续伤害']);
    expect(m.总回合数).toBe(1);
    expect(m.当前环节).not.toBe('进行战斗');
  });

  it('E-04: the hero dying from his own round-end DoT stops at phase 20', () => {
    const h = harness({ systems: { damage: { BP_ManeActor: { 结算持续伤害: s => { if (s === s.world.mode.玩家角色) s.死掉了 = true; } } } } });
    const m = h.w.mode;
    h.hero.疲劳了 = true;
    m.当前环节 = '进行战斗';
    // the hero is alive at the check, dies in his DoT
    m.退出战斗状态('');
    expect(m.当前环节).toBe('回合结束');
    expect(m.总回合数).toBe(0);
  });

  it('TF-TV-17: the round-end mental 斗志 (回合评分 − 150) / 25 and 获得SSS', () => {
    for (const [score, mental, sss] of [[260, 4, 0], [140, 0, 0], [100, -2, 0], [0, -6, 0], [330, 7, 1]] as const) {
      const got: number[] = [];
      const stats: [string, number][] = [];
      const h = harness({
        systems: {
          stamina: { BP_Actor_Player: { 精神系统: (_s, _a, b, why) => { if (why === '战斗评分') got.push(b); } } },
          rating: { 蓝图_动作游戏模式: { 更新轮回战斗统计: (_s, n, v) => { stats.push([n, v]); } } },
        },
      });
      const m = h.w.mode;
      m.回合战斗统计.set('反弹', { 系数: 1, 指数: 0 });
      m.回合评分 = score;
      h.hero.疲劳了 = true;
      m.当前环节 = '进行战斗';
      m.退出战斗状态('');
      expect(got).toEqual([mental]);
      expect(stats).toEqual([['获得SSS', sss]]);
    }
  });

  it('TF-TV-38: a corpse-only AI phase ends the round nested; the outer loop resumes over the rebuilt list', () => {
    // the next turn's gains (combat) bring E2 and E3 to ≥ 100; the outer loop's stagger U for E3 (level)
    const h: Harness = harness({
      combat: [0.5, 0.5], level: [0.5],
      systems: { ai: { 蓝图_动作游戏模式: { 预测AI行动: s => {
        for (const a of s.可行动角色) if (a && !s.world.isValid(a.当前能力)) a.当前能力 = s.world.spawn(测试能力, x => { x.label = `c${a.名字}`; });
      } } } },
    });
    const m = h.w.mode;
    withMission(h).未完成 = true;
    const E1 = h.enemy('E1'); E1.死掉了 = true; E1.当前能力 = null;
    const E2 = h.enemy('E2', { field: true, 当前行动力: 50 }); const E3 = h.enemy('E3', { field: true, 当前行动力: 50 });
    E2.疲劳了 = true; E3.疲劳了 = true;
    m.可行动角色.push(E1);
    m.场上有敌人 = true;
    m.当前环节 = '进行战斗';
    passive(h);
    h.effect(h.hero, 'Y', ['效果.时机.行动结束后']);
    h.hero.疲劳了 = false; h.hero.移动中 = true;
    h.hero.结束行动(null, '');
    expect(m.可行动角色).toEqual([E2, E3]);
    expect(h.calls.filter(c => !c.startsWith('清理已销毁效果'))).toEqual([
      'P.持续中触发(行动结束后)', 'P: −5 体力', '执行AI行动',
      // nested round end → 新回合前 → … → 新回合后 (intents for E2, E3) → the outer AI loop resumes at i = 1
      expect.stringMatching(/^cE3\.释放开始\(吟唱=0\.1750\)$/),
      'Y.持续中触发(行动结束后)',
    ]);
    expect(m.当前环节).toBe('交互场牌');
    expect(m.总回合数).toBe(1);
    expect(frame(m).prints.at(-1)).toBe('幽冥骑士//');
  });

  it('TF-TV-33 (a): the Victory panel ends the hero action once more (no AI phase: the flag is false)', () => {
    const h = harness();
    const m = h.w.mode;
    passive(h);
    m.场上有敌人 = false;
    const ms = withMission(h);
    ms.未完成 = false;
    m.当前轮回任务 = h.w.spawn(BP_Mission, x => { x.未完成 = true; });
    m.当前环节 = '回合开始';
    m.新回合后();
    expect(m.当前环节).toBe('战斗统计');
    expect(h.calls).toEqual(['幽冥骑士.打断技能(true)', 'P.持续中触发(行动结束后)', 'P: −5 体力']);
    expect(m.玩家控制器!.玩家可与环境交互).toBe(true); // 等待玩家操作 after the panel
    expect(h.w.modal.current).toMatchObject({ kind: 'panel', result: 'victory', canRetry: false });
  });
});

describe('entering combat', () => {
  it('TURN-045: only from phase 2; resets the round stats; 进入战斗时 on the hero, then the field', () => {
    const h = harness();
    const m = h.w.mode;
    const E = h.enemy('E', { field: true });
    h.effect(h.hero, 'H', ['效果.时机.进入战斗时']);
    h.effect(E, 'F', ['效果.时机.进入战斗时']);
    m.当前环节 = '进行战斗';
    m.进入战斗状态();
    expect(frame(m).prints.at(-1)).toBe('没有敌人');
    m.当前环节 = '交互场牌';
    m.回合评分 = 77;
    m.玩家控制器!.玩家可与环境交互 = true;
    m.可行动角色.push(E as BP_ManeActor);
    m.进入战斗状态();
    expect([m.当前环节, m.回合评分, m.玩家控制器!.玩家可与环境交互, E.战斗状态]).toEqual(['进行战斗', 0, false, true]);
    expect(h.calls).toEqual(['H.持续中触发(进入战斗时)', 'F.持续中触发(进入战斗时)']);
  });
});

/**
 * TF-TV-10, 11, 12, 20, 21, 22, 25, 30, 37 and the goal classes: the mission check, the goals, the panel, Continue,
 * the floor end and the room reset (turn-flow §4.9–§4.11).
 */
import { describe, expect, it } from 'vitest';
import { harness, type Harness } from './harness.ts';
import { frame } from '../../src/core/sys/turn/util.ts';
import { BP_Mission } from '../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';
import { 蓝图_任务目标_清理房间 } from '../../src/content/bp/Skill/效果/任务/蓝图_任务目标_清理房间.ts';
import { 蓝图_任务目标_完成交互 } from '../../src/content/bp/Skill/效果/任务/蓝图_任务目标_完成交互.ts';
import { 蓝图_任务目标_空 } from '../../src/content/bp/Skill/效果/任务/蓝图_任务目标_空.ts';
import { 蓝图_任务目标_抵达层数 } from '../../src/content/bp/Skill/效果/任务/蓝图_任务目标_抵达层数.ts';
import { 蓝图_任务目标_新手关通关 } from '../../src/content/bp/Skill/效果/任务/蓝图_任务目标_新手关通关.ts';
import { 蓝图_效果_退出回合开始检查 } from '../../src/content/bp/Skill/效果/蓝图_效果_退出回合开始检查.ts';
import { make效果配置 } from '../../src/core/bp/structs.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { 重置房间 } from '../../src/core/sys/turn/index.ts';

function mission(h: Harness, o: { kill?: boolean; param?: number; goal?: string } = {}): BP_Mission {
  const m = h.w.spawn(BP_Mission, x => { x.拥有者 = h.hero; x.能力名 = o.kill === false ? '完成交互' : '消灭所有敌人'; });
  if (o.kill !== false) m.类型.add('能力.类型.任务.杀敌');
  m.参数 = [{ 初始值: o.param ?? -1, 提升值: 0, 词条: '', 整数: false, 乘算: false, 品质倍率: false, 不预算: false, 初始区间: [] } as never];
  m.效果配置 = [make效果配置({ 效果类: o.goal ?? 蓝图_任务目标_清理房间.path, 持续时间: -1, 触发间隔: 1, 持续回合: -1 })];
  h.w.mode.当前任务实例 = m;
  return m;
}

const recorder = () => {
  const log: string[] = [];
  const systems: Partial<Systems> = {
    ai: { 蓝图_动作游戏模式: { 预测AI行动: () => { log.push('预测AI行动'); } } },
    map: { 蓝图_动作游戏模式: { 创建路口: (_s, d) => { log.push(`创建路口(${d})`); } } },
  };
  return { log, systems };
};

describe('TURN-080 the mission check', () => {
  it('TF-TV-10: the eight branches', () => {
    type Case = { setup(h: Harness, m: BP_Mission | null): void; want: (string | RegExp)[]; input: boolean };
    const cases: Case[] = [
      { setup: h => { h.w.mode.当前任务实例 = null; }, want: [], input: false },
      { setup: (_h, m) => { m!.完成过了 = true; }, want: ['创建路口(true)'], input: true },
      { setup: (_h, m) => { m!.失败了 = true; }, want: ['panel failure'], input: true },
      { setup: (h, m) => { h.hero.死掉了 = true; m!.类型.remove('能力.类型.任务.杀敌'); }, want: ['失败任务'], input: true },
      { setup: (_h, m) => { m!.未完成 = true; }, want: ['预测AI行动'], input: true },
      { setup: (h, m) => { m!.未完成 = false; h.w.mode.当前轮回任务 = h.w.spawn(BP_Mission, x => { x.未完成 = true; }); }, want: ['panel victory'], input: true },
      { setup: (h, m) => { m!.未完成 = false; m!.类型.remove('能力.类型.任务.杀敌'); h.w.mode.当前轮回任务 = h.w.spawn(BP_Mission, x => { x.未完成 = true; }); }, want: ['完成任务'], input: true },
      { setup: (h, m) => { m!.未完成 = false; h.w.mode.当前轮回任务 = h.w.spawn(BP_Mission, x => { x.未完成 = false; x.类型.add('能力.类型.任务.轮回'); }); }, want: ['轮回.完成任务', 'panel victory'], input: true },
    ];
    for (const c of cases) {
      const r = recorder();
      const h = harness({ systems: r.systems });
      const m = mission(h);
      c.setup(h, m);
      const run = h.w.mode.当前轮回任务 as BP_Mission | null;
      if (run) { const real = run.完成任务.bind(run); run.完成任务 = () => { r.log.push('轮回.完成任务'); real(); }; }
      const realFail = m.失败任务.bind(m); m.失败任务 = () => { r.log.push('失败任务'); realFail(); };
      const realDone = m.完成任务.bind(m); m.完成任务 = () => { r.log.push('完成任务'); realDone(); };
      h.w.mode.玩家控制器!.玩家可与环境交互 = false;
      h.w.mode.当前环节 = '回合开始';
      h.w.mode.新回合后();
      const modal = h.w.modal.current;
      const got = [...r.log.filter(s => s !== '创建路口(true)' || c.want.includes('创建路口(true)')), ...(modal?.kind === 'panel' ? [`panel ${modal.result}`] : [])];
      expect(got.filter(s => !s.startsWith('创建路口') || c.want.includes(s))).toEqual(c.want);
      expect(h.w.mode.玩家控制器!.玩家可与环境交互).toBe(c.input);
      if (!c.input) expect(frame(h.w.mode).prints).toContain('没有房间任务');
    }
  });
});

describe('TURN-081 蓝图_任务目标_清理房间', () => {
  it('TF-TV-11: a living harvestable keeps the room open; harvesting it completes the mission at the next 新一天时', () => {
    const h = harness();
    const m = mission(h);
    m.执行技能(false);
    const goal = m.目标效果实例 as 蓝图_任务目标_清理房间;
    expect(goal).toBeInstanceOf(蓝图_任务目标_清理房间);
    expect(goal.目标数量).toBe(-1);
    const eye = h.enemy('眼球', { field: true });
    const grass = h.enemy('灌草', { field: true });
    grass.OwnedGameplayTags.remove('可交互.角色.AI.仇恨'); grass.OwnedGameplayTags.add('可交互.角色.AI.物品.采集');
    eye.死掉了 = true;
    h.w.mode.有角色死亡时(eye);
    expect([m.未完成, h.w.isValid(goal)]).toEqual([true, true]);
    grass.死掉了 = true;
    goal.持续中触发('效果.时机.新一天时');
    expect([m.未完成, h.w.isValid(goal)]).toEqual([false, false]);
  });

  it('TF-TV-12: 击杀敌人 (目标数量 4) counts turn starts and kills', () => {
    const h = harness();
    const m = mission(h, { param: 4 });
    m.执行技能(false);
    const goal = m.目标效果实例 as 蓝图_任务目标_清理房间;
    const seq: [number, boolean][] = [];
    for (const t of ['效果.时机.新一天时', '效果.时机.有敌人死亡', '效果.时机.有敌人死亡', '效果.时机.新一天时']) {
      goal.持续中触发(t);
      seq.push([goal.目标数量, m.未完成]);
    }
    expect(seq).toEqual([[3, true], [2, true], [1, true], [0, false]]);
    expect(h.w.isValid(goal)).toBe(false);
  });

  it('结束层时 destroys a −1 goal; other tags do nothing', () => {
    const h = harness();
    const m = mission(h);
    m.执行技能(false);
    const goal = m.目标效果实例!;
    goal.持续中触发('效果.时机.房间完毕时');
    expect(h.w.isValid(goal)).toBe(true);
    goal.持续中触发('效果.时机.结束层时');
    expect(h.w.isValid(goal)).toBe(false);
  });

  it('TF-TV-30: the goal destroying itself on the clearing kill makes the next hero effect miss that kill', () => {
    for (const order of [['P', 'G', 'K'], ['P', 'K', 'G']]) {
      const h = harness();
      const m = mission(h);
      const eff: Record<string, unknown> = {};
      for (const n of order) {
        if (n === 'G') { m.执行技能(false); eff.G = m.目标效果实例; continue; }
        eff[n] = h.effect(h.hero, n, n === 'K' ? ['效果.时机.有敌人死亡'] : []);
      }
      const E1 = h.enemy('E1');
      E1.死掉了 = true;
      h.calls.length = 0;
      h.w.mode.有角色死亡时(E1);
      expect(m.未完成).toBe(false);
      expect(h.calls).toEqual(order[1] === 'G' ? [] : ['K.持续中触发(有敌人死亡)']);
    }
  });
});

describe('the other goals', () => {
  it('完成交互 marks the mission open on 新一层时; 空 completes it; both remove themselves', () => {
    const h = harness();
    const m = mission(h, { kill: false, goal: 蓝图_任务目标_完成交互.path });
    m.未完成 = false;
    m.执行技能(false);
    const g = m.目标效果实例!;
    g.持续中触发('效果.时机.新一层时');
    expect([m.未完成, h.w.isValid(g)]).toEqual([true, false]);
    const m2 = mission(h, { kill: false, goal: 蓝图_任务目标_空.path });
    m2.执行技能(false);
    const g2 = m2.目标效果实例!;
    g2.持续中触发('效果.时机.新一层时');
    expect([m2.未完成, h.w.isValid(g2)]).toEqual([false, false]);
  });

  it('抵达层数: incomplete while hostiles remain or the floor is below 参数[0]', () => {
    const h = harness();
    h.w.mode.当前总层数 = 2;
    const m = mission(h, { kill: false, param: 3, goal: 蓝图_任务目标_抵达层数.path });
    m.执行技能(false);
    const g = m.目标效果实例!;
    expect(m.未完成).toBe(true);
    h.w.mode.当前总层数 = 3;
    h.enemy('E', { field: true });
    g.持续中触发('效果.时机.新一天时');
    expect(m.未完成).toBe(true);
    h.w.mode.场上所有.length = 0;
    g.持续中触发('效果.时机.新一天时');
    expect([m.未完成, h.w.isValid(g)]).toEqual([false, false]);
  });

  it('新手关通关: 未完成 follows 当前总层数 < 目标层数 on 房间完毕时 / 新一层时; 接受指引 once met', () => {
    const stats: string[] = [];
    const h = harness({ systems: { rating: { 蓝图_动作游戏模式: { 更新轮回战斗统计: (_s, n) => { stats.push(n); } } } } });
    h.w.mode.当前总层数 = 6;
    const m = mission(h, { kill: false, param: 7, goal: 蓝图_任务目标_新手关通关.path });
    m.执行技能(false);
    const g = m.目标效果实例!;
    g.持续中触发('效果.时机.房间完毕时');
    expect(m.未完成).toBe(true);
    g.持续中触发('效果.时机.结束层时');
    expect(stats).toEqual([]);
    h.w.mode.当前总层数 = 7;
    g.持续中触发('效果.时机.新一层时');
    expect(m.未完成).toBe(false);
    g.持续中触发('效果.时机.结束层时');
    expect(stats).toEqual(['接受指引']);
  });
});

describe('TURN-084…087, TURN-096…098 panel, Continue, floor end', () => {
  it('TF-TV-21: phase 19, title and 重新挑战 visibility', () => {
    for (const [ok, full, tut, retry] of [[true, false, false, false], [false, false, false, true], [false, true, false, false], [false, false, true, false]] as const) {
      const h = harness();
      mission(h);
      h.hero.腐化满过 = full;
      if (tut) h.w.mode.当前层地图格配置表 = { DataTable: null, RowName: '新手关02' };
      h.w.mode.当前环节 = '回合开始';
      h.w.mode.当前任务实例 = null;
      const m = mission(h);
      if (ok) { m.未完成 = false; h.w.mode.当前轮回任务 = h.w.spawn(BP_Mission, x => { x.未完成 = true; }); } else m.失败了 = true;
      h.w.mode.新回合后();
      expect(h.w.mode.当前环节).toBe('战斗统计');
      expect(h.w.modal.current).toMatchObject({ kind: 'panel', result: ok ? 'victory' : 'failure', canRetry: retry });
      const legal = h.w.sys.turn.legal!(h.w).map(s => s.type);
      expect(legal).toEqual(retry ? ['panel.continue', 'panel.retry'] : ['panel.continue']);
    }
  });

  it('TF-TV-22 (a): Continue on a Victory: 完成任务 (获取地图宝藏), phase 18, charge and shield lost; no 0.5 s auto end', () => {
    const r = recorder();
    const h = harness({ systems: r.systems });
    const m = mission(h);
    m.未完成 = false;
    h.w.mode.当前轮回任务 = h.w.spawn(BP_Mission, x => { x.未完成 = true; });
    const reward = h.w.spawn(BP_Mission); reward.类型.add('能力.类型.奖励.复合奖励'); Object.assign(h.w.sys, { map: { ...h.w.sys.map, 当前所在格: () => ({ 奖励技能实例: reward, 已清理: false }) } });
    const card = h.w.spawn('CatapultHero/BP/Actor/BP_Actor_Card') as unknown as { 当前行动力: number };
    card.当前行动力 = 37;
    h.w.cult.已装备牌.push(card as never);
    h.hero.当前护甲值 = { 系数: 12, 指数: 0 };
    h.w.mode.当前环节 = '回合开始';
    h.w.mode.新回合后();
    expect(h.w.modal.answer({ type: 'panel.continue' })).toBe(true);
    expect([m.完成过了, m.未完成]).toEqual([true, false]);
    expect(h.hero.拥有的效果.some(e => e?.def.path === 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_获取地图宝藏')).toBe(true);
    expect(h.w.mode.当前环节).toBe('物品盒子');
    expect([card.当前行动力, h.hero.当前护甲值.系数]).toEqual([0, 0]);
    h.w.clock.advance(2);
    expect(r.log).not.toContain('创建路口(true)');
  });

  it('TF-TV-22 (b): 完成任务 in a 获取兽肉 cell ends the floor 0.5 s later; (c) a dead hero stops before the reward', () => {
    const r = recorder();
    const h = harness({ systems: r.systems });
    const m = mission(h, { kill: false });
    const reward = h.w.spawn(BP_Mission); reward.类型.add('能力.类型.奖励.获取兽肉'); Object.assign(h.w.sys, { map: { ...h.w.sys.map, 当前所在格: () => ({ 奖励技能实例: reward, 已清理: false }) } });
    m.完成任务();
    expect(r.log).toEqual([]);
    h.w.clock.advance(0.5);
    expect(r.log).toEqual(['创建路口(true)']);
    expect(h.w.mode.当前环节).toBe('选择路口');
    const r2 = recorder();
    const h2 = harness({ systems: r2.systems });
    const m2 = mission(h2);
    h2.hero.死掉了 = true;
    m2.完成任务();
    h2.w.clock.advance(1);
    expect(h2.hero.拥有的效果).toEqual([]);
    expect(r2.log).toEqual([]);
  });

  it('TF-TV-37 shape: a failed 杀敌 mission with the hero alive: Failure, Continue → 失败任务 → 结束当前层(true)', () => {
    const r = recorder();
    const h = harness({ systems: r.systems });
    const m = mission(h);
    m.失败了 = true;
    h.w.mode.当前环节 = '回合开始';
    h.w.mode.新回合后();
    expect(h.w.modal.current).toMatchObject({ kind: 'panel', result: 'failure', canRetry: true });
    h.w.modal.answer({ type: 'panel.continue' });
    expect([m.失败了, m.完成过了]).toEqual([true, false]);
    expect(r.log).toEqual(['创建路口(true)']);
    expect(h.w.mode.当前环节).toBe('物品盒子'); // 关闭战斗统计页 runs after 失败任务 (TURN-085)
  });

  it('TURN-085: Continue with the hero dead leads to the run end after 0.5 s; the phase ends at 18 (E-11)', () => {
    const ran: string[] = [];
    const h = harness({
      systems: { run: { UI_冒险结束统计页: { 激活冒险统计页面: (_ctx: unknown, 完成冒险: boolean) => { ran.push(`run end(${完成冒险})`); } } } },
    });
    const m = mission(h);
    h.hero.死掉了 = true;
    h.w.mode.当前环节 = '回合开始';
    h.w.mode.新回合后();
    h.w.modal.answer({ type: 'panel.continue' });
    expect(ran).toEqual([]);
    h.w.clock.advance(0.5);
    expect(ran).toEqual(['run end(false)']); // through the UI_冒险结束统计页 facade (WAVE_A §1.4)
    expect(h.w.mode.当前环节).toBe('物品盒子');
    expect(m.完成过了).toBe(false);
  });

  it('TF-TV-25: 结束层时机 fires 结束层时; −2 effects are destroyed only in 杀敌 missions', () => {
    for (const kill of [true, false]) {
      const h = harness();
      mission(h, { kill });
      const N = h.effect(h.hero, 'N', ['效果.时机.结束层时'], { 持续回合: -2 });
      const X = h.effect(h.hero, 'X', ['效果.时机.结束层时'], { 持续回合: -1 });
      const Z = h.effect(h.hero, 'Z', ['效果.时机.新一天时'], { 持续回合: -2 });
      h.calls.length = 0;
      h.w.mode.结束层时机();
      expect(h.calls).toEqual(['N.持续中触发(结束层时)', 'X.持续中触发(结束层时)']);
      expect([h.w.isValid(N), h.w.isValid(X), h.w.isValid(Z)]).toEqual([!kill, true, true]);
    }
  });

  it('TURN-098: 结束当前层 sets phase 11 and creates the junction; refused in phase 9', () => {
    const r = recorder();
    const h = harness({ systems: r.systems });
    h.w.mode.当前环节 = '选择地图';
    h.w.mode.结束当前层(false);
    expect(r.log).toEqual([]);
    h.w.mode.当前环节 = '物品盒子';
    h.w.mode.结束当前层(false);
    expect([h.w.mode.当前环节, r.log]).toEqual(['选择路口', ['创建路口(false)']]);
  });
});

describe('TURN-095 room reset', () => {
  it('TF-TV-20: +10 Corruption (0 in 测试模式), or the suicide when 腐化满过？', () => {
    for (const [test, full, want] of [[false, false, 10], [true, false, 0], [false, true, -1]] as const) {
      const got: number[] = [];
      let died = false;
      const h = harness({
        systems: {
          stamina: { 蓝图_动作游戏模式: { 增加腐化: (_s, v) => { got.push(v); return { 满了: false, 触发死亡: false }; } } },
          damage: { BP_ManeActor: { 检查死亡: (_s, forced, noTrigger) => { died = forced && noTrigger; } } },
          map: { 蓝图_动作游戏模式: { 创建地块: () => ({ 成功: false }) } },
        },
      });
      mission(h);
      h.w.mode.测试模式 = test;
      h.hero.腐化满过 = full;
      h.w.mode.房间重建失败次数 = 99; // the rebuild itself is not under test here
      重置房间(h.w.mode);
      h.w.clock.advance(3);
      if (want >= 0) expect(got).toEqual([want]); else { expect(got).toEqual([]); expect([died, h.hero.自杀]).toEqual([true, true]); }
    }
  });
});

describe('TURN-004 rebuild budget', () => {
  it('TF-TV-36: consecutive build failures rebuild up to 3 times, a success resets the streak', () => {
    const results = [false, false, true];
    let campCalls = 0;
    const h = harness({
      systems: {
        map: { 蓝图_动作游戏模式: { 创建地块: () => ({ 成功: results.shift() ?? false }), 摆放玩家: () => {} } },
        run: { 蓝图_动作游戏模式: { 返回营地: () => { campCalls++; } } },
      },
    });
    const m = h.w.mode;
    m.当前层地图格配置表 = { DataTable: null, RowName: '空' };
    const seen: number[] = [];
    const tick = (): void => { h.w.clock.advance(0.6); seen.push(m.房间重建失败次数); };
    m.新一层();
    tick(); tick(); tick();
    expect(seen).toEqual([1, 2, 0]);
    results.push(false, false, false, false);
    m.重建房间();
    seen.length = 0;
    tick(); tick(); tick(); tick();
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(campCalls).toBe(1);
  });
});

describe('蓝图_效果_退出回合开始检查', () => {
  it('joins the barrier on any trigger and leaves 0.2 s later once its owner is slower than 5', () => {
    const h = harness();
    const m = h.w.mode;
    m.当前环节 = '回合开始';
    const e = h.w.spawn(蓝图_效果_退出回合开始检查, x => { x.拥有者 = h.hero; });
    h.hero.拥有的效果.push(e);
    h.hero.当前物理速度 = 50;
    e.激活效果('');
    e.持续中触发('效果.时机.新一天时');
    expect(m.回合开始实例).toEqual([e]);
    h.w.clock.advance(0.5);
    expect(h.w.isValid(e)).toBe(true);
    h.hero.当前物理速度 = 1;
    h.w.clock.advance(0.1);
    expect(h.w.isValid(e)).toBe(false);
    expect(m.回合开始实例).toEqual([]);
  });
});

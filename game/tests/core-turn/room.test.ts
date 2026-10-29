/**
 * One combat room end to end (turn-flow §5, cell 战斗房_简单 with 2 × 眼球) through the real turn module and the real
 * core-sim runtime. Doubles: map (创建地块 / 摆放玩家 / 创建路口), the actor kernel (激活角色), the hero launch
 * (可控挥击 via 使目标执行自身技能), the hero passive (stamina), enemy AI (预测AI行动 / casts) and the kill (damage).
 */
import { describe, expect, it } from 'vitest';
import { turn } from '../../src/core/sys/turn/index.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import type { 蓝图_动作游戏模式 } from '../../src/core/sim/mode.ts';
import type { 结构_层, 结构_任务条 } from '../../src/content/demo/types.ts';
import { structOf } from '../../src/core/bp/structs.ts';
import { abilityDouble, harness, 测试能力, type Harness } from './harness.ts';

const ENEMIES = 'CatapultHero/数据表/角色/数据表_敌人_普通';
const MISSIONS = 'CatapultHero/数据表/技能/数据表_技能_任务';
type ModeFns = NonNullable<Systems['turn']['蓝图_动作游戏模式']>;

interface Script {
  /** Per hero launch: which field enemies die (by index into 敌方场上 at the launch). */
  kills: number[][];
}

function room(script: Script, o: { seed?: number } = {}) {
  const trace: string[] = [];
  let H: Harness | null = null;
  const h = (): Harness => H as Harness;
  // the turn module with every game-mode function recorded
  const modeFns = { ...turn.蓝图_动作游戏模式 } as Record<string, (...a: unknown[]) => unknown>;
  for (const [n, f] of Object.entries(modeFns)) modeFns[n] = (...a: unknown[]) => { trace.push(n); return f(...a); };
  const base = abilityDouble(() => h().w);
  let launches = 0;
  type Lib = NonNullable<Systems['ability']['函数库_工具']>;
  const 使目标执行自身技能: NonNullable<Lib['使目标执行自身技能']> = (_ctx, _i, target) => {
      // 可控挥击: 释放开始 → 执行技能 (the launch) → 进入战斗状态 (TURN-044); the launch ends 1 s later (LAUNCH-072).
      const mode = h().w.mode;
      trace.push('可控挥击.释放开始');
      if (target) { target.疲劳了 = false; target.移动中 = true; } // the launch start (LAUNCH-011)
      mode.进入战斗状态();
      const kills = script.kills[launches++] ?? [];
      const targets = kills.map(i => mode.敌方场上[i]).filter((x): x is BP_ManeActor => !!x);
      target?.delay('LAUNCH', 1.0, () => {
        for (const e of targets) kill(mode, e);
        trace.push('hero launch ends');
        target.结束行动(null, '');
      });
      return { 技能实例: null, 条件通过: true, 完成释放: true };
  };
  const ability = { ...base, 函数库_工具: { ...base.函数库_工具, 使目标执行自身技能 } };
  const systems: Partial<Systems> = {
    turn: { ...turn, 蓝图_动作游戏模式: modeFns as ModeFns },
    ability: ability as Systems['ability'],
    map: {
      蓝图_动作游戏模式: {
        创建地块: s => {
          s.当前任务实例 = null;
          s.当前层配置 = structOf('结构_层', {
            ...structOf('结构_层'), 场上最多敌人: 5,
            敌人池: [{ '成长？': false, 数量: 2, 概率: 1, 内容: [{ 权重: 1, 数据表行: { DataTable: ENEMIES, RowName: '眼球' } }] }],
          }) as 结构_层;
          s.创建任务({ ...structOf('结构_任务条'), 任务需求: [{ 权重: 1, 数据表行: { DataTable: MISSIONS, RowName: '消灭所有敌人' } }], 任务等级: 1 } as 结构_任务条);
          return { 成功: true };
        },
        摆放玩家: () => {},
        创建路口: (_s, d) => { trace.push(`创建路口(${d})`); },
      },
    },
    kernel: {
      BP_Actor_Other: { 激活角色: self => {
        for (const t of self.角色配置.标签) self.OwnedGameplayTags.add(t);
        self.行动力 = 100; self.当前生命 = { 系数: 5, 指数: 0 }; self.宽度 = 30;
      } },
    },
    ai: {
      蓝图_动作游戏模式: {
        AI行动前: () => { trace.push('AI行动前'); },
        预测AI行动: s => {
          for (const a of [...s.可行动角色]) {
            if (!a || s.world.isValid(a.当前能力)) continue;
            const ab = s.world.spawn(测试能力, x => { x.label = `${a.名字}#${a.id}`; x.拥有者 = a; });
            ab.onRelease = () => ab.delay('CAST', ab.吟唱 + 0.3, () => { a.当前能力 = null; trace.push(`${a.名字} cast ends`); a.结束行动(null, ''); });
            a.当前能力 = ab;
          }
        },
      },
    },
    stamina: { BP_ManeActor: { 疲劳结算: () => {} }, BP_Actor_Player: { 精神系统: () => {} } },
  };
  H = harness({ systems, seed: o.seed ?? 3 });
  const hh = H;
  // the hero passive (TURN-052): −5 Stamina, then 执行AI行动 when the cached flag says so
  hh.effect(hh.hero, 'P', ['效果.时机.行动结束后'], { hook: () => { trace.push('P −5'); if (hh.w.mode.场上有敌人) hh.w.mode.执行AI行动(); } });
  hh.w.mode.当前层地图格配置表 = { DataTable: 'CatapultHero/数据表/地图/数据表_地图格', RowName: '简单战斗' };
  hh.w.mode.当前轮回任务 = hh.w.spawn('CatapultHero/BP/Skill/Ability/Mission/BP_Mission', x => { (x as unknown as { 未完成: boolean }).未完成 = true; });
  return { h: hh, trace };
}

/** The kill as the damage pipeline runs it (TURN-073…075): out of the field, 有角色死亡时, 角色死亡 → graveyard, 退出战斗状态. */
function kill(mode: 蓝图_动作游戏模式, e: BP_ManeActor): void {
  e.当前生命 = { 系数: 0, 指数: 0 };
  mode.从场上移出_碰撞(e);
  mode.有角色死亡时(e);
  e.死掉了 = true;
  e.当前能力 = null;
  mode.添加到墓地(e);
  mode.退出战斗状态('');
}

function release(h: Harness): void {
  const r = h.w.sys.turn.commands!['aim.release']!(h.w, { type: 'aim.release', aim: { x: 300, y: 0 } });
  expect(r.ok).toBe(true);
}

/** Runs the scheduler until input opens (phase 2 or a panel), at most `s` seconds. */
function untilInput(h: Harness, s = 20): void {
  h.w.clock.runUntil(() => (h.w.mode.玩家控制器?.玩家可与环境交互 ?? false), s);
}

describe('§5: one combat room, 2 × 眼球', () => {
  it('reproduces the event order from 新一层 to the Victory panel and the floor end', () => {
    const { h, trace } = room({ kills: [[], [0, 1]] });
    const m = h.w.mode;
    m.新一层();
    untilInput(h);
    expect(m.当前环节).toBe('交互场牌');
    expect(m.敌方场上).toHaveLength(2);
    expect(m.当前层回合).toBe(1);
    const MILESTONES = new Set(['新一层', '清理房间', '创建角色', '激活任务', '新一层触发时机', '抽取卡牌到场上_碰撞', '房间完毕触发时机', '新回合前', '新回合触发时机', '退出回合开始', '新回合后', '增长行动度', '等待玩家操作', '可控挥击.释放开始', '进入战斗状态', 'hero launch ends', 'P −5', '执行AI行动', 'AI行动前', '退出战斗状态', '有角色死亡时', '结束当前层', '创建路口(true)']);
    const pick = (): string[] => trace.filter(t => MILESTONES.has(t) || t.endsWith('cast ends'));
    expect(pick()).toEqual(['新一层', '清理房间', '创建角色', '激活任务', '新一层触发时机', '抽取卡牌到场上_碰撞', '房间完毕触发时机', '新回合前', '新回合触发时机', '退出回合开始', '新回合后', '增长行动度', '等待玩家操作']);
    trace.length = 0;
    // turn 1: the hero hits nothing; both eyes act
    release(h);
    h.w.clock.runUntil(() => m.当前层回合 === 2 && (m.玩家控制器?.玩家可与环境交互 ?? false), 20);
    const t1 = pick();
    expect(t1.slice(0, 7)).toEqual(['可控挥击.释放开始', '进入战斗状态', 'hero launch ends', 'P −5', '执行AI行动', 'AI行动前', '退出战斗状态']);
    expect(t1.filter(t => t.endsWith('cast ends'))).toHaveLength(2);
    expect(t1.slice(-8)).toEqual(['退出战斗状态', '新回合前', '抽取卡牌到场上_碰撞', '新回合触发时机', '退出回合开始', '新回合后', '增长行动度', '等待玩家操作']);
    trace.length = 0;
    // turn 2: the launch kills both; no AI phase (the goal refreshed the flag); round end; turn 3 opens the Victory panel
    release(h);
    h.w.clock.runUntil(() => h.w.modal.current !== null, 20);
    const t2 = pick();
    expect(t2).toEqual([
      '可控挥击.释放开始', '进入战斗状态',
      '有角色死亡时', '退出战斗状态', '有角色死亡时', '退出战斗状态',
      'hero launch ends', 'P −5', '退出战斗状态',
      '新回合前', '抽取卡牌到场上_碰撞', '新回合触发时机', '退出回合开始', '新回合后', '增长行动度',
      // the Victory panel's hidden hero action end (TURN-053 a): −5 Stamina, no AI phase, a no-op 退出战斗状态
      'P −5', '退出战斗状态', '等待玩家操作',
    ]);
    expect(m.当前环节).toBe('战斗统计');
    expect(m.当前层回合).toBe(3);
    expect(h.w.modal.current).toMatchObject({ kind: 'panel', result: 'victory' });
    // Continue → 完成任务 → phase 18; the loot box (rewards) then ends the floor: here 盒子关闭后 is simulated
    h.w.modal.answer({ type: 'panel.continue' });
    expect(m.当前环节).toBe('物品盒子');
    trace.length = 0;
    m.结束当前层(true);
    expect(pick()).toEqual(['结束当前层', '创建路口(true)']);
    expect(m.当前环节).toBe('选择路口');
  });

  it('a fixture room with two 眼球 runs 20 turns without a stall when the hero never hits', () => {
    const { h } = room({ kills: [] });
    const m = h.w.mode;
    m.新一层();
    untilInput(h);
    for (let turnNo = 1; turnNo <= 20; turnNo++) {
      expect(m.当前环节).toBe('交互场牌');
      expect(m.当前层回合).toBe(turnNo);
      release(h);
      const r = h.w.clock.runUntil(() => m.当前层回合 === turnNo + 1 && (m.玩家控制器?.玩家可与环境交互 ?? false), 30);
      expect(r).toBe('stopped');
    }
    expect(m.总回合数).toBe(21);
    expect(m.敌方场上).toHaveLength(2);
  });

  it('the same seed and the same commands give the same digest', () => {
    const run = (): string => {
      const { h } = room({ kills: [[], [0], [0]] });
      h.w.mode.新一层();
      untilInput(h);
      for (let i = 0; i < 3; i++) { release(h); h.w.clock.runUntil(() => h.w.modal.current !== null || (h.w.mode.当前环节 === '交互场牌' && (h.w.mode.玩家控制器?.玩家可与环境交互 ?? false) && h.w.mode.当前层回合 === i + 2), 30); }
      return h.w.digest();
    };
    expect(run()).toBe(run());
  });
});

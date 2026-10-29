/** TF-TV-01, 02, 05, 06, 07, 08, 09, 41: turn start, the five passes, the barrier, 新回合后 (turn-flow §4.2–§4.4). */
import { describe, expect, it } from 'vitest';
import { turn } from '../../src/core/sys/turn/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { BpObject } from '../../src/core/sim/object.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { calls, harness, 测试效果 } from './harness.ts';
import { frame } from '../../src/core/sys/turn/util.ts';
import { BP_Mission } from '../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';

type ModeFns = NonNullable<Systems['turn']['蓝图_动作游戏模式']>;
/** The real turn module with recorders around the named game-mode functions. */
function spyTurn(names: (keyof ModeFns)[], record: (name: string, args: unknown[]) => void, replace: Partial<ModeFns> = {}): Systems['turn'] {
  const mode = { ...turn.蓝图_动作游戏模式 } as Record<string, (...a: unknown[]) => unknown>;
  for (const n of names) {
    const real = (replace as Record<string, (...a: unknown[]) => unknown>)[n as string] ?? mode[n as string];
    mode[n as string] = (...a: unknown[]) => { record(n as string, a.slice(1)); return real(...a); };
  }
  return { ...turn, 蓝图_动作游戏模式: mode as ModeFns };
}

class 测试装饰 extends BpObject {
  static override readonly path = 'Test/core-turn/测试装饰';
  新一天时(): void { calls(this.world).push('D1.新一天时()'); }
}

describe('TURN-020 新回合前', () => {
  it('TF-TV-01: the first turn of a room: phase 0, counters, the run-wide turn log, no refill', () => {
    const rec: string[] = [];
    let phaseAt = '';
    const h = harness({ systems: { turn: spyTurn(['抽取卡牌到场上_碰撞', '新回合触发时机'], n => { rec.push(n); phaseAt = h.w.mode.当前环节; }) } });
    const m = h.w.mode;
    m.总回合数 = 4; m.当前层回合 = 0; m.当前环节 = '创建房间';
    m.新回合前();
    expect(phaseAt).toBe('回合开始');
    expect(m.总回合数).toBe(5);
    expect(m.当前层回合).toBe(1);
    expect(rec).toEqual(['新回合触发时机']);
    const logs = h.w.events.drain();
    expect(logs.filter(e => e.kind === 'log').map(e => (e as { rich: string }).rich)).toContain('<强调>———————————————————</>第<强调>5</>回合');
  });

  it('TF-TV-02: a later turn refills the field before 新回合触发时机', () => {
    const rec: string[] = [];
    const h = harness({ systems: { turn: spyTurn(['抽取卡牌到场上_碰撞', '新回合触发时机'], (n, a) => rec.push(`${n}(${a.join(',')})`)) } });
    const m = h.w.mode;
    m.总回合数 = 9; m.当前层回合 = 3;
    const e1 = h.enemy('a'); const e2 = h.enemy('b'); const f1 = h.enemy('f', { field: true });
    void f1;
    m.敌方牌库.push(e1, e2);
    m.场上最多敌人数量 = 5;
    m.新回合前();
    expect(m.当前层回合).toBe(4);
    expect(rec.slice(0, 2)).toEqual(['抽取卡牌到场上_碰撞(10)', '新回合触发时机()']);
    expect(m.敌方场上).toHaveLength(3);
    expect(m.敌方牌库).toHaveLength(0);
  });
});

describe('TURN-022 新回合触发时机', () => {
  it('TF-TV-05: decorations, rating, equipped cards, hero (then 疲劳结算), field, graveyard terrain, 退出回合开始(None)', () => {
    const rec: string[] = [];
    const h = harness({
      systems: {
        turn: spyTurn(['退出回合开始'], (_n, a) => rec.push(`退出回合开始(${a[0] === null ? 'None' : '?'})`), { 退出回合开始: () => {} }),
        rating: { BP_Actor_Player: { 结算评分: s => calls(s.world).push('玩家.结算评分()') } },
        stamina: { BP_ManeActor: { 疲劳结算: s => calls(s.world).push('玩家.疲劳结算()') } },
      },
    });
    const { w, hero } = h;
    const m = w.mode;
    const room = w.spawn(蓝图_房间);
    room.房间装饰品.push(w.spawn(测试装饰));
    m.当前房间实例 = room;
    const C1 = w.spawn(BP_Actor_Card, c => { c.名字 = 'C1'; });
    w.cult.已装备牌.push(C1);
    const P1 = h.effect(hero, 'P1', ['效果.时机.新一天时']);
    h.effect(hero, 'P2', []);
    const P3 = h.effect(hero, 'P3', ['效果.时机.新一天时']);
    C1.拥有的效果.push(P3);
    h.effect(C1, 'C1e', ['效果.时机.新一天时']);
    const E1 = h.enemy('E1', { field: true });
    h.effect(E1, 'E1e', ['效果.时机.新一天时']);
    const G1 = h.enemy('G1');
    m.墓地.push(G1);
    // T1 is a terrain effect: its manifest class derives from 蓝图_效果_地形.
    const T1 = w.spawn('CatapultHero/BP/Skill/效果/蓝图_效果_地形') as 测试效果;
    T1.OwnedGameplayTags.add('效果.时机.新一天时');
    (T1 as unknown as { label: string }).label = 'T1';
    G1.拥有的效果.push(T1);
    h.effect(G1, 'G1e', ['效果.时机.新一天时']);
    void P1;
    h.calls.length = 0;
    m.新回合触发时机();
    expect([...h.calls, ...rec]).toEqual([
      'D1.新一天时()', '玩家.结算评分()',
      'P3.持续效果()', 'P3.持续中触发(新一天时)', 'C1e.持续效果()', 'C1e.持续中触发(新一天时)', '清理已销毁效果(C1)',
      'P1.持续效果()', 'P1.持续中触发(新一天时)', '清理已销毁效果(幽冥骑士)', '玩家.疲劳结算()',
      'E1e.持续效果()', 'E1e.持续中触发(新一天时)', '清理已销毁效果(E1)',
      'T1.持续效果()', '清理已销毁效果(G1)',
      '退出回合开始(None)',
    ]);
  });

  it('TF-TV-06: 持续回合 1 / 0 / −1 fire at turn starts N+1… and expire after the last', () => {
    const h = harness({ systems: { turn: spyTurn(['退出回合开始'], () => {}, { 退出回合开始: () => {} }) } });
    const tag = ['效果.时机.新一天时'];
    const a = h.effect(h.hero, 'A', tag, { 持续回合: 1 });
    const b = h.effect(h.hero, 'B', tag, { 持续回合: 0 });
    const c = h.effect(h.hero, 'C', tag, { 持续回合: -1 });
    for (const e of [a, b, c]) e.激活效果('');
    expect([a.剩余回合, b.剩余回合, c.剩余回合]).toEqual([2, 1, -1]);
    const fired = (): string[] => h.calls.filter(s => s.includes('持续中触发')).map(s => s[0]);
    h.calls.length = 0; h.w.mode.新回合触发时机();
    expect(fired()).toEqual(['A', 'B', 'C']);
    expect([h.w.isValid(a), h.w.isValid(b), h.w.isValid(c)]).toEqual([true, false, true]);
    h.calls.length = 0; h.w.mode.新回合触发时机();
    expect(fired()).toEqual(['A', 'C']);
    expect(h.w.isValid(a)).toBe(false);
    h.calls.length = 0; h.w.mode.新回合触发时机();
    expect(fired()).toEqual(['C']);
  });
});

describe('TURN-033…035 the turn-start barrier', () => {
  it('TF-TV-07: the game mode exit fails while PRJ1 is registered; a never-registered exit fails; PRJ1 opens 新回合后', () => {
    const rec: string[] = [];
    const h = harness({ systems: { turn: spyTurn(['新回合后'], n => rec.push(n), { 新回合后: () => {} }) } });
    const m = h.w.mode;
    m.当前环节 = '回合开始';
    const PRJ1 = h.w.spawn(测试效果); const XRC2 = h.w.spawn(测试效果);
    m.加入回合开始(PRJ1);
    m.退出回合开始(null);
    m.退出回合开始(XRC2);
    expect(rec).toEqual([]);
    expect(frame(m).prints.filter(p => p === '退出回合开始失败')).toHaveLength(2);
    m.退出回合开始(PRJ1);
    expect(rec).toEqual(['新回合后']);
  });

  it('加入回合开始 registers only in phase 0', () => {
    const h = harness();
    const m = h.w.mode;
    const x = h.w.spawn(测试效果);
    m.当前环节 = '交互场牌'; m.加入回合开始(x);
    expect(m.回合开始实例).toEqual([]);
    m.当前环节 = '回合开始'; m.加入回合开始(x);
    expect(m.回合开始实例).toEqual([x]);
  });

  it('TF-TV-08: two pending level-ups resolve one after another inside the turn start', () => {
    const rec: string[] = [];
    let 升级点 = 2;
    let picking = false;
    const h = harness({
      systems: {
        turn: spyTurn(['新回合后'], n => rec.push(n), { 新回合后: () => {} }),
        talents: {
          BP_Actor_Player: {
            升级玩家: s => {
              if (picking) return { 成功: false, 升级中: true };
              if (升级点 <= 0 || s.world.mode.当前环节 !== '回合开始') return { 成功: false, 升级中: false };
              升级点 -= 1; picking = true;
              s.world.mode.加入回合开始(s); // the talent pick (UI_主界面 ln 974)
              return { 成功: true, 升级中: false };
            },
          },
        },
      },
    });
    const m = h.w.mode;
    m.当前环节 = '回合开始';
    m.退出回合开始(null);
    expect([升级点, rec.length]).toEqual([1, 0]);
    picking = false; m.退出回合开始(h.hero); // pick #1 closes
    expect([升级点, rec.length]).toEqual([0, 0]);
    picking = false; m.退出回合开始(h.hero); // pick #2 closes
    expect(rec).toEqual(['新回合后']);
  });
});

describe('TURN-036 新回合后', () => {
  it('TF-TV-09: phase 2, or 12 when the cell reward is a shop or a rest; the gauge grows in both', () => {
    for (const [tag, phase] of [['能力.类型.奖励.复合奖励', '交互场牌'], ['能力.类型.奖励.是商店', '进入商店'], ['能力.类型.奖励.休息', '进入商店']] as const) {
      const rec: string[] = [];
      const h = harness({ systems: { turn: spyTurn(['增长行动度'], n => rec.push(n)) } });
      const m = h.w.mode;
      const reward = h.w.spawn(BP_Mission);
      reward.类型.add(tag);
      Object.assign(m.world.sys, { map: { ...m.world.sys.map, 当前所在格: () => ({ 奖励技能实例: reward, 已清理: false }) } });
      m.当前环节 = '回合开始';
      m.新回合后();
      expect(m.当前环节).toBe(phase);
      expect(rec).toEqual(['增长行动度']);
    }
  });

  it('TF-TV-41: the refill is not awaited: input opens while a refilled card is still hidden', () => {
    const h = harness();
    const m = h.w.mode;
    m.当前层回合 = 2;
    const Ea = h.enemy('Ea'); const Eb = h.enemy('Eb');
    Ea.精灵动画序列 = [null, null, null, 'CatapultHero/精灵片/AnimSequences/Test_出场'];
    Eb.精灵动画序列 = [null, null, null, 'CatapultHero/精灵片/AnimSequences/Test_出场'];
    m.敌方牌库.push(Ea, Eb);
    m.场上最多敌人数量 = 5;
    const ms = h.w.spawn(BP_Mission); ms.拥有者 = h.hero; m.当前任务实例 = ms;
    m.新回合前();
    expect(m.当前环节).toBe('交互场牌');
    expect(m.玩家控制器?.玩家可与环境交互).toBe(true);
    expect(m.敌方场上).toEqual([Ea, Eb]);
    // Ea's child activated synchronously (unhidden), Eb waits for Ea's delay
    const hidden = (o: object): boolean => (o as { bHiddenInGame?: boolean }).bHiddenInGame === true;
    expect(hidden(Ea)).toBe(false);
    expect(hidden(Eb)).toBe(true);
    h.w.clock.advance(0.5);
    expect(hidden(Eb)).toBe(false);
  });
});

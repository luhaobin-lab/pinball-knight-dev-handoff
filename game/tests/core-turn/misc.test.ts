/** TF-TV-27, 37 and the module's commands, legal list and view slice. */
import { describe, expect, it } from 'vitest';
import { BpObject } from '../../src/core/sim/object.ts';
import { BP_Mission } from '../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';
import { harness, type Harness } from './harness.ts';
import type { Systems } from '../../src/core/bp/systems.ts';

class 迷雾 extends BpObject { static override readonly path = 'Test/core-turn/迷雾'; }
const hidden = (o: object): boolean => (o as { bHiddenInGame?: boolean }).bHiddenInGame === true;

describe('TURN-005 the fog step of the room-type branch', () => {
  it('TF-TV-27: hidden unless 迷茫 or 传奇房 in combat rooms; shown in 探索房 unless in the tutorial', () => {
    const cases: [string, boolean, boolean][] = [
      ['简单战斗', false, true], ['简单战斗', true, false], ['传奇房', false, false], ['宝箱房', false, true], ['探索房', false, false], ['新手关05', false, true],
    ];
    for (const [row, 迷茫, want] of cases) {
      const systems: Partial<Systems> = { map: { 蓝图_动作游戏模式: { 创建地块: () => ({ 成功: true }), 摆放玩家: () => {} } } };
      const h = harness({ systems });
      const m = h.w.mode;
      m.迷雾图 = h.w.spawn(迷雾);
      if (迷茫) h.effect(h.hero, '迷茫', []).OwnedGameplayTags.add('x');
      if (迷茫) (h.w.sys.ability.函数库_工具 as Record<string, unknown>).存在同类效果 = () => ({ 存在相同被动: true, 存在的效果: null });
      m.当前层地图格配置表 = { DataTable: null, RowName: row };
      m.新一层();
      h.w.clock.advance(0.6);
      expect([row, hidden(m.迷雾图)]).toEqual([row, want]);
    }
  });
});

describe('TURN-083 (b) a failed mission with the hero alive (the slime escape)', () => {
  it('TF-TV-37: the escapes hold the barrier; the last one opens 新回合后 → Failure with no AI phase', () => {
    const h: Harness = harness({ systems: { ai: { 蓝图_动作游戏模式: { 预测AI行动: () => {} } } } });
    const m = h.w.mode;
    const ms = h.w.spawn(BP_Mission, x => { x.拥有者 = h.hero; x.能力名 = '消灭所有敌人'; });
    ms.类型.add('能力.类型.任务.杀敌');
    m.当前任务实例 = ms;
    m.当前层回合 = 6;
    const slimes = [h.enemy('盗宝黏菌', { field: true }), h.enemy('盗宝黏菌', { field: true }), h.enemy('盗宝黏菌', { field: true })];
    // 蓝图_效果_黏菌逃跑 (wave B): on 新一天时 at room turn 7 it joins the barrier and leaves when its animation ends
    for (const s of slimes) {
      h.effect(s, '逃跑', ['效果.时机.新一天时'], {
        hook: () => {
          if (!(m.当前层回合 > 6)) return;
          s.疲劳了 = false;
          m.加入回合开始(s);
          s.delay('ANIM', 0.5, () => {
            m.从场上移出_碰撞(s); m.添加到墓地(s);
            s.结束行动(null, '');
            ms.失败了 = true;
            m.退出回合开始(s);
          });
        },
      });
    }
    h.effect(h.hero, 'P', ['效果.时机.行动结束后'], { hook: () => h.calls.push('P −5') });
    m.新回合前();
    expect(m.回合开始实例).toEqual(slimes);
    expect(m.当前环节).toBe('回合开始');
    h.w.clock.advance(1);
    expect(m.当前环节).toBe('战斗统计');
    expect(h.w.modal.current).toMatchObject({ kind: 'panel', result: 'failure' });
    expect(m.场上有敌人).toBe(false);
    expect(h.calls.filter(c => c === 'P −5')).toHaveLength(1); // the panel's hidden action end, no AI phase
  });
});

describe('commands, legal, view', () => {
  it('legal lists the launch and the clickables only when input is open in phase 2; interact refuses unknown ids', () => {
    const h = harness();
    const m = h.w.mode;
    const ms = h.w.spawn(BP_Mission, x => { x.拥有者 = h.hero; });
    m.当前任务实例 = ms;
    const chest = h.enemy('任务宝箱');
    chest.OwnedGameplayTags.remove('可交互.角色.AI.仇恨');
    chest.OwnedGameplayTags.add('可交互.角色.AI.物品.关卡');
    m.场上所有.push(chest);
    m.当前环节 = '交互场牌';
    const legal = () => h.w.sys.turn.legal!(h.w);
    expect(legal()).toEqual([]);
    m.玩家控制器!.玩家可与环境交互 = true;
    expect(legal()).toEqual([{ type: 'aim.release' }, { type: 'interact', params: { actor: [chest.id] } }]);
    m.当前环节 = '进行战斗';
    expect(legal()).toEqual([]);
    expect(h.w.sys.turn.commands!.interact!(h.w, { type: 'interact', actor: 99999 }).ok).toBe(false);
    expect(h.w.sys.turn.commands!['aim.release']!(h.w, { type: 'aim.release', aim: { x: Number.NaN, y: 0 } }).ok).toBe(false);
  });

  it('the view slice: phase, inputOpen and the field in Demo order', () => {
    const h = harness();
    const m = h.w.mode;
    const a = h.enemy('眼球', { field: true });
    const b = h.enemy('守门人', { field: true, boss: true });
    a.当前生命 = { 系数: 5, 指数: 0 };
    m.当前环节 = '交互场牌';
    const v = h.w.sys.turn.view!(h.w);
    expect(v.phase).toBe('交互场牌');
    expect(v.inputOpen).toBe(false);
    expect(v.field?.map(f => [f.id, f.row, f.kind, f.hp])).toEqual([[a.id, '眼球', 'enemy', 5], [b.id, '守门人', 'boss', 0]]);
  });
});

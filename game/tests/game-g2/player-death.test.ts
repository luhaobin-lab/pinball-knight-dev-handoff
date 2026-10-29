import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { UI_战斗结束统计页 } from '../../src/core/bp/widgets.ts';
import { playRun } from '../../src/bot/runner.ts';
import type { BotGame } from '../../src/bot/api.ts';
import { sci } from '../../src/core/math/sci.ts';
import { FRAME } from '../../src/core/sim/clock.ts';

function firstRoom() {
  const g = createGame({ seed: 4, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  g.runUntilInput();
  expect(g.send({ type: 'title.newRun' }).ok).toBe(true);
  g.runUntilInput();
  expect(g.send({ type: 'hero.start' }).ok).toBe(true);
  g.runUntilInput();
  expect(g.send({ type: 'map.enter', cell: 'r1c0' }).ok).toBe(true);
  g.runUntilInput();
  return g;
}

describe('the source player death settlement', () => {
  it('a defeated hero waits for the imported death timeline plus one second, then Failure leads to run end', () => {
    const g = firstRoom(), hero = g.world.mode.玩家角色!;
    const duration = hero.def.timelines.全局时间变速.length;
    expect(duration).toBe(0.75);
    // Boundary fixture: damage is already resolved. Exercise the real death check and both result panels.
    hero.当前生命 = sci(-1);
    hero.检查死亡(false, false);
    const start = g.view.time;
    expect(hero.死掉了).toBe(true);
    expect(g.view.modal).toBeNull();
    g.advance(duration + 1 - FRAME);
    expect(g.view.modal).toBeNull();
    g.advance(FRAME);
    expect(g.view.time - start).toBeCloseTo(duration + 1, 9);
    expect(g.view.modal).toMatchObject({ kind: 'panel', result: 'failure' });
    expect(g.view.phase).toBe('战斗统计');
    expect(g.send({ type: 'panel.continue' }).ok).toBe(true);
    expect(g.runUntilInput(10)).toBe('ended');
    expect(g.view.screen).toBe('runEnd');
    expect(g.view.modal).toMatchObject({ kind: 'runEnd', demoComplete: false });
    expect(g.world.mode.轮回战斗统计.get('探险失败')).toBe(1);
  });

  it('frame stepping and event waiting settle the same fatal hit, while suicide uses its separate 0.5s branch', () => {
    const end = (frames: boolean) => {
      const g = firstRoom();
      g.world.mode.玩家角色!.检查死亡(true, true);
      if (frames) for (let i = 0; !g.view.modal && i < 180; i++) g.advance(FRAME);
      else expect(g.runUntilInput(10)).toBe('input');
      expect(g.view.modal).toMatchObject({ kind: 'panel', result: 'failure' });
      return g.digest();
    };
    expect(end(true)).toBe(end(false));
    const g = firstRoom(), hero = g.world.mode.玩家角色!;
    hero.自杀 = true;
    hero.检查死亡(true, true);
    g.advance(0.5 - FRAME);
    expect(g.view.screen).not.toBe('runEnd');
    g.advance(FRAME);
    expect(g.view.screen).toBe('runEnd');
    expect(g.view.modal).toBeNull(); // the run summary itself waits its documented additional one second
    expect(g.runUntilInput(10)).toBe('ended');
    expect(g.view.modal).toMatchObject({ kind: 'runEnd', demoComplete: false });
  });

  it('the suicide loading overlay and run-end preparation both block a covered Failure panel', () => {
    const g = firstRoom(), hero = g.world.mode.玩家角色!;
    // Source boundary: corruption kills during 新一天时, and the same new-round mission check opens Failure.
    // The source loading overlay must own input even while that old widget remains present underneath it.
    hero.腐化满过 = true;
    g.world.mode.当前腐化 = g.world.mode.最大腐化;
    expect(g.world.mode.增加腐化(1, false, hero).触发死亡).toBe(true);
    UI_战斗结束统计页.激活战斗统计页面(hero, false, false);
    expect(g.world.modal.current).toMatchObject({ kind: 'panel', result: 'failure' });
    const assertCovered = () => {
      expect(g.legal()).toEqual([]);
      const before = g.digest();
      expect(g.send({ type: 'panel.continue' }).ok).toBe(false);
      expect(g.send({ type: 'runEnd.continue' }).ok).toBe(false);
      expect(g.digest()).toBe(before);
    };
    assertCovered();
    g.advance(0.5 - FRAME);
    assertCovered();
    g.advance(FRAME);
    expect(g.view.screen).toBe('runEnd');
    expect(g.view.modal).toBeNull();
    expect(g.world.mode.轮回战斗统计.get('探险失败')).toBe(1);
    assertCovered();
    g.advance(1 - FRAME);
    assertCovered();
    g.advance(FRAME);
    expect(g.view.modal).toMatchObject({ kind: 'runEnd', demoComplete: false });
    expect(g.legal().map(c => c.type)).toEqual(['runEnd.continue']);
    expect(g.world.mode.轮回战斗统计.get('探险失败')).toBe(1);
  });

  it('source corruption death and new-round Failure overlap records one defeat without a covered panel click', () => {
    const g = firstRoom();
    const mode = g.world.mode, hero = mode.玩家角色!;
    // Historical seed38's natural path changed with source room RNG. Keep the exact mechanism as a boundary:
    // second corruption fill during a kill mission, followed by the real 新回合后 mission check.
    (mode.当前任务实例 as unknown as { 类型: { add(tag: string): void } }).类型.add('能力.类型.任务.杀敌');
    hero.腐化满过 = true; mode.当前腐化 = mode.最大腐化;
    expect(mode.增加腐化(1, false, hero).触发死亡).toBe(true);
    mode.新回合后();
    let deadPanelContinues = 0;
    const result = playRun(() => {
      const send = g.send;
      g.send = cmd => {
        if (cmd.type === 'panel.continue' && g.world.mode.玩家角色?.自杀) deadPanelContinues++;
        return send(cmd);
      };
      return g as unknown as BotGame;
    }, { seed: 38, runIndex: 37, policy: 'scripted', filter: 'ported', maxCommands: 10, maxSim: 10 });
    expect(result.outcome, result.reason).toBe('ended');
    expect(result.terminalReason).toBe('defeat');
    expect(g.world.mode.玩家角色).toMatchObject({ 死掉了: true, 自杀: true, 腐化满过: true });
    expect(g.view.hero!.hp).toBeGreaterThan(0);
    expect(deadPanelContinues).toBe(0);
    expect(g.world.mode.轮回战斗统计.get('探险失败')).toBe(1);
    expect(g.view.modal).toMatchObject({ kind: 'runEnd', demoComplete: false });
  }, 60_000);
});

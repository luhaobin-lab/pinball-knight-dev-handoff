import { describe, expect, it, vi } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { playRun } from '../../src/bot/runner.ts';
import type { BotGame } from '../../src/bot/api.ts';
import { fromJson } from '../../src/core/sys/save/ems.ts';
import { FRAME } from '../../src/core/sim/clock.ts';
import captured from './fixtures/seed516-failure-panel.json';
import { currentFirstRoom } from './fixtures/source-boundaries.ts';
import { 蓝图_效果_退出回合开始检查 } from '../../src/content/bp/Skill/效果/蓝图_效果_退出回合开始检查.ts';

/** Source boundary: a real current room and normal death settlement, plus the source barrier class.
 * Historical seed516 prefix remains untouched in seed516-failure-panel.json (89d332c); new source room RNG no
 * longer reproduces its floor4 scene. This deliberately verifies the same retry lifecycle independently of luck.
 */
function failurePanel() {
  const game = currentFirstRoom(captured.seed), hero = game.world.mode.玩家角色!;
  hero.检查死亡(true, true); // real source non-suicide death timeline -> Failure
  game.advance(1.75);
  expect(game.view.modal).toMatchObject({ kind: 'panel', result: 'failure', canRetry: true });
  expect(hero.死掉了).toBe(true);
  const barrier = game.world.spawn(蓝图_效果_退出回合开始检查, e => { e.拥有者 = hero; e.释放者 = hero; e.持续时长 = -1; });
  barrier.K2_AttachToActor(hero); hero.拥有的效果.push(barrier); barrier.激活效果('');
  return game;
}

describe('G2 seed516 failure retry uses source UIF L2054 OpenLevel and EMS snapshot', () => {
  it('blocks input for the source .5 delay, reloads a fresh living hero on the same floor, restores snapshot RNG and charges corruption once', () => {
    const game = failurePanel(), w = game.world, oldHero = w.mode.玩家角色!;
    const save = game.save(), snapshot = save.run!.actorSnapshot as { mode: Record<string, unknown>; rng: unknown };
    const oldEffects = oldHero.拥有的效果.filter(e => e?.valid && e.拥有者 === oldHero);
    const barrier = oldEffects.find(e => e?.def.name === '蓝图_效果_退出回合开始检查');
    expect(barrier).toBeDefined();
    const floor = game.view.run!.floor;
    let restoredRng: unknown;
    const originalLoad = w.mode.OnCompleted_CA3908B4440EBB3BF905F9BD2B9266E2.bind(w.mode);
    vi.spyOn(w.mode, 'OnCompleted_CA3908B4440EBB3BF905F9BD2B9266E2').mockImplementation(() => {
      originalLoad(); restoredRng = w.rng.save();
    });
    expect(game.send({ type: 'panel.retry' }).ok).toBe(true);
    expect(game.legal()).toEqual([]);
    expect(game.save().run!['重置房间？']).toBe(true);
    const before = game.digest();
    expect(game.send({ type: 'item.use', item: 249 }).ok).toBe(false);
    expect(game.send({ type: 'panel.retry' }).ok).toBe(false);
    expect(game.digest()).toBe(before);
    game.advance(0.49);
    expect(oldHero.valid).toBe(true); expect(w.mode.玩家角色).toBe(oldHero);
    game.advance(0.02);
    expect(oldHero.valid).toBe(false); expect(w.mode.玩家角色).not.toBe(oldHero);
    expect(game.runUntilInput(10)).toBe('input');
    expect(restoredRng).toEqual(fromJson(snapshot.rng));
    expect(w.mode.玩家角色!.死掉了).toBe(false);
    expect(game.view.hero!.hp).toBeGreaterThan(0);
    expect(game.view.run!.floor).toBe(floor);
    expect(w.mode.金币).toBe(snapshot.mode.金币);
    expect(w.mode.当前腐化).toBe(Number(snapshot.mode.当前腐化) + 10);
    expect(game.save().meta).toEqual(save.meta);
    expect(game.save().run!['重置房间？']).toBe(false);
    expect(game.legal().some(s => s.type === 'aim.release')).toBe(true);
    for (const e of oldEffects) if (e) expect(e.valid, e.def.name).toBe(false);
    expect(w.scheduler.pending().some(e => e.owner === oldHero || oldEffects.includes(e.owner as never))).toBe(false);
    const corruption = w.mode.当前腐化;
    game.advance(3);
    expect(w.mode.当前腐化).toBe(corruption); expect(game.view.modal).toBeNull();
  });

  it('frame stepping and event waiting agree after the source failure-boundary retry', () => {
    const a = failurePanel(), b = failurePanel();
    a.send({ type: 'panel.retry' }); b.send({ type: 'panel.retry' });
    expect(a.runUntilInput(10)).toBe('input');
    for (let i = 0; i < 600 && b.view.time < a.view.time; i++) b.advance(Math.min(FRAME, a.view.time - b.view.time));
    expect(b.legal().some(s => s.type === 'aim.release')).toBe(true);
    expect(b.digest()).toBe(a.digest());
  });

  it('the original random seed516/runIndex515 terminates through its actual source input without the 600-second softlock', () => {
    const result = playRun(o => createGame({ ...o, content: registry }) as unknown as BotGame,
      { seed: 516, runIndex: 515, policy: 'random', filter: 'ported', maxSim: 7200, maxCommands: 20000 });
    expect(result.outcome).toBe('ended');
    // Expanded source item pools and optional enchant actions change this random policy's decision sequence.
    // Current trace (studio/reports/parity-seed516-0452.json) explicitly opens the menu then chooses abandon.
    // Failure retry is still exercised independently in the three source-boundary tests in this file.
    expect(result.terminalReason).toBe('abandoned');
    expect(result.commandLog.slice(-2)).toEqual([{ type: 'menu.open' }, { type: 'warning.answer', button: 1 }]);
    // The full source-room algorithm legitimately changes the path and number of retries. Two explicit retries
    // are verified below; the old63-command capture stays available against its historical commit.
    expect(result.commands).toBeLessThan(200);
    expect(result.simSeconds).toBeLessThan(600);
  });

  it('allows two successive source Failure retries without retaining a dead hero or a stale barrier', () => {
    const game = failurePanel();
    for (let i = 0; i < 2; i++) {
      const old = game.world.mode.玩家角色!;
      expect(game.send({ type: 'panel.retry' }).ok).toBe(true);
      expect(game.runUntilInput(10)).toBe('input');
      expect(old.valid).toBe(false);
      expect(game.world.mode.玩家角色!.死掉了).toBe(false);
      if (i === 0) {
        game.world.mode.玩家角色!.检查死亡(true, true);
        game.advance(1.75);
        expect(game.view.modal).toMatchObject({ kind: 'panel', result: 'failure', canRetry: true });
      }
    }
  });
});

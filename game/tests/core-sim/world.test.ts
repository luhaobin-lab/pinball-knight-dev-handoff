import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { 蓝图_动画结算 } from '../../src/core/sim/settlement.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { createWorld, CoreError, type SimWorld, type WorldOptions } from '../../src/core/sim/runtime.ts';
import { openBarrierModal } from '../../src/core/sim/modal.ts';
import { isHiddenInGame } from '../../src/core/sim/engine.ts';
import type { ContentRegistry, BpCtor } from '../../src/core/sim/types.ts';
import type { Systems } from '../../src/core/bp/systems.ts';

const LEVEL_UP = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_升级获取天赋';
const SETTLE = 'CatapultHero/BP/动画/蓝图_动画结算';

function contentOf(...classes: BpCtor[]): ContentRegistry {
  const m = new Map(classes.map(c => [c.path, c]));
  return { get: p => m.get(p), get size() { return m.size; }, paths: () => [...m.keys()] };
}

function world(o: Partial<WorldOptions> = {}): SimWorld {
  return createWorld({ content: registry, seed: 7, ...o });
}

class 测试效果 extends 蓝图_效果 {
  static override readonly path = 'Test/测试效果';
  计数 = 2;
  起始 = -1;
  override ReceiveBeginPlay(): void { this.起始 = this.计数; }
}

describe('spawn and destroy', () => {
  it('constructs with CDO defaults, runs init, then ReceiveBeginPlay; ids are monotonic', () => {
    const w = world({ content: contentOf(测试效果) });
    const a = w.spawn(测试效果, x => { x.计数 = 5; });
    const b = w.spawn(测试效果);
    expect(a.起始).toBe(5);
    expect(b.起始).toBe(2);
    expect(b.id).toBe(a.id + 1);
    expect(a.持续回合).toBe(-1); // the generated 蓝图_效果 CDO default
    expect(w.objectById(a.id)).toBe(a);
  });

  it('ids are deterministic: the same spawns give the same ids', () => {
    const ids = () => { const w = world({ content: contentOf(测试效果) }); return [w.spawn(测试效果).id, w.spawn(测试效果).id]; };
    expect(ids()).toEqual(ids());
  });

  it('destroy marks invalid, cancels scheduled entries and keeps array slots (TURN-102)', () => {
    const w = world({ content: contentOf(测试效果) });
    const a = w.spawn(测试效果), b = w.spawn(测试效果);
    const list: 测试效果[] = [a, b];
    let fired = 0;
    a.delay('L1', 0.1, () => fired++);
    a.setTimer('t', 0.05, true, () => fired++);
    w.clock.after(0.2, () => fired++, a);
    a.K2_DestroyActor();
    w.clock.advance(1);
    expect(fired).toBe(0);
    expect(w.isValid(a)).toBe(false);
    expect(w.isValid(b)).toBe(true);
    expect(list).toHaveLength(2);
    expect(list.filter(x => w.isValid(x))).toEqual([b]);
    a.K2_DestroyActor(); // a second destroy is a no-op
  });
});

describe('stubs, unported and strict mode', () => {
  it('a class without a module spawns as a manifest stub and counts in coverage', () => {
    const w = world({ content: contentOf() });
    const e = w.spawn<蓝图_效果>(LEVEL_UP);
    expect(e).toBeInstanceOf(蓝图_效果);
    expect(e.def.path).toBe(LEVEL_UP);
    w.spawn(LEVEL_UP);
    expect(w.counters.report().stubs[LEVEL_UP]).toBe(2);
    expect(w.isPorted(LEVEL_UP)).toBe(false);
    expect(w.isPorted(SETTLE)).toBe(true);
  });

  it('strict mode throws on stubs and unported functions; non-strict counts them', () => {
    const s = world({ strict: true, content: contentOf() });
    expect(() => s.spawn(LEVEL_UP)).toThrow(CoreError);
    expect(() => s.unported('BP_ManeActor.终结目标')).toThrow(/终结目标/);
    const w = world();
    w.unported('BP_ManeActor.终结目标');
    w.unported('BP_ManeActor.终结目标');
    expect(w.coverage.counts.get('BP_ManeActor.终结目标')).toBe(2);
  });

  it('isRowPorted: every class referencing the row must be registered', () => {
    const w = world({ content: contentOf() });
    expect(w.isRowPorted('数据表_天赋_新新通用', '力量')).toBe(false);
    expect(w.isRowPorted('数据表_天赋_新新通用', '不存在的行')).toBe(true);
  });

  it('timeline length and tracks come from the class manifest', () => {
    const w = world();
    const e = w.spawn<蓝图_效果>(LEVEL_UP);
    const ups: number[] = [];
    let done = -1;
    e.timeline('时间轴', 'PlayFromStart', { update: (_t, tr) => ups.push(tr.粒子高度), finished: () => { done = w.clock.now; } });
    w.clock.advance(3);
    expect(done).toBeCloseTo(1.6, 9);
    expect(ups).toHaveLength(96);
    expect(ups.every(Number.isFinite)).toBe(true);
  });
});

/** A settlement tree under test: phase 创建房间, doubles for the turn module's hooks. */
function settleWorld(log: string[]): SimWorld {
  const w = world({
    systems: {
      turn: {
        蓝图_动作游戏模式: { 房间完毕触发时机: () => { log.push(`房间完毕 ${w.clock.now.toFixed(4)}`); } },
        BP_ManeActor: { 结束行动: (_self: BP_ManeActor, 实例: { id: number } | null) => { log.push(`结束行动 #${实例?.id} ${w.clock.now.toFixed(4)}`); } },
      },
      ability: { 蓝图_效果: { 额外子触发: (self: 蓝图_效果) => { log.push(`额外子触发 ${self.id} ${w.clock.now.toFixed(4)}`); }, ReceiveBeginPlay: () => {} } },
    } as unknown as Partial<Systems>,
  });
  return w;
}

describe('settlements (蓝图_动画结算, TURN-012/013/050)', () => {
  it('children run one after another; 结算结束判断 fires 房间完毕触发时机 in phase 创建房间, then cleans up', () => {
    const log: string[] = [];
    const w = settleWorld(log);
    w.mode.当前环节 = '创建房间';
    const enemy = w.spawn(BP_Actor_Other);
    const kids = [0.2, 0.3].map(d => w.spawn(蓝图_动画结算, s => { s.延迟 = d; s.结算类型 = '被揭示'; s.动画对象 = enemy; }));
    w.mode.模式动画结算数组.push(...kids);
    w.mode.开始动画结算();
    const root = w.mode.当前模式结算实例!;
    expect(root.结算类型).toBe('无');
    expect(w.mode.所有动画结算数组).toEqual([root, kids[0]]);
    w.clock.advance(0.25);
    expect(w.mode.所有动画结算数组).toEqual([kids[1]]); // the root's own 0 s delay ended; kid 0 done at 0.2
    w.clock.advance(1);
    expect(log).toEqual(['房间完毕 0.5000']);
    expect([root, ...kids].map(s => w.isValid(s))).toEqual([false, false, false]);
    expect(w.mode.所有动画结算数组).toEqual([]);
    expect(w.mode.待销毁动画结算数组).toEqual([]);
  });

  it('outside phase 创建房间 the tree ends without 房间完毕触发时机', () => {
    const log: string[] = [];
    const w = settleWorld(log);
    w.mode.当前环节 = '交互场牌';
    w.mode.模式动画结算数组.push(w.spawn(蓝图_动画结算, s => { s.延迟 = 0.1; }));
    w.mode.开始动画结算();
    w.clock.advance(1);
    expect(log).toEqual([]);
  });

  it('echo settlements (TF-TV-29): 额外子触发 and the barrier release at 0, 0.3, 0.6 s', () => {
    const log: string[] = [];
    const w = settleWorld(log);
    w.mode.当前环节 = '进行战斗';
    const hero = w.spawn(BP_Actor_Other);
    const effect = w.spawn(测试效果);
    const echoes = [0, 1, 2].map(() => w.spawn(蓝图_动画结算, s => {
      s.延迟 = 0.3; s.结算类型 = '连击结算'; s.动画对象 = effect; s.来自角色 = hero;
    }));
    w.mode.模式动画结算数组.push(w.spawn(蓝图_动画结算, s => { s.延迟 = 0; s.子动画结算 = [...echoes]; s.结算类型 = '无'; }));
    w.mode.开始动画结算();
    w.clock.advance(2);
    const e = effect.id;
    expect(log).toEqual([
      `额外子触发 ${e} 0.0000`, `结束行动 #${echoes[0].id} 0.0000`,
      `额外子触发 ${e} 0.3000`, `结束行动 #${echoes[1].id} 0.3000`,
      `额外子触发 ${e} 0.6000`, `结束行动 #${echoes[2].id} 0.6000`,
    ]);
  });

  it('到战斗: unhides the actor; a boss waits for its appearance animation', () => {
    const log: string[] = [];
    const w = settleWorld(log);
    w.mode.当前环节 = '创建房间';
    const seq = 'CatapultHero/精灵片/AnimSequences/Actor_C01_Attack'; // 0.4 s
    const mk = (boss: boolean) => w.spawn(BP_Actor_Other, a => {
      a.精灵动画序列 = [null, null, null, seq];
      if (boss) a.OwnedGameplayTags.add('可交互.角色.AI.仇恨.首领');
    });
    const boss = mk(true);
    w.mode.模式动画结算数组.push(w.spawn(蓝图_动画结算, s => { s.结算类型 = '到战斗'; s.动画对象 = boss; s.延迟 = 0.1; }));
    w.mode.开始动画结算();
    expect(isHiddenInGame(boss)).toBe(false);
    w.clock.advance(2);
    // the boss's settlement ends after anim 0.4 s + its own 0.1 s
    expect(log).toEqual(['房间完毕 0.5000']);
    const anims = w.events.drain().filter(e => e.kind === 'actor.anim');
    expect(anims).toMatchObject([{ id: boss.id, sequence: seq, seconds: 0.4 }]);
  });

  it('开始动画结算 reuses a still-valid running container (TURN-GAP-19)', () => {
    const w = settleWorld([]);
    w.mode.当前环节 = '进行战斗';
    w.mode.模式动画结算数组.push(w.spawn(蓝图_动画结算, s => { s.延迟 = 1; }));
    w.mode.开始动画结算();
    const root = w.mode.当前模式结算实例;
    w.mode.开始动画结算();
    expect(w.mode.当前模式结算实例).toBe(root);
  });
});

describe('modal service', () => {
  it('a barrier modal joins the turn start on open and leaves it on close (TURN-034/035)', () => {
    const log: string[] = [];
    const w = world({
      systems: { turn: { 蓝图_动作游戏模式: { 加入回合开始: () => { log.push('加入'); }, 退出回合开始: () => { log.push('退出'); } } } } as unknown as Partial<Systems>,
    });
    const answers: string[] = [];
    openBarrierModal(w, { kind: 'warning', type: 0, buttons: ['a', 'b'] } as never, a => { answers.push(a.type); w.modal.close(); });
    expect(w.modal.current).not.toBeNull();
    expect(w.modal.answer({ type: 'warning.answer', button: 0 })).toBe(true);
    expect(answers).toEqual(['warning.answer']);
    expect(log).toEqual(['加入', '退出']);
    expect(w.modal.answer({ type: 'warning.answer', button: 0 })).toBe(false);
  });
});

describe('trace', () => {
  it('sphere traces return the actor bodies along the sweep in order; line traces the first', () => {
    const w = world();
    const a = w.spawn(BP_Actor_Other, x => { x.宽度 = 20; }, { x: 100, y: 0, z: 0 });
    const b = w.spawn(BP_Actor_Other, x => { x.宽度 = 20; }, { x: 300, y: 0, z: 0 });
    w.spawn(BP_Actor_Other, x => { x.宽度 = 20; }, { x: 300, y: 200, z: 0 });
    const hits = w.trace.sphere({ x: 0, y: 0, z: 0 }, { x: 500, y: 0, z: 0 }, 10, 'Visibility');
    expect(hits.map(h => h.actor)).toEqual([a, b]);
    expect(w.trace.line({ x: 0, y: 0, z: 0 }, { x: 500, y: 0, z: 0 }, 'Visibility', [a])?.actor).toBe(b);
    expect(w.trace.line({ x: 0, y: 100, z: 0 }, { x: 500, y: 100, z: 0 }, 'Visibility')).toBeNull();
  });
});

describe('createGame', () => {
  it('starts on the title screen; unknown or illegal commands return { ok: false } without throwing', () => {
    const g = createGame({ seed: 1, content: registry });
    expect(g.view.screen).toBe('title');
    expect(g.legal().map(s => s.type)).toEqual(['title.settings']);
    expect(g.send({ type: 'hero.start' })).toMatchObject({ ok: false });
    expect(g.send({ type: 'title.prologue' })).toMatchObject({ ok: false });
    expect(g.send(null as never)).toMatchObject({ ok: false });
    expect(g.send({ type: 'nope' } as never)).toMatchObject({ ok: false });
    expect(g.runUntilInput()).toBe('input');
    expect(g.legal().map(s => s.type)).toContain('title.prologue');
  });

  it('the boot emits the main-menu BGM and runs the game mode tick', () => {
    const g = createGame({ seed: 1, content: registry });
    expect(g.drainEvents().some(e => e.kind === 'bgm' && e.state === '主界面')).toBe(true);
    const before = g.world.mode.每回合计时;
    g.advance(0.5);
    expect(g.world.mode.每回合计时 - before).toBeCloseTo(0.5, 5);
  });

  it('the same seed and commands give the same digest; another seed gives another', () => {
    const run = (seed: number) => {
      const g = createGame({ seed, content: registry, debug: { skipPrologue: true } });
      g.runUntilInput();
      expect(g.send({ type: 'title.newRun' }).ok).toBe(true);
      for (let i = 0; i < 30; i++) g.advance(1 / 60);
      g.runUntilInput(5);
      return g.digest();
    };
    expect(run(3)).toBe(run(3));
    expect(run(3)).not.toBe(run(4));
  });

  it('advance in frames and runUntil reach the same state', () => {
    const a = createGame({ seed: 9, content: registry });
    for (let i = 0; i < 60; i++) a.advance(1 / 60);
    const b = createGame({ seed: 9, content: registry });
    b.advance(1);
    expect(a.digest()).toBe(b.digest());
  });

  it('the real loading-to-input boundary has the same full digest under event jumps and frame playback', () => {
    const opts = { seed: 1, content: registry, filter: 'ported' as const, debug: { skipPrologue: true } };
    const a = createGame(opts), b = createGame(opts);
    expect(a.runUntilInput()).toBe('input');
    while (b.view.time < a.view.time - 1e-9) b.advance(Math.min(1 / 60, a.view.time - b.view.time));
    expect(a.digest()).toBe(b.digest());
    expect(a.send({ type: 'title.newRun' }).ok).toBe(true);
    expect(b.send({ type: 'title.newRun' }).ok).toBe(true);
    expect(a.digest()).toBe(b.digest());
  });
});

describe('createGame and the modal service', () => {
  it('an open modal makes its answers legal and routes them to its handler', () => {
    const g = createGame({ seed: 1, content: registry });
    expect(g.runUntilInput(10)).toBe('input');
    const got: unknown[] = [];
    g.world.modal.open({ kind: 'panel', result: 'victory', lines: [], canRetry: false }, a => { got.push(a); g.world.modal.close(); });
    expect(g.legal()).toEqual([{ type: 'panel.continue' }]);
    expect(g.send({ type: 'panel.retry' }).ok).toBe(false);
    expect(g.send({ type: 'panel.continue' }).ok).toBe(true);
    expect(got).toEqual([{ type: 'panel.continue' }]);
    expect(g.view.modal).toBeNull();
  });
});

describe('createGame input validation', () => {
  it('refuses parameters outside the legal values', () => {
    const g = createGame({ seed: 1, content: registry });
    expect(g.runUntilInput(10)).toBe('input');
    const picks: number[] = [];
    g.world.modal.open({ kind: 'multiChoice', source: 'levelUp', title: '', options: [{ row: 'a', title: '', text: '', level: 1, icon: '' }], reroll: null, canSkip: false }, a => { if (a.type === 'modal.pick') picks.push(a.option); });
    expect(g.send({ type: 'modal.pick', option: 3 }).ok).toBe(false);
    expect(g.send({ type: 'modal.skip' }).ok).toBe(false);
    expect(g.send({ type: 'modal.pick', option: 0 }).ok).toBe(true);
    expect(picks).toEqual([0]);
  });
});

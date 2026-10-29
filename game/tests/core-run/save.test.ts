import { describe, expect, it } from 'vitest';
import type { ModalView } from '../../src/core/api/view.ts';
import { makeGame, step, type TestGame } from './doubles.ts';

const warning = (g: TestGame): Extract<ModalView, { kind: 'warning' }> | null => {
  const m = g.view.modal;
  return m && m.kind === 'warning' ? m : null;
};

/** Close the warning without answering (the dialog's close button, WARN L3762). */
function closeWarning(g: TestGame): void {
  g.world.modal.close();
  const u = g.world.objects().find(o => o.def.path === 'core-run/运行界面') as unknown as { 警告中: boolean };
  u.警告中 = false;
}

/** A run on the map after `rooms` rooms (floors 5, so the map keeps offering rooms). */
function onMap(rooms: number, o: Parameters<typeof makeGame>[0] = {}): TestGame {
  const g = makeGame({ floors: 5, ...o });
  g.runUntilInput(10);
  step(g, { type: 'title.newRun' });
  step(g, { type: 'hero.start' });
  for (let i = 0; i < rooms; i++) step(g, { type: 'map.enter', cell: 'r1c1' });
  return g;
}

describe('core-run: the pause dialog (UI_警告提示 type 0, BAR L1056)', () => {
  it('button 1 reads 保存并退出 on the map (9), in the item box (18) and in the prologue, else 重置房间（+10腐化）', () => {
    const g = onMap(0);
    step(g, { type: 'menu.open' });
    expect(warning(g)).toEqual({ kind: 'warning', type: 0, text: '结束本次探险？', buttons: ['保存并退出', '放弃探险'] });
    closeWarning(g);
    const cases = [['回合开始', '重置房间（+10腐化）'], ['交互场牌', '重置房间（+10腐化）'], ['物品盒子', '保存并退出'], ['选择地图', '保存并退出']] as const;
    for (const [phase, label] of cases) {
      g.world.mode.当前环节 = phase;
      expect(g.legal().map(s => s.type)).toContain('menu.open');
      g.send({ type: 'menu.open' });
      expect(warning(g)?.buttons[0]).toBe(label);
      closeWarning(g);
    }
    for (const phase of ['进行战斗', '战斗统计', '选择路口'] as const) {
      g.world.mode.当前环节 = phase;
      expect(g.legal().map(s => s.type)).not.toContain('menu.open');
      expect(g.send({ type: 'menu.open' }).ok).toBe(false);
    }
  });

  it('in the prologue the room dialog offers 保存并退出', () => {
    const g = makeGame({ debug: {}, floors: 3 });
    g.runUntilInput(10);
    step(g, { type: 'title.prologue' });
    g.send({ type: 'map.enter', cell: 'r1c1' });
    step(g, { type: 'menu.open' });
    expect(warning(g)?.buttons).toEqual(['保存并退出', '放弃探险']);
  });

  it('重置房间: +10 Corruption and the room is rebuilt from the room-start snapshot (WARN L806, GM L28466)', () => {
    const g = onMap(1);
    g.send({ type: 'map.enter', cell: 'r1c1' });
    expect(g.view.screen).toBe('room');
    g.world.mode.金币 = 99; // changed after the room-start snapshot: the reset restores 8
    step(g, { type: 'menu.open' });
    g.send({ type: 'warning.answer', button: 0 });
    g.advance(1.6);
    expect(g.world.mode.当前腐化).toBe(10);
    expect(g.world.mode.金币).toBe(8);
    expect(g.world.mode.当前关卡层数).toBe(2);
    expect(g.save().run?.['重置房间？']).toBe(false);
    // the rebuilt room completes (double) and the map opens again
    g.runUntilInput(10);
    expect(g.view.screen).toBe('map');
  });

  it('保存并退出 quits (QuitGame): the core accepts nothing more and the save holds the map snapshot', () => {
    const g = onMap(1);
    step(g, { type: 'menu.open' });
    g.drainEvents();
    g.send({ type: 'warning.answer', button: 0 });
    // QuitGame closes the Demo; the core's own commands stop (other modules' specs are the shell's to ignore).
    expect(g.legal().map(s => s.type)).not.toContain('menu.open');
    expect(g.drainEvents().some(e => e.kind === 'ui' && e.widget === 'game' && e.op === 'close')).toBe(true);
    expect(g.save().run?.['当前环节']).toBe('选择地图');
  });

  it('放弃探险 kills the hero: Failure → run end 探险失败 −100 (QUIRK: 自我放弃 is never counted)', () => {
    const g = onMap(1);
    step(g, { type: 'menu.open' });
    step(g, { type: 'warning.answer', button: 1 });
    const m = g.view.modal;
    expect(m?.kind).toBe('runEnd');
    if (m?.kind !== 'runEnd') return;
    expect(m.lines.map(l => l.label)).toEqual(['探险失败', '反弹', '探险失败']);
    expect(m.score).toBe(10 - 100);
    step(g, { type: 'runEnd.continue' });
    expect(g.view.screen).toBe('title');
  });
});

describe('core-run: save v0 and the resume prompt (EMS_基础存档, GM L27905–L29825)', () => {
  it('the blob is versioned JSON with the meta and run fields', () => {
    const g = onMap(2);
    const blob = g.save();
    expect(blob.version).toBe(0);
    expect(JSON.parse(JSON.stringify(blob))).toEqual(blob);
    for (const k of ['探索等级进度', '已解锁配方', '已解锁机制', '已解锁天赋', '主线任务', '新手关过？', '已触发新手提示', '被选择头像序号']) expect(blob.meta).toHaveProperty(k);
    for (const k of ['地图格存档数组', '当前关卡选项', '关卡地图切换', '新手关中？', '重置房间？']) expect(blob.run).toHaveProperty(k);
    expect(blob.run?.['当前环节']).toBe('选择地图');
    const snap = blob.run?.actorSnapshot as { mode: Record<string, unknown>; hero: Record<string, unknown> };
    expect(snap.mode['当前关卡层数']).toBe(2);
    expect(snap.mode['当前英雄角色名']).toBe('幽冥骑士');
    expect(snap.hero['名字']).toBe('幽冥骑士');
  });

  it('loading a map save shows warning type 2 (回忆 / 遗忘); QUIRK: the map phase gets it too', () => {
    const blob = onMap(2).save();
    const g = makeGame({ floors: 5, save: blob });
    g.runUntilInput(10);
    expect(warning(g)).toEqual({ kind: 'warning', type: 2, text: '上一次的记忆还未丢失，是否回忆？', buttons: ['回忆', '遗忘'] });
    expect(g.world.mode.当前关卡层数).toBe(2);
    expect(g.world.mode.当前关卡名).toBe('遗迹');
  });

  it('回忆 resumes on the map; 遗忘 abandons the run and returns to the camp', () => {
    const blob = onMap(2).save();
    const a = makeGame({ floors: 5, save: blob });
    a.runUntilInput(10);
    step(a, { type: 'warning.answer', button: 0 });
    expect(a.view.screen).toBe('map');
    expect(a.view.run).toMatchObject({ chapter: '遗迹', floor: 2, 金币: 8 });
    step(a, { type: 'map.enter', cell: 'r1c1' });
    expect(a.world.mode.当前关卡层数).toBe(3);

    const b = makeGame({ floors: 5, save: blob });
    b.runUntilInput(10);
    step(b, { type: 'warning.answer', button: 1 });
    expect(b.view.screen).toBe('title');
    expect(b.world.mode.当前关卡层数).toBe(0);
  });

  it('a camp save loads straight to the camp (L27982)', () => {
    const g = makeGame();
    g.runUntilInput(10);
    const h = makeGame({ save: g.save() });
    expect(h.runUntilInput(10)).toBe('input');
    expect(h.view.screen).toBe('title');
    expect(h.view.modal).toBeNull();
  });

  it('save → load at phase 9 → identical digest after the same commands', () => {
    const blob = onMap(1).save();
    const script = (): { digest: string; meta: unknown } => {
      const g = makeGame({ floors: 3, save: blob });
      g.runUntilInput(10);
      step(g, { type: 'warning.answer', button: 0 });
      step(g, { type: 'map.enter', cell: 'r1c1' });
      step(g, { type: 'map.enter', cell: 'r1c1' });
      step(g, { type: 'map.option', option: '营地' });
      step(g, { type: 'runEnd.continue' });
      return { digest: g.digest(), meta: g.save().meta };
    };
    const x = script();
    const y = script();
    expect(x.digest).toBe(y.digest);
    expect(x.meta).toEqual(y.meta);
    // The resumed run finished: 3 rooms of 10 bounces + 完成探险.
    expect((x.meta as Record<string, unknown>)['探索等级进度']).toEqual({ $map: [['总值', { 当前解锁分: 530, 每级所需分: 500, 当前解锁等级: 1, 最高解锁等级: 35 }]] });
  });

  it('the camp save keeps the meta progress across a reload', () => {
    const g = makeGame({ floors: 1 });
    g.runUntilInput(10);
    step(g, { type: 'title.newRun' });
    step(g, { type: 'hero.start' });
    step(g, { type: 'map.enter', cell: 'r1c1' });
    step(g, { type: 'map.option', option: '营地' });
    step(g, { type: 'runEnd.continue' });
    const blob = g.save();
    const h = makeGame({ save: blob, debug: {} });
    h.runUntilInput(10);
    expect(h.save().meta).toEqual(blob.meta);
    expect(h.view.title?.newRun).toBe(true);
  });
});

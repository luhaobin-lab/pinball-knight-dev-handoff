import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { makeGame, playRun, step } from './doubles.ts';

const types = (g: { legal(): readonly { type: string }[] }): string[] => g.legal().map(s => s.type);

describe('core-run: screens and the scripted run (A21 acceptance 1)', () => {
  it('boots to the camp main menu: 序幕 always, 新的冒险 only after the prologue (MENU L2178)', () => {
    const fresh = createGame({ seed: 1, content: registry });
    expect(fresh.runUntilInput(10)).toBe('input');
    expect(fresh.view.screen).toBe('title');
    expect(fresh.view.phase).toBe('进入营地');
    expect(types(fresh)).toEqual(['title.prologue', 'title.settings', 'title.quit']);
    expect(fresh.view.title).toMatchObject({ prologue: true, newRun: false, quest: { title: '凝视深渊', need: 60 } });

    const passed = createGame({ seed: 1, content: registry, debug: { skipPrologue: true } });
    passed.runUntilInput(10);
    expect(types(passed)).toEqual(['title.prologue', 'title.newRun', 'title.settings', 'title.quit']);
    expect(passed.send({ type: 'hero.start' }).ok).toBe(false);
  });

  it('the boot runs the run reset (英雄死亡后初始化, GM ln 2625–2651)', () => {
    const g = makeGame();
    g.runUntilInput(10);
    const m = g.world.mode;
    expect([m.金币, m.收入, m.英雄等级, m.当前经验, m.最大经验, m.当前腐化, m.最大腐化, m.通过关卡数]).toEqual([8, 5, 1, 0, 150, 0, 100, 0]);
    expect(m.玩家角色?.名字).toBe('幽冥骑士');
    expect(g.view.title?.newRun).toBe(true);
  });

  it('title → hero select → map → rooms → 营地 → run end → title from a command list', () => {
    const g = makeGame({ floors: 3 });
    g.runUntilInput(10);
    step(g, { type: 'title.newRun' });
    expect(g.view.screen).toBe('heroSelect');
    expect(g.view.heroSelect?.heroes.map(h => [h.row, h.unlocked])).toEqual([['幽冥骑士', true], ['灵魂猎手', false]]);
    step(g, { type: 'hero.start' });
    expect(g.view.screen).toBe('map');
    expect(g.view.run).toMatchObject({ chapter: '遗迹', floors: 12, 金币: 8, 英雄等级: 1, 经验: 0, 升级经验: 150 });
    expect(g.view.run?.quest).toEqual([{ text: '凝视深渊', done: false }]);
    for (let i = 0; i < 3; i++) {
      g.send({ type: 'map.enter', cell: 'r1c1' });
      expect(g.view.screen).toBe('room');
      expect(g.runUntilInput(30)).toBe('input');
      expect(g.view.screen).toBe('map');
    }
    step(g, { type: 'map.option', option: '营地' });
    expect(g.view.screen).toBe('runEnd');
    expect(g.view.modal).toMatchObject({ kind: 'runEnd', score: 1030, demoComplete: true, exploration: { level: 1, progress: 530, need: 1000 } });
    expect(g.view.phase).toBe('死亡结算');
    step(g, { type: 'runEnd.continue' });
    expect(g.view.screen).toBe('title');
    expect(g.view.phase).toBe('进入营地');
    expect(types(g)).toContain('title.newRun');
    // The next run starts from a fresh reset.
    expect([g.world.mode.通过关卡数, g.world.mode.金币, g.world.mode.当前关卡层数]).toEqual([0, 8, 0]);
    expect(g.save().meta['探索等级进度']).toEqual({ $map: [['总值', { 当前解锁分: 530, 每级所需分: 500, 当前解锁等级: 1, 最高解锁等级: 35 }]] });
  });

  it('the run end waits 1.0 s before it takes input (END 更新完毕？)', () => {
    const g = makeGame({ floors: 1 });
    g.runUntilInput(10);
    step(g, { type: 'title.newRun' });
    step(g, { type: 'hero.start' });
    step(g, { type: 'map.enter', cell: 'r1c1' });
    const t0 = g.view.time;
    g.send({ type: 'map.option', option: '营地' });
    expect(g.view.screen).toBe('runEnd');
    expect(g.view.modal).toBeNull();
    g.runUntilInput(10);
    expect(g.view.time - t0).toBeCloseTo(1.0, 5);
    expect(g.view.modal?.kind).toBe('runEnd');
  });

  it('the prologue: 序幕 → chapter 新手关, quest 序幕; passing it shows 新的冒险 (END L6276)', () => {
    const g = makeGame({ debug: {}, floors: 1 });
    g.runUntilInput(10);
    expect(types(g)).not.toContain('title.newRun');
    step(g, { type: 'title.prologue' });
    expect(g.view.screen).toBe('map');
    expect(g.view.run).toMatchObject({ chapter: '新手关', floors: 7, quest: [{ text: '序幕', done: false }] });
    step(g, { type: 'map.enter', cell: 'r1c1' });
    step(g, { type: 'map.option', option: '营地' });
    expect(g.view.modal).toMatchObject({ kind: 'runEnd', demoComplete: false });
    step(g, { type: 'runEnd.continue' });
    expect(types(g)).toContain('title.newRun');
    expect(g.save().meta['新手关过？']).toBe(true);
  });

  it('hero.back returns to the menu; the same seed and commands give the same digest', () => {
    const script = (): string => {
      const g = makeGame({ floors: 2 });
      g.runUntilInput(10);
      step(g, { type: 'title.newRun' });
      step(g, { type: 'hero.back' });
      expect(g.view.screen).toBe('title');
      playRun(g);
      return g.digest();
    };
    expect(script()).toBe(script());
  });
});

describe('core-run: debug options (WAVE_A §3.4)', () => {
  it('hero, unlockAllHeroes and chapter', () => {
    const g = makeGame({ debug: { skipPrologue: true, hero: '灵魂猎手', unlockAllHeroes: true, chapter: '新手关' } });
    g.runUntilInput(10);
    expect(g.world.mode.玩家角色?.名字).toBe('灵魂猎手');
    step(g, { type: 'title.newRun' });
    expect(g.view.heroSelect?.heroes.every(h => h.unlocked)).toBe(true);
    // Opening the page clicks the saved portrait (SEL L3370, 被选择头像序号 0 = 幽冥骑士).
    expect(g.view.heroSelect?.picked).toBe('幽冥骑士');
    step(g, { type: 'hero.pick', hero: '灵魂猎手' });
    step(g, { type: 'hero.start' });
    expect(g.world.mode.玩家角色?.名字).toBe('灵魂猎手');
    expect(g.view.run?.chapter).toBe('新手关');
  });
});

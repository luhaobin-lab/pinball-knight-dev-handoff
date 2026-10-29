import { describe, expect, it } from 'vitest';
import { meta, 结算探索等级 } from '../../src/core/sys/meta/index.ts';
import { makeGame, playRun, step } from './doubles.ts';

const L = (lvl: number, pts: number) => ({ 当前解锁分: pts, 每级所需分: 500, 当前解锁等级: lvl, 最高解锁等级: 35 });
const stats = (o: Record<string, number>): Map<string, number> => new Map(Object.entries(o));

describe('core-run: score and exploration level (PROTOTYPE_SCOPE §7.7, END L2016–L4638)', () => {
  it('13 categories with the widget weights; only counted categories make lines, in widget order', () => {
    const r = 结算探索等级(undefined, stats({ 完成探险: 1, 反弹: 37, 英雄升级: 3, 获取天赋: 3, 击败首领: 1, 挑战成功: 12, 获取物品: 9, 未知: 5 }));
    expect(r.lines.map(l => l.统计名)).toEqual(['反弹', '获取物品', '英雄升级', '获取天赋', '挑战成功', '击败首领', '完成探险']);
    expect(r.本次增加分数).toBe(37 + 45 + 90 + 30 + 600 + 50 + 1000);
  });

  it('level n → n+1 needs 500·(n+1); leftovers carry; 5000 cumulative points = level 4', () => {
    expect(结算探索等级(undefined, stats({ 完成探险: 5 })).更新后分数).toEqual(L(4, 0));
    expect(结算探索等级(undefined, stats({ 完成探险: 4, 获得SSS: 49, 反弹: 19 })).更新后分数).toEqual(L(3, 1999));
    expect(结算探索等级(undefined, stats({ 接受指引: 1 })).更新后分数).toEqual(L(1, 0));
    // The "1582/2000" bar: level 3, 1582 of the 2000 points level 4 needs (3000 + 1582 cumulative).
    const bar = 结算探索等级(L(2, 0), stats({ 完成探险: 3, 反弹: 82 }));
    expect(bar.更新后分数).toEqual(L(3, 1582));
    expect(bar.本次增加等级).toBe(1);
    expect(bar.更新后分数.每级所需分 * (bar.更新后分数.当前解锁等级 + 1)).toBe(2000);
  });

  it('QUIRK: a level-up drops the progress the save already had toward the current level', () => {
    expect(结算探索等级(L(2, 500), stats({ 完成探险: 2, 反弹: 582 })).更新后分数).toEqual(L(3, 1082));
    // Below the next level the old progress is kept.
    expect(结算探索等级(L(2, 500), stats({ 反弹: 582 })).更新后分数).toEqual(L(2, 1082));
  });

  it('a failed run loses 100 points but never goes below 0 progress; levels are never lost', () => {
    expect(结算探索等级(L(2, 60), stats({ 探险失败: 1 })).更新后分数).toEqual(L(2, 0));
    expect(结算探索等级(L(0, 150), stats({ 探险失败: 1, 反弹: 20 })).更新后分数).toEqual(L(0, 70));
  });

  it('QUIRK: the level loop ignores the cap 35 (only stored)', () => {
    expect(结算探索等级(L(35, 0), stats({ 完成探险: 18 })).更新后分数).toEqual(L(36, 0));
  });

  it('hero unlocks: 灵魂猎手 needs exploration level 4 (AVA L1669); 判断解锁 compares floors (BP_ManeActor ln 4892)', () => {
    const g = makeGame();
    g.runUntilInput(10);
    expect(meta.英雄已解锁(g.world, '灵魂猎手')).toBe(false);
    expect(meta.可选英雄(g.world)).toEqual(['幽冥骑士', '灵魂猎手']);
    const hero = g.world.mode.玩家角色!;
    hero.解锁 = { 层数: 3, 积分等级: 0 };
    g.world.mode.当前总层数 = 2;
    hero.判断解锁();
    expect(hero.已解锁).toBe(false);
    g.world.mode.当前总层数 = 3;
    hero.判断解锁();
    expect(hero.已解锁).toBe(true);
  });

  it('灵魂猎手 locked, then unlocked after six 1000-point runs (the level-up QUIRK costs one run)', () => {
    const g = makeGame({ floors: 1 });
    g.runUntilInput(10);
    for (let run = 0; run < 6; run++) {
      step(g, { type: 'title.newRun' });
      const hunter = g.view.heroSelect?.heroes.find(h => h.row === '灵魂猎手');
      expect(hunter?.unlocked).toBe(false);
      expect(hunter?.unlockText).toBe('探索等级提升至<天赋>4</>后解锁。');
      expect(g.send({ type: 'hero.pick', hero: '灵魂猎手' }).ok).toBe(false);
      step(g, { type: 'hero.start' });
      // Score only 完成探险: clear the room's bounces.
      step(g, { type: 'map.enter', cell: 'r1c1' });
      g.world.mode.轮回战斗统计.delete('反弹');
      step(g, { type: 'map.option', option: '营地' });
      step(g, { type: 'runEnd.continue' });
    }
    step(g, { type: 'title.newRun' });
    expect(g.view.heroSelect?.heroes.find(h => h.row === '灵魂猎手')).toEqual({ row: '灵魂猎手', unlocked: true, unlockText: null });
    step(g, { type: 'hero.pick', hero: '灵魂猎手' });
    expect(g.world.mode.当前英雄角色名).toBe('灵魂猎手');
    expect(g.world.mode.玩家角色?.名字).toBe('灵魂猎手');
    step(g, { type: 'hero.start' });
    expect(g.view.screen).toBe('map');
    // The pick is remembered (被选择头像序号) and the next run creates the Hunter.
    expect(g.save().meta['被选择头像序号']).toBe(1);
  });

  it('the Demo-complete text only when 是DEMO ∧ 通过关卡数 == 1 ∧ ¬新手关中 (END L5641)', () => {
    const won = makeGame({ floors: 1 });
    won.runUntilInput(10);
    playRun(won);
    step(won, { type: 'title.newRun' });
    step(won, { type: 'hero.start' });
    step(won, { type: 'map.enter', cell: 'r1c1' });
    step(won, { type: 'map.option', option: '营地' });
    expect(won.view.modal).toMatchObject({ kind: 'runEnd', demoComplete: true });
    step(won, { type: 'runEnd.continue' });
    expect(won.view.screen).toBe('title');

    // A death before the boss: 通过关卡数 stays 0.
    const lost = makeGame({ floors: 5 });
    lost.runUntilInput(10);
    step(lost, { type: 'title.newRun' });
    step(lost, { type: 'hero.start' });
    step(lost, { type: 'menu.open' });
    step(lost, { type: 'warning.answer', button: 1 });
    expect(lost.view.modal).toMatchObject({ kind: 'runEnd', demoComplete: false, score: -100 });
    expect(lost.view.modal?.kind === 'runEnd' && lost.view.modal.lines[0]).toEqual({ label: '探险失败', value: '' });
  });
});

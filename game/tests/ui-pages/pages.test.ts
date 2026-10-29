import { describe, expect, it } from 'vitest';
import { Surface, type Rect } from '../../src/ui/core/surface';
import type { UiPointer } from '../../src/ui/kit/page';
import { BossBarState, bossBarTarget } from '../../src/ui/pages/boss-bar/model';
import { BossBarPage } from '../../src/ui/pages/boss-bar/page';
import { canStart, heroIntro, heroPortraits, heroRows, lockTip, pickIntent, type HeroSelectIntent } from '../../src/ui/pages/hero-select/model';
import { HeroSelectPage } from '../../src/ui/pages/hero-select/page';
import { excludedBy, shownOptions, type MultiChoiceIntent, type MultiChoiceModel } from '../../src/ui/pages/multi-choice/model';
import { MultiChoicePage } from '../../src/ui/pages/multi-choice/page';
import { explorationGain, intSlide, runEndLines, runEndTitle, runScore, RunEndState, type RunEndIntent, type RunEndModel } from '../../src/ui/pages/run-end/model';
import { RunEndPage } from '../../src/ui/pages/run-end/page';
import { LINKS, titleButtons, titleIntent, type TitleIntent } from '../../src/ui/pages/title/model';
import { TitlePage } from '../../src/ui/pages/title/page';
import { warningText, type WarningIntent } from '../../src/ui/pages/warning/model';
import { WARNING_LAYOUT } from '../../src/ui/pages/warning/layout';
import { WarningPage } from '../../src/ui/pages/warning/page';
import { BONE, DANGER, ITEM_ACCENT } from '../../src/ui/style/palette';
import type { TextFont } from '../../src/ui/text/font';

/** Fusion Pixel metrics without the browser: 6 px per Latin character, 12 per CJK, ink as boxes. */
const STUB: TextFont = {
  line: 16,
  measure: t => [...t].reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) > 0x2e80 ? 12 : 6), 0),
  draw(s, text, x, y, style) {
    let pen = x;
    for (const ch of text) {
      const w = (ch.codePointAt(0) ?? 0) > 0x2e80 ? 12 : 6;
      s.fill(pen + 1, y + 2, w - 2, 11, style.color, style.opacity);
      pen += w;
    }
    return pen - x;
  },
};

const centre = (r: Rect) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });

/** A full click (move, press, release) at the centre of `r`. */
function click(page: { pointer(e: UiPointer): boolean }, r: Rect): void {
  const p = centre(r);
  page.pointer({ kind: 'move', ...p });
  page.pointer({ kind: 'down', ...p, button: 0 });
  page.pointer({ kind: 'up', ...p, button: 0 });
}

const drawn = (draw: (s: Surface) => void): number => {
  const s = new Surface(960, 540);
  draw(s);
  return s.data.reduce((n, c) => n + (c >>> 24 ? 1 : 0), 0);
};

describe('title (UI_营地主菜单)', () => {
  it('shows 序幕 always, 新的冒险 only after the prologue, never 继续冒险', () => {
    expect(titleButtons({ prologueDone: false })).toEqual(['prologue', 'quit', 'settings', 'discord', 'kook']);
    expect(titleButtons({ prologueDone: true })).toEqual(['prologue', 'newRun', 'quit', 'settings', 'discord', 'kook']);
    expect(titleIntent('kook')).toEqual({ kind: 'link', url: LINKS.kook });
  });

  it('emits an intent per click; a hidden 新的冒险 takes no click', () => {
    const got: TitleIntent[] = [];
    const page = new TitlePage(STUB, { prologueDone: true }, i => got.push(i));
    const newRun = page.rectOf('newRun')!;
    click(page, newRun);
    click(page, page.rectOf('prologue')!);
    click(page, page.rectOf('settings')!);
    click(page, page.rectOf('discord')!);
    expect(got).toEqual([{ kind: 'newRun' }, { kind: 'prologue' }, { kind: 'settings' }, { kind: 'link', url: LINKS.discord }]);
    page.setModel({ prologueDone: false });
    got.length = 0;
    click(page, newRun);
    expect(got.filter(i => i.kind === 'newRun')).toEqual([]);
    expect(page.rectOf('newRun')).toBeNull();
    expect(drawn(s => page.draw(s))).toBeGreaterThan(0);
  });

  it('a press released elsewhere is not a click (DownAndUp)', () => {
    const got: TitleIntent[] = [];
    const page = new TitlePage(STUB, { prologueDone: true }, i => got.push(i));
    const p = centre(page.rectOf('quit')!);
    page.pointer({ kind: 'down', ...p, button: 0 });
    page.pointer({ kind: 'up', x: 5, y: 5, button: 0 });
    expect(got).toEqual([]);
  });
});

describe('hero select (UI_英雄选择页 / UI_英雄头像)', () => {
  it('lists the two heroes without 忽略, locks the Hunter below exploration level 4', () => {
    expect(heroRows()).toEqual(['幽冥骑士', '灵魂猎手']);
    const low = heroPortraits({ explorationLevel: 3, selected: '幽冥骑士' });
    expect(low.map(p => [p.hero, p.unlocked, p.selected, p.unlockLevel])).toEqual([
      ['幽冥骑士', true, true, 0],
      ['灵魂猎手', false, false, 4],
    ]);
    expect(lockTip(low[1])).toEqual({ title: '灵魂猎手', text: '探索等级提升至<天赋>4</>后解锁。', extra: '未解锁' });
    expect(heroPortraits({ explorationLevel: 4, selected: '默认' })[1].unlocked).toBe(true);
  });

  it('intro from 描述, 出发 disabled on 默认, clicks only on an unlocked unselected portrait', () => {
    expect(heroIntro('幽冥骑士')).toEqual({ name: '幽冥骑士', text: '盔甲化身，无躯归魂，防守反击施加毁灭性伤害。\n被诅咒者的守护者，永恒深渊中誓要净化罪孽。' });
    expect(heroIntro('默认')).toEqual({ name: '', text: '' });
    expect(canStart({ selected: '默认' })).toBe(false);
    expect(canStart({ selected: '幽冥骑士' })).toBe(true);
    const [knight, hunter] = heroPortraits({ explorationLevel: 0, selected: '幽冥骑士' });
    expect(pickIntent(knight)).toBeNull();
    expect(pickIntent(hunter)).toBeNull();

    const got: HeroSelectIntent[] = [];
    const page = new HeroSelectPage(STUB, { explorationLevel: 4, selected: '默认' }, i => got.push(i));
    click(page, page.startRect);
    expect(got).toEqual([]);
    click(page, page.avatarRect('灵魂猎手')!);
    expect(got).toEqual([{ kind: 'pick', hero: '灵魂猎手' }]);
    page.setModel({ explorationLevel: 4, selected: '灵魂猎手' });
    click(page, page.avatarRect('灵魂猎手')!);
    click(page, page.startRect);
    expect(got).toEqual([{ kind: 'pick', hero: '灵魂猎手' }, { kind: 'start' }]);
    expect(drawn(s => page.draw(s))).toBeGreaterThan(0);
  });
});

const TALENTS: MultiChoiceModel = {
  source: 'levelUp',
  layout: 'talent',
  options: [
    { name: 'A', description: 'a', level: '1/8', excludes: [2] },
    { name: 'B', description: 'b' },
    { name: 'C', description: 'c' },
    { name: 'D', description: 'd' },
  ],
  reroll: { cost: 3, enabled: false },
  canSkip: true,
};

describe('multi-choice (多选一 / UI_天赋选项)', () => {
  it('shows at most three talent cards, every event card', () => {
    expect(shownOptions(TALENTS)).toHaveLength(3);
    expect(shownOptions({ ...TALENTS, layout: 'event' })).toHaveLength(4);
    expect([...excludedBy(TALENTS, 0)]).toEqual([2]);
    expect([...excludedBy(TALENTS, null)]).toEqual([]);
  });

  it('picks, skips, and ignores a disabled reroll', () => {
    const got: MultiChoiceIntent[] = [];
    const page = new MultiChoicePage(STUB, TALENTS, i => got.push(i));
    expect(page.cardRects()).toHaveLength(3);
    click(page, page.cardRects()[1]);
    click(page, page.rerollRect!);
    click(page, page.skipRect);
    expect(got).toEqual([{ kind: 'pick', option: 1 }, { kind: 'skip' }]);
    page.setModel({ ...TALENTS, reroll: { cost: 3, enabled: true } });
    click(page, page.rerollRect!);
    expect(got.at(-1)).toEqual({ kind: 'reroll' });
    page.setModel({ ...TALENTS, reroll: null });
    expect(page.rerollRect).toBeNull();
    expect(drawn(s => page.draw(s))).toBeGreaterThan(0);
  });
});

describe('warning dialog (UI_警告提示)', () => {
  it('has the Demo texts and buttons of types 0 and 2', () => {
    expect(warningText({ type: 0, saveQuit: false })).toEqual({ text: '结束本次探险？', buttons: ['重置房间（+10腐化）', '放弃探险'] });
    expect(warningText({ type: 0, saveQuit: true })).toEqual({ text: '结束本次探险？', buttons: ['保存并退出', '放弃探险'] });
    expect(warningText({ type: 2, saveQuit: true })).toEqual({ text: '上一次的记忆还未丢失，是否回忆？', buttons: ['回忆', '遗忘'] });
  });

  it('answers with the button index; the cross closes', () => {
    const got: WarningIntent[] = [];
    const page = new WarningPage(STUB, { type: 2, saveQuit: false }, i => got.push(i));
    click(page, WARNING_LAYOUT.buttons[0]);
    click(page, WARNING_LAYOUT.buttons[1]);
    click(page, WARNING_LAYOUT.close);
    expect(got).toEqual([{ kind: 'answer', button: 0 }, { kind: 'answer', button: 1 }, { kind: 'close' }]);
    expect(drawn(s => page.draw(s))).toBeGreaterThan(0);
  });
});

const BEFORE = { 当前解锁分: 1582, 每级所需分: 500, 当前解锁等级: 3, 最高解锁等级: 35 } as const;
const WON: RunEndModel = { completed: true, counts: { 反弹: 12, 挑战成功: 2, 获取天赋: 1 }, before: BEFORE, demoComplete: false, replayedPrologue: false };

describe('run end (UI_冒险结束统计页)', () => {
  it('lists the stats with a count in 轮回得分统计 order, adding 完成探险 / 探险失败', () => {
    const lines = runEndLines(WON);
    expect(lines.map(l => [l.label, l.count, l.score])).toEqual([
      ['反弹', 12, '12'],
      ['获取天赋', 1, '10'],
      ['挑战成功', 2, '100'],
      ['完成探险', 1, '1000'],
    ]);
    expect(runScore(WON)).toBe(1122);
    const lost = runEndLines({ completed: false, counts: { 自我放弃: 1 } });
    expect(lost.map(l => [l.stat, l.score, l.negative])).toEqual([
      ['探险失败', '-100', true],
      ['自我放弃', '-100', true],
    ]);
    expect(runEndTitle(true)).toBe('完成探险');
    expect(runEndTitle(false)).toBe('探险失败');
  });

  it('QUIRK: 英雄升级 has no 数据表_词条_统计 row and keeps the design-time texts', () => {
    expect(runEndLines({ completed: true, counts: { 英雄升级: 2 } })[0]).toEqual({ stat: '英雄升级', label: '获得SSS数', count: 2, score: '200', negative: false });
  });

  it('levels: 500 × (level + 1) each, the old points dropped on a level-up (QUIRK L4057)', () => {
    expect(explorationGain({ ...BEFORE, 当前解锁分: 0, 当前解锁等级: 0 }, 5000).after).toMatchObject({ 当前解锁等级: 4, 当前解锁分: 0 });
    expect(explorationGain({ ...BEFORE, 当前解锁分: 0, 当前解锁等级: 0 }, 499).after).toMatchObject({ 当前解锁等级: 0, 当前解锁分: 499 });
    expect(explorationGain(BEFORE, 1000).after).toMatchObject({ 当前解锁等级: 4, 当前解锁分: 0 });
    expect(explorationGain(BEFORE, 2309).after).toMatchObject({ 当前解锁等级: 4, 当前解锁分: 309 });
    expect(explorationGain(BEFORE, 300).after).toMatchObject({ 当前解锁等级: 3, 当前解锁分: 1882 });
    expect(explorationGain({ ...BEFORE, 当前解锁分: 50 }, -100).after).toMatchObject({ 当前解锁等级: 3, 当前解锁分: 0 });
  });

  it('整数滑动: FCeil up, FTrunc down, snap under 1', () => {
    expect(intSlide(0, 100, 0.25, 3, false)).toEqual({ value: 75, arrived: false });
    expect(intSlide(0, 100, 0.1, 3, false).value).toBe(31); // 0.1 × 3 is 0.30000000000000004 in doubles, as in UE
    expect(intSlide(100, 0, 0.25, 3, true)).toEqual({ value: 25, arrived: false });
    expect(intSlide(99.5, 100, 0.1, 3, false)).toEqual({ value: 100, arrived: true });
  });

  it('the bar counts up level by level after 1 s and ends on the saved value', () => {
    const st = new RunEndState({ ...WON, counts: { 挑战成功: 20 } });
    expect(st.gain.after).toMatchObject({ 当前解锁等级: 4, 当前解锁分: 0 });
    for (let i = 0; i < 30; i++) st.update(1 / 60);
    expect(st.ready).toBe(false);
    expect(st.visibleLines).toBe(1);
    for (let i = 0; i < 60 * 20; i++) st.update(1 / 60);
    expect(st.ready).toBe(true);
    expect(st.visibleLines).toBe(2);
    expect(st.level).toBe(4);
    expect(st.score).toBe(0);
    expect(st.need).toBe(2500);
  });

  it('continues only once ready; the Demo-complete text takes a second click', () => {
    const got: RunEndIntent[] = [];
    const page = new RunEndPage(STUB, { ...WON, demoComplete: true }, i => got.push(i));
    click(page, page.continueRect);
    expect(got).toEqual([]);
    for (let i = 0; i < 70; i++) page.update(1 / 60);
    click(page, page.continueRect);
    expect(page.showingDemoText).toBe(true);
    expect(got).toEqual([]);
    click(page, { x: 10, y: 10, w: 4, h: 4 });
    expect(got).toEqual([{ kind: 'continue' }]);
    click(page, { x: 10, y: 10, w: 4, h: 4 });
    expect(got).toHaveLength(1);
  });

  it('a replayed prologue shows no score and continues after 1 s', () => {
    const got: RunEndIntent[] = [];
    const page = new RunEndPage(STUB, { ...WON, replayedPrologue: true }, i => got.push(i));
    expect(page.state.lines).toEqual([]);
    for (let i = 0; i < 59; i++) page.update(1 / 60);
    expect(got).toEqual([]);
    for (let i = 0; i < 3; i++) page.update(1 / 60);
    expect(got).toEqual([{ kind: 'continue' }]);
  });
});

describe('boss bar (UI_首领状态条)', () => {
  const M = { name: '守门人', hp: 300, hpMax: 500, armor: 50, dotPending: 40, overflowHeal: 10 };

  it('fills: HP, HP after the pending damage over time, 强固 over 当前最大生命', () => {
    expect(bossBarTarget(M)).toEqual({ hp: 0.6, safe: 270 / 500, armor: 0.1 });
    expect(bossBarTarget({ ...M, overflowHeal: 100 }).safe).toBe(0.6);
  });

  it('slides at 浮点滑动 2.0, widens 250 → 600 with 显示 and fades with 关闭', () => {
    const st = new BossBarState(M);
    expect(st.width).toBe(250);
    expect(st.opacity).toBe(0);
    st.update(0.5);
    expect(st.fill.hp).toBeCloseTo(0.6);
    for (let i = 0; i < 180; i++) st.update(1 / 60);
    expect(st.fill.hp).toBe(0.6);
    expect(st.width).toBe(600);
    expect(st.opacity).toBe(1);
    st.close();
    for (let i = 0; i < 40; i++) st.update(1 / 60);
    expect(st.closed).toBe(true);
    expect(st.opacity).toBe(0);
    expect(st.width).toBe(600);
  });

  it('never takes input and draws once visible', () => {
    const page = new BossBarPage(STUB, M);
    expect(page.pointer()).toBe(false);
    expect(drawn(s => page.draw(s))).toBe(0);
    page.update(1);
    expect(drawn(s => page.draw(s))).toBeGreaterThan(0);
  });
});

describe('Ink & Bone roles (fix round 1)', () => {
  const colours = (draw: (s: Surface) => void): Set<number> => {
    const s = new Surface(960, 540);
    draw(s);
    return new Set(s.data);
  };

  it('costs on the pick dialog are bone, never the tool green', () => {
    const page = new MultiChoicePage(STUB, { ...TALENTS, reroll: { cost: 3, enabled: true }, options: TALENTS.options.map(o => ({ ...o, price: 4 })) }, () => {});
    const seen = colours(s => page.draw(s));
    expect(seen.has(ITEM_ACCENT.tool)).toBe(false);
    expect(seen.has(BONE.base)).toBe(true);
  });

  it('the boss bar draws 强固 in bone over the red, inside a closed faint frame', () => {
    const page = new BossBarPage(STUB, { name: '守门人', hp: 290, hpMax: 500, armor: 60, dotPending: 40, overflowHeal: 0 });
    for (let i = 0; i < 240; i++) page.update(1 / 60);
    const seen = colours(s => page.draw(s));
    expect(seen.has(BONE.base)).toBe(true);
    expect(seen.has(BONE.faint)).toBe(true);
    expect(seen.has(DANGER.deep)).toBe(true);
  });
});

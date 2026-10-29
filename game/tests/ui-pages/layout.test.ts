import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canvasBox, DESIGN_UNITS, toGrid } from '../../src/ui/kit/umg';
import { bossBarRects, BOSS_BAR_SLOT } from '../../src/ui/pages/boss-bar/page';
import { BOSS_HIDE, BOSS_SHOW } from '../../src/ui/pages/boss-bar/model';
import { heroSelectLayout } from '../../src/ui/pages/hero-select/layout';
import { CARD, CHOICE_CENTRE, choiceLayout } from '../../src/ui/pages/multi-choice/layout';
import { RUN_END_LAYOUT } from '../../src/ui/pages/run-end/layout';
import { MENU_BUTTON_H, titleLayout } from '../../src/ui/pages/title/layout';
import { WARNING_LAYOUT } from '../../src/ui/pages/warning/layout';
import { canvasLayout, HAVE_DUMP, node, padding, prop, WIDGET_DIR } from '../ui-kit/dump';

/**
 * Every number the A07 pages lay out from, re-read from the Demo widget dump
 * (D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI/), then the resolved grid rects.
 */

const size = (w: string, n: string): [number, number] => [prop<number>(w, n, 'WidthOverride'), prop<number>(w, n, 'HeightOverride')];
const imageSize = (w: string, n: string): [number, number] => {
  const b = prop<{ ImageSize: { X: number; Y: number } }>(w, n, 'Brush');
  return [b.ImageSize.X, b.ImageSize.Y];
};
const visibility = (w: string, n: string): string | undefined => prop<string | undefined>(w, n, 'Visibility');

describe.skipIf(!HAVE_DUMP)('widget numbers (dump)', () => {
  it('UI_警告提示', () => {
    expect(size('UI_警告提示', 'SizeBox_0')).toEqual([672, 594]);
    expect(size('UI_警告提示', 'SizeBox_1')).toEqual([440, 212]);
    expect(padding('UI_警告提示', 'SizeBox_1')).toEqual([0, 0, 0, 60]);
    expect(padding('UI_警告提示', 'VerticalBox_39')).toEqual([2, 0, 0, 54]);
    expect(size('UI_警告提示', 'SizeBox_86')).toEqual([405, 63]);
    expect(size('UI_警告提示', 'SizeBox_87')).toEqual([405, 63]);
    expect(padding('UI_警告提示', '关闭按钮')).toEqual([0, 72, 6, 0]);
  });

  it('UI_营地主菜单', () => {
    expect(canvasLayout('UI_营地主菜单', 'VerticalBox_0')).toMatchObject({ offsets: [0, 108.740746, 501.18518, 140.92061], min: [1, 0.5], align: [1, 0.5] });
    expect(canvasLayout('UI_营地主菜单', '按钮_退出')).toMatchObject({ offsets: [0, 240, 400, 49], min: [1, 0.5], align: [1, 0.5] });
    expect(canvasLayout('UI_营地主菜单', '设置按钮')).toMatchObject({ offsets: [-16, -16, 45, 45], min: [1, 1], align: [1, 1] });
    expect(padding('UI_营地主菜单', '序章文本')).toEqual([96, 2, 0, 4]);
    expect(padding('UI_营地主菜单', '开始冒险文本')).toEqual([96, 2, 0, 4]);
    expect(padding('UI_营地主菜单', '退出文本')).toEqual([48, 2, 0, 4]);
    // Never shown: 继续冒险, the abyss row and the camp quest list.
    expect(visibility('UI_营地主菜单', '按钮_继续冒险')).toBe('ESlateVisibility::Collapsed');
    expect(visibility('UI_营地主菜单', 'TextBlock_121')).toBe('ESlateVisibility::Collapsed');
    expect(visibility('UI_营地主菜单', '深渊级别框')).toBe('ESlateVisibility::Collapsed');
    expect(visibility('UI_营地主菜单', '任务列表')).toBe('ESlateVisibility::Collapsed');
  });

  it('UI_英雄选择页 and UI_英雄头像', () => {
    expect(prop('UI_英雄选择页', 'Border_0', 'Padding')).toEqual({ Left: 150, Top: 32, Right: 32, Bottom: 0 });
    expect(prop('UI_英雄选择页', 'SizeBox_4', 'WidthOverride')).toBe(640);
    expect(size('UI_英雄选择页', 'SizeBox_2')).toEqual([360, 320]);
    expect(padding('UI_英雄选择页', 'SizeBox_2')).toEqual([16, 12, 16, 0]);
    expect(prop('UI_英雄选择页', 'SizeBox_3', 'HeightOverride')).toBe(160);
    expect(padding('UI_英雄选择页', '英雄头像框')).toEqual([0, 32, 0, 0]);
    expect(size('UI_英雄选择页', 'SizeBox_0')).toEqual([156, 63]);
    expect(padding('UI_英雄选择页', 'SizeBox_0')).toEqual([0, 32, 0, 0]);
    expect(visibility('UI_英雄选择页', '深渊级别框')).toBe('ESlateVisibility::Collapsed');
    expect(visibility('UI_英雄选择页', '英雄天赋框')).toBe('ESlateVisibility::Collapsed');
    expect(canvasLayout('UI_英雄选择页', 'TextBlock_56')).toMatchObject({ offsets: [0, 21, 824, 45], min: [0.5, 0], align: [0.5, 0] });
    expect(size('UI_英雄头像', 'SizeBox_0')).toEqual([114, 114]);
    expect(prop('UI_英雄头像', 'Border_0', 'Padding')).toEqual({ Left: 15, Top: 0, Right: 15, Bottom: 0 });
    expect(prop('UI_英雄头像', '英雄头像', 'Padding')).toEqual({ Left: 3, Top: 3, Right: 3, Bottom: 3 });
    expect(prop('UI_英雄头像', 'Border_3', 'Padding')).toEqual({ Left: 18, Top: 18, Right: 18, Bottom: 18 });
    expect(size('UI_英雄头像', '已选取标志')).toEqual([33, 36]);
    expect(padding('UI_英雄头像', '已选取标志')).toEqual([9, -12, -12, 9]);
  });

  it('UI_主界面 多选一 and UI_天赋选项', () => {
    expect(canvasLayout('UI_主界面', '多选一父级')).toMatchObject({ offsets: [288, 525, 900, 666], min: [0.5, 0], align: [0.5, 0.5] });
    expect(padding('UI_主界面', 'HorizontalBox_2')).toEqual([0, 0, 0, -75]);
    expect(size('UI_主界面', '刷新按钮框')).toEqual([189, 75]);
    expect(padding('UI_主界面', '刷新按钮框')).toEqual([9, 0, 9, 0]);
    expect(imageSize('UI_天赋选项', 'BG_天赋')).toEqual([CARD.talent.w, CARD.talent.h - 6]);
    expect(padding('UI_天赋选项', 'BG_天赋')).toEqual([0, 3, 0, 3]);
    expect(imageSize('UI_天赋选项', 'BG_事件')).toEqual([CARD.event.w, CARD.event.h - 6]);
    expect(padding('UI_天赋选项', 'FG_天赋_1')).toEqual([51, 0, 0, 0]);
    expect(padding('UI_天赋选项', 'FG_天赋')).toEqual([60, 0, 0, 0]);
    expect(padding('UI_天赋选项', '名字_天赋')).toEqual([196, 24, 0, 0]);
    expect(padding('UI_天赋选项', '天赋等级_天赋')).toEqual([0, 30, 60, 0]);
    expect(padding('UI_天赋选项', '等级文本_天赋')).toEqual([0, 30, 140, 0]);
    expect(padding('UI_天赋选项', 'VerticalBox_0')).toEqual([196, 85, 0, 0]);
    expect(size('UI_天赋选项', 'SizeBox_0')).toEqual([652, 75]);
    expect(padding('UI_天赋选项', '价格牌')).toEqual([0, 0, 15, 15]);
    expect(size('UI_天赋选项', '互斥提示')).toEqual([198, 42]);
    expect(padding('UI_天赋选项', '互斥提示')).toEqual([0, 0, -117, 0]);
    expect(padding('UI_天赋选项', 'FG_事件')).toEqual([0, 90, 3, 0]);
    expect(size('UI_天赋选项', 'SizeBox')).toEqual([226, 226]);
    expect(padding('UI_天赋选项', 'SizeBox')).toEqual([0, 0, 0, 36]);
    // Event cards hide their name.
    expect(visibility('UI_天赋选项', '名字_事件')).toBe('ESlateVisibility::Collapsed');
  });

  it('UI_冒险结束统计页 and UI_冒险统计词条', () => {
    expect(canvasLayout('UI_冒险结束统计页', 'Overlay_0')).toMatchObject({ offsets: [0, 316.03604, 700, 563.964], min: [0.5, 0], align: [0.5, 0] });
    expect(canvasLayout('UI_冒险结束统计页', '大标题提示')).toMatchObject({ offsets: [0, 168, 1100, 700], min: [0.5, 0], align: [0.5, 0] });
    expect(prop('UI_冒险结束统计页', 'SizeBox_0', 'HeightOverride')).toBe(24);
    expect(padding('UI_冒险结束统计页', 'SizeBox_0')).toEqual([0, 0, 48, 0]);
    expect(padding('UI_冒险结束统计页', 'ProgressBar_176')).toEqual([6, 6, 6, 6]);
    expect(padding('UI_冒险结束统计页', '等级')).toEqual([330, -14, 0, 0]);
    expect(padding('UI_冒险结束统计页', 'TextBlock_84')).toEqual([0, 28, 0, 0]);
    expect(padding('UI_冒险结束统计页', 'Image')).toEqual([-16, 82, -16, 0]);
    expect(padding('UI_冒险结束统计页', '冒险结束词条框')).toEqual([0, 96, 0, 0]);
    expect(size('UI_冒险统计词条', 'SizeBox_1')).toEqual([240, 30]);
    expect(size('UI_冒险统计词条', 'SizeBox_3')).toEqual([80, 30]);
    expect(prop<{ ImageSize: { X: number; Y: number } }>('UI_冒险结束统计页', '返回营地', 'WidgetStyle')).toBeTruthy();
    // 无尽模式 is hidden by code (L414 SetVisibility(Collapsed)); the button is 156×63.
    const style = prop<{ Normal: { ImageSize: { X: number; Y: number } } }>('UI_冒险结束统计页', '返回营地', 'WidgetStyle');
    expect([style.Normal.ImageSize.X, style.Normal.ImageSize.Y]).toEqual([156, 63]);
  });

  it('UI_首领状态条 and its animations', () => {
    expect(canvasLayout('UI_主界面', '首领状态框父级')).toMatchObject({ offsets: [288, 0, 1200, 93], min: [0.5, 1], align: [0.5, 1] });
    expect(prop('UI_首领状态条', 'SizeBox_2', 'WidthOverride')).toBe(250);
    expect(padding('UI_首领状态条', 'SizeBox_0')).toEqual([51, 51, 51, 21]);
    expect(padding('UI_首领状态条', 'Overlay_1')).toEqual([3, 3, 3, 3]);
    expect(padding('UI_首领状态条', '名字')).toEqual([0, 3, 0, 0]);
    expect(imageSize('UI_首领状态条', 'Image_30')).toEqual([120, 93]);
    const anims = readAnims();
    const show = anims['显示_INST'];
    expect(show.width.times).toEqual([18951, 149550]);
    expect(show.width.values).toEqual([250, 600]);
    expect(show.opacity.times).toEqual([0, 36383]);
    expect(BOSS_SHOW.keys.width.map(k => k[0])).toEqual(show.width.times);
    expect(BOSS_SHOW.keys.width.map(k => k[1])).toEqual(show.width.values);
    expect(BOSS_SHOW.keys.opacity.map(k => k[0])).toEqual(show.opacity.times);
    expect(BOSS_HIDE.keys.opacity.map(k => k[0])).toEqual(anims['关闭_INST'].opacity.times);
  });

  it('the nodes the pages name exist', () => {
    for (const [w, n] of [
      ['UI_警告提示', '提示内容'],
      ['UI_营地主菜单', '按钮_序幕'],
      ['UI_英雄头像', '未解锁标志'],
      ['UI_天赋选项', '升级特效_天赋'],
      ['UI_冒险统计词条', '得分'],
      ['UI_首领状态条', '持续伤害生命值'],
    ] as const)
      expect(node(w, n).name).toBe(n);
  });
});

/** MovieScene float channels of UI_首领状态条's animations: times and values per bound property. */
function readAnims(): Record<string, Record<string, { times: number[]; values: number[] }>> {
  const json = JSON.parse(readFileSync(`${WIDGET_DIR}UI_首领状态条.json`, 'utf8')) as {
    animations: { name: string; bindings: { tracks: { binding: { PropertyName: string }; sections: { properties: { FloatCurve: { Times: { Value: number }[]; Values: { Value: number }[] } } }[] }[] }[] }[];
  };
  const out: Record<string, Record<string, { times: number[]; values: number[] }>> = {};
  for (const a of json.animations) {
    out[a.name] = {};
    for (const b of a.bindings)
      for (const t of b.tracks) {
        const c = t.sections[0].properties.FloatCurve;
        const key = t.binding.PropertyName === 'RenderOpacity' ? 'opacity' : 'width';
        out[a.name][key] = { times: c.Times.map(x => x.Value), values: c.Values.map(x => x.Value) };
      }
  }
  return out;
}

describe('resolved rects (960×540 grid)', () => {
  it('warning dialog', () => {
    expect(WARNING_LAYOUT.panel).toEqual({ x: 312, y: 122, w: 336, h: 297 });
    // Buttons stacked at the bottom: 54 units above the panel's bottom, 1-unit spacer between them.
    expect(WARNING_LAYOUT.buttons[1].y + WARNING_LAYOUT.buttons[1].h).toBe(Math.round((837 - 54) / 2));
    expect(WARNING_LAYOUT.buttons[0].w).toBe(203);
    expect(WARNING_LAYOUT.close).toEqual(toGrid({ x: 1296 - 6 - 39, y: 243 + 72, w: 39, h: 39 }));
  });

  it('title menu', () => {
    const one = titleLayout(false);
    const two = titleLayout(true);
    const col = canvasBox({ offsets: [0, 108.740746, 501.18518, 140.92061], min: [1, 0.5], align: [1, 0.5] }, DESIGN_UNITS);
    // Alone, 序幕 sits on the column's bottom; with 新的冒险 both share it.
    expect(one.buttons.prologue).toEqual(toGrid({ x: col.x, y: col.y + col.h - MENU_BUTTON_H, w: col.w, h: MENU_BUTTON_H }));
    expect(one.buttons.newRun).toBeUndefined();
    expect(two.buttons.newRun!.y + two.buttons.newRun!.h).toBe(Math.round((col.y + col.h) / 2));
    expect(two.buttons.prologue!.y).toBeLessThan(two.buttons.newRun!.y);
    expect(two.buttons.quit).toEqual({ x: 760, y: 378, w: 200, h: 24 });
    expect(two.buttons.settings).toEqual({ x: 930, y: 510, w: 22, h: 22 });
    expect(two.buttons.discord!.w).toBe(48);
  });

  it('hero select', () => {
    const L = heroSelectLayout(2);
    expect(L.avatars).toHaveLength(2);
    // The column is 640 units from x 150; the two 144-unit portraits are centred in it.
    expect(L.avatars[0].frame.x).toBe(Math.round((150 + (640 - 288) / 2 + 15) / 2));
    expect(L.avatars[1].frame.x - L.avatars[0].frame.x).toBe(72);
    expect(L.avatars[0].frame.w).toBe(57);
    expect(L.start.w).toBe(78);
    expect(L.start.x + L.start.w / 2).toBe(Math.round((150 + 320) / 2));
    expect(L.close).toEqual(toGrid({ x: 1875, y: 6, w: 39, h: 39 }));
    // Icon inside the 3 + 18 frames: 72 units.
    expect(L.avatars[0].icon.w).toBe(36);
  });

  it('multi-choice: three talent cards around the dialog centre, the buttons 75 units below', () => {
    const L = choiceLayout('talent', 3, true);
    expect(L.talent.map(c => c.card)).toEqual([0, 1, 2].map(i => toGrid({ x: CHOICE_CENTRE.x - 450, y: CHOICE_CENTRE.y - 324 + i * 216, w: 900, h: 216 })));
    expect(L.skip.y).toBe(Math.round((CHOICE_CENTRE.y + 324) / 2));
    expect(L.skip.h).toBe(37);
    expect(L.reroll!.x).toBeGreaterThan(L.skip.x + L.skip.w);
    // Without the reroll, 放弃 is centred alone.
    const one = choiceLayout('talent', 3, false);
    expect(one.reroll).toBeNull();
    expect(Math.abs(one.skip.x + one.skip.w / 2 - CHOICE_CENTRE.x / 2)).toBeLessThanOrEqual(1);
    const ev = choiceLayout('event', 3, false);
    expect(ev.event.map(c => c.card.x)).toEqual([0, 1, 2].map(i => Math.round((CHOICE_CENTRE.x - 432 + i * 288) / 2)));
    // 互斥提示 turned upright: 42 units wide, 198 tall, centred 18 units past the right edge (117 − 99).
    const strip = L.talent[0].excluded;
    expect([strip.w, strip.h]).toEqual([21, 99]);
  });

  it('run end', () => {
    expect(RUN_END_LAYOUT.barFrame).toEqual(toGrid({ x: 610, y: 316.03604, w: 652, h: 24 }));
    expect(RUN_END_LAYOUT.line(0).label).toEqual(toGrid({ x: 610, y: 316.03604 + 96, w: 240, h: 30 }));
    expect(RUN_END_LAYOUT.line(1).label.y - RUN_END_LAYOUT.line(0).label.y).toBe(15);
    expect(RUN_END_LAYOUT.continue).toEqual(toGrid({ x: 882, y: 805, w: 156, h: 63 }));
  });

  it('boss bar', () => {
    const shown = bossBarRects(600);
    expect(shown.plate).toEqual(toGrid({ x: BOSS_BAR_SLOT.centreX - 300, y: 987, w: 600, h: 93 }));
    expect(shown.bars).toEqual(toGrid({ x: 1248 - 300 + 54, y: 987 + 54, w: 600 - 108, h: 93 - 78 }));
  });
});

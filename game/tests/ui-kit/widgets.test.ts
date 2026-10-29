import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WIDGETS } from '../../src/ui/kit/demo';
import { STR, STR_KEYS } from '../../src/ui/kit/strings';
import { canvasLayout, HAVE_DUMP, node, padding, prop, pseudoVar, STRINGS, widget } from './dump';

/** The kit's copied Demo numbers against the widget dump (skipped on machines without D:/TAPTAPGAME_codex/reference). */
const d = HAVE_DUMP ? describe : describe.skip;

const slot = (l: { offsets: readonly number[]; min: readonly number[]; align?: readonly number[] }) => ({ offsets: [...l.offsets], min: [...l.min], max: [...l.min], align: [...(l.align ?? [0, 0])] });

d('WIDGETS matches the dump', () => {
  it('map page, tile frame, connectors, warning text, options and retreat', () => {
    expect(canvasLayout('UI_主界面', 'UI_地图页面')).toEqual(slot(WIDGETS.map.page));
    expect(canvasLayout('UI_关卡地图页面', '地图格框')).toEqual(slot(WIDGETS.map.tiles));
    expect(canvasLayout('UI_地图格', '指引线')).toEqual(slot(WIDGETS.map.guide));
    expect(canvasLayout('UI_地图格', '文本提醒框')).toEqual(slot(WIDGETS.map.warn));
    expect(canvasLayout('UI_关卡地图页面', 'Border_0')).toEqual(slot(WIDGETS.map.options));
    expect(canvasLayout('UI_关卡地图页面', 'Button_63')).toEqual(slot(WIDGETS.map.retreat));
    const cp = canvasLayout('UI_地图格', 'CanvasPanel_1');
    expect([cp.offsets[2], cp.offsets[3]]).toEqual([WIDGETS.map.tile.w, WIDGETS.map.tile.h]);
  });

  it('map grid variables of UI_关卡地图页面', () => {
    expect(pseudoVar('UI_关卡地图页面', '格子间隔')).toBe(String(WIDGETS.map.grid.gap));
    expect(pseudoVar('UI_关卡地图页面', '格子宽度')).toBe(String(WIDGETS.map.grid.w));
    expect(pseudoVar('UI_关卡地图页面', '格子高度')).toBe(String(WIDGETS.map.grid.h));
    expect(pseudoVar('UI_关卡地图页面', '格子数量X')).toBe(String(WIDGETS.map.grid.cols));
    const src = readFileSync('D:/TAPTAPGAME_codex/reference/dump/blueprints-pseudo/CatapultHero/BP/UI/UI_关卡地图页面.txt', 'utf8');
    expect(src).toContain('(500 - CallFunc_Add_IntInt_ReturnValue_10)');
    expect(src).toContain('(CallFunc_Multiply_IntInt_ReturnValue + 224)');
    expect(src).toContain('KismetMathLibrary.Min(self.游戏模式.当前关卡最高层数, 4)');
  });

  it('map tile parts: icon box, stars, chapter option', () => {
    expect(prop<{ ImageSize: { X: number; Y: number } }>('UI_地图格', 'Image', 'Brush').ImageSize).toEqual({ X: WIDGETS.map.iconBox.w, Y: WIDGETS.map.iconBox.h });
    expect(padding('UI_地图格', '奖励_默认')[3]).toBe(WIDGETS.map.iconBox.padBottom);
    expect(padding('UI_地图格', '图标_默认')[1]).toBe(WIDGETS.map.icon.padTop);
    expect(padding('UI_地图格', 'UI_地图格星级')).toEqual([...WIDGETS.map.stars.pad]);
    expect([prop('UI_难度星级', '尺寸框', 'WidthOverride'), prop('UI_难度星级', '尺寸框', 'HeightOverride')]).toEqual([WIDGETS.map.stars.w, WIDGETS.map.stars.h]);
    expect([prop('UI_关卡选项', 'SizeBox_1', 'WidthOverride'), prop('UI_关卡选项', 'SizeBox_1', 'HeightOverride')]).toEqual([WIDGETS.map.option.w, WIDGETS.map.option.h]);
    expect(padding('UI_关卡选项', 'Border_0')).toEqual([...WIDGETS.map.option.pad]);
    expect(padding('UI_关卡选项', '副本名框')[3]).toBe(WIDGETS.map.option.nameBottom);
    expect(padding('UI_关卡选项', '规模文本')[1]).toBe(WIDGETS.map.option.scaleTop);
    expect(padding('UI_关卡选项', 'VerticalBox_3')[1]).toBe(WIDGETS.map.option.lockedTop);
    expect(padding('UI_关卡选项', 'VerticalBox_1')[1]).toBe(WIDGETS.map.option.blessingTop);
  });

  it('quest list widths', () => {
    expect(prop('UI_任务列表', 'SizeBox_0', 'WidthOverride')).toBe(WIDGETS.quest.width);
    expect(padding('UI_任务条目', '任务名描述')[0]).toBe(WIDGETS.quest.namePad);
  });

  it('loot window, close, buttons, title; reward hints', () => {
    const b = canvasLayout('UI_物品盒子', 'Border_28');
    expect([b.offsets[2], b.offsets[3]]).toEqual([WIDGETS.loot.box.w, WIDGETS.loot.box.h]);
    expect(canvasLayout('UI_物品盒子', '关闭按钮')).toEqual(slot(WIDGETS.loot.close));
    expect(canvasLayout('UI_物品盒子', '按钮切换')).toEqual(slot(WIDGETS.loot.buttons));
    expect(canvasLayout('UI_物品盒子', 'TextBlock_56')).toEqual(slot(WIDGETS.loot.title));
    const r = canvasLayout('UI_奖励提示', 'Border_21');
    expect([r.offsets[2], r.offsets[3]]).toEqual([WIDGETS.reward.w, WIDGETS.reward.h]);
    const f = canvasLayout('UI_奖励提示', '奖励显示框');
    expect([f.offsets[0], f.offsets[1]]).toEqual([WIDGETS.reward.iconAt.x, WIDGETS.reward.iconAt.y]);
    expect(canvasLayout('UI_奖励提示', '奖励描述')).toEqual(slot(WIDGETS.reward.desc));
    expect(canvasLayout('UI_主界面', '奖励提示框')).toEqual(slot(WIDGETS.reward.stack));
  });

  it('item menu, dismantle box', () => {
    expect(prop('UI_物品交互菜单', 'SizeBox_0', 'WidthOverride')).toBe(WIDGETS.menu.width);
    expect(padding('UI_物品交互菜单', 'VerticalBox_0')).toEqual([...WIDGETS.menu.pad]);
    expect(prop('UI_物品交互按钮', 'SizeBox_0', 'HeightOverride')).toBe(WIDGETS.menu.row);
    expect(padding('UI_物品交互按钮', '交互按钮')).toEqual([...WIDGETS.menu.rowPad]);
    const b = canvasLayout('UI_分解框', 'Border_0');
    expect([b.offsets[2], b.offsets[3]]).toEqual([WIDGETS.dismantle.w, WIDGETS.dismantle.h]);
    expect(canvasLayout('UI_分解框', 'Border_6')).toEqual(slot(WIDGETS.dismantle.value));
  });

  it('Victory/Failure panel and the character stats', () => {
    expect(canvasLayout('UI_战斗结束统计页', 'Overlay_1')).toEqual(slot(WIDGETS.panel.box));
    const style = prop<{ Normal: { ImageSize: { X: number; Y: number } } }>('UI_战斗结束统计页', '继续', 'WidgetStyle');
    expect(style.Normal.ImageSize).toEqual({ X: WIDGETS.panel.button.w, Y: WIDGETS.panel.button.h });
    expect(prop<{ Y: number }>('UI_战斗结束统计页', 'Spacer', 'Size').Y).toBe(WIDGETS.panel.spacer);
    expect(prop<{ Y: number }>('UI_战斗结束统计页', 'Spacer_49', 'Size').Y).toBe(WIDGETS.panel.spacer);
    expect([prop('UI_角色战斗统计', 'SizeBox_80', 'WidthOverride'), prop('UI_角色战斗统计', 'SizeBox_80', 'HeightOverride')]).toEqual([WIDGETS.stats.chip.w, WIDGETS.stats.chip.h]);
    expect(prop<{ ImageSize: { X: number; Y: number } }>('UI_角色战斗统计', '左指引线', 'Brush').ImageSize).toEqual({ X: WIDGETS.stats.guide.w, Y: WIDGETS.stats.guide.h });
  });

  it('tooltip widths (UI_悬停提示 基础宽度, UI_词条说明 paddings)', () => {
    expect(prop('UI_悬停提示', '基础宽度', 'WidthOverride')).toBe(375);
    expect(padding('UI_悬停提示', '基础宽度')).toEqual([6, 10, 6, 10]);
    expect(prop<{ Left: number }>('UI_悬停提示', '主内容', 'Padding').Left).toBe(3);
    expect(padding('UI_词条说明', '词条文本')).toEqual([12, 6, 12, 15]);
    expect(widget('UI_悬停提示').root.name).toBe('提示');
    expect(node('UI_悬停提示', '分解信息文本框').class).toBe('RichTextBlock');
  });
});

d('strings', () => {
  it('every fixed label is the Demo string of its key', () => {
    const all = JSON.parse(readFileSync(STRINGS, 'utf8')) as { key: string; zh: string }[];
    const byKey = new Map(all.map(s => [s.key, s.zh]));
    for (const [k, key] of Object.entries(STR_KEYS)) expect(byKey.get(key), k).toBe(STR[k as keyof typeof STR_KEYS]);
    const zh = new Set(all.map(s => s.zh));
    for (const q of STR.qualityName) expect(zh.has(`<${q}>${q}</>`)).toBe(true);
  });
});

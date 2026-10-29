import { describe, expect, it } from 'vitest';
import { demoWidgets } from '../../src/content/demo/widgets';
import { WIDGETS } from '../../src/ui/kit/demo';
import { box, canvasBox, DESIGN_UNITS } from '../../src/ui/kit/umg';

/** The kit's slot math against content-bpkit's resolved widget manifest (src/content/demo/widgets.ts). */
const rectOf = (w: string, n: string): readonly number[] | null | undefined => demoWidgets[w]?.nodes.find(x => x.name === n)?.rect;
const asArr = (b: { x: number; y: number; w: number; h: number }): number[] => [b.x, b.y, b.w, b.h].map(v => Math.round(v * 1000) / 1000);

describe('WIDGETS through canvasBox equals the manifest rects', () => {
  it('UI_主界面 slots in the 1920×1080 design', () => {
    expect(asArr(canvasBox(WIDGETS.map.page, DESIGN_UNITS))).toEqual(rectOf('UI_主界面', 'UI_地图页面'));
    expect(asArr(canvasBox(WIDGETS.reward.stack, DESIGN_UNITS))).toEqual(rectOf('UI_主界面', '奖励提示框'));
  });

  // The manifest roots every widget at 1920×1080; the loot page roots this 3D widget at its 948×744 frame, which the
  // loot_tooltip capture confirms (the close button sits at the window corner).
  it('the loot window children', () => {
    const root = DESIGN_UNITS;
    expect(canvasBox(WIDGETS.loot.close, box(0, 0, WIDGETS.loot.box.w, WIDGETS.loot.box.h)).x).toBe(888);
    expect(asArr(canvasBox(WIDGETS.loot.close, root))).toEqual(rectOf('UI_物品盒子', '关闭按钮'));
    expect(asArr(canvasBox(WIDGETS.loot.buttons, root))).toEqual(rectOf('UI_物品盒子', '按钮切换'));
  });
});

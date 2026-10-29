import type { CanvasLayout, Margin } from './umg';

/**
 * The Demo widget numbers the kit's pages lay out from, in UE units, copied from
 * D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI/<widget>.json (slot `layout`, SizeBox overrides, brush sizes) and
 * the widget graphs in D:/TAPTAPGAME_ref/dump/blueprints-pseudo/CatapultHero/BP/UI/. tests/ui-kit/widgets.test.ts
 * re-reads every entry marked with a path from the dump. Values marked MEASURED have no widget data (3D actors placed
 * at runtime) and come from the layout captures in D:/TAPTAPGAME_ref/screens/layout/.
 * SPEC-GAP: `src/content/demo/widgets.ts` (content-bpkit) has not landed; switch to it when it does.
 */
export const WIDGETS = {
  map: {
    /** UI_主界面 主UI内容 › UI_地图页面: the map page fills the play area right of the expanded panel. */
    page: { offsets: [0, 0, 1343, 1080], min: [1, 0], align: [1, 0] } satisfies CanvasLayout,
    /** UI_关卡地图页面 › 地图格框. */
    tiles: { offsets: [0, 0, 1000, 1080], min: [0.5, 0.5], align: [0.5, 0.5] } satisfies CanvasLayout,
    /** UI_关卡地图页面 vars 格子间隔, 格子宽度, 格子高度, 格子数量X; 创建单个地图格 (L8321) places tile i at
     * ((i % 3) × 285 + 500 − 285, ⌊i / 3⌋ × 225 + 224), alignment 0.5. */
    grid: { gap: 75, w: 210, h: 150, cols: 3, x0: 500 - (210 + 75), y0: 224 },
    /** 创建地图格层: min(当前关卡最高层数, 4) rows are created at the start. */
    rows: 4,
    /** UI_地图格 › CanvasPanel_1 (210×150), 指引线 (offsets 0,114 size 582×111 about the tile centre). */
    tile: { w: 210, h: 150 },
    guide: { offsets: [0, 114, 582, 111], min: [0.5, 0.5], align: [0.5, 0.5] } satisfies CanvasLayout,
    /** UI_地图格 › 奖励_默认 › Image (99×108) and 图标_默认 (96×96, padding top 3); Overlay padding bottom 9. */
    iconBox: { w: 99, h: 108, padBottom: 9 },
    icon: { w: 96, h: 96, padTop: 3 },
    /** UI_地图格 › UI_地图格星级 (UI_难度星级 尺寸框 66×69, slot padding −15,−15). */
    stars: { w: 66, h: 69, pad: [-15, -15, 0, 0] as Margin },
    /** UI_地图格 › 文本提醒框 (无法抵达): anchor (0.5, 0), 100×30, alignment (0.5, 1). */
    warn: { offsets: [0, 0, 100, 30], min: [0.5, 0], align: [0.5, 1] } satisfies CanvasLayout,
    /** UI_关卡地图页面 › CanvasPanel_1 › Border_0 (the chapter options row) and Button_63 (撤退). */
    options: { offsets: [-549, 0, 1098, 600], min: [0.5, 0], align: [0, 0] } satisfies CanvasLayout,
    retreat: { offsets: [0, 630, 210, 63], min: [0.5, 0], align: [0.5, 0] } satisfies CanvasLayout,
    /** UI_关卡选项: SizeBox_1 324×600, Border_0 padding 6,0,6,0; 副本名框 padding bottom 210; 规模文本 top 84;
     * 未解锁 VerticalBox_3 padding 24,323,24,0; 祝福 VerticalBox_1 padding 24,314,24,0. */
    option: { w: 324, h: 600, pad: [6, 0, 6, 0] as Margin, nameBottom: 210, scaleTop: 84, lockedTop: 323, blessingTop: 314 },
  },
  quest: {
    /** UI_任务列表 SizeBox_0 324 wide; UI_任务条目 任务名描述 padding 15,0,15,0, the 33×33 bullet Image_139. MEASURED: the
     * list's place in 区域判断 (title at 604,1007 in map_page.json). */
    width: 324,
    namePad: 15,
    bullet: 33,
    at: { x: 604, y: 1007 },
  },
  loot: {
    /** UI_物品盒子 Border_28 948×744; a 3D widget of 修炼系统 under the ortho camera (0.75 screen px per unit). */
    box: { w: 948, h: 744 },
    scale: 0.375,
    /** MEASURED (loot_tooltip.json loot.window 903,243 at 1080p): the window's top-left in grid px. */
    at: { x: 451, y: 121 },
    /** MEASURED (loot.grid 984,318: 81,75 screen px into the window = 108,100 units): 7 × 5 cells of 104 units (the
     * 修炼物品格子组 cell pitch). */
    grid: { x: 108, y: 100, cols: 7, rows: 5, cell: 104 },
    close: { offsets: [-34, 8, 52, 52], min: [1, 0], align: [0.5, 0] } satisfies CanvasLayout,
    buttons: { offsets: [0, 0, 252, 100], min: [0.5, 1], align: [0.5, 1] } satisfies CanvasLayout,
    title: { offsets: [0, 8, 300, 49.714287], min: [0.5, 0], align: [0.5, 0] } satisfies CanvasLayout,
  },
  reward: {
    /** UI_奖励提示 Border_21 399×132; 奖励显示框 at 9,9 (99×108 icon box); 奖励描述 offsets 54,0 240×72 about the centre. */
    w: 399,
    h: 132,
    iconAt: { x: 9, y: 9 },
    desc: { offsets: [54, 0, 240, 72], min: [0.5, 0.5], align: [0.5, 0.5] } satisfies CanvasLayout,
    /** UI_主界面 › 奖励提示框 (VerticalBox): anchor (0.5, 1), offset 288,−96, alignment (0.5, 1). */
    stack: { offsets: [288, -96, 100, 30], min: [0.5, 1], align: [0.5, 1] } satisfies CanvasLayout,
  },
  menu: {
    /** UI_物品交互菜单 SizeBox_0 WidthOverride 210, Border_22 padding 10,8,10,6; UI_物品交互按钮 SizeBox_0 240×52 with
     * 交互按钮 slot padding 0,3,0,3. */
    width: 210,
    pad: [10, 8, 10, 6] as Margin,
    row: 52,
    rowPad: [0, 3, 0, 3] as Margin,
  },
  dismantle: {
    /** UI_分解框 Border_0 300×268; Border_6 (the value) anchor (0.5, 1), offsets 22,−40 120×36, alignment (0.5, 1). */
    w: 300,
    h: 268,
    value: { offsets: [22, -40, 120, 36], min: [0.5, 1], align: [0.5, 1] } satisfies CanvasLayout,
  },
  panel: {
    /** UI_战斗结束统计页 › Overlay_1: anchor (1, 1), offsets −650,−281.08105 605×245; 大标题提示 bottom-right. */
    box: { offsets: [-650, -281.08105, 605, 245], min: [1, 1], align: [0, 0] } satisfies CanvasLayout,
    /** 重新挑战 / 继续: button brushes 156×63; Spacer 14 and Spacer_49 14 high. */
    button: { w: 156, h: 63 },
    spacer: 14,
    /** 出现: RenderOpacity 0 → 1 over 60066 ticks (1.0 s). */
    fadeIn: 60066 / 60000,
  },
  stats: {
    /** UI_角色战斗统计: 左指引线 142×3, four chips (SizeBox 120×48 in two 3-unit borders, slot padding −3,0,0,0). */
    guide: { w: 142, h: 3 },
    chip: { w: 120, h: 48, border: 3 },
  },
} as const;

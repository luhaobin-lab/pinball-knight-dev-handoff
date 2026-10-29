import { rect, type Rect } from '../core/surface';

/**
 * THE layout table of the combat HUD, resolved from the Demo's widget dump
 * (D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI/). Every rect below is written as the raw
 * UE slot (anchor, offsets, alignment, padding) and converted here, so it can be checked against
 * the dump line by line. Two widget spaces make up the combat screen:
 *
 * - SCREEN: UI_主界面 and its children are a screen widget authored at 1920×1080
 *   (DefaultEngine.ini DesignScreenSize, UIScaleRule ShortestSide): 1 unit = 0.5 px of our grid.
 * - SIDE: the left panel UI_背包栏_3d is NOT a screen widget. It is the 3D WidgetComponent 侧栏UI
 *   of the actor BP/环境/修炼/修炼系统 (DrawSize 496×1440, scale 1), lying in the world under the
 *   orthographic camera (BP_PixelCamManager OrthoWidth 2560 → 1440 world units over 1080 screen px).
 *   1 unit = 0.75 screen px = 0.375 px of our grid. Its origin sits 8 units left of the screen edge
 *   (the widget centre is 58 units right of the item grid's; both measured against ss2.jpg, where
 *   the HP frame, the skill slots, the codex/character tiles and the 10 grid rows land within 1 px).
 *   The item cards are 3D actors too (BP_Actor_Card with the 220-unit UI_修炼牌 widget), placed by
 *   the grid component 修炼物品格_已装备 (修炼物品格子组: 10 cells, 104 units apart).
 *
 * Edges are rounded to whole pixels (Math.round of each edge), never sizes, so neighbours stay
 * flush. Art that exists only as sprites (the panel frame, slot frames, icons) is placed from
 * ss2.jpg measurements and marked MEASURED.
 */

/** A rect in widget units (fractional). */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A UE CanvasPanelSlot with point anchors (min = max): offsets are position and size. */
export interface CanvasSlot {
  readonly anchor: readonly [number, number];
  readonly pos: readonly [number, number];
  readonly size: readonly [number, number];
  readonly align?: readonly [number, number];
}

/** UE Margin order: left, top, right, bottom. */
export type Pad = readonly [number, number, number, number];

/** Resolves a canvas slot inside a parent of `pw` × `ph` units. */
export function slotBox(s: CanvasSlot, pw: number, ph: number): Box {
  const [ax, ay] = s.anchor;
  const [al, at] = s.align ?? [0, 0];
  return { x: ax * pw + s.pos[0] - al * s.size[0], y: ay * ph + s.pos[1] - at * s.size[1], w: s.size[0], h: s.size[1] };
}

/** Shrinks a box by a UE padding. */
export function padBox(b: Box, p: Pad): Box {
  return { x: b.x + p[0], y: b.y + p[1], w: b.w - p[0] - p[2], h: b.h - p[1] - p[3] };
}

/** A widget space: px = (units + offset) × scale. */
export interface Space {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** UI_主界面 (1920×1080 design) on the 960×540 grid. */
export const SCREEN: Space = { scale: 0.5, offsetX: 0, offsetY: 0 };

/** The design frame in px: UI_主界面 is a ScaleBox around a 1920×1080 SizeBox, so UE letterboxes it. */
export const DESIGN = { w: 960, h: 540 } as const;

/** Top of the design frame on a layer `h` px tall (centred, whole pixels). */
export function frameTop(h: number): number {
  return Math.max(0, Math.floor((h - DESIGN.h) / 2));
}
/**
 * UI_背包栏_3d, the 3D side panel (see the header).
 * SPEC-GAP: the actor 修炼系统 is placed at runtime, so the panel origin (−8 units) is fitted on ss2.jpg.
 */
export const SIDE: Space = { scale: 0.375, offsetX: -8, offsetY: 0 };

/** Pixel rect of a widget box: each edge rounded on its own. */
export function toPx(b: Box, space: Space): Rect {
  const x0 = Math.round((b.x + space.offsetX) * space.scale);
  const y0 = Math.round((b.y + space.offsetY) * space.scale);
  const x1 = Math.round((b.x + b.w + space.offsetX) * space.scale);
  const y1 = Math.round((b.y + b.h + space.offsetY) * space.scale);
  return rect(x0, y0, x1 - x0, y1 - y0);
}

/** A pixel coordinate of a widget point. */
export function pointPx(x: number, y: number, space: Space): { x: number; y: number } {
  return { x: (x + space.offsetX) * space.scale, y: (y + space.offsetY) * space.scale };
}

// ---------------------------------------------------------------------------------------------
// SIDE: UI_背包栏_3d (CanvasPanel_0 inside SizeBox_0 480×1440)

const SIDE_W = 480;
const SIDE_H = 1440;
const side = (s: CanvasSlot): Box => slotBox(s, SIDE_W, SIDE_H);

/** The skill column 技能栏: a VerticalBox (slot 90×396) of UI_技能格 cells (90×90, top padding 9),
 * render-scaled ×1.333 about its top-right corner (RenderTransformPivot 1,0). */
function skillBox(i: number): Box {
  const col = side({ anchor: [1, 0], pos: [-32, 288], size: [90, 396], align: [1, 0] });
  const k = 1.333;
  const right = col.x + col.w;
  const y = col.y + 9 + i * 99;
  return { x: right - col.w * k, y: col.y + (y - col.y) * k, w: 90 * k, h: 90 * k };
}

const hpBorder = side({ anchor: [0, 1], pos: [274, -1246], size: [316, 28], align: [0.5, 0.5] }); // Border_0 → 生命值 / 持续伤害生命值 / 护甲值
const staminaBorder = side({ anchor: [0, 1], pos: [274, -1198], size: [316, 28], align: [0.5, 0.5] }); // Border_2 → 体力值_1

export const PANEL = {
  /** 升级按钮 (92×92): the level lozenge and its hover; the level digits sit in Border_7 above it. */
  level: toPx(side({ anchor: [0, 0.5], pos: [84, -648], size: [92, 92] }), SIDE),
  /** 等级 text box (Border_7 49.13×52, padding 7,6,0,0): the level number is centred in it. */
  levelText: toPx(padBox(side({ anchor: [0.5, 0], pos: [-111, 118], size: [49.13, 52], align: [0.5, 0.5] }), [7, 6, 0, 0]), SIDE),
  /** 腐化度 in Border_4 (204×44) with padding 12,12,8,12. */
  corruption: toPx(padBox(side({ anchor: [0, 0], pos: [184, 80], size: [204, 44] }), [12, 12, 8, 12]), SIDE),
  /** 经验条 in Border_1 (220×28) with padding 0,12,12,12: a 4-unit line. */
  exp: toPx(padBox(side({ anchor: [0, 0], pos: [196, 132], size: [220, 28] }), [0, 12, 12, 12]), SIDE),
  /** The HP bar: its border box, and the frame image Image_69 (修炼页_Sprite_6, 308×20 at padding 4,4). */
  hp: toPx(hpBorder, SIDE),
  hpFrame: toPx({ x: hpBorder.x + 4, y: hpBorder.y + 4, w: 308, h: 20 }, SIDE),
  stamina: toPx(staminaBorder, SIDE),
  staminaFrame: toPx({ x: staminaBorder.x + 4, y: staminaBorder.y + 4, w: 308, h: 20 }, SIDE),
  /** UI_技能格 ×4 (the dump holds two; the 396-unit column fits four at 99). */
  skills: [0, 1, 2, 3].map(i => toPx(skillBox(i), SIDE)),
  /** Buttons of the right column (Normal = NoDrawType; the visible tile is panel art). */
  codex: toPx(side({ anchor: [0.5, 1], pos: [148, -596], size: [112, 120], align: [0.5, 0] }), SIDE), // 图鉴 (Border_13)
  character: toPx(side({ anchor: [0.5, 1], pos: [148, -460], size: [112, 120], align: [0.5, 0] }), SIDE), // 角色 (Border_14)
  // 材料包 (Border_5, pos 148,-324, 112×120) is Collapsed in the dump: no tile, no target
  retreat: toPx(side({ anchor: [0.5, 1], pos: [148, -236], size: [112, 72], align: [0.5, 0] }), SIDE), // 撤退 (Border_9)
  settings: toPx(side({ anchor: [0.5, 1], pos: [150, -144], size: [76, 60], align: [0.5, 0] }), SIDE), // 设置 (Border_15)
} as const;

/**
 * Panel art (the sprites 修炼页_Sprite_14 装备栏 440×1440 units at actor Y 92, and the slot frames
 * baked into it). SPEC-GAP: only the sprite bounds are in the dump (art is metadata only); the inner
 * structure is MEASURED on ss2.jpg (screen px ÷ 2), an older build than the dump.
 */
export const PANEL_ART = {
  /** The panel column; the play area (区域判断) starts at 178.5. */
  column: rect(0, 0, 178, 540),
  /** 装备栏 sprite bounds: centre 12 units right of the widget centre → x 12..177. */
  sprite: toPx({ x: 32, y: 0, w: 440, h: 1440 }, SIDE),
  /** Recessed wells: the stats block, the item column. */
  statsWell: rect(24, 25, 137, 75),
  itemWell: rect(25, 102, 89, 404),
  /** Icons left of the bars (the heart, the stamina flask) and the corruption skull. */
  hpIcon: rect(27, 68, 11, 10),
  staminaIcon: rect(27, 86, 11, 11),
  skull: rect(145, 33, 11, 11),
} as const;

// ---------------------------------------------------------------------------------------------
// The item grid (修炼物品格子组 at actor X −94, Y 22; 10 cells 104 units apart) and the cards

const GRID_CX = 248 - (80 - 22); // widget centre (Y 80) is 58 units right of the grid (Y 22)
const GRID_CY = 720 + 94; // the grid sits 94 units below the widget centre (actor X is screen-up)
export const GRID_ROWS = 10;
const CELL = 104;

/** Top of row `r` (0..10) in px. */
export function rowTop(r: number): number {
  return Math.round((GRID_CY - (GRID_ROWS / 2) * CELL + r * CELL) * SIDE.scale);
}

export const GRID = {
  /** The grid's two columns (208 units) and its 10 rows; one card spans both columns. */
  rect: toPx({ x: GRID_CX - CELL, y: GRID_CY - (GRID_ROWS / 2) * CELL, w: CELL * 2, h: CELL * GRID_ROWS }, SIDE),
  /** Column split of the empty-cell art (MEASURED: two 38-px squares per empty row). */
  colX: [29, 68] as const,
  cell: 39,
} as const;

export type CardSize = 1 | 2 | 3;

/**
 * The card widget UI_修炼牌 (DrawSize 220 × 108/212/316 for 小型/中型/大型, BP_Actor_Card) centred
 * on its rows, and its sub-boxes in widget units relative to the card's top-left.
 */
export function cardBox(row: number, size: CardSize): Box {
  const h = 108 + CELL * (size - 1);
  const cy = GRID_CY - (GRID_ROWS / 2) * CELL + row * CELL + (CELL * size) / 2;
  return { x: GRID_CX - 110, y: cy - h / 2, w: 220, h };
}

export interface CardLayout {
  /** The card face and frame (sprite 修炼页_铜/银/金/钻 1–3; MEASURED inset: 74 × 39·n − 4 px). */
  readonly face: Rect;
  /** 物品图标 (Overlay_0 padding 24,16,32,16, image padding −4). */
  readonly icon: Rect;
  /** 充能进度 fills Overlay_0. */
  readonly charge: Rect;
  /** 连击信息框: 48×32 at Overlay_0's top-right, 32 units down. */
  readonly combo: Rect;
  /** Right and bottom of 耐久度 (Overlay_0's bottom-right, 4 units in). */
  readonly durabilityRight: number;
  readonly durabilityBottom: number;
  /** Right edge and top of HorizontalBox_50 (the value badges). */
  readonly badgeRight: number;
  readonly badgeTop: number;
  /** Centre x of the 附魔提示框 sockets and their centre y, one per row. */
  readonly socketX: number;
  readonly socketY: readonly number[];
}

export function cardLayout(row: number, size: CardSize): CardLayout {
  const b = cardBox(row, size);
  const area = padBox(b, [24, 16, 32, 16]);
  const top = rowTop(row);
  const sockets = Array.from({ length: size }, (_, i) => (b.y + b.h / 2 + (i - (size - 1) / 2) * 32) * SIDE.scale);
  return {
    face: rect(32, top + 2, 74, GRID.cell * size - 4),
    icon: toPx(padBox(area, [-4, -4, -4, -4]), SIDE),
    charge: toPx(area, SIDE),
    combo: toPx({ x: area.x + area.w - 48, y: area.y + 32, w: 48, h: 32 }, SIDE),
    durabilityRight: Math.round(pointPx(area.x + area.w - 4, 0, SIDE).x),
    durabilityBottom: Math.round(pointPx(0, area.y + area.h, SIDE).y),
    badgeRight: Math.round(pointPx(b.x + b.w, 0, SIDE).x),
    badgeTop: Math.round(pointPx(0, b.y, SIDE).y),
    socketX: Math.round(pointPx(b.x + b.w - 12 - 6, 0, SIDE).x),
    socketY: sockets.map(Math.round),
  };
}

/**
 * One value badge (修炼页_Sprite_25/26/27: 76×44 units = 28.5×16.5 px, the next one 4 units over
 * → pitch 27). The visible pill inside the sprite is MEASURED on ss2: 25×11, 2 px in from the
 * slot's right, 3 px down.
 */
export const BADGE = { w: 25, h: 11, pitch: 27, right: 2, top: 3 } as const;

// ---------------------------------------------------------------------------------------------
// SCREEN: UI_主界面 (1920×1080)

/**
 * 区域判断 (the play area): anchored right, 1343 units wide out of combat; the combat animation
 * 区域判断变大 widens it to 1563 (CanvasPanelSlot_18 Offsets.Right keys 1343 → 1563), so its left
 * edge meets the side panel at 1920 − 1563 = 357 units (178.5 px).
 */
export const PLAY_AREA_UNITS = 1563;
const PLAY_AREA_LEFT = Math.round((1920 - PLAY_AREA_UNITS) * SCREEN.scale);

/** Pixel rect of a screen widget for a grid of `w` × `h` px (anchors follow the real grid). */
export function screenRect(s: CanvasSlot, w: number, h: number): Rect {
  return toPx(slotBox(s, w / SCREEN.scale, h / SCREEN.scale), SCREEN);
}

/**
 * The play area on a layer `w` px wide: from the side panel's right edge to the layer's right edge.
 * UI_主界面's ScaleBox keeps 区域判断 next to the panel on every viewport, so on layers wider than
 * 960 px (1366×768 or 1920×969 at ×1) it grows to the right instead of detaching from the panel.
 */
export function playArea(w: number, h: number): Rect {
  return rect(PLAY_AREA_LEFT, 0, Math.max(0, w - PLAY_AREA_LEFT), h);
}

/** Where a popup's 位移提示 target may land, in HUD-layer px. */
export interface Bounds {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** UI_伤害提示 / UI_治疗提示.位移提示 FClamp the target to X 485..1792, Y 128..952: 区域判断 inset 128 units. */
const POPUP_INSET = 128;

/**
 * The popup clamp on a layer `w` × `h` px: 64 px inside the play area. Like 区域判断 it runs to the
 * right edge of a wider layer; vertically it stays in the design frame.
 */
export function popupBounds(w: number, h: number): Bounds {
  const k = SCREEN.scale;
  const top = frameTop(h);
  return { x0: (1920 - PLAY_AREA_UNITS + POPUP_INSET) * k, x1: w - POPUP_INSET * k, y0: top + POPUP_INSET * k, y1: top + DESIGN.h - POPUP_INSET * k };
}

/** UI_任务列表 in 区域判断 (padding 12,15,12,15, bottom-left), 324 units wide (SizeBox_0). */
export const QUEST = {
  pad: [12, 15, 12, 15] as Pad,
  width: 324,
  /** UI_任务条目.任务名描述 padding 15,0,15,0; the objective line starts with the 33-unit bullet. */
  titleIndent: 15,
  bullet: 33,
} as const;

/** 各种状态栏 in 区域判断: padding 24 from the play area's top-left. UI_增减益格 cells are
 * 72-unit icons in a Border with padding 6 + 3 → 90 units (45 px). */
export const STATUS = { pad: 24, cell: 90, icon: 72 } as const;

/** 回合统计 (Overlay 400×635, anchored top-right at −36, 372): rank letters, a 240-unit rule at
 * 86 (shadow at 88), stat lines from 96, right-aligned. */
export const TURN_STATS = {
  slot: { anchor: [1, 0], pos: [-36, 372], size: [400, 635], align: [1, 0] } as CanvasSlot,
  ruleTop: 86,
  ruleWidth: 240,
  linesTop: 96,
  /** UI_回合统计词条 is a 30-unit tall row (SizeBox_1 120×30). */
  line: 30,
  /** 数值 right padding 6 before the 120-unit label box. */
  valueGap: 6,
  labelWidth: 120,
} as const;

/**
 * The low-health frame (区域判断.Overlay_1): 6-unit red bars on all four edges of the play area and
 * the 「低生命值」 tag at padding 6,140 (Border_63, text padding 9,0,6,2). 区域判断's Tick pulses it:
 * Delta Seconds += dt × 5, opacity = MapRangeClamped(sin(Delta Seconds), −1, 1, 0.2, 1.0).
 */
export const LOW_HEALTH = { bar: 6, tag: { x: 6, y: 140, padX: 9, padRight: 6 }, pulse: { rate: 5, min: 0.2, max: 1 } } as const;

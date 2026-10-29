import type { Rect } from '../../core/surface';
import { WIDGETS } from '../../kit/demo';
import { box, canvasBox, DESIGN_UNITS, toGrid, type Box } from '../../kit/umg';

const M = WIDGETS.map;

/** UI_地图页面 in the design frame (units): 577..1920 × 0..1080. */
export const PAGE_BOX: Box = canvasBox(M.page, DESIGN_UNITS);
/** 地图格框 (1000×1080, centred in the page). */
export const TILES_BOX: Box = canvasBox(M.tiles, box(0, 0, PAGE_BOX.w, PAGE_BOX.h));

/** Centre of tile (col, row) in design units: 创建单个地图格's position plus the two canvases' origins. */
export function tileCentre(col: number, row: number): { x: number; y: number } {
  const g = M.grid;
  return { x: PAGE_BOX.x + TILES_BOX.x + g.x0 + col * (g.w + g.gap), y: PAGE_BOX.y + TILES_BOX.y + g.y0 + row * (g.h + g.gap) };
}

/** The tile's 210×150 frame (alignment 0.5) on the grid. */
export function tileRect(col: number, row: number): Rect {
  const c = tileCentre(col, row);
  return toGrid(box(c.x - M.tile.w / 2, c.y - M.tile.h / 2, M.tile.w, M.tile.h));
}

/** 奖励_默认 › Image (99×108), centred with the Overlay's 9-unit bottom padding. */
export function iconBoxRect(col: number, row: number): Rect {
  const c = tileCentre(col, row);
  const { w, h, padBottom } = M.iconBox;
  return toGrid(box(c.x - w / 2, c.y - h / 2 - padBottom / 2, w, h));
}

/** UI_地图格星级 (66×69) at the tile's top-left with the −15,−15 slot padding. */
export function starsRect(col: number, row: number): Rect {
  const c = tileCentre(col, row);
  const { w, h, pad } = M.stars;
  return toGrid(box(c.x - M.tile.w / 2 + pad[0], c.y - M.tile.h / 2 + pad[1], w, h));
}

/** The y of the connector bus between row and row + 1 (指引线 centre, 114 units below the tile centre). */
export function busY(row: number): number {
  return Math.round((tileCentre(0, row).y + M.guide.offsets[1]) * 0.5);
}

/** The 无法抵达 line above the tile (文本提醒框: anchor top centre, alignment bottom). */
export function warnRect(col: number, row: number): Rect {
  const c = tileCentre(col, row);
  const parent = box(c.x - M.tile.w / 2, c.y - M.tile.h / 2, M.tile.w, M.tile.h);
  return toGrid(canvasBox(M.warn, parent));
}

/**
 * UI_关卡地图页面 › CanvasPanel_1 in its WidgetSwitcherSlot (HAlign/VAlign_Center): the canvas takes its desired size,
 * the furthest child edge (Border_0 0..600, Button_63 630..693), and is centred in the page. Its children anchor at
 * x 0.5, so only the vertical centring moves them.
 * SPEC-GAP: no Demo capture of the options mode; the block is centred by SConstraintCanvas's desired-size rule.
 */
export const OPTIONS_CANVAS: Box = (() => {
  const h = Math.max(M.options.offsets[1] + M.options.offsets[3], M.retreat.offsets[1] + M.retreat.offsets[3]);
  return box(PAGE_BOX.x, PAGE_BOX.y + (PAGE_BOX.h - h) / 2, PAGE_BOX.w, h);
})();

/** The chapter options (UI_关卡选项, 324×600 each, centred in Border_0) and the 撤退 button. */
export function optionRects(n: number): Rect[] {
  const row = canvasBox(M.options, OPTIONS_CANVAS);
  const w = M.option.w;
  const x0 = row.x + (row.w - n * w) / 2;
  return Array.from({ length: n }, (_, i) => toGrid(box(x0 + i * w + M.option.pad[0], row.y, w - M.option.pad[0] - M.option.pad[2], M.option.h)));
}

export function retreatRect(): Rect {
  return toGrid(canvasBox(M.retreat, OPTIONS_CANVAS));
}

/** The quest list's top-left (MEASURED on map_page.json) in px. */
export const QUEST_AT = { x: WIDGETS.quest.at.x / 2, y: WIDGETS.quest.at.y / 2 } as const;

import type { PixelSprite } from '../../kit/widgets';
import type { TooltipModel } from '../../kit/tooltip';

/**
 * View model of the map page (UI_关卡地图页面 with UI_地图格, UI_关卡选项, UI_难度星级, UI_任务列表 / UI_任务条目).
 * Built by `src/game` from `view.map`; the page never decides reachability or contents.
 */

/** What a tile's icon box shows when no sprite is given (the Demo draws the 地图格结构 sprites). */
export type MapGlyph = 'portal' | 'enemies' | 'boss' | 'chest' | 'unknown' | 'camp' | 'empty';

export interface MapTile {
  /** Column 0..2 (格子数量X = 3) and row from the top of the shown window (row 0 = where the hero stands). */
  readonly col: number;
  readonly row: number;
  readonly glyph: MapGlyph;
  /** A reward sprite for 奖励_默认 (e.g. `itemIcon(row, 48)` from src/procgen/icons). */
  readonly icon?: PixelSprite;
  /**
   * `current`: 设为当前所在格 (the hero is here, lit); `open`: 可探索？ (can be entered); `closed`: not reachable from the
   * current tile; `cleared`: 已清理？ (passed).
   */
  readonly state: 'current' | 'open' | 'closed' | 'cleared';
  /** UI_难度星级 image index 0..3 (difficulty / elite marker), absent = Collapsed. */
  readonly stars?: number;
  /** 数值提示 (a count on the icon box), absent = Collapsed. */
  readonly value?: number;
  /** Columns of the next row this tile's 指引线 connects to. */
  readonly links: readonly number[];
  /** The hover tooltip (UI_悬停提示 basic mode: 房间 / its description). */
  readonly tip?: TooltipModel;
}

/** UI_关卡选项 (the chapter page: 营地 and the chapters). */
export interface ChapterOption {
  readonly id: string;
  /** 副本名框. */
  readonly name: string;
  /** 规模文本 (e.g. （小型）). */
  readonly scale?: string;
  /** 已解锁？ false → 未解锁 with the lock. */
  readonly locked?: boolean;
  /** 祝福描述 (rich), shown in VerticalBox_1. */
  readonly blessing?: string;
}

export interface QuestEntry {
  /** 任务名描述. */
  readonly title: string;
  /** 目标描述文本 lines (rich, e.g. `通过第<数值>3/12</>层`). */
  readonly lines: readonly string[];
}

export interface MapModel {
  /** 页面切换: 0 = the chapter options (CanvasPanel_1), 1 = the tile map (CanvasPanel_16). */
  readonly mode: 'options' | 'tiles';
  readonly tiles: readonly MapTile[];
  readonly options?: readonly ChapterOption[];
  /** The quest list drawn bottom-left of the play area (UI_任务列表), if the HUD does not draw it. */
  readonly quest?: readonly QuestEntry[];
}

export type MapIntent =
  | { readonly kind: 'enter'; readonly col: number; readonly row: number }
  | { readonly kind: 'option'; readonly option: string }
  | { readonly kind: 'retreat' };

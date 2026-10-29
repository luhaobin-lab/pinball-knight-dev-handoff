/**
 * The HUD's turn-statistics slice (UI_主界面 回合统计, rating-shot-stats RATING-012…016): the letter, its fill and one
 * line per stat in first-occurrence order. Plain data; number formatting (科学数字缩写, 0 decimals) is the text module's.
 */
import { 数据表_词条_统计 } from '../../../content/demo/tables.ts';
import type { FText } from '../../../content/demo/types.ts';
import { Divide_IntInt, Percent_IntInt } from '../../math/kismet.ts';
import { 科学数变普通, type 科学数 } from '../../math/sci.ts';
import type { World } from '../../sim/world.ts';

export type 评级字母 = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
const LETTERS: readonly 评级字母[] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];

/**
 * 评级文本 for a score: select(Clamp(回合评分 ÷ 50, 0, 6)) (GM @989–@1226). The visible switcher index is unclamped
 * and UMG clamps it to the last child, so both agree (RATING-012/053; SPEC-GAP G15: engine clamp assumed).
 * The turn end's 获得SSS check (`评级文本 == "SSS"`, RATING-031) reads this: 评级文本 was last set by the latest scored
 * update, and 回合评分 only changes there or in 进入战斗状态, which also empties 回合战斗统计.
 */
export const 评级 = (回合评分: number): 评级字母 => LETTERS[Math.min(6, Math.max(0, Divide_IntInt(回合评分, 50)))];

/** 评级进度条 (UIM line 185, RATING-013): float((回合评分 % 50) / 50.0), the BottomToTop fill of every letter. */
export const 评级进度 = (回合评分: number): number => Math.fround(Percent_IntInt(回合评分, 50) / 50.0);

export interface TurnStatsView {
  /** 回合评分. */
  readonly score: number;
  readonly letter: 评级字母;
  readonly progress: number;
  /** UI_回合统计词条 lines: 数据表_词条_统计[stat].游戏中名 and the accumulated 科学数 (also as a plain number). */
  readonly lines: readonly { readonly stat: string; readonly label: FText | null; readonly value: 科学数; readonly amount: number }[];
}

const ROWS: Readonly<Record<string, { readonly 游戏中名: FText }>> = 数据表_词条_统计.rows;

export function turnStatsView(world: World): TurnStatsView {
  const mode = world.mode;
  return {
    score: mode.回合评分,
    letter: 评级(mode.回合评分),
    progress: 评级进度(mode.回合评分),
    // A missing row keeps the designer placeholder "错误错误" (UIL L10); label null stands for it.
    lines: [...mode.回合战斗统计].map(([stat, value]) => ({ stat, label: ROWS[stat]?.游戏中名 ?? null, value, amount: 科学数变普通(value) })),
  };
}

import type { Rect } from '../../core/surface';
import { toGrid, type Box } from '../../kit/umg';

/**
 * UI_英雄选择页 (D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI/UI_英雄选择页.json, full screen in UI_主界面) in the
 * 1920×1080 design. Border_0 pads the content 150, 32, 32, 0; SizeBox_4 (640 wide) sits left, centred vertically, and
 * stacks VerticalBox_34: [英雄天赋框 Collapsed] 英雄介绍 (名字, 简介 360×320 box, 技能介绍框 160 tall), 英雄头像框, [深渊级别框
 * Collapsed], 出发.
 */

/** One text line of the Demo's 24-unit fonts (思源宋体 / 思源黑体 at the default size). MEASURED on demo shots: 34 units. */
export const LINE = 34;

const CONTENT = { x: 150, y: 32, w: 1920 - 150 - 32, h: 1080 - 32 } as const;
const COLUMN_W = 640;

/** UI_英雄头像: Border_0 padding 15 around SizeBox_0 114×114; 英雄头像 (padding 3) → Border_3 (RebornIcon01, padding 18) → icon. */
const AVATAR = { outer: 114 + 30, size: 114, frame: 3, ring: 18 } as const;

const parts = {
  name: { top: 7, h: LINE },
  intro: { top: 12, side: 16, h: 320 },
  skills: { h: 160 },
  avatars: { top: 32, h: AVATAR.size },
  start: { top: 32, w: 156, h: 63 },
} as const;

const columnH =
  parts.name.top + parts.name.h + parts.intro.top + parts.intro.h + parts.skills.h + parts.avatars.top + parts.avatars.h + parts.start.top + parts.start.h;
const column: Box = { x: CONTENT.x, y: CONTENT.y + (CONTENT.h - columnH) / 2, w: COLUMN_W, h: columnH };

export interface AvatarRects {
  /** 英雄头像 (the 114-unit hover border). */
  readonly frame: Rect;
  /** Border_1: the hero icon (and the 未解锁标志 overlay over it). */
  readonly icon: Rect;
  /** 已选取标志 33×36: padding left 9, top −12, right −12, HAlign Right on the icon overlay. */
  readonly mark: Rect;
}

export interface HeroSelectLayout {
  readonly title: Rect;
  readonly name: Rect;
  readonly intro: Rect;
  readonly skills: Rect;
  readonly avatars: readonly AvatarRects[];
  readonly start: Rect;
  readonly close: Rect;
  /** Where 角色选择立绘 (the full-screen splash) puts the hero: the right of the screen, beside the column. */
  readonly splash: Rect;
}

export function heroSelectLayout(heroes: number): HeroSelectLayout {
  let y = column.y + parts.name.top;
  const name: Box = { x: column.x, y, w: column.w, h: parts.name.h };
  y += parts.name.h + parts.intro.top;
  // SizeBox_2 is a Fill slot: 360 is only its desired width; it spans the column minus its 16-unit side padding.
  const intro: Box = { x: column.x + parts.intro.side, y, w: column.w - 2 * parts.intro.side, h: parts.intro.h };
  y += parts.intro.h;
  const skills: Box = { x: column.x, y, w: column.w, h: parts.skills.h };
  y += parts.skills.h + parts.avatars.top;
  const rowX = column.x + (column.w - heroes * AVATAR.outer) / 2;
  const avatars = Array.from({ length: heroes }, (_, i): AvatarRects => {
    const frame: Box = { x: rowX + i * AVATAR.outer + 15, y, w: AVATAR.size, h: AVATAR.size };
    const inset = AVATAR.frame + AVATAR.ring;
    const icon: Box = { x: frame.x + inset, y: frame.y + inset, w: frame.w - 2 * inset, h: frame.h - 2 * inset };
    const mark: Box = { x: icon.x + icon.w + 12 - 33, y: icon.y - 12, w: 33, h: 36 };
    return { frame: toGrid(frame), icon: toGrid(icon), mark: toGrid(mark) };
  });
  y += parts.avatars.h + parts.start.top;
  const start: Box = { x: column.x + (column.w - parts.start.w) / 2, y, w: parts.start.w, h: parts.start.h };
  return {
    // TextBlock_56: anchor (0.5, 0), offsets 0, 21, 824, 45, alignment (0.5, 0).
    title: toGrid({ x: 960 - 412, y: 21, w: 824, h: 45 }),
    name: toGrid(name),
    intro: toGrid(intro),
    skills: toGrid(skills),
    avatars,
    start: toGrid(start),
    // Border_2: anchor (1, 0), 51 × 51, alignment (1, 0); 关闭按钮 inside its 6-unit padding.
    close: toGrid({ x: 1920 - 51 + 6, y: 6, w: 39, h: 39 }),
    splash: toGrid({ x: column.x + column.w + 200, y: 140, w: 1920 - (column.x + column.w + 200) - 160, h: 800 }),
  };
}

/** UI_介绍词条: 描述名 (padding left 33), then a row with the 33-unit bullet and 描述文本 (bottom padding 9). */
export const SKILL_ENTRY = { indent: 33, bullet: 33, rowPad: 9 } as const;

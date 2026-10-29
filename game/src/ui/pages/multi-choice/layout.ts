import type { Rect } from '../../core/surface';
import { toGrid, type Box } from '../../kit/umg';

/**
 * 多选一父级 (UI_主界面: anchor (0.5, 0), offset (288, 525), auto size, alignment (0.5, 0.5)) and its UI_天赋选项 cards, in
 * the 1920×1080 design. The overlay sizes to its WrapBox; HorizontalBox_2 (the buttons) hangs 75 units below it
 * (padding bottom −75, VAlign Bottom).
 * SPEC-GAP: talent_pick.json (tut07 f087) has the cards 100 units further left (x 698 instead of 798) and 20 higher;
 * the dump's anchor wins (the capture is a 600×400 crop of a recording).
 */
export const CHOICE_CENTRE = { x: 960 + 288, y: 525 } as const;

/** UI_天赋选项: BG_天赋 900×210 and BG_事件 288×468, each with 3 units of padding above and below. */
export const CARD = {
  talent: { w: 900, h: 216 },
  event: { w: 288, h: 474 },
} as const;

/** 天赋放弃按钮 / 刷新按钮: SizeBox 189×75 with 9 units of padding left and right. */
const BUTTON = { w: 189, h: 75, pad: 9 } as const;

export interface TalentCardRects {
  readonly card: Rect;
  readonly face: Rect;
  /** FG_天赋_1 (SkillGrid2, 90×90, padding left 51, centred) and FG_天赋 (72×72, padding left 60). */
  readonly iconFrame: Rect;
  readonly icon: Rect;
  /** 名字_天赋 at padding 196, 24. */
  readonly name: Rect;
  /** 天赋等级_天赋 right-aligned 60 from the right, 等级文本_天赋 140 from the right, both at top 30. */
  readonly level: Rect;
  readonly levelLabel: Rect;
  /** VerticalBox_0 at 196, 85: 技能条件描述框 then 描述 (652 × 75). */
  readonly desc: Rect;
  /** 价格牌 57×30, 15 from the right and bottom. */
  readonly price: Rect;
  /** 互斥提示 198×42 turned 90° about its centre, hanging 117 units past the right edge: a vertical strip. */
  readonly excluded: Rect;
}

export interface EventCardRects {
  readonly card: Rect;
  readonly face: Rect;
  /** FG_事件 96×96 at top 90 (right padding 3, centred). */
  readonly icon: Rect;
  /** SizeBox 226×226, bottom padding 36, centred: 描述_1, vertically centred. */
  readonly desc: Rect;
  readonly price: Rect;
  readonly excluded: Rect;
}

export interface ChoiceLayout {
  readonly talent: readonly TalentCardRects[];
  readonly event: readonly EventCardRects[];
  readonly skip: Rect;
  readonly reroll: Rect | null;
}

/** The vertical 互斥 strip: the 198×42 box (HAlign Right, padding right −117, VAlign Center) rotated 90°. */
function excludedStrip(card: Box): Box {
  const bx = card.x + card.w + 117 - 198;
  const by = card.y + (card.h - 42) / 2;
  const cx = bx + 99;
  const cy = by + 21;
  return { x: cx - 21, y: cy - 99, w: 42, h: 198 };
}

function talentCard(card: Box): TalentCardRects {
  const at = (x: number, y: number, w: number, h: number): Rect => toGrid({ x: card.x + x, y: card.y + y, w, h });
  return {
    card: toGrid(card),
    face: at(0, 3, card.w, 210),
    iconFrame: at(51, (card.h - 90) / 2, 90, 90),
    icon: at(60, (card.h - 72) / 2, 72, 72),
    name: at(196, 24, 500, 34),
    level: at(card.w - 60 - 80, 30, 80, 34),
    levelLabel: at(card.w - 140 - 80, 30, 80, 34),
    desc: at(196, 85, 652, 75 + 40),
    price: at(card.w - 15 - 57, card.h - 15 - 30, 57, 30),
    excluded: toGrid(excludedStrip(card)),
  };
}

function eventCard(card: Box): EventCardRects {
  const at = (x: number, y: number, w: number, h: number): Rect => toGrid({ x: card.x + x, y: card.y + y, w, h });
  return {
    card: toGrid(card),
    face: at(0, 3, card.w, 468),
    icon: at((card.w - 3 - 96) / 2, 90, 96, 96),
    desc: at((card.w - 226) / 2, card.h - 36 - 226, 226, 226),
    price: at(card.w - 15 - 57, card.h - 15 - 30, 57, 30),
    excluded: toGrid(excludedStrip(card)),
  };
}

export function choiceLayout(kind: 'talent' | 'event', count: number, reroll: boolean): ChoiceLayout {
  const c = CARD[kind];
  const n = Math.max(1, count);
  const w = kind === 'talent' ? c.w : c.w * n;
  const h = kind === 'talent' ? c.h * n : c.h;
  const x0 = CHOICE_CENTRE.x - w / 2;
  const y0 = CHOICE_CENTRE.y - h / 2;
  const cards = Array.from({ length: count }, (_, i): Box => (kind === 'talent' ? { x: x0, y: y0 + i * c.h, w: c.w, h: c.h } : { x: x0 + i * c.w, y: y0, w: c.w, h: c.h }));
  const buttons = reroll ? 2 : 1;
  const rowW = buttons * (BUTTON.w + 2 * BUTTON.pad);
  const rowX = CHOICE_CENTRE.x - rowW / 2;
  const rowY = y0 + h + 75 - BUTTON.h;
  const button = (i: number): Rect => toGrid({ x: rowX + i * (BUTTON.w + 2 * BUTTON.pad) + BUTTON.pad, y: rowY, w: BUTTON.w, h: BUTTON.h });
  return {
    talent: kind === 'talent' ? cards.map(talentCard) : [],
    event: kind === 'event' ? cards.map(eventCard) : [],
    skip: button(0),
    reroll: reroll ? button(1) : null,
  };
}

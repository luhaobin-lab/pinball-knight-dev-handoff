import { rect, type Rect, type Surface } from '../core/surface';
import { BONE, DANGER, INK, ITEM_ACCENT } from '../style/palette';
import type { TextFont } from '../text/font';
import { drawRich, label, layoutRich } from './rich';
import { STR } from './strings';
import { QUALITY_STYLE, RICH_DEFAULT, TEXT, type Quality } from './style';
import { panel, rule } from './widgets';

/**
 * Tooltip (UI_悬停提示 and its parts UI_技能词条, UI_属性词条, UI_物品类型标签, UI_词条说明). One model covers the widget's
 * modes: the plain 描述名 + 基础描述 (map rooms, buttons), the item card (修炼牌信息框: quality, type chips, charge and
 * effect lines, durability, dismantle value, mouse hints), the skill (消耗 / 冷却) and the task (目标 / 奖励). Sections a
 * model leaves out are Collapsed, as the widget does.
 */
export interface TooltipModel {
  /** 基础宽度 in units: 简单描述 / 显示名词描述 pass it (UI_地图格 275, buttons and statuses 375, 名词 320); default 375. */
  width?: number;
  /** 描述名文本 (centred, EDEDED). */
  title?: string;
  /** 品质信息框: the quality name in its style (`<青铜>青铜品质</>`); `qualityText` overrides the label. */
  quality?: Quality;
  qualityText?: string;
  /** 修炼牌类型文本框: UI_物品类型标签 chips (小型, 武器 …). */
  tags?: readonly string[];
  /** 基础描述文本 / 充能速度框 paragraphs (rich). */
  body?: readonly string[];
  /** UI_技能词条 lines: a bullet and rich text; `use` lines are the 使用时 effects (orange bullet in the Demo). */
  effects?: readonly { text: string; kind?: 'charge' | 'use' | 'passive' }[];
  /** UI_属性词条 rows (label left 120 units, value right). */
  stats?: readonly { label: string; value: string }[];
  /** 技能条件描述框: 体力消耗 / 冷却回合. */
  cost?: { stamina?: number | string; cooldown?: number | string };
  /** 耐久信息框. */
  durability?: { cur: number; max: number };
  /** 分解信息框: 分解获得： and the price chip. */
  dismantle?: number;
  /** 任务词条框. */
  task?: { objective: readonly string[]; reward: readonly string[] };
  /** 辅助描述文本 (8B8B8B). */
  note?: string;
  /** 鼠标提示框: left / right click hints. */
  mouse?: { left?: string; right?: string };
  /** UI_词条说明 keyword boxes beside the tooltip (附内容框). */
  keywords?: readonly string[];
}

/** Widths in units (UI_悬停提示): 基础宽度 375 inside 主内容's 3 + 3 and Border_0's 3 + 3 borders and 6 + 6 padding. */
const U = 0.5;
export const TIP = {
  /** Outer width: 375 + 2 × (6 + 3 + 3) = 399 units. */
  width: Math.round((375 + 24) * U),
  /** Content inset from the outer edge: 3 + 3 + 6 units. */
  inset: Math.round(12 * U),
  /** Body text inset (基础描述 padding 11). */
  text: Math.round(11 * U),
  /** UI_词条说明 width: the 375-unit 附内容 column. */
  keywordWidth: Math.round(375 * U),
  /** Gap between the tooltip and the keyword column (Spacer_40: 0) and between keyword boxes (Border_40 top pad 3). */
  keywordGap: 2,
} as const;

type Op = (s: Surface, x: number, y: number) => void;

/** Measures and records the drawing of a tooltip at `TIP.width`; `draw` paints it with its top-left at (x, y). */
export function layoutTooltip(font: TextFont, m: TooltipModel): { w: number; h: number; draw: (s: Surface, x: number, y: number) => void } {
  const w = m.width === undefined ? TIP.width : Math.round((m.width + 24) * U);
  const inner = w - 2 * TIP.inset;
  const ops: { y: number; op: Op }[] = [];
  let y = TIP.inset;
  const add = (h: number, op: Op): void => {
    const at = y;
    ops.push({ y: at, op });
    y += h;
  };
  const textW = inner - 2 * TIP.text;

  if (m.title) add(font.line + 2, (s, x, yy) => label(s, font, m.title!, rect(x + TIP.inset, yy, inner, font.line), TEXT.title, 'center'));
  if (m.quality !== undefined || m.qualityText) {
    const q = m.quality ?? 0;
    const text = `<${QUALITY_STYLE[q]}>${m.qualityText ?? STR.qualityName[q]}</>`;
    add(font.line + 4, (s, x, yy) => {
      const b = layoutRich(font, text, inner);
      drawRich(s, font, b, rect(x + TIP.inset, yy, inner, font.line), { styles: RICH_DEFAULT, align: 'center' });
    });
  }
  if (m.tags?.length) {
    const chipH = font.line + 4;
    add(chipH + 3, (s, x, yy) => {
      let cx = x + TIP.inset + TIP.text;
      for (const t of m.tags!) {
        const cw = font.measure(t) + 12;
        const r = rect(cx, yy, cw, chipH);
        s.fillRect(r, INK.raised);
        s.frame(r, BONE.faint);
        label(s, font, t, r, TEXT.body, 'center');
        cx += cw + 3;
      }
    });
  }
  const divider = (): void => add(8, (s, x, yy) => rule(s, x + TIP.inset + 2, yy + 4, inner - 4));
  if ((m.quality !== undefined || m.tags?.length) && (m.body?.length || m.effects?.length)) divider();
  for (const p of m.body ?? []) {
    const b = layoutRich(font, p, textW);
    add(b.h + 3, (s, x, yy) => drawRich(s, font, b, rect(x + TIP.inset + TIP.text, yy, textW, b.h), { styles: RICH_DEFAULT }));
  }
  for (const e of m.effects ?? []) {
    const b = layoutRich(font, e.text, textW - 12);
    add(b.h + 2, (s, x, yy) => {
      const bx = x + TIP.inset + TIP.text;
      const c = e.kind === 'use' ? ITEM_ACCENT.weapon : BONE.dim;
      s.fill(bx + 2, yy + 6, 4, 4, c);
      drawRich(s, font, b, rect(bx + 12, yy, textW - 12, b.h), { styles: RICH_DEFAULT });
    });
  }
  for (const st of m.stats ?? []) {
    add(font.line, (s, x, yy) => {
      const r = rect(x + TIP.inset + TIP.text, yy, textW, font.line);
      label(s, font, st.label, r, TEXT.body, 'left');
      label(s, font, st.value, r, TEXT.body, 'right');
    });
  }
  if (m.cost) {
    const lines: [string, string | number][] = [];
    if (m.cost.stamina !== undefined) lines.push([STR.staminaCost, m.cost.stamina]);
    if (m.cost.cooldown !== undefined) lines.push([STR.cooldownTurns, m.cost.cooldown]);
    for (const [k, v] of lines)
      add(font.line, (s, x, yy) => {
        const r = rect(x + TIP.inset + TIP.text, yy, textW, font.line);
        const vw = font.measure(String(v));
        label(s, font, String(v), r, BONE.base, 'right');
        label(s, font, k, rect(r.x, r.y, r.w - vw - 3, r.h), TEXT.body, 'right');
      });
  }
  if (m.task) {
    const block = (head: string, lines: readonly string[]): void => {
      add(font.line + 2, (s, x, yy) => label(s, font, head, rect(x + TIP.inset + TIP.text, yy, textW, font.line), TEXT.title, 'left'));
      for (const l of lines) {
        const b = layoutRich(font, l, textW - 8);
        add(b.h + 1, (s, x, yy) => drawRich(s, font, b, rect(x + TIP.inset + TIP.text + 8, yy, textW - 8, b.h), { styles: RICH_DEFAULT }));
      }
    };
    block(STR.objective, m.task.objective);
    block(STR.reward, m.task.reward);
  }
  if (m.note) {
    const b = layoutRich(font, m.note, textW);
    add(b.h + 2, (s, x, yy) => drawRich(s, font, b, rect(x + TIP.inset + TIP.text, yy, textW, b.h), { styles: { Default: { color: BONE.dim } } }));
  }
  if (m.durability || m.dismantle !== undefined) divider();
  if (m.durability) {
    const d = m.durability;
    add(font.line, (s, x, yy) => {
      const r = rect(x + TIP.inset, yy, inner - TIP.text, font.line);
      const v = `${d.cur}/${d.max}`;
      label(s, font, v, r, d.cur <= 0 ? DANGER.base : BONE.base, 'right');
      label(s, font, STR.durability, rect(r.x, r.y, r.w - font.measure(v), r.h), TEXT.body, 'right');
    });
  }
  if (m.dismantle !== undefined) {
    const v = String(m.dismantle);
    add(font.line + 4, (s, x, yy) => {
      const chip = rect(x + w - TIP.inset - TIP.text - (font.measure(v) + 16), yy + 1, font.measure(v) + 16, font.line + 1);
      s.fillRect(chip, INK.deep);
      s.frame(chip, BONE.faint);
      s.fill(chip.x + 3, chip.y + 6, 5, 5, TEXT.currency);
      label(s, font, v, rect(chip.x + 10, chip.y, chip.w - 12, chip.h), TEXT.currency, 'right');
      label(s, font, STR.dismantleGain, rect(x + TIP.inset, yy, chip.x - x - TIP.inset - 3, font.line + 2), TEXT.body, 'right');
    });
  }
  if (m.mouse && (m.mouse.left || m.mouse.right)) {
    const rows = [m.mouse.left ? ['L', m.mouse.left] : null, m.mouse.right ? ['R', m.mouse.right] : null].filter((r): r is string[] => r !== null);
    y += 3;
    add(rows.length * font.line + 4, (s, x, yy) => {
      s.fill(x + 1, yy, w - 2, rows.length * font.line + 4, INK.raised);
      rows.forEach(([side, text], i) => {
        const ry = yy + 2 + i * font.line;
        mouseGlyph(s, x + TIP.inset + 1, ry + MOUSE_TOP, side === 'L');
        label(s, font, text, rect(x + TIP.inset + 10, ry, inner - 10, font.line), TEXT.body, 'left');
      });
    });
  }
  const h = y + TIP.inset;
  return {
    w,
    h,
    draw: (s, x, yy) => {
      panel(s, rect(x, yy, w, h), 'tip');
      for (const o of ops) o.op(s, x, yy + o.y);
    },
  };
}

/** The mouse glyph (鼠标提示_Sprite_0 / _2): 5 × 7, the pressed button lit; MOUSE_TOP centres it on a text line. */
const MOUSE = ['.###.', '#L#R#', '#L#R#', '#####', '#...#', '#...#', '.###.'] as const;
export const MOUSE_SIZE = { w: 5, h: 7 } as const;
/** Rows 5..11 of the 16-px line box: centred on the CJK ink of the 12-px font (about rows 3..14). */
export const MOUSE_TOP = 5;

export function mouseGlyph(s: Surface, x: number, y: number, left: boolean): void {
  MOUSE.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const lit = (left && (ch === 'L' || (j <= 2 && i <= 1))) || (!left && (ch === 'R' || (j <= 2 && i >= 3)));
      if (ch === 'L' || ch === 'R') {
        if (lit) s.px(x + i, y + j, BONE.base);
        continue;
      }
      s.px(x + i, y + j, lit ? BONE.base : BONE.dim);
    }
  });
}

/** UI_词条说明: one keyword box (Border_40/15/38 padding 3 + 3 + 12/6/12/15 units) at `TIP.keywordWidth`. */
export function layoutKeyword(font: TextFont, text: string): { w: number; h: number; draw: (s: Surface, x: number, y: number) => void } {
  const w = TIP.keywordWidth;
  const padX = Math.round((3 + 3 + 12) * U);
  const padTop = Math.round((3 + 3 + 6) * U);
  const padBottom = Math.round((3 + 15) * U);
  const b = layoutRich(font, text, w - 2 * padX);
  const h = padTop + b.h + padBottom;
  return {
    w,
    h,
    draw: (s, x, y) => {
      s.fillRect(rect(x, y, w, h), INK.base);
      s.frame(rect(x, y, w, h), BONE.faint);
      drawRich(s, font, b, rect(x + padX, y + padTop, w - 2 * padX, b.h), { styles: RICH_DEFAULT });
    },
  };
}

/**
 * Where a tooltip of `w × h` goes: right of and below the anchor point (the cursor tip or a card's top-right corner),
 * flipped left / up when it would leave `bounds`, then clamped inside.
 * SPEC-GAP: UI_主界面 positions 悬停提示AB from the cursor in its graph; the flip rule is taken from the captures
 * (map_room_tooltip, loot_tooltip).
 */
export function placeTooltip(w: number, h: number, anchor: { x: number; y: number }, bounds: Rect, flipX = anchor.x): { x: number; y: number } {
  let x = anchor.x;
  let y = anchor.y;
  if (x + w > bounds.x + bounds.w) x = flipX - w;
  if (y + h > bounds.y + bounds.h) y = bounds.y + bounds.h - h;
  x = Math.max(bounds.x, Math.min(x, bounds.x + bounds.w - w));
  y = Math.max(bounds.y, y);
  return { x: Math.round(x), y: Math.round(y) };
}

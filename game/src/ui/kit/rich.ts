import type { Rect, Surface } from '../core/surface';
import type { TextFont } from '../text/font';
import { breakLines, parseRich, type LaidLine } from '../text/layout';
import type { RichStyles } from './style';

export type TextAlign = 'left' | 'center' | 'right';

export interface RichOptions {
  readonly styles: RichStyles;
  readonly align?: TextAlign;
  /** Extra px between lines (default 0: the font's 16-px line box). */
  readonly gap?: number;
  /** 8-neighbour outline colour. */
  readonly outline?: number;
  readonly opacity?: number;
}

/** A laid-out rich text block (RichTextBlock with AutoWrapText): lines and their size in px. */
export interface RichBlock {
  readonly lines: readonly LaidLine[];
  readonly w: number;
  readonly h: number;
}

/** Lays out the Demo's rich markup (`<强调>…</>`, `\r\n` breaks) at `maxWidth` px. */
export function layoutRich(font: TextFont, text: string, maxWidth: number, gap = 0): RichBlock {
  const lines = breakLines(parseRich(text), maxWidth, ch => font.measure(ch));
  const w = lines.reduce((m, l) => Math.max(m, l.width), 0);
  return { lines, w, h: lines.length * font.line + Math.max(0, lines.length - 1) * gap };
}

/** Draws a laid-out block into `r` (lines from the top, aligned per line); returns the height used. */
export function drawRich(s: Surface, font: TextFont, block: RichBlock, r: Rect, opts: RichOptions): number {
  const gap = opts.gap ?? 0;
  const fallback = opts.styles.Default;
  block.lines.forEach((line, i) => {
    const y = r.y + i * (font.line + gap);
    const x0 = opts.align === 'center' ? r.x + Math.floor((r.w - line.width) / 2) : opts.align === 'right' ? r.x + r.w - line.width : r.x;
    for (const run of line.runs) {
      const st = (run.style !== undefined ? opts.styles[run.style] : undefined) ?? fallback;
      font.draw(s, run.text, x0 + run.x, y, { color: st.color, outline: opts.outline, opacity: opts.opacity });
      if (st.underline) s.hline(x0 + run.x, x0 + run.x + run.width - 1, y + font.line - 2, st.color);
    }
  });
  return block.h;
}

/** One-call RichLabel: lays out at the rect's width and draws. */
export function richLabel(s: Surface, font: TextFont, text: string, r: Rect, opts: RichOptions): number {
  return drawRich(s, font, layoutRich(font, text, r.w, opts.gap), r, opts);
}

/** A single plain line aligned in `r` (vertically centred on the 16-px line box). */
export function label(s: Surface, font: TextFont, text: string, r: Rect, color: number, align: TextAlign = 'left', outline?: number): void {
  const w = font.measure(text);
  const x = align === 'center' ? r.x + Math.floor((r.w - w) / 2) : align === 'right' ? r.x + r.w - w : r.x;
  font.draw(s, text, x, r.y + Math.floor((r.h - font.line) / 2), { color, outline });
}

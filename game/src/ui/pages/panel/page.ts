import type { Rgba } from '../../core/color';
import { rect, Surface, type Rect } from '../../core/surface';
import { BONE, INK, SAPPHIRE } from '../../style/palette';
import type { TextFont } from '../../text/font';
import { WIDGETS } from '../../kit/demo';
import type { Page, UiPointer } from '../../kit/page';
import { label } from '../../kit/rich';
import { STR } from '../../kit/strings';
import { TEXT } from '../../kit/style';
import { box, canvasBox, DESIGN_UNITS, toGrid } from '../../kit/umg';
import { Button, inkBox, type ButtonState } from '../../kit/widgets';
import type { CharacterStats, PanelIntent, PanelModel } from './model';

const P = WIDGETS.panel;
const S = WIDGETS.stats;

/** The panel's fade-in (出现: RenderOpacity 0 → 1 in 1.0 s); open the page with `{ dim: false, fade: PANEL_FADE }`. */
export const PANEL_FADE = P.fadeIn;
/**
 * The title's scale over the 12-px font. SPEC-GAP: 标题 (天狼星12px) has no size in the dump; the failure_panel
 * capture shows a cap height of about 17 virtual px, so the title is drawn at 2×.
 */
export const TITLE_SCALE = 2;

/** 大标题提示 inside Overlay_1 (bottom-right): 重新挑战, Spacer 14, 继续, Spacer_49 14, 标题, right-aligned. */
export function panelLayout(font: TextFont, canRetry: boolean): { box: Rect; retry: Rect | null; next: Rect; title: Rect } {
  const ov = canvasBox(P.box, DESIGN_UNITS);
  const right = ov.x + ov.w;
  const titleH = font.line * TITLE_SCALE * 2;
  let y = ov.y + ov.h - titleH;
  const title = toGrid(box(ov.x, y, ov.w, titleH));
  y -= P.spacer + P.button.h;
  const next = toGrid(box(right - P.button.w, y, P.button.w, P.button.h));
  y -= P.spacer + P.button.h;
  const retry = canRetry ? toGrid(box(right - P.button.w, y, P.button.w, P.button.h)) : null;
  return { box: toGrid(ov), retry, next, title };
}

type StatKind = 'charge' | 'damage' | 'heal' | 'armor';

/** One stats row: the guide line, then the chips (SizeBox 120×48 in two 3-unit borders, overlapping by 3). */
export function statChips(st: CharacterStats): { guide: Rect | null; chips: { kind: StatKind; value: number | string; rect: Rect }[] } {
  const k = 0.5;
  const outerW = (S.chip.w + 4 * S.chip.border) * k;
  const outerH = (S.chip.h + 4 * S.chip.border) * k;
  let guide = st.guide ? rect(Math.round(st.at.x), Math.round(st.at.y - 1), Math.round(S.guide.w * k), Math.max(1, Math.round(S.guide.h * k))) : null;
  let x = st.at.x + (st.guide ? S.guide.w * k : 0);
  const chips: { kind: StatKind; value: number | string; rect: Rect }[] = [];
  for (const kind of ['charge', 'damage', 'heal', 'armor'] as const) {
    const v = st[kind];
    if (v === undefined) continue;
    chips.push({ kind, value: v, rect: rect(Math.round(x - S.chip.border * k), Math.round(st.at.y - outerH / 2), Math.round(outerW), Math.round(outerH)) });
    x += outerW - S.chip.border * k;
  }
  if (st.rightGuide) guide = rect(Math.round(x), Math.round(st.at.y - 1), Math.round(S.guide.w * k), Math.max(1, Math.round(S.guide.h * k)));
  return { guide, chips };
}

/**
 * The Victory / Failure panel (UI_战斗结束统计页): the title word, 继续 and (when allowed) 重新挑战 bottom-right (icon-only:
 * the widget's two Buttons have no TextBlock, their glyphs are in the 锻造页 sprites), and the
 * per-character stats rows. Emits `continue` and `retry` (panel.continue / panel.retry).
 */
export class PanelPage implements Page {
  readonly id = 'panel';
  private readonly next: Button;
  private readonly retry: Button;
  private title: Surface | null = null;

  constructor(
    private readonly font: TextFont,
    private model: PanelModel,
    private readonly emit: (i: PanelIntent) => void,
  ) {
    this.next = new Button('continue', rect(0, 0, 0, 0), (s, f, st) => arrowGlyph(s, f, st));
    this.retry = new Button('retry', rect(0, 0, 0, 0), (s, f, st) => resetGlyph(s, f, st));
    this.layout();
  }

  setModel(m: PanelModel): void {
    this.model = m;
    this.layout();
  }

  layout(): void {
    const L = panelLayout(this.font, this.model.canRetry);
    this.next.rect = L.next;
    if (L.retry) this.retry.rect = L.retry;
    const text = this.model.success ? STR.victory : STR.failure;
    const t = new Surface(this.font.measure(text) + 2, this.font.line + 1);
    this.font.draw(t, text, 1, 0, { color: TEXT.title, outline: INK.deep });
    this.title = t;
  }

  hit(x: number, y: number): boolean {
    const r = [this.next.rect, ...(this.model.canRetry ? [this.retry.rect] : [])];
    return r.some(b => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h);
  }

  pointer(e: UiPointer): boolean {
    if (this.next.pointer(e)) this.emit({ kind: 'continue' });
    if (this.model.canRetry && this.retry.pointer(e)) this.emit({ kind: 'retry' });
    return this.hit(e.x, e.y);
  }

  draw(s: Surface): void {
    for (const st of this.model.stats) this.drawStats(s, st);
    const L = panelLayout(this.font, this.model.canRetry);
    if (this.model.canRetry) this.retry.draw(s, this.font);
    this.next.draw(s, this.font);
    if (this.title) {
      // right-aligned on the bone ink (the 1-px dark outline overhangs), so the word's right edge meets the buttons'
      const ink = inkBox(this.title);
      const w = (ink ? ink.x + ink.w - 1 : this.title.w) * TITLE_SCALE;
      s.blitScaled(this.title, L.next.x + L.next.w - w, L.title.y + L.title.h - this.title.h * TITLE_SCALE, TITLE_SCALE, TITLE_SCALE);
    }
  }

  private drawStats(s: Surface, st: CharacterStats): void {
    const { guide, chips } = statChips(st);
    if (guide) s.fillRect(guide, BONE.dim);
    for (const c of chips) {
      s.fillRect(c.rect, INK.base);
      s.frame(c.rect, BONE.dim);
      s.frame(rect(c.rect.x + 1, c.rect.y + 1, c.rect.w - 2, c.rect.h - 2), INK.bevel);
      statIcon(s, c.kind, c.rect.x + 5, c.rect.y + Math.floor(c.rect.h / 2) - 4);
      label(s, this.font, String(c.value), rect(c.rect.x + 16, c.rect.y, c.rect.w - 22, c.rect.h), TEXT.title, 'center');
    }
  }
}

const glyphColor = (st: ButtonState): Rgba => (st === 'disabled' ? BONE.faint : st === 'normal' ? BONE.dim : BONE.base);

/** 继续: a dotted-tail arrow. */
function arrowGlyph(s: Surface, f: Rect, st: ButtonState): void {
  const c = glyphColor(st);
  const cx = f.x + Math.floor(f.w / 2);
  const cy = f.y + Math.floor(f.h / 2);
  for (let i = 0; i < 3; i++) s.fill(cx - 16 + i * 5, cy - 1, 3, 3, c);
  s.fill(cx - 1, cy - 1, 10, 3, c);
  for (let i = 0; i < 6; i++) s.vline(cx + 9 + i, cy - 5 + i, cy + 5 - i, c);
}

/** 重新挑战: two arrows chasing round a circle. */
function resetGlyph(s: Surface, f: Rect, st: ButtonState): void {
  const c = glyphColor(st);
  const cx = f.x + Math.floor(f.w / 2);
  const cy = f.y + Math.floor(f.h / 2);
  for (let a = 0; a < 360; a += 4) {
    if ((a > 60 && a < 100) || (a > 240 && a < 280)) continue;
    const r = (a * Math.PI) / 180;
    s.fill(Math.round(cx + Math.cos(r) * 8), Math.round(cy + Math.sin(r) * 8), 2, 2, c);
  }
  s.fill(cx + 2, cy - 11, 4, 2, c);
  s.fill(cx - 5, cy + 9, 4, 2, c);
}

/** The 15×15-unit stat icons (修炼页_Sprite_35..38): charge, damage, heal, armor. */
function statIcon(s: Surface, kind: StatKind, x: number, y: number): void {
  switch (kind) {
    case 'charge':
      s.fill(x + 3, y, 3, 4, BONE.base);
      s.fill(x + 1, y + 3, 6, 2, BONE.base);
      s.fill(x + 2, y + 5, 3, 4, BONE.base);
      return;
    case 'damage':
      for (let i = 0; i < 8; i++) s.px(x + i, y + 8 - i, BONE.base);
      s.fill(x, y + 6, 3, 3, BONE.dim);
      return;
    case 'heal':
      s.fill(x + 3, y, 3, 9, SAPPHIRE.light);
      s.fill(x, y + 3, 9, 3, SAPPHIRE.light);
      return;
    case 'armor':
      s.frame(rect(x, y, 8, 6), BONE.dim);
      s.fill(x + 1, y + 6, 6, 2, BONE.dim);
      s.fill(x + 3, y + 8, 2, 1, BONE.dim);
  }
}

import { Surface, type Rect } from '../../core/surface';
import { Regions, type Page, type UiPointer } from '../../kit/page';
import { label } from '../../kit/rich';
import { tile } from '../../style/draw';
import { BONE, INK } from '../../style/palette';
import type { TextFont } from '../../text/font';
import { titleLayout, type TitleLayout } from './layout';
import { TITLE_TEXT, titleButtons, titleIntent, type TitleButton, type TitleIntent, type TitleModel } from './model';

/** The game's name, drawn as a placeholder wordmark where the Demo's camp scene shows its logo. */
export const WORDMARK = '棺材板下';

/**
 * The main menu page. The camp scene behind it (logo, well, light) belongs to the game shell; with `wordmark` the page
 * draws the game's name as a placeholder logo (SPEC-GAP: the Demo's logo is part of the 3D camp scene, not the widget).
 */
export class TitlePage implements Page {
  readonly id = 'title';
  private model: TitleModel;
  private lay: TitleLayout;
  private readonly regions = new Regions<TitleButton>();
  private mark: Surface | null = null;

  constructor(
    private readonly font: TextFont,
    model: TitleModel,
    private readonly emit: (i: TitleIntent) => void,
    private readonly opts: { wordmark?: boolean } = {},
  ) {
    this.model = model;
    this.lay = titleLayout(model.prologueDone);
    this.layout();
  }

  setModel(model: TitleModel): void {
    this.model = model;
    this.lay = titleLayout(model.prologueDone);
    this.layout();
  }

  /** The buttons on screen (for tests and the bot's screen hooks). */
  get visible(): TitleButton[] {
    return titleButtons(this.model);
  }

  layout(): void {
    this.regions.set(this.visible.map(b => ({ rect: this.lay.buttons[b]!, target: b })));
  }

  rectOf(b: TitleButton): Rect | null {
    return this.regions.rectOf(b);
  }

  draw(s: Surface): void {
    if (this.opts.wordmark) this.drawWordmark(s);
    const hovered = this.regions.hovered;
    for (const b of ['prologue', 'newRun', 'quit'] as const) {
      const r = this.lay.buttons[b];
      if (!r) continue;
      band(s, r, hovered === b);
      // Hover (L530): the label brightens and grows 24 → 27; here it brightens (one pixel font size).
      label(s, this.font, TITLE_TEXT[b], this.lay.labels[b]!, hovered === b ? BONE.base : BONE.dim, 'center');
    }
    // 联系我们 on the buttons' left edge (the Demo centres it over the pair; aligned here so the block reads as one).
    label(s, this.font, TITLE_TEXT.contact, this.lay.contact, BONE.dim, 'left');
    linkTile(s, this.lay.buttons.discord!, 'D', hovered === 'discord');
    linkTile(s, this.lay.buttons.kook!, 'K', hovered === 'kook');
    gear(s, this.lay.buttons.settings!, hovered === 'settings' ? BONE.base : BONE.dim);
  }

  hit(x: number, y: number): boolean {
    return this.regions.at(x, y) !== null;
  }

  pointer(e: UiPointer): boolean {
    const clicked = this.regions.route(e);
    if (clicked) this.emit(titleIntent(clicked));
    return this.hit(e.x, e.y);
  }

  private drawWordmark(s: Surface): void {
    const k = 4;
    if (!this.mark) {
      const w = this.font.measure(WORDMARK);
      this.mark = new Surface(w + 2, this.font.line + 2);
      this.font.draw(this.mark, WORDMARK, 1, 1, { color: BONE.base, outline: INK.deep });
    }
    s.blitScaled(this.mark, Math.round((960 - this.mark.w * k) / 2), 52, k, k);
  }
}

/**
 * 按钮 face: the Demo's material band (tint 1C201F) fading in from the left over a darker strip, with the bevel line
 * across its top; hovered, it lightens one ink step and the top line turns bone. The fade is whole-pixel columns.
 */
function band(s: Surface, r: Rect, lit: boolean): void {
  const c = lit ? INK.bevel : INK.deep;
  const fade = Math.round(r.w * 0.4);
  for (let x = 0; x < r.w; x++) s.fill(r.x + x, r.y, 1, r.h, c, x < fade ? (x + 1) / fade : 1);
  s.hline(r.x, r.x + r.w - 1, r.y, lit ? BONE.faint : INK.bevel);
}

/** Discord / KOOK: a raised ink tile with a faint frame and a 2-px letter that lights on hover (like the gear). */
function linkTile(s: Surface, r: Rect, letter: 'D' | 'K', lit: boolean): void {
  tile(s, r, BONE.faint, INK.raised);
  const c = lit ? BONE.base : BONE.dim;
  const w = 14;
  const h = 20;
  const x0 = r.x + Math.floor((r.w - w) / 2);
  const y0 = r.y + Math.floor((r.h - h) / 2);
  s.fill(x0, y0, 2, h, c);
  if (letter === 'D') {
    s.fill(x0, y0, 10, 2, c);
    s.fill(x0, y0 + h - 2, 10, 2, c);
    s.fill(x0 + 10, y0 + 2, 2, 2, c);
    s.fill(x0 + 10, y0 + h - 4, 2, 2, c);
    s.fill(x0 + 12, y0 + 4, 2, h - 8, c);
    return;
  }
  // K: two 2-px arms from the stem's middle to the top and bottom right corners.
  const ym = y0 + h / 2 - 1;
  stroke2(s, x0 + 2, ym, x0 + w - 2, y0, c);
  stroke2(s, x0 + 2, ym, x0 + w - 2, y0 + h - 2, c);
}

/** A 2-px stroke: 2×2 blocks stepped along the line, every block on whole pixels. */
function stroke2(s: Surface, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) s.fill(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 2, 2, c);
}

/** 设置按钮: a small gear (ring and eight teeth). */
function gear(s: Surface, r: Rect, c: number): void {
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  const ro = Math.floor(Math.min(r.w, r.h) / 2) - 3;
  const ri = Math.max(2, ro - 4);
  for (let y = -ro - 2; y <= ro + 2; y++) {
    for (let x = -ro - 2; x <= ro + 2; x++) {
      const d = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      const tooth = Math.cos(a * 8) > 0.5 && d <= ro + 2;
      if ((d <= ro && d > ri - 1) || (tooth && d > ro - 1)) s.px(cx + x, cy + y, c);
    }
  }
}

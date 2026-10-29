import { rect, type Rect, type Surface } from '../../core/surface';
import type { TextFont } from '../../text/font';
import { label } from '../../kit/rich';
import { TEXT } from '../../kit/style';
import { layoutKeyword, layoutTooltip, placeTooltip, TIP } from '../../kit/tooltip';
import type { Page } from '../../kit/page';
import { BONE, INK } from '../../style/palette';
import type { TooltipPageModel } from './model';

/** Spacer_74 between A and B: padding 3 + 3 units. */
const AB_GAP = 3;
/** 额外信息文本 on B: the widget's own text (同类型物品; not a loc string). */
const SAME_TYPE = '同类型物品';
/** The 同类型物品 plate: 2 px of top padding, the text line, and a bottom line shared with B's top border. */
const HEAD_PAD = 2;

/**
 * The tooltip overlay: A (and B), then the keyword boxes stacked beside them, placed right of the anchor and flipped
 * or clamped inside the frame. HitTestInvisible like the widget: it never takes input. Open it on the stack with
 * `{ dim: false, fade: 0 }`.
 */
export class TooltipPage implements Page {
  readonly id = 'tooltip';
  private frame: Rect = rect(0, 0, 960, 540);

  constructor(
    private readonly font: TextFont,
    private model: TooltipPageModel | null,
  ) {}

  setModel(m: TooltipPageModel | null): void {
    this.model = m;
  }

  layout(frame: Rect): void {
    this.frame = frame;
  }

  hit(): boolean {
    return false;
  }

  pointer(): boolean {
    return false;
  }

  /** The boxes as placed: [A, B?, keyword…] with their rects (for tests and the shell's hit-test-free overlays). */
  arrange(): { x: number; y: number; w: number; h: number; draw: (s: Surface, x: number, y: number) => void }[] {
    const m = this.model;
    if (!m) return [];
    const a = layoutTooltip(this.font, m.tip);
    const b = m.compare ? layoutTooltip(this.font, m.compare) : null;
    const kws = (m.tip.keywords ?? []).map(k => layoutKeyword(this.font, k));
    const kwH = kws.reduce((h, k) => h + k.h + TIP.keywordGap, 0);
    const kwW = kws.length ? TIP.keywordWidth + AB_GAP : 0;
    const head = b ? this.font.line + HEAD_PAD : 0;
    const w = a.w + (b ? AB_GAP + b.w : 0) + kwW;
    const h = Math.max(a.h, b ? b.h + head : 0, kwH);
    const p = placeTooltip(w, h, m.anchor, this.frame, m.flipX ?? m.anchor.x);
    const out = [{ x: p.x, y: p.y, w: a.w, h: a.h, draw: a.draw }];
    let x = p.x + a.w;
    if (b) {
      const bx = x + AB_GAP;
      out.push({
        x: bx,
        y: p.y,
        w: b.w,
        h: b.h + head,
        draw: (s, xx, yy) => {
          // the plate's bottom line is B's top border (drawn over it by B), so the two never double up
          const plate = rect(xx, yy, b.w, head + 1);
          s.fillRect(plate, INK.raised);
          s.frame(plate, BONE.faint);
          label(s, this.font, SAME_TYPE, rect(xx, yy + HEAD_PAD, b.w, this.font.line), TEXT.body, 'center');
          b.draw(s, xx, yy + head);
        },
      });
      x = bx + b.w;
    }
    let ky = p.y;
    for (const k of kws) {
      out.push({ x: x + AB_GAP, y: ky, w: k.w, h: k.h, draw: k.draw });
      ky += k.h + TIP.keywordGap;
    }
    return out;
  }

  draw(s: Surface): void {
    for (const b of this.arrange()) b.draw(s, b.x, b.y);
  }
}

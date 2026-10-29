import type { Rect, Surface } from '../../core/surface';
import { inside, rect } from '../../core/surface';
import { Button, panel } from '../../kit/widgets';
import type { Page, UiPointer } from '../../kit/page';
import { richLabel } from '../../kit/rich';
import { RICH_DEFAULT } from '../../kit/style';
import type { TextFont } from '../../text/font';
import { BONE } from '../../style/palette';
import { WARNING_LAYOUT as L } from './layout';
import { warningText, type WarningIntent, type WarningModel } from './model';

/**
 * UI_警告提示 as a modal page: the panel (锻造页_Sprite7 → an Ink & Bone window), the centred question, the two stacked
 * buttons and the close cross. Clicking a button or the cross emits an intent; the binder sends the command.
 */
export class WarningPage implements Page {
  readonly id = 'warning';
  private model: WarningModel;
  private readonly buttons: [Button, Button];
  private readonly closeButton: Button;

  constructor(
    private readonly font: TextFont,
    model: WarningModel,
    private readonly emit: (i: WarningIntent) => void,
  ) {
    this.model = model;
    const t = warningText(model);
    this.buttons = [new Button('answer-0', L.buttons[0], t.buttons[0]), new Button('answer-1', L.buttons[1], t.buttons[1])];
    this.closeButton = new Button('close', L.close, '');
  }

  setModel(model: WarningModel): void {
    this.model = model;
    const t = warningText(model);
    this.buttons[0].face = t.buttons[0];
    this.buttons[1].face = t.buttons[1];
  }

  layout(): void {}

  draw(s: Surface): void {
    panel(s, L.panel, 'window');
    const { text } = warningText(this.model);
    const lines = text.split('\n').length;
    const h = lines * this.font.line;
    richLabel(s, this.font, text, rect(L.text.x, L.text.y + Math.floor((L.text.h - h) / 2), L.text.w, h), { styles: RICH_DEFAULT, align: 'center' });
    for (const b of this.buttons) b.draw(s, this.font);
    // 关闭按钮 draws no plate (DrawAs NoDrawType on a sprite): only the glyph, lit on hover.
    cross(s, L.close, this.closeButton.state === 'normal' ? BONE.dim : BONE.base);
  }

  hit(x: number, y: number): boolean {
    return inside(L.panel, x, y);
  }

  pointer(e: UiPointer): boolean {
    // Every button sees every event (hover and press tracking); at most one can report a click.
    const clicked = [this.buttons[0].pointer(e), this.buttons[1].pointer(e), this.closeButton.pointer(e)];
    if (clicked[0]) this.emit({ kind: 'answer', button: 0 });
    if (clicked[1]) this.emit({ kind: 'answer', button: 1 });
    if (clicked[2]) this.emit({ kind: 'close' });
    return this.hit(e.x, e.y);
  }
}

/** The close glyph: a 1-px X inset in the button (the Demo's 39-unit 关闭 sprite). */
function cross(s: Surface, f: Rect, c: number): void {
  const n = Math.min(f.w, f.h) - 8;
  const x0 = f.x + Math.floor((f.w - n) / 2);
  const y0 = f.y + Math.floor((f.h - n) / 2);
  s.line(x0, y0, x0 + n - 1, y0 + n - 1, c);
  s.line(x0 + n - 1, y0, x0, y0 + n - 1, c);
}

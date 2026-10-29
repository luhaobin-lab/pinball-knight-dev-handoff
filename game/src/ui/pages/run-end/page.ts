import { rect, type Rect, type Surface } from '../../core/surface';
import type { Page, UiPointer } from '../../kit/page';
import { label, richLabel } from '../../kit/rich';
import { RICH_DEFAULT, TEXT } from '../../kit/style';
import { Button } from '../../kit/widgets';
import { fillWidth } from '../../style/draw';
import { BONE, DANGER, INK } from '../../style/palette';
import type { TextFont } from '../../text/font';
import { RUN_END_LAYOUT as L } from './layout';
import { DEMO_COMPLETE_TEXT, LINE_DELAY, RunEndState, runEndTitle, type RunEndIntent, type RunEndModel } from './model';

/** 更新闪烁 of a new line: its backing lights and fades over this many seconds (SPEC-GAP: one fade, not the keys). */
const LINE_FLASH = 1;

/**
 * The run-end page (full screen, phase 13): 标题, the exploration bar with the level digit and "{0}/{1}", the rule, the
 * score lines appearing one every 0.5 s, and 返回营地 (answers once the bar has started, 更新完毕？). With `demoComplete`
 * the click opens the loading page with the Demo-complete text (加载页可返回？), and a second click continues. A replayed
 * prologue shows no score and continues by itself after 1 s.
 */
export class RunEndPage implements Page {
  readonly id = 'run-end';
  readonly state: RunEndState;
  private readonly button: Button;
  private demoText = false;
  private sent = false;

  constructor(
    private readonly font: TextFont,
    model: RunEndModel,
    private readonly emit: (i: RunEndIntent) => void,
  ) {
    this.state = new RunEndState(model);
    this.button = new Button('continue', L.continue, (s, f, st) => arrow(s, f, st === 'disabled' ? BONE.faint : st === 'normal' ? BONE.dim : BONE.base));
    this.button.enabled = false;
  }

  /** Whether the Demo-complete loading text is showing. */
  get showingDemoText(): boolean {
    return this.demoText;
  }

  get continueRect(): Rect {
    return L.continue;
  }

  layout(): void {}

  update(dt: number): void {
    this.state.update(dt);
    this.button.enabled = this.state.ready;
    if (this.state.model.replayedPrologue && this.state.time >= 1) this.finish();
  }

  draw(s: Surface): void {
    s.fill(0, 0, 960, 540, INK.deep);
    if (this.demoText) {
      richLabel(s, this.font, DEMO_COMPLETE_TEXT, L.loadingText, { styles: RICH_DEFAULT, align: 'center', gap: 4 });
      return;
    }
    if (this.state.model.replayedPrologue) return;
    label(s, this.font, runEndTitle(this.state.model.completed), L.title, TEXT.title, 'center', INK.deep);
    this.drawBar(s);
    const now = this.state.time;
    this.state.lines.slice(0, this.state.visibleLines).forEach((line, i) => {
      const r = L.line(i);
      const age = now - i * LINE_DELAY;
      if (age < LINE_FLASH) s.fillRect(r.flash, BONE.faint, 1 - age / LINE_FLASH);
      const c = line.negative ? DANGER.base : TEXT.title;
      label(s, this.font, line.label, r.label, c, 'left');
      label(s, this.font, '×', r.times, c, 'right');
      label(s, this.font, String(line.count), r.count, c, 'left');
      label(s, this.font, line.score, r.score, c, 'right');
    });
    this.button.draw(s, this.font);
  }

  hit(): boolean {
    return true;
  }

  pointer(e: UiPointer): boolean {
    if (this.demoText) {
      if (e.kind === 'up') this.finish();
      return true;
    }
    if (this.button.pointer(e) && this.state.ready) {
      if (this.state.model.demoComplete) this.demoText = true;
      else this.finish();
    }
    return true;
  }

  private finish(): void {
    if (this.sent) return;
    this.sent = true;
    this.emit({ kind: 'continue' });
  }

  /**
   * The exploration bar: the bone frame (Image_45 / _1 / _2 / _3), a recessed track one ink step up from the page so the
   * gap inside the frame shows on all four sides, the bone fill (exploration points are not a hero resource), the level
   * and "{0}/{1}". The level sits on the Demo's x (等级 centred right of 330) but above the frame, clear of its line
   * (the Demo's −14 overlaps the frame; with 1-px lines that reads as a collision).
   */
  private drawBar(s: Surface): void {
    const f = L.barFrame;
    s.frame(f, BONE.dim);
    const fill = L.barFill;
    s.fillRect(fill, INK.bevel);
    s.fill(fill.x, fill.y, fillWidth(fill.w, this.state.score / Math.max(1, this.state.need)), fill.h, BONE.base);
    label(s, this.font, String(this.state.level), rect(L.level.x, f.y - this.font.line - 1, L.level.w, this.font.line), TEXT.title, 'center');
    label(s, this.font, `${this.state.score}/${this.state.need}`, rect(L.progress.x, L.progress.y, L.progress.w, this.font.line), TEXT.title, 'center');
    s.fillRect(L.shadow, INK.base);
    s.fillRect(L.rule, BONE.dim);
  }
}

/** 返回营地 (锻造页_Sprite12): a forward chevron on the button plate. */
function arrow(s: Surface, f: Rect, c: number): void {
  const cx = f.x + Math.floor(f.w / 2);
  const cy = f.y + Math.floor(f.h / 2);
  for (let k = 0; k < 2; k++) {
    s.line(cx - 6 + k * 6, cy - 5, cx - 1 + k * 6, cy, c);
    s.line(cx - 1 + k * 6, cy, cx - 6 + k * 6, cy + 5, c);
  }
}

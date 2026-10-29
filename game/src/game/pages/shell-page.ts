import { rect, type Rect, type Surface } from '../../ui/core/surface';
import type { TextFont } from '../../ui/text/font';
import { INK } from '../../ui/style/palette';
import { drawButton, label, panel, Regions, TEXT, type Page, type UiPointer } from '../../ui/kit';
import type { Command } from '../api';
import type { PageModel } from '../bind/page-model';
import { PLAY_CX } from '../play-area';

/**
 * A `PageModel` as a page of the ui-kit (`Page` in the kit's `PageStack`): menus centred, the map's tiles in a grid
 * over the play area, dialogs in a window panel. Functional pages until the ui-kit / ui-pages pages replace them
 * (SPEC-GAP in `bind/page-model.ts`). A click on a live button emits its Command.
 */
const BUTTON = { w: 168, h: 22, gap: 6 } as const;
const CELL = { w: 132, h: 40, gap: 12 } as const;
/** The play area right of the HUD column (UI_主界面 区域判断 starts at 178.5 px). */
const PLAY_X = 179;

export interface PlacedButton {
  readonly index: number;
  readonly rect: Rect;
}

/** Where each button of the model goes in the 960 × 540 design frame, and the window of a dialog. */
export function layoutPage(page: PageModel, line: number): { buttons: PlacedButton[]; window: Rect | null; title: Rect; lines: Rect[] } {
  const playCx = Math.round(PLAY_CX);
  const stack = (cx: number, y0: number, idx: readonly number[]): PlacedButton[] =>
    idx.map((index, k) => ({ index, rect: rect(cx - BUTTON.w / 2, y0 + k * (BUTTON.h + BUTTON.gap), BUTTON.w, BUTTON.h) }));
  const all = page.buttons.map((_, i) => i);
  if (page.layout === 'modal' || page.layout === 'screen') {
    // a dialog sits over the play area; a full-screen page (no HUD column) is centred on the screen
    const cx = page.layout === 'screen' ? 480 : playCx;
    const h = 44 + page.lines.length * line + page.buttons.length * (BUTTON.h + BUTTON.gap) + 12;
    const window = rect(cx - 150, Math.round((540 - h) / 2), 300, h);
    const lines = page.lines.map((_, i) => rect(window.x + 8, window.y + 30 + i * line, window.w - 16, line));
    return { window, title: rect(window.x + 8, window.y + 8, window.w - 16, line), lines, buttons: stack(cx, window.y + 36 + page.lines.length * line, all) };
  }
  if (page.layout === 'grid') {
    const cells = all.filter(i => page.buttons[i].cell);
    const cols = Math.max(1, ...cells.map(i => page.buttons[i].cell!.col + 1));
    const floors = [...new Set(cells.map(i => page.buttons[i].cell!.row))].sort((a, b) => b - a);
    const gx = playCx - (cols * CELL.w + (cols - 1) * CELL.gap) / 2;
    const placed = cells.map(i => {
      const c = page.buttons[i].cell!;
      return { index: i, rect: rect(Math.round(gx + c.col * (CELL.w + CELL.gap)), 200 + floors.indexOf(c.row) * (CELL.h + CELL.gap), CELL.w, CELL.h) };
    });
    const rest = stack(playCx, 320, all.filter(i => !page.buttons[i].cell));
    return { window: null, title: rect(PLAY_X, 40, 960 - PLAY_X, line), lines: [], buttons: [...placed, ...rest] };
  }
  const lines = page.lines.map((_, i) => rect(0, 150 + i * line, 960, line));
  return { window: null, title: rect(0, 120, 960, line), lines, buttons: stack(480, 200 + page.lines.length * line, all) };
}

export class ShellPage implements Page {
  private readonly regions = new Regions<number>();
  private placed: PlacedButton[] = [];
  private window: Rect | null = null;
  private titleRect: Rect = rect(0, 0, 0, 0);
  private lineRects: Rect[] = [];

  constructor(
    private readonly font: TextFont,
    private model: PageModel,
    private readonly emit: (cmd: Command) => void,
  ) {
    this.layout();
  }

  get id(): string {
    return this.model.id;
  }

  setModel(model: PageModel): void {
    this.model = model;
    this.layout();
  }

  layout(): void {
    const l = layoutPage(this.model, this.font.line);
    this.placed = l.buttons;
    this.window = l.window;
    this.titleRect = l.title;
    this.lineRects = l.lines;
    this.regions.set(this.placed.filter(p => this.model.buttons[p.index].cmd !== null).map(p => ({ rect: p.rect, target: p.index })));
  }

  draw(s: Surface): void {
    // a full-screen page covers whatever the 3D canvas still shows
    if (this.model.layout === 'screen') s.fill(0, 0, 960, 540, INK.deep);
    if (this.window) panel(s, this.window, 'window');
    label(s, this.font, this.model.title, this.titleRect, TEXT.title, 'center');
    this.model.lines.forEach((t, i) => label(s, this.font, t, this.lineRects[i], TEXT.body, 'center'));
    for (const p of this.placed) {
      const b = this.model.buttons[p.index];
      const state = b.cmd === null ? 'disabled' : this.regions.pressed === p.index ? 'pressed' : this.regions.hovered === p.index ? 'hover' : 'normal';
      const tall = p.rect.h > 30 && b.note;
      drawButton(s, this.font, tall ? rect(p.rect.x, p.rect.y, p.rect.w, p.rect.h - 12) : p.rect, b.label, state);
      if (b.note) {
        const r = tall ? rect(p.rect.x, p.rect.y + p.rect.h - 16, p.rect.w, 14) : rect(p.rect.x + p.rect.w + 8, p.rect.y, 300, p.rect.h);
        label(s, this.font, b.note, r, TEXT.disabled, tall ? 'center' : 'left');
      }
    }
  }

  hit(x: number, y: number): boolean {
    return this.regions.at(x, y) !== null || (this.window !== null && x >= this.window.x && y >= this.window.y && x < this.window.x + this.window.w && y < this.window.y + this.window.h);
  }

  pointer(e: UiPointer): boolean {
    const clicked = this.regions.route(e);
    const cmd = clicked !== null ? this.model.buttons[clicked].cmd : null;
    if (cmd) this.emit(cmd);
    return this.hit(e.x, e.y);
  }

  /** The command a click at (x, y) would send (tests and the bot overlay). */
  commandAt(x: number, y: number): Command | null {
    const i = this.regions.at(x, y);
    return i === null ? null : this.model.buttons[i].cmd;
  }
}

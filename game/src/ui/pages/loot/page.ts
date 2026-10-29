import { inside, rect, type Rect, type Surface } from '../../core/surface';
import { BONE, INK } from '../../style/palette';
import type { TextFont } from '../../text/font';
import { currencyChip, drawCard } from '../../kit/card';
import { WIDGETS } from '../../kit/demo';
import { Regions, type Page, type UiPointer } from '../../kit/page';
import { drawRich, label, layoutRich } from '../../kit/rich';
import { STR } from '../../kit/strings';
import { RICH_DEFAULT, TEXT } from '../../kit/style';
import { layoutTooltip, placeTooltip } from '../../kit/tooltip';
import { box, canvasBox, DESIGN_UNITS, toGrid, type Space } from '../../kit/umg';
import { Button, Grid, icon, panel } from '../../kit/widgets';
import type { LootIntent, LootItem, LootModel } from './model';

const L = WIDGETS.loot;
const R = WIDGETS.reward;

/** The loot window's widget space: 0.375 px per unit from its MEASURED top-left. */
export const LOOT_SPACE: Space = { scale: L.scale, x: L.at.x / L.scale, y: L.at.y / L.scale };

const ROOT = box(0, 0, L.box.w, L.box.h);
const inBox = (b: ReturnType<typeof canvasBox>): Rect => toGrid(b, LOOT_SPACE);

/** Window parts in grid px. */
export const LOOT = {
  window: inBox(ROOT),
  close: inBox(canvasBox(L.close, ROOT)),
  buttons: inBox(canvasBox(L.buttons, ROOT)),
  title: inBox(canvasBox(L.title, ROOT)),
  /** The 7 × 5 grid; cells are 104 units (39 px). */
  grid: new Grid(Math.round((L.grid.x + LOOT_SPACE.x) * L.scale), Math.round((L.grid.y + LOOT_SPACE.y) * L.scale), L.grid.cols, L.grid.rows, Math.round(L.grid.cell * L.scale)),
} as const;

/** A card's face inside its cells (the 3D card sits 4 screen px inside the cell lines: 2 px here). */
export function cardRect(it: Pick<LootItem, 'col' | 'row' | 'size' | 'sourcePosition'>): Rect {
  if (it.sourcePosition) {
    // SCS 物品盒子 centre=(X32,Y400), 盒子UI local=(X−1,Y1), 948×744; cards at
    // X298−128(row+size/2), Y166+232col. The card widget is 220×(108+104(size−1)).
    const { col, row } = it.sourcePosition;
    const centreX = LOOT.window.x + (474 + (166 + 232 * col) - 401) * L.scale;
    const centreY = LOOT.window.y + (372 - ((298 - 128 * (row + it.size / 2)) - 31)) * L.scale;
    const w = 220 * L.scale, h = (108 + 104 * (it.size - 1)) * L.scale;
    return rect(Math.round(centreX - w / 2) + 2, Math.round(centreY - h / 2) + 2, Math.round(w) - 4, Math.round(h) - 4);
  }
  const c = LOOT.grid.cell(it.col, it.row, 2, it.size);
  return rect(c.x + 2, c.y + 2, c.w - 3, c.h - 3);
}

/** UI_奖励提示 cards stacked upward from 奖励提示框 (bottom centre of the play area). */
export function rewardRects(n: number): Rect[] {
  const anchor = canvasBox(R.stack, DESIGN_UNITS);
  const cx = anchor.x + anchor.w / 2;
  const bottom = anchor.y + anchor.h;
  return Array.from({ length: n }, (_, i) => toGrid(box(cx - R.w / 2, bottom - (n - i) * R.h, R.w, R.h)));
}

type Target = { kind: 'item'; item: LootItem } | { kind: 'close' };

/**
 * The loot window (UI_物品盒子): title plate, close button, the 7 × 5 grid of item cards with the hovered card's
 * tooltip, and 刷新 / 分解 at the bottom; the reward hints (UI_奖励提示) stack at the bottom of the play area.
 * Clicking a card emits `take`, the close button `close`.
 */
export class LootPage implements Page {
  readonly id = 'loot';
  private readonly regions = new Regions<Target>();
  private readonly action: Button;

  constructor(
    private readonly font: TextFont,
    private model: LootModel,
    private readonly emit: (i: LootIntent) => void,
  ) {
    this.action = new Button('action', LOOT.buttons, '');
    this.layout();
  }

  setModel(m: LootModel): void {
    this.model = m;
    this.layout();
  }

  layout(): void {
    const b = this.model.button;
    this.action.enabled = b?.enabled ?? false;
    this.action.face = b?.kind === 'reroll' ? this.rerollFace(b.cost) : STR.dismantle;
    this.regions.set(this.model.open ? [...this.model.items.map(it => ({ rect: cardRect(it), target: { kind: 'item', item: it } as Target })), { rect: LOOT.close, target: { kind: 'close' } }] : []);
  }

  hit(x: number, y: number): boolean {
    return this.model.open && inside(LOOT.window, x, y);
  }

  pointer(e: UiPointer): boolean {
    if (!this.model.open) return false;
    if (this.model.button && this.action.pointer(e)) {
      this.emit({ kind: this.model.button.kind });
      return true;
    }
    const t = this.regions.route(e);
    if (t?.kind === 'item' && t.item.enabled !== false) this.emit({ kind: 'take', id: t.item.id });
    if (t?.kind === 'close') this.emit({ kind: 'close' });
    return this.hit(e.x, e.y);
  }

  draw(s: Surface): void {
    this.drawRewards(s);
    if (!this.model.open) return;
    const w = LOOT.window;
    panel(s, w, 'window');
    // title plate with pointed end caps
    const t = LOOT.title;
    const plate = rect(t.x, t.y + 1, t.w, t.h - 2);
    s.fillRect(plate, INK.raised);
    s.hline(plate.x, plate.x + plate.w - 1, plate.y + plate.h - 1, BONE.faint);
    for (let i = 0; i < 4; i++) {
      s.px(plate.x - 1 - i, plate.y + Math.floor(plate.h / 2) - i, BONE.faint);
      s.px(plate.x + plate.w + i, plate.y + Math.floor(plate.h / 2) - i, BONE.faint);
    }
    label(s, this.font, this.model.title ?? STR.loot, plate, TEXT.title, 'center');
    this.drawClose(s);
    LOOT.grid.draw(s, BONE.faint);
    const hovered = this.regions.hovered?.kind === 'item' ? this.regions.hovered.item : null;
    for (const it of this.model.items) {
      const r = cardRect(it);
      drawCard(s, this.font, r, it.face, it === hovered);
      // UI_修炼牌.价格牌 is bottom-left; 更新卡面信息 L3686 hides it when price <=0.
      if (it.price !== undefined && it.price > 0) currencyChip(s, this.font, r.x, r.y + r.h - this.font.line, it.price);
    }
    if (this.model.button) this.action.draw(s, this.font);
    if (hovered?.tip) {
      const r = cardRect(hovered);
      const tip = layoutTooltip(this.font, hovered.tip);
      const p = placeTooltip(tip.w, tip.h, { x: r.x + r.w, y: r.y }, rect(0, 0, 960, 540), r.x);
      tip.draw(s, p.x, p.y);
    }
  }

  private drawClose(s: Surface): void {
    const c = LOOT.close;
    const lit = this.regions.hovered?.kind === 'close';
    s.fillRect(c, INK.deep);
    s.frame(c, lit ? BONE.base : BONE.dim);
    const k = Math.min(c.w, c.h) - 8;
    for (let i = 0; i < k; i++) {
      s.px(c.x + 4 + i, c.y + 4 + i, lit ? BONE.base : BONE.dim);
      s.px(c.x + 4 + k - 1 - i, c.y + 4 + i, lit ? BONE.base : BONE.dim);
    }
  }

  private rerollFace(cost: number) {
    return (s: Surface, f: Rect): void => {
      const tw = this.font.measure(STR.reroll);
      const x = f.x + Math.floor((f.w - tw - 30) / 2);
      label(s, this.font, STR.reroll, rect(x, f.y, tw, f.h), this.action.enabled ? TEXT.title : TEXT.disabled);
      // UI_物品盒子 L1867: 货币数 is Hidden while 可刷新 is false; the disabled button remains visible.
      if (this.action.enabled) currencyChip(s, this.font, x + tw + 4, f.y + Math.floor((f.h - this.font.line) / 2), cost);
    };
  }

  private drawRewards(s: Surface): void {
    const rs = this.model.rewards ?? [];
    rewardRects(rs.length).forEach((r, i) => {
      const hint = rs[i];
      panel(s, r, 'window');
      const ib = rect(r.x + Math.round(R.iconAt.x / 2), r.y + Math.round(R.iconAt.y / 2), 50, 54);
      panel(s, ib, 'well');
      if (hint.icon) icon(s, hint.icon, ib);
      const d = toGrid(canvasBox(R.desc, box(0, 0, R.w, R.h)));
      const b = layoutRich(this.font, hint.text, d.w);
      drawRich(s, this.font, b, rect(r.x + d.x, r.y + Math.floor((r.h - b.h) / 2), d.w, b.h), { styles: RICH_DEFAULT, align: 'center' });
    });
  }
}

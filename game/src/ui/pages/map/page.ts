import type { Rgba } from '../../core/color';
import { rect, type Rect, type Surface } from '../../core/surface';
import { checker, tile } from '../../style/draw';
import { BONE, DANGER, INK } from '../../style/palette';
import type { TextFont } from '../../text/font';
import type { Page, UiPointer } from '../../kit/page';
import { Regions } from '../../kit/page';
import { drawRich, label, layoutRich } from '../../kit/rich';
import { STR } from '../../kit/strings';
import { RICH_DEFAULT, TEXT } from '../../kit/style';
import { layoutTooltip, placeTooltip } from '../../kit/tooltip';
import { Button, diamondBadge, icon, panel } from '../../kit/widgets';
import { busY, iconBoxRect, optionRects, QUEST_AT, retreatRect, starsRect, tileRect, warnRect } from './layout';
import type { MapIntent, MapModel, MapTile } from './model';

/** Hover time before a tile's tooltip shows. MEASURED: map_room_tooltip (f013 → f020, about 0.23 s). */
export const TIP_DELAY = 0.23;
/** How long 无法抵达 stays up after a click on a closed tile. SPEC-GAP: UI_地图格 提醒 keys not decoded; 1 s. */
export const WARN_TIME = 1;

type Target = { kind: 'tile'; tile: MapTile } | { kind: 'option'; id: string };

/**
 * The map page (UI_关卡地图页面): the 3 × N tile window with its connectors, difficulty markers and tooltips, or the
 * chapter options with 撤退. Emits `enter` for an open tile, `option`, `retreat`.
 */
export class MapPage implements Page {
  readonly id = 'map';
  private readonly regions = new Regions<Target>();
  private readonly retreat: Button;
  private cursor = { x: 0, y: 0 };
  private hoverTime = 0;
  private warn = new Map<MapTile, number>();

  constructor(
    private readonly font: TextFont,
    private model: MapModel,
    private readonly emit: (i: MapIntent) => void,
  ) {
    this.retreat = new Button('retreat', retreatRect(), STR.retreat);
    this.layout();
  }

  setModel(m: MapModel): void {
    this.model = m;
    this.warn.clear();
    this.layout();
  }

  layout(): void {
    if (this.model.mode === 'tiles') this.regions.set(this.model.tiles.map(t => ({ rect: tileRect(t.col, t.row), target: { kind: 'tile', tile: t } as Target })));
    else {
      const opts = this.model.options ?? [];
      const rs = optionRects(opts.length);
      this.regions.set(opts.filter(o => !o.locked).map(o => ({ rect: rs[opts.indexOf(o)], target: { kind: 'option', id: o.id } as Target })));
    }
  }

  update(dt: number): void {
    this.hoverTime += dt;
    for (const [t, left] of this.warn) {
      if (left - dt <= 0) this.warn.delete(t);
      else this.warn.set(t, left - dt);
    }
  }

  hit(x: number, y: number): boolean {
    return this.regions.at(x, y) !== null || (this.model.mode === 'options' && inRect(this.retreat.rect, x, y));
  }

  pointer(e: UiPointer): boolean {
    const before = this.regions.hovered;
    this.cursor = { x: e.x, y: e.y };
    if (this.model.mode === 'options' && this.retreat.pointer(e)) {
      this.emit({ kind: 'retreat' });
      return true;
    }
    const clicked = this.regions.route(e);
    if (this.regions.hovered !== before) this.hoverTime = 0;
    if (clicked?.kind === 'tile') {
      if (clicked.tile.state === 'open') this.emit({ kind: 'enter', col: clicked.tile.col, row: clicked.tile.row });
      else if (clicked.tile.state === 'closed') this.warn.set(clicked.tile, WARN_TIME);
    } else if (clicked?.kind === 'option') this.emit({ kind: 'option', option: clicked.id });
    return this.hit(e.x, e.y);
  }

  draw(s: Surface): void {
    if (this.model.mode === 'options') this.drawOptions(s);
    else this.drawTiles(s);
    if (this.model.quest) this.drawQuest(s);
  }

  private drawTiles(s: Surface): void {
    const tiles = this.model.tiles;
    const at = (col: number, row: number): MapTile | undefined => tiles.find(t => t.col === col && t.row === row);
    for (const t of tiles) {
      const targets = t.links.map(c => at(c, t.row + 1)).filter((x): x is MapTile => x !== undefined);
      if (t.links.length) this.drawLinks(s, t, t.links, t.state === 'current' ? BONE.base : BONE.faint, targets.length > 0);
    }
    const hovered = this.regions.hovered?.kind === 'tile' ? this.regions.hovered.tile : null;
    for (const t of tiles) this.drawTile(s, t, t === hovered);
    for (const [t] of this.warn) label(s, this.font, STR.unreachable, warnRect(t.col, t.row), TEXT.warning, 'center', INK.deep);
    if (hovered?.tip && this.hoverTime >= TIP_DELAY) {
      const tip = layoutTooltip(this.font, hovered.tip);
      const p = placeTooltip(tip.w, tip.h, { x: this.cursor.x + 8, y: this.cursor.y + 8 }, rect(0, 0, 960, 540), this.cursor.x - 4);
      tip.draw(s, p.x, p.y);
    }
  }

  /** 指引线: a stub down from the tile, the bus across the linked columns, a drop into each linked tile (dotted). */
  private drawLinks(s: Surface, t: MapTile, cols: readonly number[], c: Rgba, intoTiles: boolean): void {
    const from = tileRect(t.col, t.row);
    const y = busY(t.row);
    const cx = (col: number): number => {
      const r = tileRect(col, t.row);
      return r.x + Math.floor(r.w / 2) - 1;
    };
    const x0 = Math.min(cx(t.col), ...cols.map(cx));
    const x1 = Math.max(cx(t.col), ...cols.map(cx));
    dotted(s, cx(t.col), from.y + from.h + 6, cx(t.col), y, c);
    dotted(s, x0, y, x1, y, c);
    const top = tileRect(0, t.row + 1).y;
    if (intoTiles) for (const col of cols) dotted(s, cx(col), y, cx(col), top - 1, c);
  }

  private drawTile(s: Surface, t: MapTile, hovered: boolean): void {
    const r = tileRect(t.col, t.row);
    if (t.glyph === 'portal') {
      drawPortal(s, r, t.state === 'current');
      return;
    }
    checker(s, rect(r.x + 2, r.y + r.h, r.w - 2, 6), INK.deep);
    const frame = t.state === 'current' ? BONE.base : t.state === 'open' ? BONE.dim : BONE.faint;
    tile(s, r, frame, INK.raised);
    s.hline(r.x + 1, r.x + r.w - 2, r.y + r.h - 2, INK.deep);
    const ib = iconBoxRect(t.col, t.row);
    tile(s, ib, t.state === 'closed' ? BONE.faint : BONE.dim, INK.base);
    for (const [x, y] of [[ib.x + 2, ib.y + 2], [ib.x + ib.w - 3, ib.y + 2], [ib.x + 2, ib.y + ib.h - 3], [ib.x + ib.w - 3, ib.y + ib.h - 3]]) s.px(x, y, BONE.dim);
    const inner = rect(ib.x + 2, ib.y + 2, ib.w - 4, ib.h - 4);
    if (t.icon) icon(s, t.icon, inner, t.state === 'closed' ? 0.5 : 1);
    else drawGlyph(s, t.glyph, inner, t.state === 'closed' ? BONE.dim : BONE.base);
    if (t.value !== undefined) {
      const v = String(t.value);
      const chip = rect(ib.x + Math.floor((ib.w - 28) / 2), ib.y + ib.h - 15, 28, 15);
      s.fillRect(chip, INK.deep);
      s.frame(chip, BONE.faint);
      label(s, this.font, v, chip, BONE.base, 'center');
    }
    if (t.stars !== undefined) {
      const sr = starsRect(t.col, t.row);
      const cx = sr.x + Math.floor(sr.w / 2);
      const cy = sr.y + Math.floor(sr.h / 2);
      diamondBadge(s, cx, cy, 11, BONE.dim, INK.base);
      diamondBadge(s, cx, cy, 4, DANGER.deep, DANGER.base);
      for (let i = 0; i < t.stars; i++) s.fill(cx - 4 + i * 3, cy + 7, 2, 2, BONE.base);
    }
    if (hovered) s.frame(rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4), BONE.base);
  }

  private drawOptions(s: Surface): void {
    const opts = this.model.options ?? [];
    const rs = optionRects(opts.length);
    const hovered = this.regions.hovered?.kind === 'option' ? this.regions.hovered.id : null;
    opts.forEach((o, i) => {
      const r = rs[i];
      panel(s, r, 'plain');
      if (o.id === hovered) s.frame(rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4), BONE.base);
      const k = 0.5;
      if (o.scale) label(s, this.font, o.scale, rect(r.x, r.y + Math.round(84 * k), r.w, this.font.line), BONE.dim, 'center');
      // SPEC-GAP: in the widget 副本名框 (bottom padding 210) and the 未解锁 box (top 323) overlap; the name yields to the lock.
      if (!o.locked) label(s, this.font, o.name, rect(r.x, r.y + r.h - Math.round(210 * k) - this.font.line, r.w, this.font.line), TEXT.title, 'center');
      if (o.locked) {
        const y = r.y + Math.round(323 * k);
        drawLock(s, r.x + Math.floor(r.w / 2) - 5, y);
        label(s, this.font, STR.locked, rect(r.x, y + 14, r.w, this.font.line), TEXT.body, 'center');
      } else if (o.blessing) {
        const w = r.w - 24;
        const b = layoutRich(this.font, o.blessing, w);
        drawRich(s, this.font, b, rect(r.x + 12, r.y + Math.round(314 * k), w, b.h), { styles: RICH_DEFAULT, align: 'center' });
      }
    });
    this.retreat.draw(s, this.font);
  }

  private drawQuest(s: Surface): void {
    let y = QUEST_AT.y;
    for (const q of this.model.quest ?? []) {
      label(s, this.font, q.title, rect(QUEST_AT.x, y, 200, this.font.line), BONE.base);
      y += this.font.line;
      for (const l of q.lines) {
        s.fill(QUEST_AT.x, y + 7, 4, 4, BONE.dim);
        const b = layoutRich(this.font, l, 150);
        drawRich(s, this.font, b, rect(QUEST_AT.x + 9, y, 150, b.h), { styles: RICH_DEFAULT });
        y += b.h;
      }
    }
  }
}

const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** The Demo's connectors are dotted (4-vpx squares, 1-vpx gaps): 2-px dots on a 3-px pitch here, 2 px thick. */
function dotted(s: Surface, x0: number, y0: number, x1: number, y1: number, c: Rgba): void {
  if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 3) s.fill(x, y0, 2, 2, c);
  else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 3) s.fill(x0, y, 2, 2, c);
}

/** The start portal: an oval ring in bone (the Demo's blue portal; sapphire is reserved for the hero's resources). */
function drawPortal(s: Surface, r: Rect, lit: boolean): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 - 4;
  const rx = 20;
  const ry = 27;
  for (let y = -ry - 2; y <= ry + 2; y++) {
    for (let x = -rx - 2; x <= rx + 2; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      const px = Math.floor(cx + x);
      const py = Math.floor(cy + y);
      if (d <= 0.78) s.px(px, py, INK.deep);
      else if (d <= 1) s.px(px, py, lit ? BONE.base : BONE.dim);
      else if (d <= 1.18 && ((px + py) & 1) === 0) s.px(px, py, BONE.faint);
    }
  }
}

function drawLock(s: Surface, x: number, y: number): void {
  s.frame(rect(x + 2, y, 7, 6), BONE.dim);
  s.fill(x, y + 5, 11, 7, BONE.dim);
  s.fill(x + 5, y + 7, 1, 3, INK.deep);
}

const SKULL = ['.###.', '#####', '#o#o#', '#####', '.#.#.'] as const;
const QUESTION = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'] as const;

/** A tiny bitmap at a whole-pixel scale; `pal` maps its characters to colours ('.' is clear). */
function bitmap(s: Surface, rows: readonly string[], x: number, y: number, k: number, pal: Record<string, Rgba>): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = pal[row[i]];
      if (c !== undefined) s.fill(x + i * k, y + j * k, k, k, c);
    }
  });
}

/** Placeholder room glyphs on the 50 × 54 icon box (the Demo's 地图格结构 sprites until the art pass). */
function drawGlyph(s: Surface, g: MapTile['glyph'], r: Rect, c: Rgba): void {
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  switch (g) {
    case 'enemies':
      // three small skulls (2× pixels) in a triangle, red for danger
      for (const [dx, dy] of [[-6, -5], [6, -5], [0, 6]]) bitmap(s, SKULL, cx + dx - 5, cy + dy - 5, 2, { '#': DANGER.base, o: INK.deep });
      return;
    case 'boss':
      for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) if (x * x + y * y <= 121) s.px(cx + x, cy + y, x * x + y * y > 81 ? DANGER.deep : DANGER.base);
      s.fill(cx - 5, cy - 2, 3, 3, INK.deep);
      s.fill(cx + 3, cy - 2, 3, 3, INK.deep);
      return;
    case 'chest':
      s.frame(rect(cx - 11, cy - 7, 23, 16), c);
      s.hline(cx - 11, cx + 11, cy - 2, c);
      s.fill(cx - 1, cy - 3, 3, 4, c);
      return;
    case 'camp':
      for (let i = 0; i < 4; i++) s.hline(cx - 2 - i * 2, cx + 2 + i * 2, cy + 4 + i, c);
      s.fill(cx - 2, cy - 6, 5, 8, BONE.dim);
      return;
    case 'unknown':
      bitmap(s, QUESTION, cx - 5, cy - 7, 2, { '#': c });
      return;
    case 'portal':
    case 'empty':
      return;
  }
}

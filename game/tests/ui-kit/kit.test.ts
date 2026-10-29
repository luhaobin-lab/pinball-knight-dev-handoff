import { describe, expect, it } from 'vitest';
import { Surface } from '../../src/ui/core/surface';
import { BONE } from '../../src/ui/style/palette';
import { BADGE, badgeRects, Button, Grid, iconFit, inkBox, layoutTooltip, Menu, MENU, PageStack, placeTooltip, Regions, TIP, type Page, type UiPointer } from '../../src/ui/kit';
import { alignBox, box, canvasBox, toGrid } from '../../src/ui/kit/umg';
import { layoutRich } from '../../src/ui/kit/rich';
import { STUB } from './stub';


const ev = (kind: UiPointer['kind'], x: number, y: number, button = 0): UiPointer => ({ kind, x, y, button });

describe('UMG layout math', () => {
  it('point anchors: offsets are position and size, alignment shifts by the size', () => {
    // UI_主界面 › UI_地图页面: anchor (1,0), 1343×1080, alignment (1,0) → starts at 577
    expect(canvasBox({ offsets: [0, 0, 1343, 1080], min: [1, 0], align: [1, 0] }, box(0, 0, 1920, 1080))).toEqual(box(577, 0, 1343, 1080));
    // UI_物品盒子 › 关闭按钮: anchor (1,0), offset −34,8, 52×52, alignment (0.5,0)
    expect(canvasBox({ offsets: [-34, 8, 52, 52], min: [1, 0], align: [0.5, 0] }, box(0, 0, 948, 744))).toEqual(box(888, 8, 52, 52));
  });

  it('stretched anchors: offsets are insets', () => {
    expect(canvasBox({ offsets: [10, 20, 30, 40], min: [0, 0], max: [1, 1] }, box(0, 0, 200, 100))).toEqual(box(10, 20, 160, 40));
  });

  it('box slots: padding then alignment', () => {
    expect(alignBox(box(0, 0, 324, 600), 100, 24, 'center', 'bottom', [0, 0, 0, 210])).toEqual(box(112, 366, 100, 24));
    expect(alignBox(box(0, 0, 100, 50), 10, 10, 'fill', 'top')).toEqual(box(0, 0, 100, 10));
  });

  it('toGrid rounds edges, not sizes', () => {
    expect(toGrid(box(577, 0, 1343, 1080))).toEqual({ x: 289, y: 0, w: 671, h: 540 });
    expect(toGrid(box(855, 1, 105, 75), { scale: 0.375, x: 0, y: 0 })).toEqual({ x: 321, y: 0, w: 39, h: 29 });
  });
});

describe('hit testing', () => {
  it('Regions: the topmost region wins; a click is press and release on the same target', () => {
    const r = new Regions<string>();
    r.set([
      { rect: { x: 0, y: 0, w: 100, h: 100 }, target: 'below' },
      { rect: { x: 10, y: 10, w: 20, h: 20 }, target: 'top' },
    ]);
    expect(r.at(15, 15)).toBe('top');
    expect(r.at(50, 50)).toBe('below');
    expect(r.at(150, 50)).toBeNull();
    r.route(ev('down', 15, 15));
    expect(r.route(ev('up', 15, 15))).toBe('top');
    r.route(ev('down', 15, 15));
    expect(r.route(ev('up', 50, 50))).toBeNull();
    r.route(ev('move', 50, 50));
    expect(r.hovered).toBe('below');
    r.route(ev('leave', 0, 0));
    expect(r.hovered).toBeNull();
  });

  it('Button states: normal → hover → pressed → click; disabled never clicks; right button ignored', () => {
    const b = new Button('ok', { x: 10, y: 10, w: 40, h: 20 }, 'OK');
    expect(b.state).toBe('normal');
    b.pointer(ev('move', 20, 20));
    expect(b.state).toBe('hover');
    b.pointer(ev('down', 20, 20));
    expect(b.state).toBe('pressed');
    b.pointer(ev('move', 100, 100));
    expect(b.state).toBe('normal');
    expect(b.pointer(ev('up', 100, 100))).toBe(false);
    b.pointer(ev('down', 20, 20));
    expect(b.pointer(ev('up', 20, 20))).toBe(true);
    b.pointer(ev('down', 20, 20, 2));
    expect(b.pointer(ev('up', 20, 20, 2))).toBe(false);
    b.enabled = false;
    expect(b.state).toBe('disabled');
    b.pointer(ev('down', 20, 20));
    expect(b.pointer(ev('up', 20, 20))).toBe(false);
  });

  it('Button draws its states in different frames', () => {
    const frames = (['normal', 'hover', 'disabled'] as const).map(st => {
      const s = new Surface(60, 30);
      const b = new Button('x', { x: 5, y: 5, w: 40, h: 20 }, 'X');
      if (st === 'hover') b.pointer(ev('move', 10, 10));
      if (st === 'disabled') b.enabled = false;
      b.draw(s, STUB);
      return s.get(5, 5);
    });
    expect(frames).toEqual([BONE.dim, BONE.base, BONE.faint]);
  });

  it('Menu: rows from the widget sizes, disabled rows, outside click', () => {
    const m = new Menu([{ id: 'use', label: '使用' }, { id: 'modify', label: '改造', enabled: false }, { id: 'dismantle', label: '分解' }], 100, 50);
    expect(m.frame).toEqual({ x: 100, y: 50, w: MENU.width, h: 4 + 3 * 26 + 3 });
    expect(m.rows[1]).toEqual({ x: 105, y: 50 + 4 + 26 + 2, w: 95, h: 23 });
    const [use, modify] = m.rows;
    m.pointer(ev('down', use.x + 5, use.y + 5));
    expect(m.pointer(ev('up', use.x + 5, use.y + 5))).toBe('use');
    m.pointer(ev('down', modify.x + 5, modify.y + 5));
    expect(m.pointer(ev('up', modify.x + 5, modify.y + 5))).toBeNull();
    m.pointer(ev('down', 10, 10));
    expect(m.pointer(ev('up', 10, 10))).toBe('outside');
  });

  it('Menu: a disabled row keeps the near-black fill and ignores hover; only hover lifts the fill', () => {
    const m = new Menu([{ id: 'use', label: 'a' }, { id: 'modify', label: 'b', enabled: false }], 0, 0);
    const fillAt = (r: { x: number; y: number }): number => {
      const s = new Surface(120, 80);
      m.draw(s, STUB);
      return s.get(r.x + 1, r.y + 1);
    };
    const [use, modify] = m.rows;
    expect(fillAt(modify)).toBe(fillAt(use));
    m.pointer(ev('move', modify.x + 5, modify.y + 5));
    expect(m.hovered).toBe('modify');
    expect(fillAt(modify)).toBe(fillAt(use));
    m.pointer(ev('move', use.x + 5, use.y + 5));
    expect(fillAt(use)).not.toBe(fillAt(modify));
  });

  it('badges snap to one offset inside the card top-right corner; icons scale by whole multiples', () => {
    for (const r of [{ x: 10, y: 10, w: 75, h: 36 }, { x: 100, y: 10, w: 75, h: 75 }, { x: 200, y: 10, w: 75, h: 114 }]) {
      const [b] = badgeRects(STUB, r, { damage: 5 });
      expect(b.rect.x + b.rect.w).toBe(r.x + r.w - BADGE.inset);
      expect(b.rect.y).toBe(r.y + BADGE.inset);
    }
    const two = badgeRects(STUB, { x: 0, y: 0, w: 75, h: 36 }, { damage: 5, armor: 8 });
    expect(two[1].rect.x + two[1].rect.w).toBe(two[0].rect.x - BADGE.gap);
    const sprite = new Surface(12, 12);
    sprite.fill(2, 2, 8, 8, BONE.base);
    const s = new Surface(80, 80);
    expect(iconFit(s, sprite, { x: 0, y: 0, w: 70, h: 40 }, 0.6)).toBe(3);
    expect(inkBox(sprite)).toEqual({ x: 2, y: 2, w: 8, h: 8 });
  });

  it('Grid cells', () => {
    const g = new Grid(10, 20, 7, 5, 39);
    expect(g.rect).toEqual({ x: 10, y: 20, w: 273, h: 195 });
    expect(g.cell(2, 1, 2, 3)).toEqual({ x: 88, y: 59, w: 78, h: 117 });
    expect(g.at(88, 59)).toEqual({ col: 2, row: 1 });
    expect(g.at(9, 59)).toBeNull();
  });
});

class Probe implements Page {
  events: UiPointer[] = [];
  drawn = 0;
  constructor(
    readonly id: string,
    private readonly area = { x: 100, y: 100, w: 50, h: 50 },
  ) {}
  layout(): void {}
  draw(s: Surface): void {
    this.drawn++;
    s.fill(this.area.x, this.area.y, this.area.w, this.area.h, BONE.base);
  }
  hit(x: number, y: number): boolean {
    return x >= this.area.x && y >= this.area.y && x < this.area.x + this.area.w && y < this.area.y + this.area.h;
  }
  pointer(e: UiPointer): boolean {
    this.events.push(e);
    return this.hit(e.x, e.y);
  }
}

describe('PageStack', () => {
  it('routes input to the top page; a modal swallows clicks outside it; the frame offset is removed', () => {
    const stack = new PageStack();
    stack.layout({ x: 0, y: 30, w: 960, h: 540 });
    const base = new Probe('base');
    const modal = new Probe('modal');
    stack.setBase(base);
    expect(stack.pointer(ev('move', 120, 130))).toBe(true);
    expect(base.events.at(-1)).toMatchObject({ x: 120, y: 100 });
    expect(stack.pointer(ev('move', 500, 500))).toBe(false);
    stack.open(modal);
    expect(stack.top).toBe(modal);
    expect(stack.pointer(ev('down', 500, 500))).toBe(true);
    expect(base.events).toHaveLength(2);
    stack.close(modal);
    expect(stack.top).toBe(base);
  });

  it('fades modals in and out over the fade time, dims beneath, drops closed pages', () => {
    const stack = new PageStack();
    const base = new Probe('base', { x: 0, y: 0, w: 10, h: 10 });
    const modal = new Probe('modal', { x: 20, y: 0, w: 10, h: 10 });
    stack.setBase(base);
    stack.open(modal, { fade: 0.2 });
    expect(stack.openness(modal)).toBe(0);
    stack.update(0.1);
    expect(stack.openness(modal)).toBeCloseTo(0.5);
    stack.update(0.2);
    expect(stack.openness(modal)).toBe(1);
    const s = new Surface(40, 20);
    stack.draw(s, 0);
    expect(s.get(25, 5)).toBe(BONE.base);
    expect(s.get(5, 5)).not.toBe(BONE.base); // the base page is dimmed
    expect(s.get(35, 15) >>> 24).toBe(Math.round(0.6 * 255)); // the dim over empty layer pixels
    stack.close(modal);
    stack.update(0.1);
    expect(stack.has(modal)).toBe(false);
    stack.update(0.2);
    expect(stack.openness(modal)).toBe(0);
  });
});

describe('tooltip and rich text', () => {
  it('rich text breaks at the width and keeps styles', () => {
    const b = layoutRich(STUB, '获得<强调>100 - 200</>点经验。', 60);
    expect(b.lines.length).toBeGreaterThan(1);
    expect(b.lines.flatMap(l => l.runs).some(r => r.style === '强调')).toBe(true);
    expect(b.h).toBe(b.lines.length * 16);
  });

  it('a tooltip is 399 units wide and grows with its sections', () => {
    const small = layoutTooltip(STUB, { title: '房间', body: ['获得100 - 200点经验。'] });
    const item = layoutTooltip(STUB, { title: '旧剑', quality: 0, tags: ['小型', '武器'], body: ['25.0充能/每次反弹'], effects: [{ text: '造成5点伤害' }], durability: { cur: 4, max: 4 }, dismantle: 4, mouse: { left: '装上/卸下' } });
    expect(small.w).toBe(TIP.width);
    expect(TIP.width).toBe(200);
    expect(item.h).toBeGreaterThan(small.h + 60);
    const s = new Surface(240, 260);
    item.draw(s, 10, 10);
    expect(s.get(10, 10)).toBe(BONE.dim);
  });

  it('placement: right of the anchor, flipped left at the edge, clamped', () => {
    const bounds = { x: 0, y: 0, w: 960, h: 540 };
    expect(placeTooltip(200, 100, { x: 400, y: 200 }, bounds)).toEqual({ x: 400, y: 200 });
    expect(placeTooltip(200, 100, { x: 850, y: 200 }, bounds, 820)).toEqual({ x: 620, y: 200 });
    expect(placeTooltip(200, 100, { x: 400, y: 500 }, bounds)).toEqual({ x: 400, y: 440 });
  });
});

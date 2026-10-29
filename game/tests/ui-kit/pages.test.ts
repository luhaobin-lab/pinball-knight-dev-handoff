import { describe, expect, it } from 'vitest';
import { Surface } from '../../src/ui/core/surface';
import type { UiPointer } from '../../src/ui/kit';
import { PageStack, TIP, layoutTooltip } from '../../src/ui/kit';
import { ItemMenuPage } from '../../src/ui/pages/item-menu/page';
import type { ItemMenuIntent } from '../../src/ui/pages/item-menu/model';
import { cardRect, LOOT, LootPage, rewardRects } from '../../src/ui/pages/loot/page';
import type { LootIntent, LootModel } from '../../src/ui/pages/loot/model';
import { busY, optionRects, retreatRect, tileCentre, tileRect } from '../../src/ui/pages/map/layout';
import type { MapIntent, MapModel } from '../../src/ui/pages/map/model';
import { MapPage, TIP_DELAY } from '../../src/ui/pages/map/page';
import { PanelPage, panelLayout, statChips } from '../../src/ui/pages/panel/page';
import type { PanelIntent } from '../../src/ui/pages/panel/model';
import { TooltipPage } from '../../src/ui/pages/tooltip/page';
import { STUB } from './stub';

/** `actual` (px) within `tol` px of a capture measurement given in 1920×1080 screen px. */
const near = (actual: number, screenPx: number, tol = 2): void => expect(Math.abs(actual - screenPx / 2)).toBeLessThanOrEqual(tol);
const click = (p: { pointer(e: UiPointer): boolean }, x: number, y: number, button = 0): void => {
  p.pointer({ kind: 'move', x, y });
  p.pointer({ kind: 'down', x, y, button });
  p.pointer({ kind: 'up', x, y, button });
};
const mid = (r: { x: number; y: number; w: number; h: number }) => [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)] as const;

describe('map page', () => {
  it('tiles sit where 创建单个地图格 puts them, matching map_page.json', () => {
    expect(tileCentre(1, 0)).toEqual({ x: 1248.5, y: 224 });
    expect(tileCentre(0, 1)).toEqual({ x: 963.5, y: 449 });
    expect(tileCentre(2, 3)).toEqual({ x: 1533.5, y: 899 });
    // the stone frames measured on ss1 (198×132 inside the 210×150 widget)
    const r = tileRect(1, 0);
    near(r.x + r.w / 2, 1147 + 99, 2);
    near(r.y + r.h / 2, 155 + 66, 2);
    const e = tileRect(0, 2);
    near(e.x + e.w / 2, 862 + 99, 2);
    near(e.y + e.h / 2, 603 + 66, 3.5); // the stone art sits a little high in its widget (drop shadow below)
    expect([r.w, r.h]).toEqual([105, 75]);
    // the dim bus between rows 1 and 2 (conn.dim_bus_row2 at y 558..570)
    near(busY(1), 564, 2);
  });

  it('chapter options and 撤退 from UI_关卡地图页面 CanvasPanel_1', () => {
    const rs = optionRects(3);
    expect(rs.map(r => r.w)).toEqual([156, 156, 156]);
    // CanvasPanel_1 (desired height 693 = Button_63's bottom) centred in the 1080-unit page: top 193.5 units
    expect(rs[0].y).toBe(97);
    expect(rs[0].y + rs[0].h).toBe(397);
    const ret = retreatRect();
    expect(ret).toEqual({ x: 572, y: 412, w: 105, h: 31 });
  });

  const MODEL: MapModel = {
    mode: 'tiles',
    tiles: [
      { col: 1, row: 0, glyph: 'portal', state: 'current', links: [0, 2] },
      { col: 0, row: 1, glyph: 'chest', state: 'open', links: [], tip: { title: '房间', body: ['寻找一件物品。'], width: 275 } },
      { col: 2, row: 1, glyph: 'enemies', state: 'closed', links: [] },
    ],
  };

  it('enter on an open tile; a closed tile shows 无法抵达 and emits nothing', () => {
    const out: MapIntent[] = [];
    const page = new MapPage(STUB, MODEL, i => out.push(i));
    click(page, ...mid(tileRect(0, 1)));
    expect(out).toEqual([{ kind: 'enter', col: 0, row: 1 }]);
    click(page, ...mid(tileRect(2, 1)));
    expect(out).toHaveLength(1);
    const s = new Surface(960, 540);
    page.draw(s);
    page.update(1.1);
    const after = new Surface(960, 540);
    page.draw(after);
    expect(s.data).not.toEqual(after.data); // the warning went away
  });

  it('the tile tooltip waits TIP_DELAY of hover', () => {
    const page = new MapPage(STUB, MODEL, () => {});
    const [x, y] = mid(tileRect(0, 1));
    page.pointer({ kind: 'move', x, y });
    const a = new Surface(960, 540);
    page.draw(a);
    page.update(TIP_DELAY);
    const b = new Surface(960, 540);
    page.draw(b);
    expect(a.data).not.toEqual(b.data);
  });

  it('options mode: option and retreat intents, locked options take no click', () => {
    const out: MapIntent[] = [];
    const page = new MapPage(STUB, { mode: 'options', tiles: [], options: [{ id: '营地', name: '营地' }, { id: '遗迹', name: '遗迹', locked: true }] }, i => out.push(i));
    const rs = optionRects(2);
    click(page, ...mid(rs[0]));
    click(page, ...mid(rs[1]));
    click(page, ...mid(retreatRect()));
    expect(out).toEqual([{ kind: 'option', option: '营地' }, { kind: 'retreat' }]);
  });
});

describe('loot page', () => {
  it('window, grid and close button land on loot_tooltip.json', () => {
    near(LOOT.window.x, 903);
    near(LOOT.window.y, 243);
    near(LOOT.window.w, 708, 2);
    near(LOOT.window.h, 547, 6); // the frame sprite stops short of Border_28's 744 units
    const g = LOOT.grid.rect;
    near(g.x, 984);
    near(g.y, 318);
    near(g.w, 546, 2);
    near(g.h, 390, 2);
    near(LOOT.close.x, 1568, 2);
    near(LOOT.close.y, 250, 2);
    // a 小型 card spans 2 × 1 cells (loot.item_whip 148×66)
    const c = cardRect({ col: 0, row: 0, size: 1 });
    near(c.w, 148, 2);
    near(c.h, 66, 3);
  });

  it('reward hints stack up from 奖励提示框', () => {
    const rs = rewardRects(2);
    expect(rs[1].y + rs[1].h).toBe(492);
    expect(rs[0].y + rs[0].h).toBe(rs[1].y);
    expect(rs[0].w).toBe(200);
  });

  const MODEL: LootModel = {
    open: true,
    items: [{ id: 'sword', col: 0, row: 0, size: 1, face: { damage: 5 }, tip: { title: '旧剑' } }],
    button: { kind: 'reroll', cost: 3, enabled: true },
  };

  it('take, close and reroll intents; a closed window takes no input', () => {
    const out: LootIntent[] = [];
    const page = new LootPage(STUB, MODEL, i => out.push(i));
    click(page, ...mid(cardRect(MODEL.items[0])));
    click(page, ...mid(LOOT.close));
    click(page, ...mid(LOOT.buttons));
    expect(out).toEqual([{ kind: 'take', id: 'sword' }, { kind: 'close' }, { kind: 'reroll' }]);
    page.setModel({ ...MODEL, button: { kind: 'reroll', cost: 3, enabled: false } });
    click(page, ...mid(LOOT.buttons));
    expect(out).toHaveLength(3);
    page.setModel({ ...MODEL, open: false });
    expect(page.pointer({ kind: 'down', x: LOOT.close.x + 2, y: LOOT.close.y + 2 })).toBe(false);
  });

  it('as a modal on the stack it swallows clicks outside the window', () => {
    const stack = new PageStack();
    stack.open(new LootPage(STUB, MODEL, () => {}), { fade: 0 });
    expect(stack.pointer({ kind: 'down', x: 5, y: 5 })).toBe(true);
  });
});

describe('tooltip page', () => {
  it('widths: 375-unit items (loot_tooltip tip.frame 405 px) and the 275-unit map rooms (≈ 295 px)', () => {
    near(TIP.width, 405, 3);
    near(layoutTooltip(STUB, { title: '房间', width: 275 }).w, 295, 3);
  });

  it('keywords stack beside A (and B); the overlay never takes input', () => {
    const page = new TooltipPage(STUB, { tip: { title: '旧剑', keywords: ['<词条>心流</>：…', '<词条>灌注</>：…'] }, compare: { title: '旧盾' }, anchor: { x: 100, y: 50 } });
    const boxes = page.arrange();
    expect(boxes).toHaveLength(4);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].w);
    expect(boxes[2].x).toBeGreaterThan(boxes[1].x + boxes[1].w);
    expect(boxes[3].y).toBeGreaterThan(boxes[2].y);
    expect(page.pointer()).toBe(false);
  });

  it('flips left of the anchor near the right edge', () => {
    const page = new TooltipPage(STUB, { tip: { title: 'x' }, anchor: { x: 900, y: 50 }, flipX: 880 });
    const [a] = page.arrange();
    expect(a.x + a.w).toBe(880);
  });
});

describe('item menu page', () => {
  const rows = [{ id: 'use', label: '使用' }, { id: 'modify', label: '改造', enabled: false }, { id: 'dismantle', label: '分解' }];

  it('opens at the card corner, clamped inside the frame', () => {
    const page = new ItemMenuPage(STUB, { anchor: { x: 110, y: 112 }, rows }, () => {});
    expect(page.rect).toMatchObject({ x: 110, y: 112, w: 105 });
    const edge = new ItemMenuPage(STUB, { anchor: { x: 930, y: 530 }, rows }, () => {});
    expect(edge.rect.x + edge.rect.w).toBe(960);
    expect(edge.rect.y + edge.rect.h).toBe(540);
  });

  it('pick on enabled rows, close on outside clicks and Escape', () => {
    const out: ItemMenuIntent[] = [];
    const page = new ItemMenuPage(STUB, { anchor: { x: 110, y: 112 }, rows }, i => out.push(i));
    const r = page.rect;
    click(page, r.x + 20, r.y + 4 + 2 + 5);
    click(page, r.x + 20, r.y + 4 + 26 + 2 + 5);
    click(page, 5, 5);
    page.key({ key: 'Escape' });
    expect(out).toEqual([{ kind: 'pick', id: 'use' }, { kind: 'close' }, { kind: 'close' }]);
  });
});

describe('panel page', () => {
  it('buttons stack right-aligned in Overlay_1 (156×63 units, 14-unit spacers)', () => {
    const L = panelLayout(STUB, true);
    expect(L.next.x + L.next.w).toBe(938);
    expect([L.next.w, L.next.h]).toEqual([78, 32]);
    expect(L.retry!.y + L.retry!.h).toBeLessThan(L.next.y);
    expect(panelLayout(STUB, false).retry).toBeNull();
  });

  it('continue and retry intents; no retry button when the Demo collapses it', () => {
    const out: PanelIntent[] = [];
    const page = new PanelPage(STUB, { success: false, canRetry: true, stats: [] }, i => out.push(i));
    const L = panelLayout(STUB, true);
    click(page, ...mid(L.next));
    click(page, ...mid(L.retry!));
    page.setModel({ success: true, canRetry: false, stats: [] });
    click(page, ...mid(L.retry!));
    expect(out).toEqual([{ kind: 'continue' }, { kind: 'retry' }]);
  });

  it('stats chips: guide line then chips for the values given', () => {
    const { guide, chips } = statChips({ at: { x: 100, y: 200 }, guide: true, damage: 8, armor: 3 });
    expect(guide).toEqual({ x: 100, y: 199, w: 71, h: 2 });
    expect(chips.map(c => c.kind)).toEqual(['damage', 'armor']);
    expect(chips[0].rect.w).toBe(66);
    expect(Math.abs(chips[1].rect.x - chips[0].rect.x - 64.5)).toBeLessThanOrEqual(0.5);
  });
});

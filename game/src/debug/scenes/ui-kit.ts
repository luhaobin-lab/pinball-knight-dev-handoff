import { itemIcon } from '../../procgen/icons';
import { ScreenLayer } from '../../ui/core/screen-layer';
import { rect, type Surface } from '../../ui/core/surface';
import { BONE, INK } from '../../ui/style/palette';
import { PixelFont, type TextFont } from '../../ui/text/font';
import { drawCard, label, PageStack, type Page } from '../../ui/kit';
import type { PixelSprite, TooltipModel } from '../../ui/kit';
import { ItemMenuPage } from '../../ui/pages/item-menu/page';
import { LootPage } from '../../ui/pages/loot/page';
import type { LootModel } from '../../ui/pages/loot/model';
import type { MapModel } from '../../ui/pages/map/model';
import { MapPage } from '../../ui/pages/map/page';
import { PanelPage } from '../../ui/pages/panel/page';
import { TooltipPage } from '../../ui/pages/tooltip/page';
import { defineScene, type SceneContext } from '../types';
import play from './play';

/**
 * The page kit's five A06 pages on sample models: `?scene=ui-kit&page=map|map-options|loot|tooltip|item-menu|panel`.
 * `&hover=x,y` puts the pointer at a design-frame pixel (tooltips, hover states) and `&click=x,y` clicks there, so
 * `npm run shots` can show both. Pages other than the map sit over the reference combat room (play), as in the Demo.
 * Intents are logged to the console.
 */

interface SampleContext {
  font: TextFont;
  icon: (row: string, size: number) => PixelSprite;
  log: (intent: unknown) => void;
}

interface Sample {
  /** Draw the reference room behind the pages. */
  room: boolean;
  build(c: SampleContext): { page: Page; modal: boolean; dim?: boolean }[];
  /** Scene-only context drawn in the design frame under the pages (what the page sits next to in the game). */
  backdrop?(s: Surface, c: SampleContext): void;
}

/** The context menu's source card (context_menu.json anchor.card 63,221 155×75 at 1080p): the 生命药剂 card. */
const MENU_CARD = rect(32, 112, 78, 37);

/** Icon canvas per card size (itemIcon inks about 2/3 of its canvas): ink near 55% of the card's short side. */
const CARD_ICON = { 1: 30, 2: 60, 3: 60 } as const;

/** UI_地图格 calls 简单描述(…, 275.0). */
const tip = (desc: string) => ({ title: '房间', body: [desc], width: 275 });

const MAP: MapModel = {
  mode: 'tiles',
  tiles: [
    { col: 1, row: 0, glyph: 'portal', state: 'current', links: [0, 1, 2] },
    { col: 0, row: 1, glyph: 'unknown', state: 'open', links: [0, 1, 2], tip: tip('获得<强调>100 - 200</>点经验。') },
    { col: 1, row: 1, glyph: 'chest', state: 'open', links: [0, 1, 2], tip: tip('寻找一件物品。') },
    { col: 2, row: 1, glyph: 'enemies', state: 'open', stars: 1, links: [0, 2], tip: tip('有奇怪的生物。') },
    { col: 0, row: 2, glyph: 'unknown', state: 'closed', links: [0, 1, 2] },
    { col: 2, row: 2, glyph: 'boss', state: 'closed', stars: 2, links: [0, 1, 2] },
    { col: 0, row: 3, glyph: 'unknown', state: 'closed', links: [0, 1, 2] },
    { col: 1, row: 3, glyph: 'enemies', state: 'closed', stars: 0, links: [0, 1, 2] },
  ],
  quest: [{ title: '往日回忆', lines: ['通过第<数值>0/12</>层'] }],
};

const PAGES: Record<string, Sample> = {
  loot: { room: true, build: c => [{ page: new LootPage(c.font, loot(c), c.log), modal: true }] },
  tooltip: {
    room: true,
    build: c => [
      { page: new TooltipPage(c.font, { tip: SWORD_TIP, compare: POTION_TIP, anchor: { x: 260, y: 90 } }), modal: true },
    ],
  },
  'item-menu': {
    room: true,
    backdrop: (s, c) => drawCard(s, c.font, MENU_CARD, { icon: c.icon('生命药剂', CARD_ICON[1]), heal: 20 }),
    build: c => [
      {
        page: new ItemMenuPage(
          c.font,
          {
            anchor: { x: MENU_CARD.x + MENU_CARD.w, y: MENU_CARD.y },
            rows: [
              { id: 'use', label: '使用' },
              { id: 'modify', label: '改造', enabled: false },
              { id: 'dismantle', label: '分解', cost: 1 },
            ],
            dismantle: { x: 20, y: 380, value: 16, icon: c.icon('旧盾', 32) },
          },
          c.log,
        ),
        modal: true,
        // context_menu.json: the backpack stays undimmed behind the menu
        dim: false,
      },
    ],
  },
  panel: {
    room: true,
    build: c => [
      {
        page: new PanelPage(
          c.font,
          {
            success: false,
            canRetry: true,
            stats: [
              { at: { x: 470, y: 250 }, guide: true, charge: 2, damage: 18, heal: 5, armor: 8 },
              { at: { x: 600, y: 330 }, guide: true, damage: 6 },
            ],
          },
          c.log,
        ),
        modal: false,
      },
    ],
  },
  map: {
    room: false,
    // the page box starts at x 577 units; left of it the hero / backpack HUD (not part of this card) will sit
    backdrop: (s, c) => {
      const r = rect(8, 8, 272, 524);
      for (let x = r.x; x < r.x + r.w; x += 4) {
        s.fill(x, r.y, 2, 1, BONE.faint);
        s.fill(x, r.y + r.h - 1, 2, 1, BONE.faint);
      }
      for (let y = r.y; y < r.y + r.h; y += 4) {
        s.fill(r.x, y, 1, 2, BONE.faint);
        s.fill(r.x + r.w - 1, y, 1, 2, BONE.faint);
      }
      label(s, c.font, 'HUD: hero / backpack (placeholder)', rect(r.x, r.y + 8, r.w, c.font.line), BONE.faint, 'center');
    },
    build: c => [{ page: new MapPage(c.font, MAP, c.log), modal: false }],
  },
  'map-options': {
    room: false,
    build: c => [
      {
        page: new MapPage(
          c.font,
          {
            mode: 'options',
            tiles: [],
            options: [
              { id: '营地', name: '营地', scale: '（小型）', blessing: '移除<强调>10</>腐化' },
              { id: '遗迹', name: '遗迹', scale: '（中型）' },
              { id: '深渊', name: '深渊', scale: '（大型）', locked: true },
            ],
          },
          c.log,
        ),
        modal: false,
      },
    ],
  },
};

/** The 旧剑 tooltip of loot_tooltip.json (title, quality, chips, charge, effects, durability, dismantle, mouse). */
const SWORD_TIP: TooltipModel = {
  title: '旧剑',
  quality: 0,
  tags: ['小型', '武器'],
  body: ['<强调>25.0</>充能/每次反弹', '完成充能时：'],
  effects: [{ text: '造成<强调>5</>点伤害' }, { text: '获得<强调>1</>层<词条>心流</>' }],
  durability: { cur: 4, max: 4 },
  dismantle: 4,
  mouse: { left: '装上/卸下', right: '交互' },
  keywords: ['<词条>心流</>：每层使下一次碰撞伤害提高。', '<词条>灌注</>：消耗体力为武器充能。'],
};

const POTION_TIP: TooltipModel = {
  title: '生命药剂',
  quality: 0,
  tags: ['小型'],
  effects: [{ text: '使用时：恢复<强调>20</>点生命', kind: 'use' }],
  durability: { cur: 1, max: 1 },
  dismantle: 1,
};

const loot = (c: SampleContext): LootModel => ({
  open: true,
  items: [
    // icons at native size for their card (CARD_ICON), so the whole grid shares one pixel scale
    { id: 'sword', col: 0, row: 0, size: 1, face: { icon: c.icon('旧剑', CARD_ICON[1]), damage: 5 }, tip: SWORD_TIP },
    { id: 'shield', col: 2, row: 0, size: 2, face: { icon: c.icon('旧盾', CARD_ICON[2]), quality: 1, armor: 8 } },
    { id: 'potion', col: 4, row: 0, size: 1, face: { icon: c.icon('生命药剂', CARD_ICON[1]), heal: 20 }, tip: POTION_TIP },
    { id: 'blood', col: 0, row: 2, size: 1, face: { icon: c.icon('鲜血', CARD_ICON[1]), quality: 2 } },
    { id: 'book', col: 4, row: 2, size: 3, face: { icon: c.icon('无字书', CARD_ICON[3]), quality: 3 } },
  ],
  button: { kind: 'reroll', cost: 3, enabled: true },
  rewards: [{ icon: c.icon('空瓶', 32), text: '获得<强调>12</>经验。' }],
});

let layer: ScreenLayer | null = null;
let backdrop: (() => void) | null = null;
let stack: PageStack | null = null;
let withRoom = false;
let elapsed = 0;

const frameOf = (l: ScreenLayer) => rect(Math.floor((l.surface.w - 960) / 2), Math.max(0, Math.floor((l.surface.h - 540) / 2)), 960, 540);

async function setup(ctx: SceneContext): Promise<void> {
  const id = ctx.params.get('page') ?? 'map';
  const sample = PAGES[id];
  if (!sample) throw new Error(`ui-kit: unknown page "${id}"; one of ${Object.keys(PAGES).join(', ')}`);
  withRoom = sample.room;
  if (withRoom) await play.setup(ctx);
  else ctx.renderer.scene.background = null;
  const font: TextFont = await PixelFont.load();
  layer = new ScreenLayer(ctx.renderer, document.body);
  stack = new PageStack();
  stack.layout(frameOf(layer));
  const sc: SampleContext = { font, icon: (row, size) => itemIcon(row, size), log: i => console.log('[ui-kit intent]', JSON.stringify(i)) };
  const pages = sample.build(sc);
  backdrop = sample.backdrop ? () => sample.backdrop!(layer!.surface, sc) : null;
  for (const p of pages) {
    if (p.modal) stack.open(p.page, { fade: 0, ...(p.dim === undefined ? {} : { dim: p.dim }) });
    else stack.setBase(p.page);
  }
  const f = frameOf(layer);
  for (const [k, kind] of [['hover', 'move'], ['click', 'down']] as const) {
    const v = ctx.params.get(k);
    if (!v) continue;
    const [x, y] = v.split(',').map(Number);
    stack.pointer({ kind: 'move', x: f.x + x, y: f.y + y });
    if (kind === 'down') {
      stack.pointer({ kind: 'down', x: f.x + x, y: f.y + y, button: 0 });
      stack.pointer({ kind: 'up', x: f.x + x, y: f.y + y, button: 0 });
    }
  }
  // Hover tooltips wait TIP_DELAY; a still frame shows them.
  stack.update(1);
  const toLayer = (e: PointerEvent) => layer!.toLayer(e.clientX, e.clientY);
  window.addEventListener('pointermove', e => stack!.pointer({ kind: 'move', ...toLayer(e) }));
  window.addEventListener('pointerdown', e => stack!.pointer({ kind: 'down', ...toLayer(e), button: e.button }));
  window.addEventListener('pointerup', e => stack!.pointer({ kind: 'up', ...toLayer(e), button: e.button }));
}

function update(ctx: SceneContext, dt: number): void {
  if (withRoom) play.update?.(ctx, dt);
  if (!layer || !stack) return;
  if (layer.sync()) stack.layout(frameOf(layer));
  elapsed += dt;
  stack.update(dt);
  const s = layer.surface;
  s.clear(withRoom ? 0 : INK.base);
  if (backdrop) {
    const f = frameOf(layer);
    s.origin(f.x, f.y);
    backdrop();
    s.origin(0, 0);
  }
  stack.draw(s, elapsed);
  layer.present();
}

export default defineScene({ name: 'ui-kit', description: 'page kit: map, loot, tooltip, item menu, Victory/Failure panel on sample models', setup, update });

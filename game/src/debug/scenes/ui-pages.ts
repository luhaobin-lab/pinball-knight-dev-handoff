import { ScreenLayer } from '../../ui/core/screen-layer';
import { rect } from '../../ui/core/surface';
import { PageStack, type Page } from '../../ui/kit';
import { BossBarPage } from '../../ui/pages/boss-bar/page';
import { HeroSelectPage } from '../../ui/pages/hero-select/page';
import type { MultiChoiceModel } from '../../ui/pages/multi-choice/model';
import { MultiChoicePage } from '../../ui/pages/multi-choice/page';
import type { RunEndModel } from '../../ui/pages/run-end/model';
import { RunEndPage } from '../../ui/pages/run-end/page';
import { TitlePage } from '../../ui/pages/title/page';
import { WarningPage } from '../../ui/pages/warning/page';
import { INK } from '../../ui/style/palette';
import { PixelFont, type TextFont } from '../../ui/text/font';
import { defineScene, type SceneContext } from '../types';
import play from './play';

/**
 * The six A07 pages on sample models: `?scene=ui-pages&page=<id>` with id one of
 * title | title-new | hero | hero-unlocked | talents | events | run-end | run-fail | run-demo | warning | warning-save |
 * resume | boss. `&hover=x,y` puts the pointer at a design-frame pixel and `&click=x,y` clicks there (`run-demo` clicks
 * 返回营地 itself once the bar runs). Time-driven pages (run end, boss bar) move with `?t=`. Pages that are modal in the
 * game (talents, events, warning, resume) and the boss bar sit over the reference combat room. Intents go to the
 * console.
 */

interface Sample {
  room: boolean;
  modal: boolean;
  build(font: TextFont, log: (i: unknown) => void): Page;
}

const TALENTS: MultiChoiceModel = {
  source: 'levelUp',
  layout: 'talent',
  options: [
    { name: '浴血奋战', level: '1/8', icon: '浴血奋战', description: '生命低于<强调>50%</>时，造成的伤害提高<强调>16%</>，受到的伤害降低<强调>4%</>。', excludes: [2] },
    { name: '生命成长', level: '2/8', icon: '生命成长', description: '最大生命提高<强调>10%</>。' },
    { name: '强韧', level: '1/5', icon: '强韧', description: '每回合开始时获得<强调>3</>点强固。', price: 4 },
  ],
  reroll: { cost: 3, enabled: true },
  canSkip: true,
};

const EVENTS: MultiChoiceModel = {
  source: 'event',
  layout: 'event',
  options: [
    { name: '献祭', icon: '献祭', description: '失去<强调>20</>点生命，获得一件<强调>白银</>品质物品。' },
    { name: '冥想', icon: '冥想', description: '恢复<强调>30</>点体力。' },
    { name: '离开', icon: '离开', description: '什么也不做。' },
  ],
  reroll: null,
  canSkip: true,
};

const RUN_WON: RunEndModel = {
  completed: true,
  counts: { 反弹: 214, 获得SSS: 6, 获取物品: 23, 分解物品: 4, 获取天赋: 9, 挑战成功: 14, 击败首领: 1 },
  before: { 当前解锁分: 1582, 每级所需分: 500, 当前解锁等级: 3, 最高解锁等级: 35 },
  demoComplete: false,
  replayedPrologue: false,
};

const PAGES: Record<string, Sample> = {
  title: { room: false, modal: false, build: (f, log) => new TitlePage(f, { prologueDone: false }, log, { wordmark: true }) },
  'title-new': { room: false, modal: false, build: (f, log) => new TitlePage(f, { prologueDone: true }, log, { wordmark: true }) },
  hero: {
    room: false,
    modal: false,
    build: (f, log) =>
      new HeroSelectPage(f, { explorationLevel: 3, selected: '幽冥骑士', skill: { name: '可控挥击', description: '发射后可控制方向，撞击敌人造成<强调>100%</>基础伤害。' } }, log),
  },
  'hero-unlocked': { room: false, modal: false, build: (f, log) => new HeroSelectPage(f, { explorationLevel: 4, selected: '灵魂猎手' }, log) },
  talents: { room: true, modal: true, build: (f, log) => new MultiChoicePage(f, TALENTS, log) },
  events: { room: true, modal: true, build: (f, log) => new MultiChoicePage(f, EVENTS, log) },
  'run-end': { room: false, modal: false, build: (f, log) => new RunEndPage(f, RUN_WON, log) },
  'run-fail': {
    room: false,
    modal: false,
    build: (f, log) => new RunEndPage(f, { ...RUN_WON, completed: false, counts: { 反弹: 40, 获取物品: 6, 挑战成功: 3 }, before: { ...RUN_WON.before, 当前解锁分: 120, 当前解锁等级: 1 } }, log),
  },
  'run-demo': { room: false, modal: false, build: (f, log) => new RunEndPage(f, { ...RUN_WON, demoComplete: true }, log) },
  warning: { room: true, modal: true, build: (f, log) => new WarningPage(f, { type: 0, saveQuit: false }, log) },
  'warning-save': { room: true, modal: true, build: (f, log) => new WarningPage(f, { type: 0, saveQuit: true }, log) },
  resume: { room: true, modal: true, build: (f, log) => new WarningPage(f, { type: 2, saveQuit: false }, log) },
  boss: { room: true, modal: false, build: f => new BossBarPage(f, { name: '守门人', hp: 290, hpMax: 500, armor: 60, dotPending: 40, overflowHeal: 0 }) },
};

let layer: ScreenLayer | null = null;
let stack: PageStack | null = null;
let page: Page | null = null;
let withRoom = false;
let autoClick = false;
let elapsed = 0;

const frameOf = (l: ScreenLayer) => rect(Math.floor((l.surface.w - 960) / 2), Math.max(0, Math.floor((l.surface.h - 540) / 2)), 960, 540);

async function setup(ctx: SceneContext): Promise<void> {
  const id = ctx.params.get('page') ?? 'title';
  const sample = PAGES[id];
  if (!sample) throw new Error(`ui-pages: unknown page "${id}"; one of ${Object.keys(PAGES).join(', ')}`);
  withRoom = sample.room;
  if (withRoom) await play.setup(ctx);
  else ctx.renderer.scene.background = null;
  const font: TextFont = await PixelFont.load();
  layer = new ScreenLayer(ctx.renderer, document.body);
  stack = new PageStack();
  stack.layout(frameOf(layer));
  page = sample.build(font, i => console.log('[ui-pages intent]', JSON.stringify(i)));
  if (sample.modal) stack.open(page, { fade: 0 });
  else stack.setBase(page);
  autoClick = id === 'run-demo';
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
  if (autoClick && page instanceof RunEndPage && page.state.ready) {
    autoClick = false;
    const f = frameOf(layer);
    const r = page.continueRect;
    const at = { x: f.x + r.x + Math.floor(r.w / 2), y: f.y + r.y + Math.floor(r.h / 2) };
    stack.pointer({ kind: 'move', ...at });
    stack.pointer({ kind: 'down', ...at, button: 0 });
    stack.pointer({ kind: 'up', ...at, button: 0 });
  }
  const s = layer.surface;
  s.clear(withRoom ? 0 : INK.base);
  stack.draw(s, elapsed);
  layer.present();
}

export default defineScene({ name: 'ui-pages', description: 'A07 pages: title, hero select, multi-choice, run end, warning dialog, boss bar on sample models', setup, update });

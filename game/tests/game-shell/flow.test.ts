import { describe, expect, it } from 'vitest';
import { createPolicy, Stopper } from '../../src/game/autoplay';
import { bindingFor, PAGE_BINDINGS } from '../../src/game/bind/pages';
import { combatFlags, itemCards } from '../../src/game/bind/hud';
import { GameClock } from '../../src/game/clock';
import { Cues, type CueTarget } from '../../src/game/cues';
import { roomFrame, roomSpec } from '../../src/game/room/build';
import { viewKind } from '../../src/game/views/kinds';
import { floorCount } from '../../src/procgen/architecture/layout';
import type { RoomPlan } from '../../src/game/api';
import { composeGame } from '../../src/game/compose';
import { heroSelectModel } from '../../src/game/bind/pages/hero-select';
import { mapModel } from '../../src/game/bind/pages/map';
import { multiChoiceModel } from '../../src/game/bind/pages/modal-multi-choice';
import { warningModel } from '../../src/game/bind/pages/modal-warning';
import { titleModel } from '../../src/game/bind/pages/title';
import { heroPortraits, lockTip } from '../../src/ui/pages/hero-select/model';
import { titleButtons } from '../../src/ui/pages/title/model';
import { warningText } from '../../src/ui/pages/warning/model';
import { createFakeGame } from './fake-view';

/** Plays the fake game with the scripted policy, recording every screen and modal it shows. */
function walk(seconds = 300): { seen: Set<string>; pages: Set<string> } {
  const game = createFakeGame({ floors: 3 });
  const bot = createPolicy('scripted', 1);
  const seen = new Set<string>();
  const pages = new Set<string>();
  for (let t = 0; t < seconds * 60; t++) {
    const v = game.view;
    seen.add(v.modal ? `modal:${v.modal.kind}` : v.screen);
    const b = bindingFor(v);
    if (b) pages.add(b.id);
    if (!v.launch) {
      const cmd = bot.next(v, game.legal());
      if (cmd) expect(game.send(cmd)).toEqual({ ok: true });
    }
    game.advance(1 / 60);
    if (seen.has('modal:runEnd') && v.screen === 'title') break;
  }
  return { seen, pages };
}

describe('the shell on the fake game', () => {
  it('the scripted bot reaches every screen and modal, and each has its page', () => {
    const { seen, pages } = walk();
    for (const s of ['title', 'heroSelect', 'map', 'room', 'modal:panel', 'modal:loot', 'modal:multiChoice', 'modal:runEnd']) expect(seen).toContain(s);
    for (const p of ['title', 'hero-select', 'map', 'panel', 'loot', 'multi-choice', 'run-end']) expect(pages).toContain(p);
  });

  it('hero select: the Hunter is locked with the Demo text, 出发 starts the run', () => {
    const game = createFakeGame();
    game.send({ type: 'title.newRun' });
    const v = game.view;
    expect(bindingFor(v)!.id).toBe('hero-select');
    const portraits = heroPortraits(heroSelectModel(v));
    const hunter = portraits.find(p => p.hero === '灵魂猎手')!;
    expect(hunter.unlocked).toBe(false);
    expect(lockTip(hunter).text).toBe('探索等级提升至<天赋>4</>后解锁。');
    expect(portraits.find(p => p.hero === '幽冥骑士')!.unlocked).toBe(true);
    expect(game.send({ type: 'hero.start' })).toEqual({ ok: true });
    expect(game.view.screen).toBe('map');
  });

  it('the pause dialog is the warning page with the Demo buttons; 放弃探险 ends the run', () => {
    const game = createFakeGame();
    game.send({ type: 'title.newRun' });
    game.send({ type: 'hero.start' });
    game.send({ type: 'menu.open' });
    const v = game.view;
    expect(bindingFor(v)!.id).toBe('warning');
    expect(warningText(warningModel(v)).buttons).toEqual(['保存并退出', '放弃探险']);
    expect(game.send({ type: 'warning.answer', button: 1 })).toEqual({ ok: true });
    expect(game.view.modal?.kind).toBe('runEnd');
    expect(bindingFor(game.view)!.model!(game.view, game.legal()).lines).toContain('总分  80');
  });

  it('map tiles: rows from the hero, open when legal, stars on combat tiles, enter maps back to the cell', () => {
    const game = createFakeGame();
    game.send({ type: 'title.newRun' });
    game.send({ type: 'hero.start' });
    game.send({ type: 'map.enter', cell: '1:0' });
    game.send({ type: 'loot.takeAll' });
    game.send({ type: 'interact', actor: game.view.field.find(f => f.kind === 'neutral')!.id });
    game.send({ type: 'loot.close' });
    const v = game.view;
    expect(v.screen).toBe('map');
    const m = mapModel(v, new Set(['2:0', '2:1', '2:2']));
    // the hero's row (window row 0), then the floors ahead up to the boss row; only tiles within one column open
    expect(m.tiles.map(t => [t.col, t.row, t.glyph, t.state, t.stars])).toEqual([
      [0, 0, 'chest', 'current', undefined],
      [1, 0, 'chest', 'closed', undefined],
      [2, 0, 'chest', 'closed', undefined],
      [0, 1, 'enemies', 'open', 2],
      [1, 1, 'enemies', 'open', 0],
      [2, 1, 'chest', 'closed', undefined],
      [0, 2, 'empty', 'closed', undefined],
      [1, 2, 'boss', 'closed', 1],
      [2, 2, 'empty', 'closed', undefined],
    ]);
    expect(m.tiles.find(t => t.row === 0 && t.col === 0)!.links).toEqual([0, 1]);
  });

  it('multi-choice: talents stack with levels, reroll follows legal()', () => {
    const v = { modal: { kind: 'multiChoice', source: 'levelUp', title: '', options: [{ row: '博学', title: '博学', text: 't', level: 2, icon: '' }], reroll: { cost: 3, currency: '精核' }, canSkip: true } } as never;
    expect(multiChoiceModel(v, [])).toEqual({ source: 'levelUp', layout: 'talent', options: [{ name: '博学', description: 't', level: '2', icon: '博学' }], reroll: { cost: 3, enabled: false }, canSkip: true });
    expect(multiChoiceModel(v, [{ type: 'modal.reroll' }]).reroll?.enabled).toBe(true);
  });

  it('modal bindings come before screen bindings', () => {
    const firstScreen = PAGE_BINDINGS.findIndex(b => !b.modal);
    expect(PAGE_BINDINGS.slice(firstScreen).every(b => !b.modal)).toBe(true);
  });

  it('the stopper counts arrivals', () => {
    const s = new Stopper('room:2');
    const room = { screen: 'room', modal: null } as never;
    const map = { screen: 'map', modal: null } as never;
    expect([s.reached(room), s.reached(map), s.reached(room)]).toEqual([false, false, true]);
  });
});

describe('the shell on the real core', () => {
  it('composeGame preserves the source new-player prologue gate and an explicit QA skip remains available', () => {
    const game = composeGame(1);
    expect(game.legal().some(s => s.type === 'title.newRun')).toBe(false);
    expect(game.runUntilInput()).toBe('input');
    const v = game.view;
    expect(v.screen).toBe('title');
    expect(bindingFor(v)!.id).toBe('title');
    expect(titleButtons(titleModel(v, true))).toEqual(['prologue', 'quit', 'settings', 'discord', 'kook']);
    const legal = new Set(game.legal().map(s => s.type));
    for (const t of ['title.prologue', 'title.settings', 'title.quit'] as const) expect(legal.has(t)).toBe(true);
    expect(legal.has('title.newRun')).toBe(false);const qa=composeGame(1,{skipPrologue:true});qa.runUntilInput();expect(qa.legal().some(c=>c.type==='title.newRun')).toBe(true);
  });
});

describe('bindings and views', () => {
  it('HUD flags follow the phase and the field', () => {
    const game = createFakeGame();
    game.send({ type: 'title.newRun' });
    game.send({ type: 'hero.start' });
    game.send({ type: 'map.enter', cell: '1:0' });
    expect(combatFlags(game.view)).toEqual({ aiming: true, enemiesOnField: false });
    expect(itemCards(game.view.inventory.equip)).toMatchObject([{ id: '900', row: 0, size: 2, icon: 'sword', type: 'weapon' }]);
  });

  it('rows map to views by data with a fallback', () => {
    expect(viewKind({ kind: 'hero', row: '幽冥骑士' })).toEqual({ view: 'hero' });
    expect(viewKind({ kind: 'boss', row: '守门人' })).toEqual({ view: 'boss', row: '守门人' });
    expect(viewKind({ kind: 'neutral', row: '任务宝箱' })).toEqual({ view: 'prop', prop: 'chest' });
    expect(viewKind({ kind: 'neutral', row: '铁砧' })).toEqual({ view: 'prop', prop: 'anvil' });
    expect(viewKind({ kind: 'neutral', row: '某个新行' })).toEqual({ view: 'prop', prop: 'crate' });
  });

  it('RoomPlan → RoomSpec: every floor cell becomes cell/64 tiles inside a wall ring', () => {
    const cells: [number, number][] = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) cells.push([c, r]);
    const room: RoomPlan = {
      layout: 't',
      variant: 0,
      cols: 7,
      rows: 5,
      tile: 128,
      cells,
      solids: [{ kind: 'circle', at: { x: 64, y: 64, z: 0 }, radius: 32, tags: [] }],
      decorations: [{ cls: 'CatapultHero/BP/环境/装饰品/蓝图_装饰品_火盆', cell: [0.5,0.5], placement: '固定' }],
      spawns: [],
      task: null,
      playerSpawn: { x: 0, y: 0, z: 0 },
      background: null,
    };
    const spec = roomSpec(room, 1);
    expect(spec.layout.width).toBe(12); // sourceUEYisrenderX,UEXisrender−Z
    expect(spec.layout.depth).toBe(16);
    expect(floorCount(spec.layout)).toBe(14 * 10);
    expect(spec.pillars).toEqual([{ x: 2, z: 14, radius: 0.5 }]);
    const f = roomFrame(room);
    expect(f.toUu(f.toTiles(320, 192).x, f.toTiles(320, 192).z)).toEqual({ x: 320, y: 192 });
  });

  it('unknown cue assets play the placeholder and are counted', () => {
    const calls: string[] = [];
    const target: CueTarget = { shake: k => calls.push(`shake:${k}`), sound: c => calls.push(`sound:${c}`), spark: () => calls.push('spark'), place: () => ({ x: 1, z: 1 }) };
    const cues = new Cues();
    cues.play({ t: 0, kind: 'shake', asset: '摄像机晃动_零点二', at: null }, target);
    cues.play({ t: 0, kind: 'vfx', asset: '粒子_未知', at: null, attach: null }, target);
    cues.play({ t: 0, kind: 'vfx', asset: '粒子_未知', at: null, attach: null }, target);
    expect(calls).toEqual(['shake:damage', 'spark', 'spark']);
    expect(cues.unknown.get('vfx:粒子_未知')).toBe(2);
  });
});

describe('clock', () => {
  it('pauses while a modal is open and scales with speed', () => {
    const c = new GameClock();
    expect(c.step(0.1, true)).toBe(0);
    c.speed = 2;
    expect(c.step(0.1, false)).toBeCloseTo(0.2);
  });

  it('hit-stop slows the game after an enemy contact, frame-rate independent', () => {
    const a = new GameClock();
    const b = new GameClock();
    a.dilate('hitStop', 0);
    b.dilate('hitStop', 0);
    let ga = 0;
    let gb = 0;
    for (let i = 0; i < 6; i++) ga += a.step(1 / 60, false);
    for (let i = 0; i < 3; i++) gb += b.step(1 / 30, false);
    expect(ga).toBeLessThan(0.1);
    expect(ga).toBeCloseTo(gb, 9);
  });

  it('a death dilation slows, then real time resumes', () => {
    const c = new GameClock();
    c.dilate('death', 0);
    expect(c.step(0.1, false)).toBeCloseTo(0.025);
    c.step(10, false);
    expect(c.step(0.1, false)).toBeCloseTo(0.1);
  });
});

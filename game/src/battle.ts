import { createRenderer } from './render/api';
import { INTERNAL_HEIGHT } from './render/density';
import { Shell } from './game/loop';
import { createBattleGame, getBattleBootstrapSummary } from './game/battle-start';
import type { PresentEvent } from './game/api';
import './battle.css';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

/** Standalone presentation/entry only. Combat rules and source UI remain in the original core and Shell. */
export async function startBattle(canvas: HTMLCanvasElement, seed: number): Promise<void> {
  const game = createBattleGame(seed);
  const renderer = createRenderer(canvas, { internalHeight: INTERNAL_HEIGHT });
  const events: PresentEvent[] = [];
  const drain = game.drainEvents.bind(game);
  game.drainEvents = () => {
    const next = drain();
    events.push(...next.filter(e => ['launch.start', 'launch.contact', 'launch.end', 'actor.hit', 'actor.die'].includes(e.kind)));
    if (events.length > 48) events.splice(0, events.length - 48);
    return next;
  };
  // No save callback: this battle never reads or writes the ordinary campaign's browser save.
  const shell = await Shell.create({ renderer, game, seed, speed: 1 });
  window.__shell = shell;

  const controls = document.createElement('nav');
  controls.id = 'battle-controls';
  controls.setAttribute('aria-label', '战斗控制');
  controls.innerHTML = '<span>移动鼠标瞄准 · 左键松开发射</span><button type="button" id="battle-restart" title="R：重开本场">重开本场</button><button type="button" id="battle-fullscreen" title="F：切换全屏">全屏</button>';
  document.body.append(controls);
  for (const event of ['pointerdown', 'pointerup', 'click']) controls.addEventListener(event, e => e.stopPropagation());
  const restart = (): void => location.reload();
  const fullscreen = async (): Promise<void> => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
    renderer.resize();
  };
  controls.querySelector('#battle-restart')!.addEventListener('click', restart);
  controls.querySelector('#battle-fullscreen')!.addEventListener('click', () => { void fullscreen().catch(() => {}); });
  window.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyR') restart();
    if (e.code === 'KeyF') { e.preventDefault(); void fullscreen().catch(() => {}); }
  });
  window.addEventListener('resize', () => renderer.resize());
  document.addEventListener('fullscreenchange', () => renderer.resize());

  let manual = false;
  let ended = false;
  let lastRoom = game.view;
  const finish = (): void => {
    if (ended) return;
    ended = true;
    const alive = lastRoom.field.filter(a => (a.kind === 'enemy' || a.kind === 'boss') && a.hp > 0);
    const title = lastRoom.hero?.dead || game.view.hero?.dead || (game.view.hero?.hp ?? 1) <= 0
      ? '本场战斗结束' : alive.length === 0 ? '战斗完成' : '已退出本场战斗';
    const panel = document.createElement('section');
    panel.id = 'battle-result';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', title);
    panel.innerHTML = `<div><h1>${title}</h1><p>点击下方按钮，再次挑战这个房间。</p><button type="button">重新开始</button></div>`;
    panel.querySelector('button')!.addEventListener('click', restart);
    for (const event of ['pointerdown', 'pointerup', 'click']) panel.addEventListener(event, e => e.stopPropagation());
    document.body.append(panel);
  };
  const frame = (dt: number): void => {
    if (ended) return;
    if (game.view.screen === 'room') lastRoom = game.view;
    shell.frame(dt);
    renderer.render(dt);
    // This extraction ends at the room boundary; campaign navigation remains in the archived normal entry.
    if (game.view.screen !== 'room') finish();
  };
  window.advanceTime = (ms: number): void => {
    manual = true;
    const seconds = Math.max(0, Math.min(ms, 60_000)) / 1000;
    const steps = Math.max(1, Math.ceil(seconds * 60));
    for (let i = 0; i < steps; i++) frame(seconds / steps);
  };
  window.render_game_to_text = () => {
    const v = game.view;
    return JSON.stringify({
      mode: ended ? 'battle-ended' : 'battle', seed,
      coordinates: 'world uu: x/y on the floor, z is height; view is oblique, use screen projection for mouse coordinates',
      source: getBattleBootstrapSummary(game),
      screen: v.screen, phase: v.phase, inputOpen: v.inputOpen, modal: v.modal?.kind ?? null,
      page: shell.stats.page, turn: v.run?.turn, time: v.time,
      player: v.hero && { id: v.hero.id, name: v.hero.row, position: v.hero.position, hp: v.hero.hp, maxHp: v.hero.maxHp, stamina: v.hero.stamina, armor: v.hero.armor, statuses: v.hero.statuses, skills: v.hero.skills },
      enemies: v.field.filter(a => a.kind === 'enemy' || a.kind === 'boss').map(a => ({ id: a.id, name: a.row, position: a.position, hp: a.hp, maxHp: a.maxHp, hidden: a.hidden, intent: a.intent })),
      equipment: v.inventory.equip.map(c => ({ id: c.id, name: c.row })),
      launch: v.launch ? { startedAt: v.launch.startedAt } : null,
      legal: game.legal().map(c => c.type), recentEvents: events,
    });
  };
  let previous = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(Math.max((now - previous) / 1000, 0), 0.1);
    previous = now;
    if (!manual) frame(dt);
    requestAnimationFrame(loop);
  };
  frame(0);
  requestAnimationFrame(loop);
}

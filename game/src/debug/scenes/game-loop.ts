import { createFakeGame } from '../../../tests/game-shell/fake-view';
import type { Command, Game } from '../../game/api';
import { composeGame } from '../../game/compose';
import { Shell } from '../../game/loop';
import { defineScene, type SceneContext } from '../types';

/**
 * The whole browser game for tools and the bot in the browser:
 * `?scene=game-loop&bot=<scripted|random>&seed=&speed=&stop=<screen or modal kind>&floors=<n>&fake=1`.
 * `fake=1` drives the shell with the fake game of tests/game-shell (every screen and modal, no Demo rules);
 * `floors` maps to `GameOptions.debug.floors`; `stop` halts the bot on `title`, `heroSelect`, `map`, `room`,
 * `runEnd` or a modal kind (`multiChoice`, `loot`, `panel`, `warning`, `runEnd`), `:n` for the n-th arrival;
 * `then=<command type>` sends one parameterless command there (`then=menu.open` for the pause dialog); `cues=1`
 * shows the shell's stats and the Demo asset paths no cue handler takes.
 * Without `fake=1` it runs the real core (`composeGame`: the content registry, filter 'ported', prologue skipped).
 * `window.__shell` exposes the shell's stats (screen, modal, page, commands sent and rejected, unknown cues).
 */
declare global {
  interface Window {
    __shell?: Shell;
  }
}

let shell: Shell | null = null;
/** 2.25 s of frames after the stop: popups (2 s) and launch beats are over when the shot is taken. */
const SETTLE_FRAMES = 135;
let overlay: HTMLPreElement | null = null;

function makeGame(params: URLSearchParams, seed: number): Game {
  const floors = params.has('floors') ? Number(params.get('floors')) : undefined;
  if (params.get('fake') === '1') return createFakeGame({ floors });
  return composeGame(seed, floors === undefined ? {} : { floors });
}

async function setup(ctx: SceneContext): Promise<void> {
  const p = ctx.params;
  const bot = p.get('bot') ?? (p.has('stop') ? 'scripted' : null);
  shell = await Shell.create({
    renderer: ctx.renderer,
    game: makeGame(p, ctx.seed),
    seed: ctx.seed,
    bot,
    speed: Number(p.get('speed') ?? 1) || 1,
    stop: p.get('stop'),
  });
  window.__shell = shell;
  // with ?stop= the bot runs to its target before the first captured frame, in fixed steps
  if (p.has('stop')) {
    for (let i = 0; i < 60 * 600 && !shell.stats.stopped; i++) shell.frame(1 / 60);
    // a stop the run never reached is said on screen (and in the console), never shown as another screen's frame
    if (!shell.stats.stopped) {
      const msg = `stop=${p.get('stop')} not reached (at ${shell.stats.screen}${shell.stats.modal ? ` / ${shell.stats.modal}` : ''})`;
      console.warn(`[game-loop] ${msg}`);
      const note = document.createElement('div');
      note.textContent = msg;
      note.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);padding:8px 16px;font:20px monospace;color:#EDE6D6;background:#8C2236;z-index:10;pointer-events:none';
      document.body.append(note);
    }
    // then the presentation settles (the hero's pop-out, the trail, the popups) before the shot
    for (let i = 0; i < SETTLE_FRAMES; i++) shell.frame(1 / 60);
  }
  // ?then=menu.open sends one parameterless command at the stop (the pause dialog for its shot)
  const then = p.get('then');
  if (then) shell.send({ type: then } as Command);
  // ?cues=1: the debug overlay of Demo asset paths no cue handler takes (ARCHITECTURE §8.3)
  if (p.get('cues') === '1') {
    overlay = document.createElement('pre');
    overlay.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);margin:0;padding:4px 8px;font:11px/1.3 monospace;color:#EDE6D6;background:#0B0912cc;z-index:9;pointer-events:none';
    document.body.append(overlay);
  }
}

function update(_ctx: SceneContext, dt: number): void {
  if (!shell) return;
  shell.frame(dt);
  if (overlay) {
    const s = shell.stats;
    const unknown = Object.entries(s.unknownCues).map(([k, n]) => `${n}× ${k}`);
    overlay.textContent = [`${s.screen}${s.modal ? ` / ${s.modal}` : ''}  sent ${s.sent}  rejected ${s.rejected}`, ...(s.lastReject ? [s.lastReject] : []), ...(unknown.length ? ['unknown cues:', ...unknown] : [])].join('\n');
  }
}

export default defineScene({
  name: 'game-loop',
  description: 'the browser game: shell, HUD, pages, room and bot autoplay (fake=1 drives it with the fake game)',
  setup,
  update,
});

import { createRenderer } from '../render/api';
import { INTERNAL_HEIGHT } from '../render/density';
import type { Game } from './api';
import { composeGame } from './compose';
import { Shell } from './loop';
import{readSave,persistSave}from'./storage';

/**
 * `startGame(canvas, options)`: the browser game (ARCHITECTURE §8.1): the renderer, the shell (HUD, pages, input,
 * the frame loop) and the game. `src/main.ts` calls it when the page has no `?scene=` (a need of this card).
 */
export interface StartOptions {
  seed?: number;
  /** Builds the game (default: `composeGame`, the real core with the content registry). */
  createGame?: (seed: number) => Game;
  bot?: string | null;
  speed?: number;
}

export async function startGame(canvas: HTMLCanvasElement, options: StartOptions): Promise<Shell> {
  const seed = options.seed ?? 1;
  const renderer = createRenderer(canvas, { internalHeight: INTERNAL_HEIGHT });
  const debug=new URLSearchParams(location.search).get('skipPrologue')==='1'?{skipPrologue:true}:{};
  const game=options.createGame?options.createGame(seed):composeGame(seed,debug,readSave(localStorage));
  const shell = await Shell.create({ renderer, game, seed, bot: options.bot ?? null, speed: options.speed,
    onSave:options.createGame?undefined:()=>persistSave(localStorage,game.save()) });
  // The ordinary entry route can expose the existing tool inspection handle without switching to a debug scene.
  if (new URLSearchParams(location.search).has('inspect')) window.__shell = shell;
  window.addEventListener('resize', () => renderer.resize());
  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    shell.frame(dt);
    renderer.render(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(now => {
    last = now;
    loop(now);
  });
  return shell;
}

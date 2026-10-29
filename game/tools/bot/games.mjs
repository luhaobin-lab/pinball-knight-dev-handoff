// Game factories for the bot: the real core (src/core/api/game.ts + the content registry) or the fake game.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REAL_GAME = new URL('../../src/core/api/game.ts', import.meta.url);
const REAL_CONTENT = new URL('../../src/content/bp/index.ts', import.meta.url);

/** @returns {Promise<(options: object) => object>} */
export async function loadFactory(kind) {
  if (kind === 'fake') {
    const { createFakeGame } = await import('./fake-game.mjs');
    return options => createFakeGame(options);
  }
  if (kind !== 'real') throw new Error(`--game must be real or fake, got "${kind}"`);
  for (const url of [REAL_GAME, REAL_CONTENT]) {
    if (!existsSync(fileURLToPath(url))) throw new Error(`${fileURLToPath(url)} does not exist yet (wa/contracts not merged?); use --game fake`);
  }
  const [{ createGame }, { registry }] = await Promise.all([import(REAL_GAME.href), import(REAL_CONTENT.href)]);
  if (typeof createGame !== 'function') throw new Error('src/core/api/game.ts does not export createGame');
  return options => createGame({ ...options, content: registry });
}

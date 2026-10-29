import { registry } from '../content/bp/index.ts';
import { createGame, type Game, type GameOptions,type SaveBlob } from './api';

/**
 * The composition root's game (ARCHITECTURE §3.1): `createGame` with the content registry, the `'ported'` filter of
 * restored content. New players follow the original prologue gate; debug callers may explicitly skip it.
 */
export function composeGame(seed: number, debug: GameOptions['debug'] = {},save?:SaveBlob): Game {
  return createGame({ seed, content: registry, filter: 'ported', save,debug });
}

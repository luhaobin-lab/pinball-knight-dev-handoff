import type { BotGame, BotGameOptions } from '../../src/bot/api.ts';

export declare const FAKE_SEEDS: Readonly<{ crashSeed: number; softlockSeed: number; flakySeed: number }>;
export declare function createFakeGame(options?: Partial<BotGameOptions>, seeds?: { crashSeed: number; softlockSeed: number; flakySeed: number }): BotGame;

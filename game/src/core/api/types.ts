/**
 * The game API (ARCHITECTURE §6, Appendix A.8 with WAVE_A §3.4): options, the Game object, saves and coverage.
 * The composition root (src/game/app.ts, tools/bot) imports src/core/api and src/content/bp/index.ts and passes the
 * class registry into createGame. Contract file of core-contracts.
 */
import type { LaunchPreview } from '../launch/index.ts';
import type { ContentRegistry } from '../sim/types.ts';
import type { Command, CommandResult, CommandSpec } from './commands.ts';
import type { PresentEvent } from './events.ts';
import type { GameView, SkillPreview } from './view.ts';

export interface GameDebugOptions {
  /** Floors per chapter (review clips only). */
  floors?: number;
  chapter?: string;
  hero?: string;
  /** Sets the save flag 新手关过？ so 新的冒险 shows. */
  skipPrologue?: boolean;
  unlockAllHeroes?: boolean;
  forceItems?: string[];
  forceTalents?: string[];
  forceEnemies?: string[];
}

export interface GameOptions {
  seed: number;
  content: ContentRegistry;
  save?: SaveBlob;
  /** Unported code throws instead of returning neutral values. */
  strict?: boolean;
  /** 'ported' (G2): pools skip rows whose classes are not all registered. Default 'all'. */
  filter?: 'ported' | 'all';
  debug?: GameDebugOptions;
}

/** Save v0 (core-run): meta and run fields of EMS_基础存档 plus the RNG state, as JSON-safe data. */
export interface SaveBlob {
  readonly version: number;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly run: Readonly<Record<string, unknown>> | null;
}

export interface CoverageReport {
  /** Classes actually spawned (including manifest stubs), with hit counts; registration alone is not a hit. */
  readonly classesHit: Readonly<Record<string, number>>;
  /** Facade functions without implementation that ran, with hit counts. */
  readonly unported: Readonly<Record<string, number>>;
  /** Classes that ran as manifest stubs, with hit counts. */
  readonly stubs: Readonly<Record<string, number>>;
}

export interface Game {
  readonly view: GameView;
  legal(): readonly CommandSpec[];
  send(cmd: Command): CommandResult;
  /** Game seconds (the shell applies dilation). */
  advance(dt: number): void;
  /** Bot: run the scheduler until the core needs input / is idle / the run ended / timed out. */
  runUntilInput(maxSeconds?: number): 'input' | 'idle' | 'ended' | 'timeout';
  /** The launch preview from the current state; phase 2 only; never draws randomness. */
  preview(aim: { x: number; y: number }): LaunchPreview | null;
  previewSkill?(aim: { x: number; y: number }): SkillPreview | null;
  drainEvents(): PresentEvent[];
  save(): SaveBlob;
  digest(): string;
  readonly coverage: CoverageReport;
}

export type { Command, CommandResult, CommandSpec, GameView, PresentEvent };

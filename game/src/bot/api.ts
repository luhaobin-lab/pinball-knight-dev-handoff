/**
 * The part of the game API (studio/ARCHITECTURE.md Appendix A.8 with WAVE_A §3) the bot reads, as structural types,
 * so a `Game` from `src/core/api` and the fake game of `tools/bot/fake-game.mjs` both satisfy it. Everything the bot
 * reads from the view is optional: the bot tolerates screens and slices that do not exist yet.
 */

export type BotScreen = 'title' | 'heroSelect' | 'map' | 'room' | 'runEnd';

export interface BotCommand {
  readonly type: string;
  readonly [param: string]: unknown;
}

/** `CommandSpec`: a command type the current state accepts, with the values each parameter may take. */
export interface BotSpec {
  readonly type: string;
  readonly params?: Readonly<Record<string, readonly (string | number)[]>>;
}

export interface BotResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export type BotStop = 'input' | 'idle' | 'ended' | 'timeout';

export interface BotModal {
  readonly kind: string;
  readonly source?: string;
  readonly options?: readonly unknown[];
  readonly canSkip?: boolean;
  readonly canTakeAll?: boolean;
  readonly result?: string;
  readonly score?: number;
  readonly demoComplete?: boolean;
  readonly type?: number | string;
  /** Source warning labels disambiguate save/quit from reset/resume (all can use button0). */
  readonly buttons?: readonly string[];
}

/** The view fields the bot's policies, detectors and metrics read. */
export interface BotView {
  readonly screen: string;
  readonly phase?: number | string;
  readonly inputOpen?: boolean;
  readonly modal?: BotModal | null;
  readonly run?: object | null;
  readonly hero?: object | null;
  readonly field?: readonly object[];
  readonly map?: object | null;
  readonly heroSelect?: { readonly picked: string | null } | null;
  readonly inventory?: object;
  readonly time: number;
}

/** A preview leg as `src/core/launch` builds it (`PreviewCircle`): only what the scripted aim score reads. */
export interface BotPreviewLeg {
  readonly marker?: string;
  readonly length: number;
  readonly hit?: { readonly actor?: { readonly id?: string | number } | null } | null;
  readonly end?: { readonly x: number; readonly y: number };
}

export interface BotPreview {
  readonly legs: readonly BotPreviewLeg[];
}

/** `CoverageReport` (facade functions without implementation that ran, classes that ran as manifest stubs). */
export interface BotCoverage {
  readonly unported?: Readonly<Record<string, number>>;
  readonly stubs?: Readonly<Record<string, number>>;
  /** Classes that ran (not in the contract yet; the fake game reports it). */
  readonly classesHit?: Readonly<Record<string, number>>;
}

export interface BotGame {
  readonly view: BotView;
  legal(): readonly BotSpec[];
  send(cmd: BotCommand): BotResult;
  advance(dt: number): void;
  runUntilInput(maxSeconds?: number): BotStop;
  preview?(aim: { x: number; y: number }): BotPreview | null;
  digest(): string;
  readonly coverage?: BotCoverage;
}

/** `GameOptions` as far as the bot sets them. */
export interface BotGameOptions {
  readonly seed: number;
  readonly strict?: boolean;
  readonly filter?: 'ported' | 'all';
  readonly debug?: {
    readonly floors?: number;
    readonly hero?: string;
    readonly skipPrologue?: boolean;
    readonly forceItems?: string[];
    readonly forceTalents?: string[];
    readonly forceEnemies?: string[];
  };
}

export type GameFactory = (options: BotGameOptions) => BotGame;

import { registry } from '../content/bp/index.ts';
import { scriptedPolicy } from '../bot/policies.ts';
import { botRng } from '../bot/rng.ts';
import { createGame } from '../core/api/game.ts';
import type { Command, Game } from './api.ts';

export interface BattleBootstrapSummary {
  readonly seed: number;
  readonly commandCount: number;
  readonly commands: readonly Command[];
  readonly layout: string;
  readonly floor: number;
  readonly enemyRows: readonly string[];
  readonly equippedRows: readonly string[];
  readonly bootstrapSeconds: number;
}

const summaries = new WeakMap<Game, BattleBootstrapSummary>();

/** Read-only provenance for the normal game actions used to reach this battle. */
export function getBattleBootstrapSummary(game: Game): BattleBootstrapSummary | undefined {
  return summaries.get(game);
}

/**
 * Starts a fresh real run and follows legal commands to its first playable battle.
 * The original first room contains a reward chest, not enemies. Claim its initial
 * item reward, then use the existing policy for any intervening rooms. Prefer a
 * reachable simple/ordinary battle when the generated map offers one.
 *
 * No actor, health, equipment, source-table or save data is injected. The returned
 * game is the same core used by the ordinary shell, ready for human mouse input.
 */
export function createBattleGame(seed = 1): Game {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) throw new Error('Battle seed must be a finite integer.');
  const game = createGame({ seed, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  const policy = scriptedPolicy();
  const rng = botRng(seed, 0);
  const commands: Command[] = [];

  for (let step = 0; step < 256; step++) {
    game.runUntilInput(10);
    const view = game.view;
    const legal = game.legal();
    const enemies = view.field.filter(actor =>
      (actor.kind === 'enemy' || actor.kind === 'boss') && actor.hp > 0 && !actor.hidden);
    if (view.screen === 'room' && view.phase === '交互场牌' && view.inputOpen &&
        !view.modal && !view.launch && enemies.length > 0 && legal.some(command => command.type === 'aim.release')) {
      if (!view.inventory.equip.length) throw new Error('The initial reward did not provide usable equipment.');
      summaries.set(game, Object.freeze({
        seed, commandCount: commands.length, commands: Object.freeze(commands.slice()),
        layout: view.room!.layout, floor: view.run!.floor,
        enemyRows: Object.freeze(enemies.map(actor => actor.row)),
        equippedRows: Object.freeze(view.inventory.equip.map(card => card.row)),
        bootstrapSeconds: view.time,
      }));
      // Old title/reward presentation events must not replay over the ready room.
      // The shell builds its current HUD/actors from game.view when it is created.
      game.drainEvents();
      return game;
    }

    if (view.screen === 'runEnd' || view.hero?.dead) throw new Error('The run ended before a playable battle was reached.');
    const mapEntry = legal.find(command => command.type === 'map.enter');
    const reachable = view.map?.cells.filter(cell =>
      cell.enterable && mapEntry?.params?.cell?.includes(cell.id)) ?? [];
    const next = reachable.find(cell => cell.reward === '初始奖励B') ??
      reachable.find(cell => cell.tile === '简单战斗' || cell.tile === '普通战斗');
    const command = next ? { type: 'map.enter', cell: next.id } as const :
      policy.choose({ game, legal, rng, step }) as Command | null;
    if (!command) throw new Error(`No legal startup action at ${view.screen}/${view.phase}.`);
    const result = game.send(command);
    if (!result.ok) throw new Error(`Battle startup rejected ${command.type}: ${result.reason ?? 'unknown reason'}`);
    commands.push(command);
    // Same pacing used by the browser policy. This lets loading/reward timers
    // settle before choosing the next action, without editing simulation state.
    game.advance(0.5);
  }
  throw new Error('No playable battle reached within 256 startup actions.');
}

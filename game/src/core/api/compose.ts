/**
 * The composition of the system modules (ARCHITECTURE §6.5): each module exports `commands` (handlers by command
 * type), `legal(world)` and its `view` slice; this file lists the modules once (in `MODULE_NAMES` order) and combines
 * them. `api/game.ts` only routes through these helpers. Contract file of core-contracts.
 */
import { MODULE_NAMES, type Systems } from '../bp/systems.ts';
import type { World } from '../sim/world.ts';
import type { Command, CommandOf, CommandResult, CommandSpec, CommandType } from './commands.ts';
import type { GameView } from './view.ts';

export type CommandHandlers = { readonly [K in CommandType]?: (world: World, cmd: CommandOf<K>) => CommandResult };

/** What every module may contribute besides its Demo functions. */
export interface SysModule {
  readonly commands?: CommandHandlers;
  legal?(world: World): readonly CommandSpec[];
  view?(world: World): Partial<GameView>;
}

const MODAL_COMMANDS: ReadonlySet<CommandType> = new Set<CommandType>([
  'modal.pick', 'modal.reroll', 'modal.skip', 'loot.take', 'loot.takeAll', 'loot.close', 'panel.continue', 'panel.retry', 'warning.answer', 'menu.close', 'runEnd.continue',
]);

const modules = (sys: Systems): SysModule[] => MODULE_NAMES.map(m => sys[m]);

/** The view: the base (core-sim's defaults) overlaid with each module's slice in module order. */
export function composeView(world: World, base: GameView): GameView {
  let v: GameView = base;
  for (const m of modules(world.sys)) if (m.view) v = { ...v, ...m.view(world) };
  return v;
}

/** Every module's legal commands, in module order; while a modal is open, only the modal's own commands count. */
export function composeLegal(world: World): CommandSpec[] {
  const out: CommandSpec[] = [];
  for (const m of modules(world.sys)) if (m.legal) out.push(...m.legal(world));
  return world.modal.current ? out.filter(s => MODAL_COMMANDS.has(s.type)) : out;
}

/** The handler of the first module that declares the command's type. */
export function findHandler<K extends CommandType>(sys: Systems, type: K): ((world: World, cmd: CommandOf<K>) => CommandResult) | undefined {
  for (const m of modules(sys)) {
    const h = m.commands?.[type] as ((world: World, cmd: CommandOf<K>) => CommandResult) | undefined;
    if (h) return h;
  }
  return undefined;
}

/** Routes a command: modal answers go to the open modal, everything else to its module; bad input never throws. */
export function routeCommand(world: World, cmd: Command): CommandResult {
  if (MODAL_COMMANDS.has(cmd.type) && world.modal.current && !findHandler(world.sys, cmd.type)) {
    return world.modal.answer(cmd as Parameters<World['modal']['answer']>[0]) ? { ok: true } : { ok: false, reason: 'modal refused' };
  }
  const h = findHandler(world.sys, cmd.type);
  if (!h) return { ok: false, reason: `no module handles ${cmd.type}` };
  return (h as (w: World, c: Command) => CommandResult)(world, cmd);
}

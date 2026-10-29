/**
 * createGame (ARCHITECTURE §6, Appendix A.8 with WAVE_A §3; card core-sim): the world, the boot (the game mode's
 * BeginPlay), the view composed from each module's slice, `legal()` from each module's specs, `send` routed by command
 * type, the scheduler (`advance`, `runUntilInput`), the presentation events, the digest and coverage. This file only
 * routes: the rules live in the system modules (src/core/sys/*).
 */
import type { LaunchPreview } from '../launch/index.ts';
import { modalLegal } from '../sim/modal.ts';
import { createWorld, type SimWorld } from '../sim/runtime.ts';
import type { World } from '../sim/world.ts';
import type { Command, CommandResult, CommandSpec, CommandType } from './commands.ts';
import { composeLegal, composeView, routeCommand } from './compose.ts';
import type { Game, GameOptions, SaveBlob } from './types.ts';
import type { GameView, SkillPreview } from './view.ts';
import { MODULE_NAMES } from '../bp/systems.ts';

/** An empty view on the given screen: every slice empty. */
export function baseView(screen: GameView['screen']): GameView {
  return {
    screen, phase: '进入营地', inputOpen: false, modal: null, title: null, heroSelect: null, run: null, hero: null,
    field: [], pickups: [], terrain: [], projectiles: [], room: null, map: null,
    inventory: { equip: [], backpack: [], lockedRows: [], side: [], materials: {} },
    launch: null, log: [], time: 0,
  };
}

/** Commands that are always open in some screen and so never mean "the core waits for the player". */
const AMBIENT: ReadonlySet<CommandType> = new Set<CommandType>(['menu.open', 'page.open', 'page.close', 'title.settings', 'title.quit', 'map.backpack', 'item.move', 'item.use', 'item.dismantle', 'item.enchant', 'item.extract', 'item.combine', 'item.modify']);

/** Optional module hooks beyond SysModule (see the needs of core-sim): the aim preview and the save blob. */
interface ExtraHooks {
  previewSkill?(world: World, aim: { x: number; y: number }): SkillPreview | null;
  preview?(world: World, aim: { x: number; y: number }): LaunchPreview | null;
  saveBlob?(world: World): SaveBlob;
  acceptsInput?(world: World): boolean;
  waitsForEventAction?(world: World): boolean;
  waitsForAutomaticExit?(world: World): boolean;
}

function hook<K extends keyof ExtraHooks>(world: World, k: K): NonNullable<ExtraHooks[K]> | undefined {
  for (const m of MODULE_NAMES) {
    const f = (world.sys[m] as ExtraHooks)[k];
    if (f) return f as NonNullable<ExtraHooks[K]>;
  }
  return undefined;
}

/** A spec accepts a command when every scalar parameter it lists holds one of the listed values. */
function accepts(spec: CommandSpec, cmd: Command): boolean {
  if (!spec.params) return true;
  const c = cmd as unknown as Record<string, unknown>;
  return Object.entries(spec.params).every(([k, allowed]) => {
    const v = k.split('.').reduce<unknown>((at, key) =>
      at !== null && typeof at === 'object' ? (at as Record<string, unknown>)[key] : undefined, c);
    if (cmd.type === 'map.backpack' && k === 'open' && typeof v === 'boolean') return allowed.includes(Number(v));
    return (typeof v === 'string' || typeof v === 'number') && allowed.includes(v);
  });
}

export interface GameInternals {
  readonly world: SimWorld;
}

export function createGame(o: GameOptions): Game & GameInternals {
  const world = createWorld({
    content: o.content, seed: o.seed, strict: o.strict, filter: o.filter ?? 'all',
    options: { seed: o.seed, save: o.save, debug: o.debug },
  });
  const mode = world.mode;

  // Boot: the player controller, then the game mode (its BeginPlay spawns the hero and loads the save), ticking.
  mode.玩家控制器?.ReceiveBeginPlay();
  mode.ReceiveBeginPlay();
  mode.setTickEnabled(true);

  // PROTOTYPE_SCOPE §2 (UI_营地主菜单): 序幕 always, 新的冒险 after the prologue, 继续冒险 never. Bootstrap only: shown
  // while no module (core-run) contributes the title slice and its commands.
  const prologueDone = o.debug?.skipPrologue === true || o.save?.meta['新手关过？'] === true;
  const titleFallback: GameView['title'] = { prologue: true, newRun: prologueDone, quest: null };
  const titleLegal: CommandSpec[] = [
    { type: 'title.prologue' },
    ...(prologueDone ? [{ type: 'title.newRun' } as const] : []),
    { type: 'title.settings' },
    { type: 'title.quit' },
  ];

  const view = (): GameView => {
    const base: GameView = {
      ...baseView('title'),
      title: titleFallback,
      phase: mode.当前环节,
      inputOpen: mode.玩家控制器?.玩家可与环境交互 ?? false,
      modal: world.modal.current,
      time: world.clock.now,
    };
    const v = composeView(world, base);
    return v.screen !== 'title' && v.title === titleFallback ? { ...v, title: null } : v;
  };

  const legal = (): readonly CommandSpec[] => {
    const specs = composeLegal(world);
    // The loading overlay owns input across every module, not only the title/run command handlers.
    if (hook(world, 'acceptsInput')?.(world) === false) return specs.filter(s => s.type === 'title.settings');
    const tutorial=world.sys.tutorial as typeof world.sys.tutorial&{visibleTip?(w:World):unknown};
    if(tutorial.visibleTip?.(world))return[{type:'tutorial.continue'},{type:'tutorial.close'}];
    if (!world.modal.current && !world.cult.仓库页关闭了) return specs.filter(s => s.type === 'page.close' || s.type === 'item.move');
    // Source manufacture page owns environment interaction while the inventory remains operable.
    if (!world.modal.current && (!world.cult.制造页关闭了 || !world.cult.材料页关闭了)) {
      const pageCommands = new Set(['page.open','page.close','craft.select','craft.quality','craft.put','craft.take','item.craft','item.move','item.combine']);
      return specs.filter(s => pageCommands.has(s.type));
    }
    const modal = world.modal.current;
    if (modal) {
      // The rewards module owns loot eligibility (reveal, affordability). Its close command proves ownership;
      // filling in generic loot.take from display cells would bypass those constraints when no card is eligible.
      if (modal.kind === 'loot' && specs.some(s => s.type === 'loot.close')) return specs;
      const listed = new Set(specs.map(s => s.type));
      return [...specs, ...modalLegal(modal).filter(s => !listed.has(s.type))];
    }
    if (specs.length === 0 && view().screen === 'title') return titleLegal;
    return specs;
  };

  const needsInput = (): boolean => !hook(world, 'waitsForEventAction')?.(world) && !hook(world, 'waitsForAutomaticExit')?.(world) && legal().some(s => !AMBIENT.has(s.type));

  return {
    world,
    get view() { return view(); },
    legal,
    send(cmd: Command): CommandResult {
      if (!cmd || typeof cmd !== 'object' || typeof (cmd as { type?: unknown }).type !== 'string') return { ok: false, reason: 'bad command' };
      const specs = legal().filter(s => s.type === cmd.type);
      if (specs.length === 0) return { ok: false, reason: `${cmd.type} is not accepted now` };
      if (!specs.some(s => accepts(s, cmd))) return { ok: false, reason: `${cmd.type}: parameters out of range` };
      return routeCommand(world, cmd);
    },
    advance(dt: number): void {
      if (!(dt > 0)) return;
      world.clock.advance(dt);
    },
    runUntilInput(maxSeconds = 600): 'input' | 'idle' | 'ended' | 'timeout' {
      const r = world.clock.runUntil(needsInput, maxSeconds);
      if (r === 'stopped') return view().screen === 'runEnd' ? 'ended' : 'input';
      return r;
    },
    preview(aim: { x: number; y: number }): LaunchPreview | null {
      return hook(world, 'preview')?.(world, aim) ?? null;
    },
    previewSkill(aim) { return hook(world, 'previewSkill')?.(world, aim) ?? null; },
    drainEvents: () => world.events.drain(),
    save(): SaveBlob {
      const h = hook(world, 'saveBlob');
      if (h) return h(world);
      // SPEC-GAP: save v0 is core-run's; until it lands only the meta flag the title needs is kept.
      return { version: 0, meta: { ...(o.save?.meta ?? {}), '新手关过？': prologueDone }, run: null };
    },
    digest: () => world.digest(),
    get coverage() {
      const r = world.counters.report();
      return { classesHit: r.classes, unported: r.unported, stubs: r.stubs };
    },
  };
}

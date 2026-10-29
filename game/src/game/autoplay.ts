import type { Command, CommandSpec, Game, GameView } from './api';
import { makePolicy, type PolicyName as SharedPolicyName } from '../bot/policies';
import { botRng } from '../bot/rng';
import type { BotGame, BotView } from '../bot/api';

/** Browser autoplay consumes the same public policy and policy RNG as the headless runner (ARCHITECTURE §10.5). */
export type PolicyName = 'scripted' | 'random' | 'mix';

export interface Policy {
  next(view: GameView, legal: readonly CommandSpec[]): Command | null;
  /** A temporary refusal suppresses only this exact command in this unchanged public view. */
  rejected?(view: GameView, cmd: Command): void;
}

/** Keep pre-integration fixture support without permanently disabling every command of a refused action type. */
export function skipRejected(inner: Policy): Policy {
  let state = '';
  const blocked = new Set<string>();
  const key = (cmd: Command): string => JSON.stringify(cmd);
  const sync = (view: GameView): void => {
    const current = JSON.stringify(view);
    if (current !== state) { state = current; blocked.clear(); }
  };
  return {
    next(view, legal) {
      sync(view);
      const filtered = legal.filter(s => !blocked.has(key({ type: s.type } as Command)));
      const cmd = inner.next(view, filtered);
      return cmd && !blocked.has(key(cmd)) ? cmd : null;
    },
    rejected(view, cmd) { sync(view); blocked.add(key(cmd)); inner.rejected?.(view, cmd); },
  };
}

const has = (legal: readonly CommandSpec[], type: CommandSpec['type']): CommandSpec | undefined => legal.find(s => s.type === type);

/** Same decisions/RNG for the same seed, runIndex and view as tools/bot. preview remains the core's pure query. */
export function createPolicy(name: string, seed: number, game?: Pick<Game, 'preview'>, runIndex = 0): Policy {
  const policyName: SharedPolicyName = name === 'random' || name === 'mix' ? name : 'scripted';
  const shared = makePolicy(policyName, runIndex);
  const rng = botRng(seed, runIndex);
  let step = 0;
  const policy: Policy = {
    next(view, legal) {
      const candidates = game ? legal : legal.filter(s => !['title.quit', 'title.settings', 'menu.open', 'hero.back'].includes(s.type));
      const accepted = candidates.map(s => s.type === 'interact' && !s.params?.actor
        ? { ...s, params: { ...s.params, actor: view.field.filter(a => a.kind === 'neutral').map(a => a.id) } }
        : s);
      if (accepted.length === 0) return null;
      // Old shell unit fixtures call the view-only adapter and their release consumes a direction. Production
      // always supplies Game.preview and follows the absolute-point API, including the full hero position.
      const sampled: BotView = game ? view : { ...view, hero: view.hero ? { ...view.hero, position: undefined } : null };
      const query: BotGame = {
        view: sampled, legal: () => accepted,
        ...(game ? { preview: aim => game.preview(aim) } : {}),
        send: () => { throw new Error('autoplay policies may only choose commands'); },
        advance: () => { throw new Error('autoplay policies may not advance the game'); },
        runUntilInput: () => { throw new Error('autoplay policies may not advance the game'); },
        digest: () => '',
      };
      const cmd = shared.choose({ game: query, legal: accepted, rng, step });
      if (cmd) step++;
      return cmd as Command | null;
    },
  };
  // The view-only legacy fixtures can advertise unimplemented command types. The real core owns its legal list;
  // applying the old blacklist there changed headless/browser choice sequences after a temporary rejection.
  return game ? policy : skipRejected(policy);
}

/**
 * The `?stop=` target: a screen name or a modal kind, optionally `:n` for its n-th arrival (`room:2` = the second
 * room). `Stopper.reached` counts arrivals (a view that matches after one that did not).
 */
export class Stopper {
  private readonly name: string | null;
  private readonly nth: number;
  private count = 0;
  private was = false;

  constructor(stop: string | null) {
    const [name, n] = (stop ?? '').split(':');
    this.name = name || null;
    this.nth = Math.max(1, Number(n ?? 1) || 1);
  }

  reached(view: GameView): boolean {
    if (!this.name) return false;
    const now = view.modal ? view.modal.kind === this.name : view.screen === this.name;
    if (now && !this.was) this.count++;
    this.was = now;
    return now && this.count >= this.nth;
  }

  /**
   * A command that takes the run toward a stop no policy reaches on its own: the pause dialog (`warning`, type 0)
   * only opens on request, so on the map (the old warning-map path) the stop opens it with `menu.open`.
   */
  lead(view: GameView, legal: readonly CommandSpec[]): Command | null {
    if (this.name === 'warning' && !view.modal && view.screen === 'map' && has(legal, 'menu.open')) return { type: 'menu.open' };
    return null;
  }
}

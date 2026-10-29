/**
 * The system table (WAVE_A Appendix W2): one module per folder, each owned by one card. createWorld puts it on
 * `world.sys`; tests replace entries with doubles (`withSystems`). Owned by core-contracts; a new module is added by the
 * integrator.
 */
import type { Systems } from '../bp/systems.ts';
import { sim } from './sim/index.ts';
import { kernel } from './kernel/index.ts';
import { ability } from './ability/index.ts';
import { projectile } from './projectile/index.ts';
import { physics } from './physics/index.ts';
import { ai } from './ai/index.ts';
import { turn } from './turn/index.ts';
import { stamina } from './stamina/index.ts';
import { damage } from './damage/index.ts';
import { rating } from './rating/index.ts';
import { launch } from './launch/index.ts';
import { charge } from './charge/index.ts';
import { inventory } from './inventory/index.ts';
import { text } from './text/index.ts';
import { rewards } from './rewards/index.ts';
import { talents } from './talents/index.ts';
import { map } from './map/index.ts';
import { room } from './room/index.ts';
import { run } from './run/index.ts';
import { meta } from './meta/index.ts';
import { save } from './save/index.ts';
import { craft } from './craft/index.ts';
import { enchant } from './enchant/index.ts';
import { shop } from './shop/index.ts';
import { camp } from './camp/index.ts';
import { tutorial } from './tutorial/index.ts';

/** A fresh table of the real modules (modules are stateless; state lives on the world objects). */
export function createSystems(overrides: Partial<Systems> = {}): Systems {
  return { sim, kernel, ability, projectile, physics, ai, turn, stamina, damage, rating, launch, charge, inventory, text, rewards, talents, map, room, run, meta, save, craft, enchant, shop, camp, tutorial, ...overrides };
}

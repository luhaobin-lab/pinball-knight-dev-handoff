/**
 * The content registry (ARCHITECTURE §7.3): every planned batch (wave A porting cards of WAVE_A Appendix W1 and the
 * wave-B cards of WAVE_B.md §3, pre-created empty) and `registry`, the classes by their `static path`. No agent edits
 * this file; a new batch is added by the integrator. The core never imports src/content/bp: the composition root
 * passes `registry` into createGame.
 */
import type { AssetPath, BpCtor, ContentRegistry } from '../../core/sim/types.ts';
import b_core_ability from './batches/core-ability.ts';
import b_core_turn from './batches/core-turn.ts';
import b_core_damage from './batches/core-damage.ts';
import b_core_status_rating from './batches/core-status-rating.ts';
import b_core_stamina from './batches/core-stamina.ts';
import b_core_launch_sys from './batches/core-launch-sys.ts';
import b_core_ai from './batches/core-ai.ts';
import b_core_physics from './batches/core-physics.ts';
import b_core_rewards from './batches/core-rewards.ts';
import b_core_talents from './batches/core-talents.ts';
import b_core_inventory from './batches/core-inventory.ts';
import b_bp_items_1 from './batches/bp-items-1.ts';
import b_bp_items_2 from './batches/bp-items-2.ts';
import b_bp_items_3 from './batches/bp-items-3.ts';
import b_bp_items_4 from './batches/bp-items-4.ts';
import b_bp_items_5 from './batches/bp-items-5.ts';
import b_bp_items_6 from './batches/bp-items-6.ts';
import b_bp_talents_1 from './batches/bp-talents-1.ts';
import b_bp_talents_2 from './batches/bp-talents-2.ts';
import b_bp_talents_3 from './batches/bp-talents-3.ts';
import b_bp_hero_knight from './batches/bp-hero-knight.ts';
import b_bp_hero_hunter from './batches/bp-hero-hunter.ts';
import b_enemy_eyeball_ghost from './batches/enemy-eyeball-ghost.ts';
import b_enemy_crystal_brain from './batches/enemy-crystal-brain.ts';
import b_enemy_elites from './batches/enemy-elites.ts';
import b_boss_gatekeeper from './batches/boss-gatekeeper.ts';
import b_env_hazards from './batches/env-hazards.ts';
import b_core_room from './batches/core-room.ts';
import b_sys_shop_events from './batches/sys-shop-events.ts';
import b_sys_craft from './batches/sys-craft.ts';
import b_sys_enchant from './batches/sys-enchant.ts';
import b_sys_camp_meta from './batches/sys-camp-meta.ts';
import b_sys_tutorial from './batches/sys-tutorial.ts';

/** Batches by card id, in plan order (wave A, then wave B). */
export const batches: Readonly<Record<string, readonly BpCtor[]>> = {
  'core-ability': b_core_ability,
  'core-turn': b_core_turn,
  'core-damage': b_core_damage,
  'core-status-rating': b_core_status_rating,
  'core-stamina': b_core_stamina,
  'core-launch-sys': b_core_launch_sys,
  'core-ai': b_core_ai,
  'core-physics': b_core_physics,
  'core-rewards': b_core_rewards,
  'core-talents': b_core_talents,
  'core-inventory': b_core_inventory,
  'bp-items-1': b_bp_items_1,
  'bp-items-2': b_bp_items_2,
  'bp-items-3': b_bp_items_3,
  'bp-items-4': b_bp_items_4,
  'bp-items-5': b_bp_items_5,
  'bp-items-6': b_bp_items_6,
  'bp-talents-1': b_bp_talents_1,
  'bp-talents-2': b_bp_talents_2,
  'bp-talents-3': b_bp_talents_3,
  'bp-hero-knight': b_bp_hero_knight,
  'bp-hero-hunter': b_bp_hero_hunter,
  'enemy-eyeball-ghost': b_enemy_eyeball_ghost,
  'enemy-crystal-brain': b_enemy_crystal_brain,
  'enemy-elites': b_enemy_elites,
  'boss-gatekeeper': b_boss_gatekeeper,
  'env-hazards': b_env_hazards,
  'core-room': b_core_room,
  'sys-shop-events': b_sys_shop_events,
  'sys-craft': b_sys_craft,
  'sys-enchant': b_sys_enchant,
  'sys-camp-meta': b_sys_camp_meta,
  'sys-tutorial': b_sys_tutorial,
};

/** A registry over the given classes; throws on a path registered twice. */
export function createRegistry(classes: Iterable<BpCtor>): ContentRegistry {
  const byPath = new Map<AssetPath, BpCtor>();
  for (const cls of classes) {
    if (byPath.has(cls.path)) throw new Error(`content registry: ${cls.path} is registered twice`);
    byPath.set(cls.path, cls);
  }
  return { get: path => byPath.get(path), get size() { return byPath.size; }, paths: () => [...byPath.keys()] };
}

export const registry: ContentRegistry = createRegistry(Object.values(batches).flat());

import { createLaunchWorld, tilePointToUu, tilesToUu, type LaunchWorld, type SolidCircleDef } from '../core/launch/index.ts';
import type { RoomLayout } from '../procgen/architecture/layout';
import type { RoomSpec } from '../procgen/architecture/room';
import type { MobKind } from '../procgen/creatures/mobs';
import type { HeroBox } from './launch-preview';
import { demoBody, type DemoBody } from './roster';

/**
 * The reference combat room's cast (the `play` debug scene, gate G1), as data: where the congregation stands and
 * where the knight starts, in tiles of src/procgen/architecture/northstar.ts.
 * SPEC-GAP: HP pips and the attack each enemy intends (`intent`) stay the art-p placeholders until the enemy AI
 * (enemy-ai-intents) and the damage formula are ported.
 */
export const ROOM_ENEMIES: readonly { kind: MobKind; x: number; z: number; hp: number; scale?: number; intent?: number }[] = [
  { kind: 'acolyte', x: 13.3, z: 3.4, hp: 8, scale: 1.3, intent: 14 },
  { kind: 'acolyte', x: 6.2, z: 2.9, hp: 3, intent: 6 },
  { kind: 'wickling', x: 19.2, z: 2.8, hp: 2 },
  { kind: 'jelly', x: 11.2, z: 6.5, hp: 5, intent: 9 },
  { kind: 'skull', x: 18.0, z: 10.4, hp: 4, intent: 7 },
  { kind: 'skull', x: 3.6, z: 7.1, hp: 2 },
];

export const HERO_START = { x: 10.5, z: 11.6 } as const;

/**
 * The box the standing knight's sprite covers (uu from his floor point), which the aim preview leaves empty: his
 * mesh projected over every aim and his idle spans x −21.2…+23.1 px and y −59.7…+2.8 px at zoom 1 (0.375 px per
 * uu; plume, sword and shield included); the box adds the 1-px outline and a pixel of air.
 */
export const KNIGHT_BOX: HeroBox = { halfWidth: 68, up: 168, down: 14 };

/** An enemy as the launch sees it: its floor centre (tiles) and its Demo body. */
export interface RoomBody {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly body: DemoBody;
}

/** The enemies' launch bodies, ids `enemy-<index>`. */
export function roomBodies(): RoomBody[] {
  return ROOM_ENEMIES.map((e, i) => ({ id: `enemy-${i}`, x: e.x, z: e.z, body: demoBody(e.kind) }));
}

/** The room's pillars, urns and candle mound as the launch's bouncy circles (uu). */
export function roomSolids(spec: RoomSpec): SolidCircleDef[] {
  const round = [...(spec.pillars ?? []), ...(spec.urns ?? []).map(u => ({ ...u, radius: u.radius ?? 0.45 })), ...(spec.mounds ?? [])];
  return round.map((p, i) => ({ id: `solid-${i}`, ...tilePointToUu(p.x, p.z), radius: tilesToUu(p.radius) }));
}

/** The launch world: the floor cells, the round solids, and the given (living) enemies as bodies. */
export function roomWorld(layout: RoomLayout, solids: readonly SolidCircleDef[], bodies: readonly RoomBody[]): LaunchWorld {
  return createLaunchWorld({
    grid: layout,
    circles: solids,
    bodies: bodies.map(b => ({ id: b.id, ...tilePointToUu(b.x, b.z), radius: b.body.width, halfHeight: b.body.height })),
  });
}

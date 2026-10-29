import { type Vec2, vec } from '../../src/core/launch/math.ts';
import { DEFAULT_PATH_SETTINGS, type PathSettings } from '../../src/core/launch/path.ts';
import { tilesToUu } from '../../src/core/launch/units.ts';
import { createLaunchWorld, type FloorGrid, type LaunchWorld, type LaunchWorldDef, type SolidBoxDef } from '../../src/core/launch/world.ts';

/** Half-planes of the spec's ideal walls (native-trajectory §14) as huge boxes. */
const BIG = 1e6;
export const wallAtLeast = (id: string, x: number, extra: Partial<SolidBoxDef> = {}): SolidBoxDef => ({ id, minX: x, minY: -BIG, maxX: BIG, maxY: BIG, ...extra });
export const wallAtMost = (id: string, x: number, extra: Partial<SolidBoxDef> = {}): SolidBoxDef => ({ id, minX: -BIG, minY: -BIG, maxX: x, maxY: BIG, ...extra });
export const wallAboveY = (id: string, y: number): SolidBoxDef => ({ id, minX: -BIG, minY: y, maxX: BIG, maxY: BIG });
export const wallBelowY = (id: string, y: number): SolidBoxDef => ({ id, minX: -BIG, minY: -BIG, maxX: BIG, maxY: y });

export const settings = (o: Partial<PathSettings>): PathSettings => ({ ...DEFAULT_PATH_SETTINGS, ...o });
export const xs = (points: readonly { location: Vec2 }[]): number[] => points.map(p => p.location.x);

/** A floor grid from ASCII rows: '#' is wall, anything else floor. */
export function grid(rows: readonly string[]): FloorGrid {
  const width = Math.max(...rows.map(r => r.length));
  const cells = new Uint8Array(width * rows.length);
  rows.forEach((row, z) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '#') cells[z * width + x] = 1;
  });
  return { width, depth: rows.length, cells };
}

/** A rectangular room of `w` × `d` tiles inside a one-tile wall ring. */
export function boxRoom(w: number, d: number): FloorGrid {
  return grid(Array.from({ length: d + 2 }, (_, z) => (z === 0 || z === d + 1 ? '#'.repeat(w + 2) : `#${'.'.repeat(w)}#`)));
}

/** A tile point in uu. */
export const tile = (x: number, z: number): Vec2 => vec(tilesToUu(x), tilesToUu(z));

/**
 * The reference combat room of the `play` debug scene (src/procgen/architecture/northstar.ts NORTHSTAR_MAP with its
 * exits closed), its pillars, urns and candle mound as bouncy circles, and six enemies at the scene's spots.
 */
export const PLAY_MAP = [
  '########################',
  '#cc........wwwww.....cc#',
  '#..U..N....wwwww.AB....#',
  '#.~~~~.P...wwSww....C..#',
  '#.~~~~.....wewww...~~~~#',
  '#.~~~~^.~~~~.......~~~~#',
  '#.......~~~~...P...~~U~#',
  '#.......~~~~...........#',
  '####................####',
  '####.==..~~~~=..~~~~####',
  '####==...~~kk.^.~~H~####',
  '####=....~~kk...~~~~####',
  '####MM...@~~~...U~~~####',
  '####MMM.==.....==.cc####',
  '########################',
];

export const PLAY_HERO = tile(10.5, 11.6);

export function playRoom(extra: Partial<LaunchWorldDef> = {}): LaunchWorld {
  const enemies: [number, number, number][] = [[13.3, 3.4, 52], [6.2, 2.9, 40], [19.2, 2.8, 40], [11.2, 6.5, 44], [18.0, 10.4, 40], [3.6, 7.1, 40]];
  const solids: [number, number, number][] = [[7.93, 3.73, 0.6], [15.57, 6.66, 0.6], [3.95, 2.52, 0.45], [21.8, 6.14, 0.45], [16.3, 12.92, 0.45], [5.26, 13.27, 1.2]];
  return createLaunchWorld({
    grid: grid(PLAY_MAP),
    bodies: enemies.map(([x, z, r], i) => ({ id: `enemy-${i}`, ...tile(x, z), radius: r })),
    circles: solids.map(([x, z, r], i) => ({ id: `solid-${i}`, ...tile(x, z), radius: tilesToUu(r) })),
    ...extra,
  });
}

/** Demo-frame vector (X = screen up, Y = screen right) in our frame (x east, y south). */
export const demo = (x: number, y: number): Vec2 => vec(y, 0 - x);

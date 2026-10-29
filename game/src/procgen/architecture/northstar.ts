import { layoutFromAscii } from './layout';
import type { RoomSpec } from './room';

/**
 * 「节孔圣坛」 The Knothole Chancel, the North Star room shell (art bible §18.1–18.3), as a RoomSpec.
 * Positions are the bible's tile coordinates. Actors (丸子, the choir, the nun, the chariot), the bounce
 * sigil, the spikes and the Choir Loft belong to other lanes; this is the architecture and set dressing.
 */

/** §18.2 tile map. Floor marks: ~ mold, w window pool, = planks, k knothole pool, M mound, etc. */
export const NORTHSTAR_MAP = [
  '######L###ARRRRA###L####',
  '#cc........wwwww.....cc#',
  '#..U..N....wwwww.AB....#',
  '#.~~~~.P...wwSww....C..#',
  '#.~~~~.....wewww...~~~~#',
  'D.~~~~^.~~~~.......~~~~#',
  'D.......~~~~...P...~~U~#',
  '#.......~~~~...........#',
  '####................####',
  '####.==..~~~~=..~~~~####',
  '####==...~~kk.^.~~H~####',
  '####=....~~kk...~~~~####',
  '####MM...@~~~...U~~~####',
  '####MMM.==.....==.cc####',
  '########################',
] as const;

/** Where the North Star room sits at 640×360 (§18.1): x_s = 16·x + 187, y_s = 16·(z − 0.625·h) + 76. */
export const NORTHSTAR_SCREEN = { ox: 187, oy: 76 } as const;

export function northstarSpec(seed: number | string = 'ns-1'): RoomSpec {
  // Row 0 marks the north wall's lancets (L), apse (A) and rose (R); the 'D' cells are the west exit,
  // built as a gill curtain. All of them are wall cells.
  const layout = layoutFromAscii(NORTHSTAR_MAP.map((r, z) => (z === 0 ? '#'.repeat(r.length) : r.replace(/D/g, '#'))));
  return {
    layout,
    seed,
    northHeight: 2,
    lowHeight: 0.5,
    bays: [{ x0: 10, x1: 16, height: 3.5 }],
    windows: [
      { kind: 'rose', x: 13, y: 1.95, w: 2.75, h: 2.75, petals: 12, intensity: 1.1 },
      { kind: 'lancet', x: 6.5, y: 1.05, w: 0.55, h: 1.5, intensity: 0.85 },
      { kind: 'lancet', x: 19.5, y: 1.05, w: 0.55, h: 1.5, intensity: 0.85 },
    ],
    exits: [{ facing: 'west', line: 1, from: 5, to: 7 }],
    knotholes: [{ x: 12, z: 10.8, radius: 1.25, intensity: 0.85 }],
    sigils: [{ x: 13.5, z: 3.5, radius: 3.5, gills: 36 }],
    pillars: [
      { x: 7.93, z: 3.73, radius: 0.6 },
      { x: 15.57, z: 6.66, radius: 0.6 },
    ],
    mounds: [{ x: 5.26, z: 13.27, radius: 1.2, candles: 30, lit: 0.4, offering: true }],
    urns: [
      { x: 3.95, z: 2.52, radius: 0.45 },
      { x: 21.8, z: 6.14, radius: 0.45 },
      { x: 16.3, z: 12.92, radius: 0.45 },
    ],
    candles: [
      { x: 1.5, z: 1.2, count: 6, radius: 0.34, lit: 0.6 },
      { x: 21.5, z: 1.2, count: 6, radius: 0.34, lit: 0.6 },
      { x: 18.6, z: 13.35, count: 5, radius: 0.3, lit: 0.6 },
    ],
    fungi: [
      { x: 3.5, z: 1.15, count: 6, species: 'mycena', scale: 1.1, away: Math.PI / 2 },
      { x: 8.1, z: 1.15, count: 5, species: 'mycena', scale: 1, away: Math.PI / 2 },
      { x: 17.5, z: 1.15, count: 6, species: 'mycena', scale: 1.1, away: Math.PI / 2 },
      { x: 2.4, z: 7.5, count: 5, species: 'violet', scale: 1.3 },
      { x: 10.4, z: 12.6, count: 4, species: 'mycena', scale: 1.2 },
      { x: 19.3, z: 9.4, count: 4, species: 'foxfire', scale: 1.1 },
    ],
    mold: [
      { x: 3.5, z: 4.2, rx: 2.2, rz: 1.6 },
      { x: 9.9, z: 6.1, rx: 2.0, rz: 1.3 },
      { x: 10.6, z: 10.6, rx: 1.9, rz: 1.8 },
      { x: 17.9, z: 10.6, rx: 2.0, rz: 1.8 },
      { x: 20.6, z: 5.0, rx: 1.8, rz: 1.3 },
    ],
    // §18.2: fallen coffin planks laid diagonally over grave soil in the bottom hall (about 30% of the floor)
    plankRegions: [{ x: 4, z: 9, w: 16, d: 5, angle: -0.72, gaps: 0.1 }],
    planks: [{ x: 9.3, z: 8.45, length: 2.4, angle: 0.12, rot: 0.8 }],
    maxLights: 40,
    // keep the hero spot, the rest point and the enemy spots clear of automatic floor dressing
    clear: [
      { x: 8, z: 11, w: 3, d: 3 },
      { x: 11, z: 2, w: 5, d: 4 },
      { x: 16, z: 1, w: 6, d: 3 },
      { x: 5, z: 1, w: 3, d: 3 },
      { x: 17, z: 9, w: 3, d: 3 },
    ],
  };
}

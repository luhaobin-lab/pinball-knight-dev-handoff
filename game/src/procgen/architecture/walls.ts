import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { corners, isFloor, wallCells, wallRuns, type RoomLayout, type WallCell } from './layout';
import { tint, type Kit } from './kit';
import { JEWELS } from './palette';
import { boxMatrix, lathe, PRIM, trs, tube } from './mesh';

/**
 * Walls (art bible §13.2 wall heights, §3 pillar "gothic grown from living things"):
 * - north walls (floor to their south) are the tall back walls: coffin side boards in a recessed face, a
 *   plinth, mushroom-stem pilasters with glowing lamp-shade capitals, an arcade of bent stems, bone
 *   ribcages and skull niches in the bays, a chitin cornice, elytra windows, piers and finials;
 * - every other wall is low (0.5 t) and cut away: south walls are inset by k·h so their tops never hide a
 *   floor pixel in the oblique view (§13.1, k = 0.625).
 * Nothing protrudes past the floor edge, so the visible wall line is the collision line.
 */

export const K_OBLIQUE = 0.625;
/** How far the board face of north walls sits behind the collision line. */
const RECESS = 0.16;
const PLINTH = 0.22;

export interface BaySpec {
  /** North-wall cells with x0 <= x < x1 use `height` (set-piece bays such as an apse). */
  readonly x0: number;
  readonly x1: number;
  readonly height: number;
}

export type WindowKind = 'lancet' | 'rose';

export interface WindowSpec {
  readonly kind: WindowKind;
  /** Centre x in tiles. */
  readonly x: number;
  /** Centre height in tiles. */
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Face line (z of the north edge it sits in); default: the northmost north run containing x. */
  readonly line?: number;
  readonly petals?: 12 | 16;
  /** Light pool strength (default 1). */
  readonly intensity?: number;
}

export interface WallSpec {
  /** Height of standard north walls (1.5 t standard rooms, 2 t showcase; art bible §13.2). */
  readonly northHeight?: number;
  readonly lowHeight?: number;
  readonly bays?: readonly BaySpec[];
  /** Explicit windows, or 'auto' (a lancet in roughly every third bay of long north runs). */
  readonly windows?: readonly WindowSpec[] | 'auto';
  /** Target pilaster spacing in tiles (default 4). */
  readonly bayWidth?: number;
  /** Wall cells left open (doorways; see exits.ts). */
  readonly openings?: readonly (readonly [number, number])[];
}

/** A glazed opening that lets the god light in: the descriptor the GI / atmos lanes need for gobos and shafts. */
export interface WindowLight {
  readonly kind: 'lancet' | 'rose' | 'roundel';
  /** Centre of the glass in world tiles. */
  readonly centre: THREE.Vector3;
  /** Unit axes of the glass plane (window-local +x and +y). */
  readonly right: THREE.Vector3;
  readonly up: THREE.Vector3;
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly petals: number;
  readonly seed: number;
  /** Unit direction from the floor toward the light through this window. */
  readonly lightDir: THREE.Vector3;
  readonly intensity: number;
}

/** A bay of a north face, for dressing (niches, ribcages, candles, roots). */
export interface Bay {
  readonly x0: number;
  readonly x1: number;
  /** Face line z. */
  readonly line: number;
  readonly height: number;
  readonly window: WindowSpec | null;
}

/** The walkable-looking top of a wall cell (for candles, bones, mold, the Choir Loft). */
export interface WallTop {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly kind: WallCell['kind'];
}

export interface WallResult {
  readonly windows: WindowLight[];
  readonly bays: Bay[];
  readonly tops: WallTop[];
  readonly pilasters: { x: number; line: number; height: number }[];
  /** Highest point of the wall geometry (for framing). */
  readonly maxHeight: number;
}

const GOD_ELEVATION = THREE.MathUtils.degToRad(42);
const GOD_AZIMUTH = THREE.MathUtils.degToRad(-15);

/** Direction toward the god light: from the north, 42° up, 15° west of north (art bible §9.6). */
export function godLightDir(elevation = GOD_ELEVATION, azimuth = GOD_AZIMUTH): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation)).normalize();
}

export function buildWalls(kit: Kit, layout: RoomLayout, spec: WallSpec): WallResult {
  const rng = kit.rng.derive('walls');
  const northH = spec.northHeight ?? 2;
  const lowH = spec.lowHeight ?? 0.5;
  const bays = spec.bays ?? [];
  const open = new Set((spec.openings ?? []).map(([x, z]) => `${x},${z}`));
  const cells = wallCells(layout).filter(c => !open.has(`${c.x},${c.z}`));
  const byKey = new Map(cells.map(c => [`${c.x},${c.z}`, c]));
  const cellAt = (x: number, z: number): WallCell | undefined => byKey.get(`${x},${z}`);
  const northHeightAt = (x: number): number => bays.find(b => x >= b.x0 && x < b.x1)?.height ?? northH;
  const heightOf = (c: WallCell): number => {
    if (c.kind === 'north') return northHeightAt(c.x);
    if (c.kind === 'corner' || c.kind === 'side') {
      const e = cellAt(c.x + 1, c.z);
      const w = cellAt(c.x - 1, c.z);
      if (!c.floorS && ((e && e.kind === 'north') || (w && w.kind === 'north'))) return Math.max(e?.kind === 'north' ? northHeightAt(e.x) : 0, w?.kind === 'north' ? northHeightAt(w.x) : 0);
    }
    return lowH;
  };

  const tops: WallTop[] = [];
  let maxHeight = lowH;
  for (const c of cells) {
    const h = heightOf(c);
    maxHeight = Math.max(maxHeight, h);
    const tall = h > lowH + 0.01;
    // South-wall cells (floor to the north) are inset by k·h on that side: their top starts exactly
    // where the floor ends on screen, so the front wall never hides a floor pixel.
    const inset = c.floorN && !tall ? K_OBLIQUE * h : 0;
    const z0 = c.z + inset;
    const z1 = c.kind === 'north' ? c.z + 1 - RECESS : c.z + 1;
    kit.batch('board').add(PRIM.box(), boxMatrix(c.x, 0, z0, c.x + 1, h - 0.1, z1), tint(rng, 0.06, 0.03), [1, h - 0.1, rng.next() * 10, 0.4]);
    if (inset > 0) {
      // the gutter in front of an inset wall: visible only from the iso camera
      kit.batch('mold').add(PRIM.box(), boxMatrix(c.x, -0.04, c.z, c.x + 1, 0.01, z0), tint(rng, 0.05), [2, 0, 0, 0]);
    }
    coping(kit, rng, c.x, z0, c.x + 1, c.z + 1, h, tall, {
      south: c.floorS || !cellAt(c.x, c.z + 1) || heightOf(cellAt(c.x, c.z + 1)!) < h - 0.01,
      east: c.floorE,
      west: c.floorW,
    });
    tops.push({ x: c.x + 0.5, z: (z0 + c.z + 1) / 2, y: h + 0.02, kind: c.kind });
    if (!tall && !c.floorN && c.kind !== 'north') lowFace(kit, rng, c, h, layout);
    if (c.floorN && !tall) southFace(kit, rng, c.x, c.z + 1, h);
  }

  const windows: WindowLight[] = [];
  const allBays: Bay[] = [];
  const pilasters: WallResult['pilasters'] = [];
  const runs = wallRuns(layout).filter(r => r.facing === 'north');
  const specs = spec.windows === 'auto' || spec.windows === undefined ? autoWindows(runs, northHeightAt, rng) : spec.windows;
  const lineOf = (w: WindowSpec): number => w.line ?? Math.min(...runs.filter(r => w.x >= r.from && w.x <= r.to).map(r => r.line));
  for (const run of runs) {
    const runWindows = specs.filter(w => lineOf(w) === run.line && w.x >= run.from && w.x <= run.to);
    const result = northFace(kit, rng, run.line, run.from, run.to, northHeightAt, runWindows, spec.bayWidth ?? 3);
    allBays.push(...result.bays);
    pilasters.push(...result.pilasters);
    for (const w of runWindows) windows.push(buildWindow(kit, rng, w, run.line));
  }

  // Piers and finials where north walls end at a convex corner of the room.
  for (const c of corners(layout)) {
    if (c.kind !== 'outer' || c.dz !== 1) continue;
    const cx = c.dx === 1 ? c.x - 1 : c.x;
    const cell = cellAt(cx, c.z - 1);
    if (!cell) continue;
    const h = heightOf(cell);
    if (h <= lowH + 0.01) continue;
    cornerPier(kit, rng, cx, c.z - 1, h);
    maxHeight = Math.max(maxHeight, h + 0.9);
  }
  return { windows, bays: allBays, tops, pilasters, maxHeight };
}

/**
 * The wall cap: a full-depth wooden coping, bone mouldings along the edges that face the floor or the
 * camera (the crisp light line that outlines the room, like the Demo's wall bands) and a velvet mold
 * carpet on top (mold kind 3: coverage from noise, glowing frontier).
 */
function coping(kit: Kit, rng: Rng, x0: number, z0: number, x1: number, z1: number, h: number, tall: boolean, edges: { south: boolean; east: boolean; west: boolean }): void {
  kit.batch('board').add(PRIM.box(), boxMatrix(x0, h - 0.1, z0, x1, h, z1), tint(rng, 0.05, 0.03, 0xd8d0d0), [x1 - x0, z1 - z0, rng.next() * 10, 0.7]);
  const bone = tint(rng, 0.04, 0.02, 0xd8d0c8);
  if (edges.south) kit.batch('bone').add(PRIM.box(), boxMatrix(x0, h - 0.12, z1 - 0.12, x1, h + 0.025, z1 + 0.005), bone);
  if (edges.east) kit.batch('bone').add(PRIM.box(), boxMatrix(x1 - 0.1, h - 0.12, z0, x1 + 0.005, h + 0.025, z1), bone);
  if (edges.west) kit.batch('bone').add(PRIM.box(), boxMatrix(x0 - 0.005, h - 0.12, z0, x0 + 0.1, h + 0.025, z1), bone);
  const y = h + 0.012;
  kit.batch('mold').quad({ x: x0, y, z: z0 }, { x: x0, y, z: z1 }, { x: x1, y, z: z1 }, { x: x1, y, z: z0 }, tint(rng, 0.06), [3, rng.next(), tall ? 0.12 : -0.02, 0]);
}

/** The 5-px front face of a low south wall: boards with a nail row. */
function southFace(kit: Kit, rng: Rng, x: number, z: number, h: number): void {
  kit.batch('board').add(PRIM.box(), boxMatrix(x, 0.02, z - 0.04, x + 1, h - 0.12, z + 0.0), tint(rng, 0.07, 0.03), [1, h - 0.14, rng.next() * 10, 0.5]);
  if (rng.chance(0.6)) {
    const nx = x + rng.range(0.2, 0.8);
    kit.batch('iron').add(PRIM.box(), boxMatrix(nx - 0.06, h * 0.45, z - 0.01, nx + 0.06, h * 0.45 + 0.1, z + 0.02), tint(rng, 0.05));
  }
}

/** Side-wall faces only show from the iso camera: plain boards. */
function lowFace(kit: Kit, rng: Rng, c: WallCell, h: number, layout: RoomLayout): void {
  for (const [dx, floor] of [[1, c.floorE], [-1, c.floorW]] as const) {
    if (!floor) continue;
    const fx = dx === 1 ? c.x + 1 : c.x;
    if (isFloor(layout, c.x + dx, c.z)) {
      kit.batch('board').add(PRIM.box(), boxMatrix(fx - 0.03, 0.02, c.z + 0.02, fx + 0.0, h - 0.12, c.z + 0.98), tint(rng, 0.07, 0.03), [1, h - 0.14, rng.next() * 10, 0.5]);
    }
  }
}

function autoWindows(runs: { line: number; from: number; to: number }[], heightAt: (x: number) => number, rng: Rng): WindowSpec[] {
  const out: WindowSpec[] = [];
  for (const r of runs) {
    const len = r.to - r.from;
    if (len < 5) continue;
    const n = Math.max(1, Math.floor(len / 7));
    for (let i = 0; i < n; i++) {
      const x = Math.round((r.from + ((i + 0.5) * len) / n) * 2) / 2;
      const h = heightAt(Math.floor(x));
      out.push({ kind: 'lancet', x, y: h * 0.52, w: 0.55, h: Math.min(1.4, h * 0.7), line: r.line, intensity: rng.range(0.8, 1) });
    }
  }
  return out;
}

/** Lancet outline of ELYTRA_GLSL kind 0: signed inside distance of window-local p (x right, y up, ±1). */
export function lancetInside(px: number, py: number): number {
  const ys = -0.3;
  const c = 0.345;
  const R = 1.345;
  const d = py < ys ? 1 - Math.abs(px) : Math.min(R - Math.hypot(px + c, py - ys), R - Math.hypot(px - c, py - ys));
  return Math.min(d, py + 1);
}

/** True if (x, y) on the wall plane falls inside window `w` grown by `margin` tiles. */
export function inWindow(w: WindowSpec, x: number, y: number, margin: number): boolean {
  const px = (x - w.x) / (w.w / 2 + margin);
  const py = (y - w.y) / (w.h / 2 + margin);
  if (w.kind === 'rose') return Math.hypot(px, py) < 1;
  return lancetInside(px, py) > 0;
}

/**
 * Coffin side boards on one cell of a north face: horizontal courses with dark joints, staggered butt
 * joints and nail rows. Boards that cross a window are built from short segments and skip the opening,
 * keeping their grain continuous.
 */
function boards(kit: Kit, rng: Rng, x: number, fz: number, h: number, windows: readonly WindowSpec[]): void {
  const courses = Math.max(2, Math.round((h - PLINTH - 0.25) / 0.42));
  const ch = (h - PLINTH - 0.25) / courses;
  for (let k = 0; k < courses; k++) {
    const y0 = PLINTH + k * ch;
    const split = k % 2 === 0 ? 0.5 + rng.range(-0.2, 0.2) : rng.range(0.2, 0.8);
    for (const [a, b] of [[0, split], [split, 1]] as const) {
      const front = fz + 0.04 - rng.range(0, 0.015);
      const c = tint(rng, 0.08, 0.04);
      const data = [b - a, ch, rng.next() * 10, rng.range(0.2, 1)] as const;
      const yc = y0 + ch / 2;
      const hits = windows.filter(w => Math.abs(yc - w.y) < w.h / 2 + ch && x + b > w.x - w.w / 2 - 0.2 && x + a < w.x + w.w / 2 + 0.2);
      if (hits.length === 0) {
        kit.batch('board').add(PRIM.box(), boxMatrix(x + a + 0.004, y0 + 0.012, fz - 0.06, x + b - 0.004, y0 + ch - 0.012, front), c, data);
        continue;
      }
      const n = Math.max(1, Math.round((b - a) / 0.125));
      for (let i = 0; i < n; i++) {
        const s0 = a + ((b - a) * i) / n;
        const s1 = a + ((b - a) * (i + 1)) / n;
        const sx = x + (s0 + s1) / 2;
        if (hits.some(w => inWindow(w, sx, y0 + 0.012, 0.03) || inWindow(w, sx, y0 + ch - 0.012, 0.03) || inWindow(w, sx, yc, 0.03))) continue;
        const u0 = (s0 - a) / (b - a);
        const u1 = (s1 - a) / (b - a);
        kit.batch('board').add(PRIM.box(), boxMatrix(x + s0 + (i === 0 ? 0.004 : 0), y0 + 0.012, fz - 0.06, x + s1 - (i === n - 1 ? 0.004 : 0), y0 + ch - 0.012, front), c, data, (u, v) => [u0 + u * (u1 - u0), v]);
      }
    }
    if (rng.chance(0.5)) {
      const nx = x + rng.range(0.15, 0.85);
      if (!windows.some(w => inWindow(w, nx, y0 + ch * 0.45, 0.1))) {
        kit.batch('iron').add(PRIM.box(), boxMatrix(nx - 0.06, y0 + ch * 0.4, fz + 0.03, nx + 0.06, y0 + ch * 0.4 + 0.11, fz + 0.07), tint(rng, 0.06));
      }
    }
  }
}

/** Pilaster positions along a north run: corners, height changes, window flanks, then even fill. */
function pilasterStops(from: number, to: number, heightAt: (x: number) => number, windows: readonly WindowSpec[], bayWidth: number): number[] {
  const must = new Set<number>([from, to]);
  for (let x = from + 1; x < to; x++) if (heightAt(x) !== heightAt(x - 1)) must.add(x);
  for (const w of windows) {
    if (w.kind === 'lancet') {
      must.add(w.x - w.w / 2 - 0.42);
      must.add(w.x + w.w / 2 + 0.42);
    }
  }
  const stops = [...must].filter(x => x >= from && x <= to).sort((a, b) => a - b);
  const out: number[] = [stops[0]];
  for (let i = 1; i < stops.length; i++) {
    const a = out[out.length - 1];
    const b = stops[i];
    const gap = b - a;
    const hasWindow = windows.some(w => w.x > a && w.x < b);
    const n = hasWindow ? 1 : Math.max(1, Math.round(gap / bayWidth));
    for (let k = 1; k < n; k++) out.push(a + (gap * k) / n);
    if (b - out[out.length - 1] > 0.5 || i === stops.length - 1) out.push(b);
  }
  return out;
}

function northFace(
  kit: Kit,
  rng: Rng,
  line: number,
  from: number,
  to: number,
  heightAt: (x: number) => number,
  windows: readonly WindowSpec[],
  bayWidth: number,
): { bays: Bay[]; pilasters: WallResult['pilasters'] } {
  const fz = line - RECESS;
  for (let x = from; x < to; x++) {
    const h = heightAt(x);
    boards(kit, rng, x, fz, h, windows);
    // plinth: a bone base course along the collision line
    kit.batch('bone').add(PRIM.box(), boxMatrix(x, 0, line - RECESS - 0.02, x + 1, PLINTH, line), tint(rng, 0.06, 0.03, 0xb8b0ac));
    // chitin cornice: tergite segments under the coping
    for (let s = 0; s < 3; s++) {
      const sx = x + (s + 0.5) / 3;
      kit.batch('chitin').add(PRIM.cylinder(6), trs(sx, h - 0.17, line - 0.1, 0, 0, Math.PI / 2, 0.075, 0.3, 0.075), tint(rng, 0.05), [0, 0, rng.next(), 0]);
    }
  }

  const stops = pilasterStops(from, to, heightAt, windows, bayWidth);
  const bays: Bay[] = [];
  const pilasters: WallResult['pilasters'] = [];
  stops.forEach((x, i) => {
    const hl = heightAt(Math.floor(Math.max(from, x - 0.01)));
    const hr = heightAt(Math.floor(Math.min(to - 0.01, x + 0.01)));
    const end = i === 0 || i === stops.length - 1;
    const px = i === 0 ? x + 0.17 : i === stops.length - 1 ? x - 0.17 : x;
    if (hl !== hr) buttress(kit, rng, x, line, Math.max(hl, hr));
    else pilaster(kit, rng, px, line, hl, end);
    pilasters.push({ x: px, line, height: Math.max(hl, hr) });
  });
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i] + (i === 0 ? 0.34 : 0.17);
    const b = stops[i + 1] - (i + 1 === stops.length - 1 ? 0.34 : 0.17);
    if (b - a < 0.6) continue;
    const h = heightAt(Math.floor((a + b) / 2));
    const win = windows.find(w => w.x > a && w.x < b) ?? null;
    bays.push({ x0: a, x1: b, line, height: h, window: win });
    if (!win) arcade(kit, rng, a, b, line, h);
  }
  return { bays, pilasters };
}

/** A mushroom-stem pilaster: volva at the foot, an annulus ring, a glowing lamp-shade capital. */
function pilaster(kit: Kit, rng: Rng, x: number, line: number, h: number, end: boolean): void {
  const r = end ? 0.13 : 0.16;
  const z = line - 0.19;
  const top = h - 0.26;
  const bend = rng.range(-0.03, 0.03);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector3(x + Math.sin(t * Math.PI) * bend, PLINTH + t * (top - PLINTH), z));
  }
  kit.batch('stem').add(tube(pts, pts.map((_, i) => r * (1.08 - 0.12 * Math.sin((i / 6) * Math.PI))), 7), new THREE.Matrix4(), tint(rng, 0.05, 0.02), [0, 0, rng.next(), 0]);
  // volva cup at the foot
  kit.batch('stem').add(lathe([[r * 1.55, 0], [r * 1.65, 0.1], [r * 1.35, 0.2], [r * 1.05, 0.26]], 8), trs(x, PLINTH - 0.04, z), tint(rng, 0.05, 0.02, 0xe0d8d0), [0, 0, rng.next(), 0]);
  // annulus ring two thirds up
  kit.batch('stem').add(lathe([[r * 1.0, 0], [r * 1.5, 0.03], [r * 1.35, 0.07], [r * 1.0, 0.08]], 8), trs(x, PLINTH + (top - PLINTH) * 0.68, z), tint(rng, 0.04, 0.02, 0xf0e8e0), [0, 0, rng.next(), 0]);
  // capital: a small lamp-shade cap that glows from its gills
  // capital: a small lamp-shade cap that glows from its gills (kept behind the collision line)
  const capR = r * 1.6;
  kit.batch('capMycena').add(capProfile(capR, 0.12, 'lampshade', 12), trs(x, top - 0.02, line - capR - 0.01), tint(rng, 0.05), [24, 0.75, rng.next(), 0]);
}

/** Stepped buttress where the north wall changes height (apse jambs). */
function buttress(kit: Kit, rng: Rng, x: number, line: number, h: number): void {
  const w = 0.42;
  const steps = 3;
  for (let s = 0; s < steps; s++) {
    const y0 = (h * s) / steps;
    const y1 = (h * (s + 1)) / steps + 0.12;
    const back = s * 0.08;
    kit.batch('board').add(PRIM.box(), boxMatrix(x - w / 2 + back * 0.5, y0, line - 0.62, x + w / 2 - back * 0.5, y1, line - 0.02 - back), tint(rng, 0.06, 0.03, 0xc8c0c0), [w, y1 - y0, rng.next() * 10, 0.6]);
    // weathering slope: a bone drip cap on each step
    kit.batch('bone').add(PRIM.box(), trs(x, y1 - 0.02, line - 0.08 - back, -0.5, 0, 0, w - back + 0.04, 0.05, 0.16), tint(rng, 0.05, 0.02));
  }
  finial(kit, rng, x, h + 0.12, line - 0.3, 0.8);
}

/** Corner tower: a thick mushroom-stem column grown into the corner, bone bands, a glowing cap above the wall. */
function cornerPier(kit: Kit, rng: Rng, cx: number, cz: number, h: number): void {
  const x = cx + 0.5;
  const z = cz + 0.52;
  const top = h + 0.55;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector3(x + Math.sin(t * 2.2) * 0.04, t * top, z + Math.cos(t * 1.4) * 0.02));
  }
  kit.batch('stem').add(tube(pts, pts.map((_, i) => 0.36 - 0.07 * (i / 6)), 9), new THREE.Matrix4(), tint(rng, 0.04, 0.02, 0xece4dc), [0, 0, rng.next(), 0]);
  for (const y of [0.25, h * 0.55, h - 0.12]) {
    kit.batch('bone').add(lathe([[0.42, 0], [0.45, 0.05], [0.42, 0.1]].reverse() as [number, number][], 10), trs(x, y, z), tint(rng, 0.04, 0.02));
  }
  kit.batch('capViolet').add(capProfile(0.62, 0.34, 'umbonate', 20), trs(x, top - 0.06, z, rng.range(-0.08, 0.08), 0, rng.range(-0.08, 0.08)), tint(rng, 0.04), [36, 0.9, rng.next(), 0]);
  // two small caps sprouting from the column
  for (const s of [-1, 1]) {
    const y = h * rng.range(0.4, 0.75);
    kit.batch('capMycena').add(capProfile(0.16, 0.1, 'bell', 10), trs(x + s * 0.34, y, z + 0.2, 0, 0, s * 0.5), tint(rng, 0.04), [0, 0.9, rng.next(), 0]);
  }
  kit.light({ kind: 'bio', fire: false, position: { x, y: top + 0.25, z: z + 0.5 }, color: '#A96BE0', intensity: 0.38, radius: 2.2, flicker: 0 });
}

/** A pinnacle above the wall line: bone spire with a little glowing cap and a skull, or a cap cluster. */
function finial(kit: Kit, rng: Rng, x: number, y: number, z: number, scale: number): void {
  if (rng.chance(0.5)) {
    kit.batch('bone').add(PRIM.cone(0.15, 6), trs(x, y + 0.28 * scale, z, 0, rng.next(), 0, 0.14 * scale, 0.56 * scale, 0.14 * scale), tint(rng, 0.05));
    kit.batch('capMycena').add(capProfile(0.2 * scale, 0.14 * scale, 'bell', 10), trs(x, y + 0.56 * scale, z), tint(rng, 0.05), [0, 0.9, rng.next(), 0]);
  } else {
    kit.batch('stem').add(PRIM.cylinder(6), trs(x, y + 0.2 * scale, z, 0, 0, 0, 0.07 * scale, 0.4 * scale, 0.07 * scale), tint(rng, 0.05), [0, 0, rng.next(), 0]);
    kit.batch('capViolet').add(capProfile(0.26 * scale, 0.16 * scale, 'umbonate', 12), trs(x, y + 0.38 * scale, z), tint(rng, 0.05), [24, 0.8, rng.next(), 0]);
  }
}

/**
 * A tiny stone bug-gargoyle (North Star NS-NORTH): a curled-up pill bug of chitin plates crouched on a
 * pilaster capital, bead eyes glinting, peering down into the room.
 */
export function gargoyle(kit: Kit, rng: Rng, x: number, y: number, z: number): void {
  const c = tint(rng, 0.04, 0.02, 0xfff0f8);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    kit.batch('stone').add(PRIM.sphere(8, 5), trs(x, y + 0.11 + Math.sin(t * Math.PI) * 0.06, z - 0.14 + t * 0.26, 0, 0, 0, 0.16 - 0.025 * Math.abs(t - 0.5), 0.12, 0.08), c);
  }
  // head with two bead eyes and little antennae, leaning out over the edge
  kit.batch('stone').add(PRIM.sphere(8, 5), trs(x, y + 0.09, z + 0.19, 0, 0, 0, 0.11, 0.085, 0.08), c);
  for (const s of [-1, 1]) {
    kit.batch('lead').add(PRIM.sphere(5, 4), trs(x + s * 0.05, y + 0.1, z + 0.26, 0, 0, 0, 0.026, 0.03, 0.022), tint(rng, 0.02));
    kit.batch('stone').add(PRIM.cylinder(4), trs(x + s * 0.06, y + 0.17, z + 0.25, -0.6, 0, s * 0.5, 0.014, 0.14, 0.014), c);
  }
}

/**
 * A spire on the wall line (the gothic skyline above the north walls, rising into the void where it can
 * never hide gameplay): a bone spire crowned with a tiny skull, or a fibrous stem pinnacle with a glowing
 * bell cap. `h` is the spire height in tiles.
 */
export function spire(kit: Kit, rng: Rng, x: number, y: number, z: number, h: number): void {
  if (rng.chance(0.6)) {
    // stacked vertebrae tapering to a point, crowned with a cute skull
    kit.batch('bone').add(PRIM.cylinder(6), trs(x, y + 0.06, z, 0, 0, 0, 0.17, 0.12, 0.17), tint(rng, 0.04));
    const n = Math.max(3, Math.round(h / 0.22));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const r = 0.13 * (1 - t * 0.55);
      kit.batch('bone').add(PRIM.sphere(6, 4), trs(x, y + 0.14 + h * 0.78 * t, z, 0, 0, 0, r, 0.09, r), tint(rng, 0.04));
    }
    skull(kit, rng, x, y + 0.2 + h * 0.78, z + 0.02, 0.12);
  } else {
    // a fibrous stalk pinnacle under a big conical cap with glowing gills
    const pts: THREE.Vector3[] = [];
    const lean = rng.range(-0.06, 0.06);
    for (let i = 0; i <= 4; i++) pts.push(new THREE.Vector3(x + lean * (i / 4) ** 2, y + (i / 4) * h, z));
    kit.batch('stem').add(tube(pts, pts.map((_, i) => 0.11 - i * 0.012), 7), new THREE.Matrix4(), tint(rng, 0.04, 0.02), [0, 0, rng.next(), 0]);
    kit.batch(rng.chance(0.5) ? 'capMycena' : 'capViolet').add(capProfile(0.27, 0.3, 'conical', 12), trs(x + lean, y + h - 0.05, z), tint(rng, 0.04), [24, 0.9, rng.next(), 0]);
  }
}

/** A blind arcade of bent mushroom stems in one bay, with a ribcage, a skull niche or an oculus in each arch. */
function arcade(kit: Kit, rng: Rng, a: number, b: number, line: number, h: number): void {
  const z = line - RECESS + 0.05;
  const span = b - a;
  const n = Math.max(1, Math.round(span / 1.3));
  const top = h - 0.3;
  for (let i = 0; i < n; i++) {
    const x0 = a + (span * i) / n;
    const x1 = a + (span * (i + 1)) / n;
    const s = x1 - x0;
    const spring = Math.max(PLINTH + 0.12, top - Math.max(0.75 * s, 0.7));
    const rise = top - spring;
    const pts = pointedArch(x0 + 0.04, x1 - 0.04, spring, rise, z, 9);
    kit.batch('stem').add(tube(pts, pts.map((_, k) => 0.085 - 0.02 * Math.sin((k / (pts.length - 1)) * Math.PI)), 6), new THREE.Matrix4(), tint(rng, 0.05, 0.02, 0xfff8f0), [0, 0, rng.next(), 0]);
    if (rng.chance(0.5)) {
      const side = rng.chance(0.5) ? x0 + 0.06 : x1 - 0.06;
      kit.batch('capMycena').add(capProfile(0.09, 0.07, 'bell', 8), trs(side, spring + 0.12, z + 0.06, 0, 0, side < (x0 + x1) / 2 ? 0.5 : -0.5), tint(rng, 0.04), [0, 0.8, rng.next(), 0]);
    }
    // jambs: bent stems down to the plinth, with a little volva at the foot
    for (const jx of [x0 + 0.04, x1 - 0.04]) {
      kit.batch('stem').add(tube([new THREE.Vector3(jx, PLINTH, z), new THREE.Vector3(jx, spring + 0.03, z)], 0.07, 5), new THREE.Matrix4(), tint(rng, 0.05, 0.02, 0xfff4ea), [0, 0, rng.next(), 0]);
      kit.batch('stem').add(PRIM.sphere(6, 4), trs(jx, PLINTH + 0.03, z, 0, 0, 0, 0.1, 0.06, 0.08), tint(rng, 0.05, 0.02, 0xfff4ea), [0, 0, rng.next(), 0]);
    }
    // apex boss: a tiny skull keystone
    skull(kit, rng, (x0 + x1) / 2, spring + rise + 0.02, z + 0.04, 0.085);
    const cx = (x0 + x1) / 2;
    const motif = rng.next();
    if (motif < 0.45) ribcage(kit, rng, cx, PLINTH + 0.1, spring + rise * 0.55, z + 0.01, s * 0.38);
    else if (motif < 0.8) niche(kit, rng, cx, spring + rise * 0.25, z, s);
    else oculus(kit, rng, cx, spring + rise * 0.3, z, Math.min(0.32, s * 0.2));
  }
}

/** Points of a pointed arch from (x0, y) to (x1, y) rising `rise`, in the plane z. */
export function pointedArch(x0: number, x1: number, y: number, rise: number, z: number, perSide: number): THREE.Vector3[] {
  const S = x1 - x0;
  const half = S / 2;
  // centre offset of each arc from the midpoint (equilateral when rise ≈ 0.87·S); clamp to stay pointed
  const c = Math.max(0.05 * S, (rise * rise - half * half) / S);
  const R = half + c;
  const mid = (x0 + x1) / 2;
  const pts: THREE.Vector3[] = [];
  const apexAngle = Math.atan2(rise, -c);
  for (let i = 0; i <= perSide; i++) {
    const t = Math.PI - (Math.PI - apexAngle) * (i / perSide);
    pts.push(new THREE.Vector3(mid + c + R * Math.cos(t), y + Math.min(rise, R * Math.sin(t)), z));
  }
  for (let i = perSide - 1; i >= 0; i--) {
    const p = pts[i];
    pts.push(new THREE.Vector3(2 * mid - p.x, p.y, z));
  }
  return pts;
}

/** A bone ribcage on the wall: a vertebral spine and three pairs of ribs arching out and down (front view). */
function ribcage(kit: Kit, rng: Rng, x: number, y0: number, y1: number, z: number, halfW: number): void {
  const spineH = y1 - y0;
  for (let i = 0; i < 5; i++) {
    const y = y0 + (spineH * (i + 0.5)) / 5;
    kit.batch('bone').add(PRIM.sphere(6, 4), trs(x, y, z, 0, 0, 0, 0.05, 0.045, 0.04), tint(rng, 0.05));
  }
  for (let k = 0; k < 3; k++) {
    const ys = y1 - 0.06 - k * spineH * 0.24;
    const w = halfW * (0.72 + 0.28 * Math.sin(((k + 1) / 4) * Math.PI));
    const drop = spineH * (0.3 + 0.06 * k);
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 7; i++) {
        // a half ellipse leaving the spine upward, peaking, then curving down to the side
        const a = (i / 7) * Math.PI * 0.82;
        pts.push(new THREE.Vector3(x + side * w * Math.sin(a), ys + drop * 0.25 * Math.cos(a) - drop * 0.25 - drop * 0.5 * (i / 7) ** 2, z + 0.015 + 0.03 * Math.sin(a)));
      }
      kit.batch('bone').add(tube(pts, pts.map((_, i) => 0.034 - i * 0.002), 4), new THREE.Matrix4(), tint(rng, 0.05, 0.02));
    }
  }
  // a cute round skull crowns the spine
  skull(kit, rng, x, y1 + 0.06, z + 0.06, 0.13);
}

/** A recessed niche with a cute skull and a candle stub: warm light inside the arcade. */
function niche(kit: Kit, rng: Rng, x: number, y: number, z: number, span: number): void {
  const w = Math.min(0.5, span * 0.32);
  kit.batch('lead').add(PRIM.box(), boxMatrix(x - w / 2, y - 0.02, z - 0.1, x + w / 2, y + w * 1.1, z - 0.03), tint(rng, 0.04));
  kit.batch('bone').add(PRIM.box(), boxMatrix(x - w / 2 - 0.04, y - 0.06, z - 0.12, x + w / 2 + 0.04, y, z + 0.06), tint(rng, 0.05));
  skull(kit, rng, x - w * 0.12, y + 0.1, z - 0.02, 0.11);
  const cx = x + w * 0.28;
  const ch = rng.range(0.12, 0.22);
  kit.batch('wax').add(PRIM.cylinder(6), trs(cx, y + ch / 2, z - 0.02, 0, 0, 0, 0.035, ch, 0.035), tint(rng, 0.05), [0.6, 0, 0, 0]);
  kit.flames.add({ x: cx, y: y + ch + 0.01, z: z - 0.02, size: 0.32, phase: rng.next() });
  kit.light({ kind: 'candle', fire: true, position: { x: cx, y: y + ch + 0.2, z: z + 0.45 }, color: '#FFB347', intensity: 0.55, radius: 1.8, flicker: 0.35, seed: Math.floor(rng.next() * 1000) });
}

/** A small bone oculus (a round tracery ring) with a glowing gill wheel inside. */
function oculus(kit: Kit, rng: Rng, x: number, y: number, z: number, r: number): void {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push(new THREE.Vector3(x + Math.cos(a) * r, y + Math.sin(a) * r, z));
  }
  kit.batch('bone').add(tube(pts, 0.035, 4, false), new THREE.Matrix4(), tint(rng, 0.05));
  kit.batch('capMycena').add(PRIM.disc(16), trs(x, y, z - 0.03, Math.PI / 2, 0, 0, r * 0.85, 1, r * 0.85), tint(rng, 0.03), [24, 0.6, rng.next(), 0]);
}

/** Round cute skull (art bible §4 Saint Skull): round sockets, three-tooth grin. */
export function skull(kit: Kit, rng: Rng, x: number, y: number, z: number, r: number, yaw = 0): void {
  const c = tint(rng, 0.04, 0.02);
  kit.batch('bone').add(PRIM.sphere(10, 7), trs(x, y + r * 0.1, z, 0, yaw, 0, r, r * 0.92, r * 0.95), c);
  kit.batch('bone').add(PRIM.box(), trs(x, y - r * 0.62, z + r * 0.22, 0, yaw, 0, r * 1.05, r * 0.42, r * 0.9), c);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  for (const s of [-1, 1]) {
    kit.batch('lead').add(PRIM.sphere(6, 4), trs(x + s * r * 0.42 * fz + fx * r * 0.82, y + r * 0.02, z + fz * r * 0.82 - s * r * 0.42 * fx, 0, yaw, 0, r * 0.27, r * 0.3, r * 0.16), tint(rng, 0.02));
  }
  for (const s of [-1, 0, 1]) {
    kit.batch('bone').add(PRIM.box(), trs(x + s * r * 0.3 * fz + fx * r * 0.95, y - r * 0.6, z + fz * r * 0.95 - s * r * 0.3 * fx, 0, yaw, 0, r * 0.2, r * 0.26, r * 0.08), tint(rng, 0.03, 0.01, 0xfff4e8));
  }
}

export type CapShape = 'convex' | 'conical' | 'umbonate' | 'funnel' | 'bell' | 'lampshade';

/**
 * Lathe profile of a mushroom cap of radius R and height H: the top surface from the centre to the rim
 * (uv.y 0..0.6, read by the cap shader as the radial parameter) then the underside back to the stem.
 */
export function capProfile(R: number, H: number, shape: CapShape, sides: number): ReturnType<typeof lathe> {
  const top: [number, number][] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let y: number;
    switch (shape) {
      case 'conical':
        y = Math.pow(1 - t, 1.15);
        break;
      case 'umbonate':
        y = 0.72 * Math.pow(Math.max(0, 1 - t * t), 0.6) + 0.28 * Math.exp(-Math.pow(t / 0.22, 2));
        break;
      case 'funnel':
        y = 0.25 + 0.75 * Math.pow(t, 1.4) - 0.15 * Math.pow(t, 6);
        break;
      case 'bell':
        y = Math.pow(Math.cos((t * Math.PI) / 2), 0.55) - 0.25 * t * t;
        break;
      case 'lampshade':
        y = 0.75 * Math.pow(Math.max(0, 1 - Math.pow(t, 1.5)), 0.8) + 0.05;
        break;
      default:
        y = Math.pow(Math.max(0, 1 - Math.pow(t, 2.2)), 0.5);
    }
    top.push([t * R, y * H]);
  }
  const rimY = top[n - 1][1];
  const under: [number, number][] = [
    [R * 0.97, rimY - H * 0.12],
    [R * 0.7, rimY - H * 0.08 + (shape === 'funnel' ? -H * 0.15 : 0)],
    [R * 0.35, Math.min(rimY, top[3][1]) - H * 0.18],
    [R * 0.12, Math.min(rimY, top[5][1]) - H * 0.2],
  ];
  // Lathe profiles run bottom-to-top for outward normals; ours runs centre-top → rim → underside, so the
  // profile is reversed and the uv.y convention flipped back by mapping 1 - v.
  const profile = [...top, ...under].reverse();
  const prim = lathe(profile, sides);
  const uvs = new Float32Array(prim.uvs);
  for (let i = 1; i < uvs.length; i += 2) uvs[i] = 1 - uvs[i];
  return { ...prim, uvs };
}

/** Builds the glass, came and frame of a north-wall window and returns its light descriptor. */
function buildWindow(kit: Kit, rng: Rng, w: WindowSpec, line: number): WindowLight {
  // the glass sits just in front of the wall mass; the boards are cut around its shape (see boards())
  const z = line - RECESS + 0.012;
  const seed = rng.next();
  const petals = w.petals ?? 12;
  const kindCode = w.kind === 'rose' ? 1 : 0;
  kit.batch('glass').quad(
    { x: w.x - w.w / 2, y: w.y - w.h / 2, z },
    { x: w.x + w.w / 2, y: w.y - w.h / 2, z },
    { x: w.x + w.w / 2, y: w.y + w.h / 2, z },
    { x: w.x - w.w / 2, y: w.y + w.h / 2, z },
    new THREE.Color(1, 1, 1),
    [kindCode, seed, petals, 0],
  );
  if (w.kind === 'rose') roseFrame(kit, rng, w.x, w.y, z + 0.05, w.w / 2, petals);
  else lancetFrame(kit, rng, w.x, w.y, z + 0.05, w.w / 2, w.h / 2);
  // coloured wash lights: the glass glow on the wall around it and on the floor in front
  const washes: [number, string][] = w.kind === 'rose' ? [[-0.45, JEWELS[7][2]], [0.45, JEWELS[5][2]], [0, JEWELS[1][2]]] : [[0, JEWELS[rng.int(0, 7)][2]]];
  for (const [dx, color] of washes) {
    kit.light({ kind: 'window', fire: false, position: { x: w.x + dx * w.w, y: w.y * 0.75, z: line + 0.55 }, color, intensity: (w.kind === 'rose' ? 0.32 : 0.3) * (w.intensity ?? 1), radius: w.kind === 'rose' ? 2.6 : 1.9, flicker: 0 });
  }
  return {
    kind: w.kind,
    centre: new THREE.Vector3(w.x, w.y, z),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    halfWidth: w.w / 2,
    halfHeight: w.h / 2,
    petals,
    seed,
    lightDir: godLightDir(THREE.MathUtils.degToRad(w.kind === 'rose' ? 40 : 48)),
    intensity: w.intensity ?? 1,
  };
}

function lancetFrame(kit: Kit, rng: Rng, x: number, y: number, z: number, hw: number, hh: number): void {
  // the lancet outline of ELYTRA_GLSL kind 0, in world units
  const ys = -0.3;
  const c = 0.345;
  const R = 1.345;
  const pts: THREE.Vector3[] = [];
  const toW = (px: number, py: number): THREE.Vector3 => new THREE.Vector3(x + px * hw * 1.06, y + py * hh * 1.04, z);
  pts.push(toW(-1, -1), toW(-1, ys));
  const apex = Math.atan2(1 - ys, -c);
  for (let i = 1; i <= 6; i++) {
    const t = Math.PI - (Math.PI - apex) * (i / 6);
    pts.push(toW(c + R * Math.cos(t), ys + R * Math.sin(t)));
  }
  for (let i = 5; i >= 1; i--) {
    const t = Math.PI - (Math.PI - apex) * (i / 6);
    pts.push(toW(-(c + R * Math.cos(t)), ys + R * Math.sin(t)));
  }
  pts.push(toW(1, ys), toW(1, -1));
  kit.batch('bone').add(tube(pts, 0.04, 4, true), new THREE.Matrix4(), tint(rng, 0.05));
  // sill with wax drips and a tiny Mycena tuft
  kit.batch('bone').add(PRIM.box(), boxMatrix(x - hw - 0.1, y - hh - 0.07, z - 0.06, x + hw + 0.1, y - hh, z + 0.1), tint(rng, 0.05));
}

function roseFrame(kit: Kit, rng: Rng, x: number, y: number, z: number, r: number, petals: number): void {
  const ring = (radius: number, thick: number, batch: 'bone' | 'chitin', n = 32): void => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(new THREE.Vector3(x + Math.cos(a) * radius, y + Math.sin(a) * radius, z));
    }
    kit.batch(batch).add(tube(pts, thick, 5, false), new THREE.Matrix4(), tint(rng, 0.04), [0, 0, rng.next(), 0]);
  };
  ring(r * 1.04, 0.07, 'chitin', 40);
  ring(r * 1.2, 0.05, 'bone', 40);
  // petal-tip bosses around the rim: small bone knobs, one per petal
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    kit.batch('bone').add(PRIM.sphere(6, 4), trs(x + Math.cos(a) * r * 1.12, y + Math.sin(a) * r * 1.12, z + 0.02, 0, 0, 0, 0.06, 0.06, 0.05), tint(rng, 0.04));
  }
  // a gilded hood moulding above the rose
  const hood = pointedArch(x - r * 1.35, x + r * 1.35, y, r * 1.55, z + 0.02, 10);
  kit.batch('gold').add(tube(hood, 0.05, 5), new THREE.Matrix4(), tint(rng, 0.03));
}

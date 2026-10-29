/**
 * Room layouts: a grid of floor cells and its wall analysis. Pure data (no three.js), so the core map
 * generator can produce layouts and tests can check them in Node.
 *
 * Coordinates: cell (x, z) covers world [x, x+1] × [z, z+1] with x east, z south (toward the camera) and
 * y up; 1 world unit = 1 tile = 16 px. Walls occupy the non-floor cells touching the floor (8-neighbourhood),
 * one tile thick, exactly like the Demo's rooms.
 */

export interface RoomLayout {
  /** Grid size in cells, including the wall ring. */
  readonly width: number;
  readonly depth: number;
  /** 1 = floor, row-major (z * width + x). */
  readonly cells: Uint8Array;
}

export interface Rect {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
}

/**
 * What a wall cell faces. `north` walls have floor to their south: the tall back walls whose faces the
 * oblique camera sees. `south` walls have floor to their north: the low, cut-away front walls. `side` walls
 * only have floor to the east or west; `corner` cells only touch the floor diagonally.
 */
export type WallKind = 'north' | 'south' | 'side' | 'corner';

export interface WallCell {
  readonly x: number;
  readonly z: number;
  readonly kind: WallKind;
  /** Floor on each side of the cell. */
  readonly floorN: boolean;
  readonly floorS: boolean;
  readonly floorE: boolean;
  readonly floorW: boolean;
}

/** A grid vertex where the floor outline turns: `outer` = convex floor corner, `inner` = reflex (concave). */
export interface Corner {
  readonly x: number;
  readonly z: number;
  readonly kind: 'outer' | 'inner';
  /** Direction from the vertex into the floor (outer) or into the wall (inner): ±1 per axis. */
  readonly dx: -1 | 1;
  readonly dz: -1 | 1;
}

export type Facing = 'north' | 'south' | 'west' | 'east';

/**
 * A maximal straight piece of the floor outline. `facing` names the wall: a `north` run is the edge on the
 * line z = `line` with floor to its south, spanning x in [from, to].
 */
export interface WallRun {
  readonly facing: Facing;
  readonly line: number;
  readonly from: number;
  readonly to: number;
}

export function emptyLayout(width: number, depth: number): RoomLayout {
  if (!Number.isInteger(width) || !Number.isInteger(depth) || width < 3 || depth < 3) {
    throw new Error(`layout: size must be integers >= 3, got ${width}x${depth}`);
  }
  return { width, depth, cells: new Uint8Array(width * depth) };
}

export function isFloor(layout: RoomLayout, x: number, z: number): boolean {
  if (x < 0 || z < 0 || x >= layout.width || z >= layout.depth) return false;
  return layout.cells[z * layout.width + x] === 1;
}

function setRect(layout: RoomLayout, r: Rect, value: 0 | 1): void {
  for (let z = r.z; z < r.z + r.d; z++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (x <= 0 || z <= 0 || x >= layout.width - 1 || z >= layout.depth - 1) {
        throw new Error(`layout: rect ${JSON.stringify(r)} leaves no room for the wall ring`);
      }
      layout.cells[z * layout.width + x] = value;
    }
  }
}

/** Floor = union of `add` minus `cut` (notches), on a grid of the given size. */
export function layoutFromRects(width: number, depth: number, add: readonly Rect[], cut: readonly Rect[] = []): RoomLayout {
  const layout = emptyLayout(width, depth);
  for (const r of add) setRect(layout, r, 1);
  for (const r of cut) setRect(layout, r, 0);
  return layout;
}

/**
 * Parses an ASCII map: `#` and spaces are walls or void, every other character is floor (so manifests can
 * mark props on floor cells, like the North Star map in the art bible §18.2).
 */
export function layoutFromAscii(rows: readonly string[]): RoomLayout {
  const width = Math.max(...rows.map(r => r.length));
  const layout = emptyLayout(width, rows.length);
  rows.forEach((row, z) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c !== '#' && c !== ' ') layout.cells[z * width + x] = 1;
    }
  });
  return layout;
}

export function floorCount(layout: RoomLayout): number {
  let n = 0;
  for (const c of layout.cells) n += c;
  return n;
}

/** Bounding box of the floor cells (inclusive cell indices). */
export function floorBounds(layout: RoomLayout): { x0: number; z0: number; x1: number; z1: number } {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let z = 0; z < layout.depth; z++) {
    for (let x = 0; x < layout.width; x++) {
      if (!isFloor(layout, x, z)) continue;
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x);
      z1 = Math.max(z1, z);
    }
  }
  if (x0 === Infinity) throw new Error('layout: no floor cells');
  return { x0, z0, x1, z1 };
}

/** Every non-floor cell that touches the floor (8-neighbourhood), classified. */
export function wallCells(layout: RoomLayout): WallCell[] {
  const out: WallCell[] = [];
  for (let z = 0; z < layout.depth; z++) {
    for (let x = 0; x < layout.width; x++) {
      if (isFloor(layout, x, z)) continue;
      const floorN = isFloor(layout, x, z - 1);
      const floorS = isFloor(layout, x, z + 1);
      const floorE = isFloor(layout, x + 1, z);
      const floorW = isFloor(layout, x - 1, z);
      let kind: WallKind | null = null;
      if (floorS && !floorN) kind = 'north';
      else if (floorN) kind = 'south';
      else if (floorE || floorW) kind = 'side';
      else if (isFloor(layout, x - 1, z - 1) || isFloor(layout, x + 1, z - 1) || isFloor(layout, x - 1, z + 1) || isFloor(layout, x + 1, z + 1)) kind = 'corner';
      if (kind) out.push({ x, z, kind, floorN, floorS, floorE, floorW });
    }
  }
  return out;
}

/** Convex and reflex corners of the floor outline. Pinch vertices (two diagonal floor cells) yield both. */
export function corners(layout: RoomLayout): Corner[] {
  const out: Corner[] = [];
  for (let z = 1; z < layout.depth; z++) {
    for (let x = 1; x < layout.width; x++) {
      const nw = isFloor(layout, x - 1, z - 1);
      const ne = isFloor(layout, x, z - 1);
      const sw = isFloor(layout, x - 1, z);
      const se = isFloor(layout, x, z);
      const n = Number(nw) + Number(ne) + Number(sw) + Number(se);
      const quad: [boolean, -1 | 1, -1 | 1][] = [
        [nw, -1, -1],
        [ne, 1, -1],
        [sw, -1, 1],
        [se, 1, 1],
      ];
      if (n === 1) {
        const [, dx, dz] = quad.find(q => q[0])!;
        out.push({ x, z, kind: 'outer', dx, dz });
      } else if (n === 3) {
        const [, dx, dz] = quad.find(q => !q[0])!;
        out.push({ x, z, kind: 'inner', dx, dz });
      } else if (n === 2 && nw === se) {
        for (const [floor, dx, dz] of quad) if (floor) out.push({ x, z, kind: 'outer', dx, dz });
      }
    }
  }
  return out;
}

/** The floor outline as maximal straight runs, one list per facing. */
export function wallRuns(layout: RoomLayout): WallRun[] {
  const runs: WallRun[] = [];
  const scan = (facing: Facing, lines: number, span: number, edge: (line: number, i: number) => boolean): void => {
    for (let line = 0; line <= lines; line++) {
      let start = -1;
      for (let i = 0; i <= span; i++) {
        const on = i < span && edge(line, i);
        if (on && start < 0) start = i;
        if (!on && start >= 0) {
          runs.push({ facing, line, from: start, to: i });
          start = -1;
        }
      }
    }
  };
  const W = layout.width;
  const D = layout.depth;
  scan('north', D, W, (z, x) => isFloor(layout, x, z) && !isFloor(layout, x, z - 1));
  scan('south', D, W, (z, x) => isFloor(layout, x, z - 1) && !isFloor(layout, x, z));
  scan('west', W, D, (x, z) => isFloor(layout, x, z) && !isFloor(layout, x - 1, z));
  scan('east', W, D, (x, z) => isFloor(layout, x - 1, z) && !isFloor(layout, x, z));
  return runs;
}

/** Distance in tiles from the centre of floor cell (x, z) to the nearest non-floor cell edge (4-neighbour walk). */
export function wallDistance(layout: RoomLayout): Float32Array {
  const W = layout.width;
  const D = layout.depth;
  const dist = new Float32Array(W * D).fill(Infinity);
  const queue: number[] = [];
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (!isFloor(layout, x, z)) {
        dist[z * W + x] = 0;
        queue.push(z * W + x);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % W;
    const z = (i - x) / W;
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]] as const) {
      if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
      const j = nz * W + nx;
      if (dist[j] > dist[i] + 1) {
        dist[j] = dist[i] + 1;
        queue.push(j);
      }
    }
  }
  return dist;
}

/** Ready-made Demo-like shapes (all leave a one-cell wall ring). */
export const SHAPES = {
  /** A plain rectangle of w × d floor cells. */
  rect(w: number, d: number): RoomLayout {
    return layoutFromRects(w + 2, d + 2, [{ x: 1, z: 1, w, d }]);
  },
  /** An L: a w × d rectangle missing its north-east quadrant (cut × cutD). */
  ell(w: number, d: number, cut: number, cutD: number): RoomLayout {
    return layoutFromRects(w + 2, d + 2, [{ x: 1, z: 1, w, d }], [{ x: 1 + w - cut, z: 1, w: cut, d: cutD }]);
  },
  /** The Demo's stepped room (ss2): a hall with a raised west wing and a stepped east side. */
  stepped(): RoomLayout {
    return layoutFromRects(
      22,
      16,
      [
        { x: 1, z: 1, w: 13, d: 8 },
        { x: 5, z: 9, w: 16, d: 6 },
        { x: 14, z: 4, w: 4, d: 5 },
        { x: 18, z: 6, w: 3, d: 3 },
      ],
      [{ x: 1, z: 7, w: 4, d: 2 }],
    );
  },
} as const;

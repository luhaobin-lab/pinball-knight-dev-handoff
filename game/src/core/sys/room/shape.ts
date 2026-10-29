import type { 结构_瓷砖配置 } from '../../../content/demo/types.ts';
import { Array_Random, RandomIntegerInRange, type Rand15 } from '../../rng/ue.ts';

/** Copied IoStore PF_B8G8R8A8 blue==255, not an artistic room outline.
 * reference-session-20261027/room-masks:01 SHA4ebd5589f8007fe1e20638f89bbe668b396e30161790fdc2f51729551c86757f.
 * 02 SHA1449c8c62228db0cc293ba2dc2ed496f9308ad32cf0ea66f20a4b356336ebde9.
 * Source 房间.整理房间格 L519 loops textureX outer,textureY inner, matching roomY outer,roomX inner.
 */
export const MANUAL_MASKS: Readonly<Record<string, readonly string[]>> = {
  手动房间图01: ['0000000', '0111110', '0111110', '0111110', '0000000'],
  手动房间图02: ['0011100', '0111110', '0111110', '0111110', '0011100'],
};
export const EDGES = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
export const CORNERS = [[1, -1], [1, 1], [-1, 1], [-1, -1]] as const;
const EDGE_NAMES: Readonly<Record<string, string>> = {
  '0110': '左上外接', '0011': '右上外接', '1001': '右下外接', '1100': '左下外接',
  '0111': '上', '1011': '右', '1101': '下', '1110': '左',
};
const CORNER_NAMES: Readonly<Record<string, string>> = {
  '0111': '左上内角', '1011': '右上内角', '1101': '右下内角', '1110': '左下内角',
  '1111': '中', '0101': '左上右下内角', '1010': '右上左下内角',
};
export interface ShapeCell { readonly x: number; readonly y: number; readonly explored: boolean; readonly edge: string; readonly corner: string; readonly name: string }
export interface RoomShape { readonly width: number; readonly depth: number; readonly mask: readonly boolean[]; readonly cells: readonly ShapeCell[]; readonly failed: boolean }

export function cellCodes(mask: readonly boolean[], width: number, depth: number, x: number, y: number): { edge: string; corner: string; name: string } {
  const at = (dx: number, dy: number) => x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < depth && mask[(y + dy) * width + x + dx] ? '1' : '0';
  const edge = EDGES.map(([dx, dy]) => at(dx, dy)).join('');
  const corner = CORNERS.map(([dx, dy]) => at(dx, dy)).join('');
  return { edge, corner, name: (edge === '1111' ? CORNER_NAMES[corner] : EDGE_NAMES[edge]) ?? 'None' };
}

/** 房间.整理房间格 L1102-L4715, including the random bound re-evaluated each loop test. */
export function buildShape(width: number, depth: number, procedural: boolean, corridor: boolean, manual: string | null, rng: Rand15 | null): RoomShape {
  const mask: boolean[] = Array(width * depth).fill(true);
  if (procedural && !corridor && rng) {
    const area = width * depth;
    const removable = new Set(['1100', '0110', '0011', '1001', '1000', '0100', '0010', '0001']);
    // L1125 uses <=, so it removes one more than the sampled final index, as written in the blueprint.
    for (let i = 0; i <= RandomIntegerInRange(rng, Math.trunc(area * .25), Math.trunc(area * .35)); i++) {
      const candidates = mask.flatMap((live, id) => live && removable.has(cellCodes(mask, width, depth, id % width, Math.trunc(id / width)).edge) ? [id] : []);
      const pick = Array_Random(rng, candidates);
      if (pick >= 0) mask[candidates[pick]!] = false;
    }
    // L2311 repeats complete leaf removal until stable; it does not invent a connectivity repair.
    for (;;) {
      const dead = mask.flatMap((live, id) => live && ['1000', '0100', '0010', '0001', '0000'].includes(cellCodes(mask, width, depth, id % width, Math.trunc(id / width)).edge) ? [id] : []);
      if (!dead.length) break;
      for (const id of dead) mask[id] = false;
    }
  } else if (!procedural && manual) {
    const rows = MANUAL_MASKS[manual.split('/').at(-1)!];
    if (!rows) throw Error(`SPEC-GAP: missing extracted room mask ${manual}`);
    for (let y = 0; y < depth; y++) for (let x = 0; x < width; x++) mask[y * width + x] = rows[x]?.[y] === '1';
  }
  const cells = mask.map((explored, id) => ({ x: id % width, y: Math.trunc(id / width), explored, ...cellCodes(mask, width, depth, id % width, Math.trunc(id / width)) }));
  // L4247 asks the caller to rebuild when a diagonal crossing would make the boundary ambiguous.
  const failed = !mask.some(Boolean) || cells.some(c => c.explored && ['1010', '0101'].includes(c.corner));
  return { width, depth, mask, cells, failed };
}

/** GM.获取动态网格点 L137-L3313: source row offsets/order, single perimeter, bounded100 visits. */
export function boundaryPolygon(shape: RoomShape, table: Readonly<Record<string, 结构_瓷砖配置>>): { x: number; y: number }[] {
  const live = shape.cells.filter(c => c.explored);
  const start = live.find(c => c.name === '右下外接' || c.name === '左下外接');
  if (!start) return [];
  const point = (c: ShapeCell) => {
    const p = table[c.name]?.动态网格点[0];
    return p ? { x: (c.x - (shape.width - 1) / 2) * 256 + p.X, y: (c.y - (shape.depth - 1) / 2) * 256 + p.Y } : null;
  };
  const first = point(start); if (!first) return [];
  const points = [first]; let current = start, previous: ShapeCell | null = null;
  for (let count = 0; count < 100; count++) {
    const next = table[current.name]?.动态查询顺序.map(o => live.find(c => c.x === current.x + o.X && c.y === current.y + o.Y))
      .find(c => c && c !== previous && c !== start && c.name !== '中');
    if (!next) return points;
    previous = current; current = next;
    const p = point(current);
    if (p && !points.some(q => q.x === p.x && q.y === p.y)) points.push(p);
  }
  return []; // same100-iteration failure as source, never an invented polygon
}

export function insidePolygon(x: number, y: number, polygon: readonly { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

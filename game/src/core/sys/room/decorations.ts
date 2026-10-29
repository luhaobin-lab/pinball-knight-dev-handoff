import { demoClasses } from '../../../content/demo/classes.ts';
import tiles from '../../../content/demo/data/数据表_瓷砖配置_矩形.ts';
import type { 结构_层, 结构_瓷砖配置 } from '../../../content/demo/types.ts';
import { Array_Shuffle, RandomIntegerInRange, type Rand15 } from '../../rng/ue.ts';
import type { SolidBoxDef, SolidCircleDef } from '../../launch/index.ts';
import type { RoomShape } from './shape.ts';

export interface RoomPlacement { readonly cls: string; readonly at: { x: number; y: number; z: number }; readonly fixed: boolean; readonly cell: number | null; readonly occupiedCells: readonly number[]; readonly occupancy: readonly string[] }
interface Config { 占位?: string[]; 所需房间格子?: { X: number; Y: number; Z: number }[] }
const classes = demoClasses as unknown as Readonly<Record<string, { parent: string | null; vars: Config; overrides: Config; tags: string[]; components: Record<string, Record<string, unknown>> }>>;
const TILE_ROWS = tiles.rows as Readonly<Record<string, 结构_瓷砖配置>>;

function config(cls: string): Config {
  const d = classes[cls];
  return d ? { ...(d.parent ? config(d.parent) : {}), ...d.vars, ...d.overrides } : {};
}

/** 房间L1502-L4984, 房间格子.判断装饰品占位/摆放装饰品: source occupancy and row-specific offsets. */
export function placeDecorations(shape: RoomShape, layer: 结构_层, centre: { x: number; y: number }, rng: Rand15 | null): RoomPlacement[] {
  const out: RoomPlacement[] = [], occupied = shape.cells.map(() => new Set<string>());
  const fits = (id: number, d: Config): number[] | null => {
    const c = shape.cells[id]!;
    const ids = (d.所需房间格子 ?? [{ X: 0, Y: 0, Z: 0 }]).map(offset => shape.cells.findIndex(q => q.x === c.x + offset.X && q.y === c.y + offset.Y));
    if (ids.some(i => i < 0 || !shape.mask[i] || (d.占位 ?? ['边角']).some(tag => occupied[i]!.has(tag)))) return null;
    return ids;
  };
  for (const request of layer.随机装饰品) {
    if (!request.实例) continue;
    const d = config(request.实例);
    const candidates = shape.cells.flatMap((c, id) => c.explored && TILE_ROWS[c.name]?.装饰品.some(v => v.实例 === request.实例) && fits(id, d) ? [id] : []);
    const draw = () => rng ? RandomIntegerInRange(rng, Math.trunc(request.数量.Min), Math.trunc(request.数量.Max)) : Math.trunc(request.数量.Max);
    // L2464 evaluates the requested number even with no candidates; L673 re-evaluates it per iteration.
    if (draw() - 1 < 0 || !candidates.length) continue;
    if (rng) Array_Shuffle(rng, candidates);
    // Source caches this list before placing the batch: 摆放装饰品 doesnot call 判断装饰品占位 again. Preserve that
    // same-class multi-cell overlap quirk; occupancy affects the next decoration class's candidate collection.
    for (let i = 0; i <= Math.max(0, Math.min(draw() - 1, candidates.length - 1)); i++) {
      const id = candidates[i]!, c = shape.cells[id]!;
      const row = TILE_ROWS[c.name]!.装饰品.find(v => v.实例 === request.实例)!;
      const at = { x: (c.x - (shape.width - 1) / 2) * 256 + row.偏移.X, y: (c.y - (shape.depth - 1) / 2) * 256 + row.偏移.Y, z: row.偏移.Z };
      const occupancy = d.占位 ?? ['边角'];
      const occupiedCells = fits(id, { ...d, 占位: [] }) ?? [];
      out.push({ cls: request.实例, at, cell: id, occupiedCells, fixed: false, occupancy });
      for (const n of occupiedCells) for (const tag of occupancy) occupied[n]!.add(tag);
    }
  }
  // Fixed decorations are spawned once, in reverse input order. The source does not roll their 数量 field.
  for (const d of [...layer.固定装饰品].reverse()) if (d.实例) out.push({ cls: d.实例, at: { x: centre.x + d.偏移.X, y: centre.y + d.偏移.Y, z: d.偏移.Z }, fixed: true, cell: null, occupiedCells: [], occupancy: config(d.实例).占位 ?? ['边角'] });
  return out;
}

/** Source collision primitives. Pots/braziers use Sphere50 for movement; their Box64 only reserves terrain. */
export function decorationSolids(placements: readonly RoomPlacement[]): { circles: SolidCircleDef[]; boxes: SolidBoxDef[]; terrainBoxes: SolidBoxDef[] } {
  const circles: SolidCircleDef[] = [], boxes: SolidBoxDef[] = [], terrainBoxes: SolidBoxDef[] = [];
  placements.forEach((p, i) => {
    const def = classes[p.cls];
    if (!def?.tags.includes('环境.房间.墙壁')) return;
    const sphere = Object.values(def.components).find(c => c.class === 'SphereComponent');
    const box = Object.values(def.components).find(c => c.class === 'BoxComponent');
    const component = sphere ?? box;
    if (!component) return;
    const offset = component.RelativeLocation as { X?: number; Y?: number } | undefined;
    const x = p.at.x + (offset?.X ?? 0), y = p.at.y + (offset?.Y ?? 0), id = `room-decoration:${i}:${p.cls}`;
    if (sphere) circles.push({ id, x, y, radius: Number(sphere.SphereRadius), tags: def.tags });
    else if (box) {
      const extent = box.BoxExtent as { X: number; Y: number };
      boxes.push({ id, minX: x - extent.X, maxX: x + extent.X, minY: y - extent.Y, maxY: y + extent.Y, tags: def.tags });
    }
    if (box) {
      const extent = box.BoxExtent as { X: number; Y: number }, at = box.RelativeLocation as { X?: number; Y?: number } | undefined;
      const bx = p.at.x + (at?.X ?? 0), by = p.at.y + (at?.Y ?? 0);
      terrainBoxes.push({ id, minX: bx - extent.X, maxX: bx + extent.X, minY: by - extent.Y, maxY: by + extent.Y, tags: def.tags });
    }
  });
  return { circles, boxes, terrainBoxes };
}

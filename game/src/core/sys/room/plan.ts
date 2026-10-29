import { findRow, 数据表_关卡_固定地点, 数据表_地图格, type 结构_层, type 结构_装饰品 } from '../../../content/demo/index.ts';
import { Array_Random, RandomIntegerInRange, type Rand15 } from '../../rng/ue.ts';
import tiles from '../../../content/demo/data/数据表_瓷砖配置_矩形.ts';
import { buildShape, boundaryPolygon, insidePolygon, type RoomShape } from './shape.ts';
import { placeDecorations, decorationSolids, type RoomPlacement } from './decorations.ts';
import { authoredAirwalls, authoredDecorations, authoredEdges, insideSourceBox } from './authored.ts';
import type { SolidBoxDef, SolidCircleDef } from '../../launch/index.ts';

/**
 * Source room plan: 房间.整理房间格, cell edge/corner table, dynamic boundary points and decoration occupancy.
 * SPEC-GAP: the native collision backend still consumes a64uu floor raster instead of an exact polygon mesh;
 * authored boss/tutorial backgrounds use exact child OBBs; fog state is owned by room/fog.ts.
 */

/** 蓝图_房间.格子间隔 (256 uu per room cell) and 游戏模式.地形格细分 (4 terrain cells of 64 uu per room cell). */
export const 房间格uu = 256;
export const 地形格细分 = 4;
export const 地形格uu = 房间格uu / 地形格细分;

export interface PlanVec3 { readonly x: number; readonly y: number; readonly z: number }
export interface PlanRow { readonly table: string; readonly row: string; readonly 权重: number }

export interface RoomDecoration {
  /** Decoration class asset path (蓝图_装饰品_*). */
  readonly cls: string;
  readonly fixed: boolean;
  readonly offset: PlanVec3;
  readonly range: { readonly min: number; readonly max: number };
  /** Count drawn in [min, max] from the `level` domain (v0; the Demo's 创建装饰品池 order is wave B). */
  readonly count: number;
}

/** One 敌人池 entry (结构_掉落): `数量` draws with chance `概率` each from `内容` by weight; `成长？` scales with floors. */
export interface SpawnEntry {
  readonly 数量: number;
  readonly 概率: number;
  readonly 成长: boolean;
  readonly 内容: readonly PlanRow[];
}

export interface RoomPlan {
  readonly tile: string;
  readonly room: string;
  readonly variant: number;
  /** 房间尺寸X × 房间尺寸Y in room cells (最小尺寸 = 最大尺寸 = 5 × 7 in every Demo row). */
  readonly cellsX: number;
  readonly cellsY: number;
  /** Floor in terrain cells (64 uu), row-major `y * width + x`, 1 = floor (the src/core/launch FloorGrid format). */
  readonly floor: { readonly width: number; readonly depth: number; readonly cells: Uint8Array; readonly origin: { readonly x: number; readonly y: number } };
  readonly solids: readonly { readonly cls: string; readonly cells: readonly (readonly [number, number])[] }[];
  readonly decorations: readonly RoomDecoration[];
  readonly spawnDeck: readonly SpawnEntry[];
  readonly 场上最多敌人: number;
  readonly 精英几率: number;
  readonly 精英上限: number;
  /** 数据表_技能_任务 row of the room task (null: none). */
  readonly task: string | null;
  readonly drops: { readonly 指定数据筛选: readonly PlanRow[]; readonly 通用数据筛选: readonly string[] };
  readonly 程序生成: boolean;
  readonly 回廊: boolean;
  /** The 手动房间图 texture (hand-made room) or null. */
  readonly 手动房间图: string | null;
  /** Fixed backdrop decoration (首领背景A, 新手关02背景 …) when the room has one. */
  readonly background: string | null;
  /**
   * 玩家出生点 and 路口创建点 relative to the room centre, Demo axes (UE X, Y, Z in uu).
   * SPEC-GAP: the UE → core frame rotation is fixed by core-room with the room shape; 路口创建点 (−1, −1, −1) means
   * "pick an explored cell" (创建路口), reported as null.
   */
  readonly playerSpawn: PlanVec3;
  readonly junction: PlanVec3 | null;
  readonly 直射光强度: number;
  /** Historical static-plan slot; live source fog mask is projected independently on GameView.fog. */
  readonly fog: null;
  readonly authoredBoundary: boolean;
  readonly authoredEdges:readonly [number,number,number,number][];
  readonly shape: RoomShape;
  readonly polygon: readonly { x: number; y: number }[];
  readonly placements: readonly RoomPlacement[];
  readonly childPlacements: readonly RoomPlacement[];
  readonly centre: { x: number; y: number; z: number };
  readonly collision: { readonly boxes: readonly SolidBoxDef[]; readonly circles: readonly SolidCircleDef[]; readonly terrainBoxes: readonly SolidBoxDef[] };
}

const tableOf = (asset: string | null): string => (asset === null ? '' : asset.slice(asset.lastIndexOf('/') + 1));
const vec = (v: { X: number; Y: number; Z: number }): PlanVec3 => ({ x: v.X, y: v.Y, z: v.Z });
const isBackdrop = (cls: string): boolean => /背景/.test(cls);

/** The room row of a 数据表_地图格 row (营地 for 空). */
export function roomOfTile(tile: string): string | null {
  return findRow(数据表_地图格, tile)?.房间地块数据.数据表.RowName ?? null;
}

/** The 结构_层 of a room row and variant. */
export function layerOf(room: string, variant: number): 结构_层 | null {
  return findRow(数据表_关卡_固定地点, room)?.层类型[variant] ?? null;
}

function decorations(list: readonly 结构_装饰品[], fixed: boolean, rng: Rand15 | null): RoomDecoration[] {
  const out: RoomDecoration[] = [];
  for (const d of list) {
    if (d.实例 === null) continue;
    const min = Math.trunc(d.数量.Min);
    const max = Math.trunc(d.数量.Max);
    const count = rng ? RandomIntegerInRange(rng, min, max) : max;
    out.push({ cls: d.实例, fixed, offset: vec(d.偏移), range: { min, max }, count });
  }
  return out;
}

/** Builds the plan of a tile's room. `rng` is the `level` domain (null: counts at their maximum, for previews). */
export function buildRoomPlan(tile: string, room: string, variant: number, layer: 结构_层, rng: Rand15 | null): RoomPlan {
  const cellsX = Math.trunc(layer.最大尺寸.X);
  const cellsY = Math.trunc(layer.最大尺寸.Y);
  // Source 创建地形格: UE X is the inner5cell dimension, UE Y the outer7cell dimension.
  const width = cellsX * 地形格细分;
  const depth = cellsY * 地形格细分;
  const shape = buildShape(cellsX, cellsY, layer['程序生成？'], layer['回廊？'], layer.手动房间图, rng);
  const polygon = layer['程序生成？'] || layer.手动房间图 ? boundaryPolygon(shape, tiles.rows) : [];
  const cells = new Uint8Array(width * depth);
  for (let y = 0; y < depth; y++) for (let x = 0; x < width; x++) {
    const wx = (x + .5 - width / 2) * 地形格uu, wy = (y + .5 - depth / 2) * 地形格uu;
    cells[y * width + x] = polygon.length ? Number(insidePolygon(wx, wy, polygon)) : Number(shape.mask[Math.trunc(y / 4) * cellsX + Math.trunc(x / 4)]);
  }
  const explored = shape.cells.filter(c => c.explored);
  const centre = layer['程序生成？'] && explored.length ? {
    x: (Math.min(...explored.map(c => c.x)) + Math.max(...explored.map(c => c.x)) - (cellsX - 1)) * 128,
    y: (Math.min(...explored.map(c => c.y)) + Math.max(...explored.map(c => c.y)) - (cellsY - 1)) * 128, z: 0,
  } : { x: 0, y: 0, z: 0 };
  if (rng) for (const c of shape.cells) if (c.explored && c.name in tiles.rows) Array_Random(rng, tiles.rows[c.name as keyof typeof tiles.rows].瓷砖池);
  const placements = placeDecorations(shape, layer, centre, rng);
  const childPlacements=authoredDecorations(placements);
  const collision = decorationSolids([...placements,...childPlacements]);
  const authored=authoredAirwalls(placements);
  collision.boxes.push(...authored);collision.terrainBoxes.push(...authored);
  // Only presentation/walkable raster is clipped; actual collision uses the exact rotated source child Boxes.
  if(authored.length)for(let y=0;y<depth;y++)for(let x=0;x<width;x++){
    const wx=(x+.5-width/2)*地形格uu,wy=(y+.5-depth/2)*地形格uu;
    if(authored.some(b=>insideSourceBox(wx,wy,b)))cells[y*width+x]=0;
  }
  const fixed = decorations(layer.固定装饰品, true, null);
  const random = decorations(layer.随机装饰品, false, null);
  const backdrop = fixed.find(d => isBackdrop(d.cls));
  const j = layer.路口创建点;
  return {
    tile, room, variant, cellsX, cellsY,
    // 蓝图_房间.创建地形格 L626–L2630: cell centres straddle the world origin by half a cell.
    // Source axes stay in core; roomFrame alone maps them to the approved renderer's coordinate system.
    floor: { width, depth, cells, origin: { x: -width * 地形格uu / 2, y: -depth * 地形格uu / 2 } },
    solids: [],
    decorations: [...fixed, ...random],
    spawnDeck: layer.敌人池.map(p => ({
      数量: p.数量, 概率: p.概率, 成长: p['成长？'],
      内容: p.内容.filter(c => c.数据表行.DataTable !== null).map(c => ({ table: tableOf(c.数据表行.DataTable), row: c.数据表行.RowName, 权重: c.权重 })),
    })),
    场上最多敌人: layer.场上最多敌人,
    精英几率: layer.精英几率,
    精英上限: layer.精英上限,
    task: layer.任务.DataTable === null || layer.任务.RowName === 'None' ? null : layer.任务.RowName,
    drops: {
      指定数据筛选: layer.指定数据筛选.map(c => ({ table: tableOf(c.数据表行.DataTable), row: c.数据表行.RowName, 权重: c.权重 })),
      通用数据筛选: layer.通用数据筛选.filter(h => h.DataTable !== null).map(h => h.RowName),
    },
    程序生成: layer['程序生成？'],
    回廊: layer['回廊？'],
    手动房间图: layer.手动房间图,
    background: backdrop ? backdrop.cls : null,
    playerSpawn: vec(layer.玩家出生点),
    junction: j.X === -1 && j.Y === -1 && j.Z === -1 ? null : vec(j),
    直射光强度: layer.直射光强度,
    fog: null, authoredBoundary:authored.length>0,authoredEdges:authoredEdges(authored,{width,depth,cells,origin:{x:-width*地形格uu/2,y:-depth*地形格uu/2}}), shape, polygon, placements, childPlacements, centre, collision,
  };
}

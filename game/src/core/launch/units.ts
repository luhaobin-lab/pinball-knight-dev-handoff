/**
 * Unreal units (uu) per floor tile. The Demo's TileMaps use 16-px tiles at PixelsPerUnrealUnit 0.25
 * (dump/raw/.../TileMap_上A.json: 16 / 0.25 = 64), its grid helper 吸附到网格 snaps to 64.0, and the gameplay
 * camera's OrthoWidth 2560 uu spans the 640-px grid (摄像机 Camera.OrthoWidth), i.e. 4 uu per pixel, 16 px per tile.
 */
import type { Vec2 } from './math.ts';

export const UU_PER_TILE = 64;

export const uuToTiles = (uu: number): number => uu / UU_PER_TILE;
export const tilesToUu = (tiles: number): number => tiles * UU_PER_TILE;

/** A point of the renderer's floor plane in tiles (x east, z south) as a launch point in uu (x east, y south). */
export const tilePointToUu = (x: number, z: number): Vec2 => ({ x: tilesToUu(x), y: tilesToUu(z) });

/** A launch point in uu as a point of the renderer's floor plane in tiles. */
export const uuPointToTiles = (p: Vec2): { x: number; z: number } => ({ x: uuToTiles(p.x), z: uuToTiles(p.y) });

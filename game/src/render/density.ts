/**
 * Pixel density of the whole look, chosen once at startup with `?res=`:
 * - `hibit` (default, the producer's pick): 960×540 internal, 24 px per floor tile (×2 at 1080p);
 * - `pixel`: the Demo's own grid, 640×360 internal, 16 px per floor tile (×3 at 1080p).
 * The framing is identical (the same 22.5 tiles fit the internal height); only the pixels get finer.
 * World-locked pixel patterns (floor bevels, cracks, grain) are authored in these pixels: use `PPT`.
 */

export type Density = 'pixel' | 'hibit';

function readDensity(): Density {
  const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
  return new URLSearchParams(search).get('res') === 'pixel' ? 'pixel' : 'hibit';
}

export const DENSITY: Density = readDensity();
/** Internal pixels per floor tile. */
export const PPT = DENSITY === 'hibit' ? 24 : 16;
/** `PPT` as a GLSL float literal. */
export const PPT_GLSL = PPT.toFixed(1);
/** Internal render height the integer upscale aims for. */
export const INTERNAL_HEIGHT = PPT * 22.5;

/**
 * Runtime constants of the render contract (see README.md). Part of the public API:
 * changing a value here changes the G-buffer layout every material and pass relies on.
 */

/** Object layers. `world` objects go to the G-buffer; `forward` objects are drawn after lighting. */
export const LAYERS = { world: 0, forward: 1 } as const;

/** G-buffer colour attachment indices (MRT `layout(location = n)`). */
export const GBUFFER = { surface: 0, normal: 1, emissive: 2 } as const;

/** Bit flags stored as an integer in `emissive.a`. */
export const SURFACE_FLAGS = {
  /** No outline or crease highlight on this surface (flames, glows, foliage). */
  noOutline: 1,
  /** Ignore lighting: final colour = albedo × brightest ramp colour + emissive. */
  unlit: 2,
} as const;

/** Order of the built-in passes inside their stage; user passes sort around them. */
export const PASS_ORDER = {
  scene: 0,
  resolve: 0,
  forward: 1000,
  outline: 0,
  bloom: 100,
  grade: 200,
  fx: 300,
} as const;

/** A ramp holds 2..RAMP_MAX_COLORS colours. */
export const RAMP_MAX_COLORS = 6;
/** Ramp ids are 1..MAX_RAMPS-1; id 0 means "no surface". */
export const MAX_RAMPS = 256;
/** Point lights evaluated per frame, by quality tier. */
export const MAX_LIGHTS = { high: 64, medium: 32, low: 16 } as const;
/** Default target height of the internal render (640×360 at 16:9). */
export const DEFAULT_INTERNAL_HEIGHT = 360;
/** Default world units visible across the internal height. */
export const DEFAULT_VIEW_HEIGHT = 10;

import * as THREE from 'three';
import { MAX_RAMPS, RAMP_MAX_COLORS } from './constants';
import type { Hex } from './api';

/**
 * Shared ramp atlas: one row per registered palette ramp, read by the deferred resolve.
 * Row layout (RGBA float, linear): texels 0..5 = colours dark→light (the last colour repeats),
 * texel 6 = (colour count, dither width in bands, light curve exponent, overbright).
 * Row 0 is reserved for "no surface". Identical ramps share a row.
 */
const RAMP_ATLAS_WIDTH = 8;
export const RAMP_PARAMS_TEXEL = 6;

export interface RampParams {
  /** Blue-noise dither width in bands, 0..1 (default 0). */
  dither: number;
  /** Light-to-ramp curve exponent (default 0.8). */
  curve: number;
  /** How much light above 1 brightens the top band (default 0.35). */
  overbright: number;
}

export const DEFAULT_RAMP_PARAMS: Readonly<RampParams> = { dither: 0, curve: 0.8, overbright: 0.35 };

const data = new Float32Array(RAMP_ATLAS_WIDTH * MAX_RAMPS * 4);
const ids = new Map<string, number>();
let nextId = 1;

export const rampAtlas = new THREE.DataTexture(data, RAMP_ATLAS_WIDTH, MAX_RAMPS, THREE.RGBAFormat, THREE.FloatType);
rampAtlas.name = 'ramp-atlas';
rampAtlas.minFilter = THREE.NearestFilter;
rampAtlas.magFilter = THREE.NearestFilter;
rampAtlas.generateMipmaps = false;
rampAtlas.needsUpdate = true;

const scratch = new THREE.Color();

/** Returns the atlas row of `ramp` (dark → light, 2..6 colours), registering it on first use. */
export function registerRamp(ramp: readonly Hex[], options: Partial<RampParams> = {}): number {
  const params: RampParams = {
    dither: options.dither ?? DEFAULT_RAMP_PARAMS.dither,
    curve: options.curve ?? DEFAULT_RAMP_PARAMS.curve,
    overbright: options.overbright ?? DEFAULT_RAMP_PARAMS.overbright,
  };
  if (ramp.length < 2 || ramp.length > RAMP_MAX_COLORS) {
    throw new Error(`ramp needs 2..${RAMP_MAX_COLORS} colours, got ${ramp.length}`);
  }
  const key = `${ramp.map(c => scratch.set(c).getHexString()).join(',')}|${params.dither}|${params.curve}|${params.overbright}`;
  const known = ids.get(key);
  if (known !== undefined) return known;
  if (nextId >= MAX_RAMPS) throw new Error(`ramp atlas full (${MAX_RAMPS - 1} ramps); share palettes between materials`);
  const id = nextId++;
  const row = id * RAMP_ATLAS_WIDTH * 4;
  for (let i = 0; i < RAMP_MAX_COLORS; i++) {
    scratch.set(ramp[Math.min(i, ramp.length - 1)]); // ColorManagement converts sRGB hex to linear
    data.set([scratch.r, scratch.g, scratch.b, 1], row + i * 4);
  }
  data.set([ramp.length, params.dither, params.curve, params.overbright], row + RAMP_PARAMS_TEXEL * 4);
  ids.set(key, id);
  rampAtlas.needsUpdate = true;
  return id;
}

/** Linear colour of `band` in ramp `id` (for CPU-side previews and tests). */
export function rampColor(id: number, band: number, target = new THREE.Color()): THREE.Color {
  const o = (id * RAMP_ATLAS_WIDTH + band) * 4;
  return target.setRGB(data[o], data[o + 1], data[o + 2], THREE.LinearSRGBColorSpace);
}

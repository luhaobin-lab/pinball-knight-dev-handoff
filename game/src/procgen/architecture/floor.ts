import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { isFloor, type Rect, type RoomLayout } from './layout';
import { tint, type Kit } from './kit';
import { boxMatrix, PRIM, trs } from './mesh';
import { PPT } from '../../render/density';

/**
 * Floors (art bible §10 M8, M9, M5): a deterministic mix of 1×1 and 2×2 tomb slabs and brick-split cells
 * like the Demo's, separated by 1-px joints that show the mold grout plane beneath (the hyphal graph),
 * grave-soil gaps, fallen coffin planks, and a room-space mold density field for the living carpet.
 *
 * Slab tops sit exactly at y = 0 and every joint is one floor pixel, so the oblique camera maps the floor
 * 1:1 onto the pixel grid.
 */

const PX = 1 / PPT;

export interface MoldPatch {
  readonly x: number;
  readonly z: number;
  /** Radii in tiles. */
  readonly rx: number;
  readonly rz: number;
}

export interface PlankSpec {
  /** Centre in tiles. */
  readonly x: number;
  readonly z: number;
  readonly length: number;
  readonly width?: number;
  /** Yaw in radians (0 = along x). */
  readonly angle: number;
  /** 0..1 rot (foxfire inside the rot). */
  readonly rot?: number;
}

/** A prop that darkens the floor around and behind its foot (baked into the room field). */
export interface Occluder {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface FloorSpec {
  /** Cells whose slabs are missing (grave soil shows), e.g. under fallen planks. */
  readonly soil?: readonly Rect[];
  /**
   * Regions floored with fallen coffin planks laid diagonally like parquet over grave soil (B1); the
   * planks are clipped to the floor and a few are missing so the soil shows through.
   */
  readonly plankRegions?: readonly PlankRegion[];
  readonly planks?: readonly PlankSpec[];
  readonly mold?: readonly MoldPatch[];
  /** Probability of a 2×2 slab where it fits (default 0.3). */
  readonly big?: number;
  /** Probability that a 1×1 cell is split into bricks (default 0.18). */
  readonly bricks?: number;
  /** Probability of a crack per slab (default 0.28). */
  readonly cracks?: number;
}

export interface PlankRegion extends Rect {
  /** Plank direction in radians (default −0.72, a falling diagonal). */
  readonly angle?: number;
  /** Fraction of planks missing (default 0.12). */
  readonly gaps?: number;
}

export interface MoldField {
  readonly texture: THREE.DataTexture;
  /** Density 0..1 at a world point (tiles). */
  sample(x: number, z: number): number;
  /** World origin and size of the field in tiles. */
  readonly x0: number;
  readonly z0: number;
  readonly width: number;
  readonly depth: number;
}

const TEXELS = 16;

function valueNoise(rng: Rng): (x: number, y: number) => number {
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
  const at = (x: number, y: number): number => grid[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}

/**
 * Room-space field at 16 texels per tile: R = mold density (noisy blobs around the patches, clipped to
 * the floor), G = wall contact (1 at a wall base, 0 from 0.8 t away), which darkens floors along the walls.
 */
export function moldField(layout: RoomLayout, patches: readonly MoldPatch[], rng: Rng, occluders: readonly Occluder[] = []): MoldField {
  const W = layout.width * TEXELS;
  const D = layout.depth * TEXELS;
  const data = new Uint8Array(W * D * 2);
  const contact = (x: number, z: number): number => {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    const fx = x - cx;
    const fz = z - cz;
    let d = 9;
    if (!isFloor(layout, cx - 1, cz)) d = Math.min(d, fx);
    if (!isFloor(layout, cx + 1, cz)) d = Math.min(d, 1 - fx);
    // the north wall casts the deepest contact shadow (its face is tall), the south lip the least
    if (!isFloor(layout, cx, cz - 1)) d = Math.min(d, fz * 0.7);
    if (!isFloor(layout, cx, cz + 1)) d = Math.min(d, (1 - fz) * 1.6);
    for (const [ox, oz, px, pz] of [[-1, -1, 0, 0], [1, -1, 1, 0], [-1, 1, 0, 1], [1, 1, 1, 1]] as const) {
      if (!isFloor(layout, cx + ox, cz + oz)) d = Math.min(d, Math.hypot(fx - px, fz - pz));
    }
    let c = Math.pow(Math.max(0, 1 - d / 0.8), 1.6);
    // props: a tight contact ring at the foot and a soft shadow thrown south, away from the god light
    for (const o of occluders) {
      const foot = Math.hypot(x - o.x, z - o.z) / (o.radius * 1.25);
      const cast = Math.hypot((x - o.x) / (o.radius * 1.05), (z - o.z - o.radius * 0.65) / (o.radius * 1.5));
      c = Math.max(c, Math.max(0, 1 - foot) ** 0.7 * 0.9, Math.max(0, 1 - cast) ** 0.9 * 0.7);
    }
    return Math.min(1, c);
  };
  const noise = valueNoise(rng);
  const fbm = (x: number, y: number): number => 0.5 * noise(x, y) + 0.25 * noise(x * 2.1 + 7, y * 2.1 + 3) + 0.125 * noise(x * 4.3 + 1, y * 4.3 + 9);
  const values = new Float32Array(W * D);
  for (let ty = 0; ty < D; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const x = (tx + 0.5) / TEXELS;
      const z = (ty + 0.5) / TEXELS;
      if (!isFloor(layout, Math.floor(x), Math.floor(z))) continue;
      let d = 0;
      for (const p of patches) {
        const q = Math.hypot((x - p.x) / p.rx, (z - p.z) / p.rz);
        d = Math.max(d, 1.25 - q * (0.75 + 0.6 * fbm(x * 1.3, z * 1.3)));
      }
      values[ty * W + tx] = Math.min(1, Math.max(0, d));
    }
  }
  for (let i = 0; i < W * D; i++) {
    const tx = i % W;
    const ty = (i - tx) / W;
    data[i * 2] = Math.round(values[i] * 255);
    data[i * 2 + 1] = Math.round(contact((tx + 0.5) / TEXELS, (ty + 0.5) / TEXELS) * 255);
  }
  const texture = new THREE.DataTexture(data, W, D, THREE.RGFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return {
    texture,
    x0: 0,
    z0: 0,
    width: layout.width,
    depth: layout.depth,
    sample(x, z) {
      const tx = Math.floor(x * TEXELS);
      const ty = Math.floor(z * TEXELS);
      if (tx < 0 || ty < 0 || tx >= W || ty >= D) return 0;
      return values[ty * W + tx];
    },
  };
}

function inRects(rects: readonly Rect[] | undefined, x: number, z: number): boolean {
  return !!rects?.some(r => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d);
}

/** One slab quad (top at y = 0) with its south and east joint pixel left open. */
function slab(kit: Kit, rng: Rng, x0: number, z0: number, w: number, d: number, crackChance: number): void {
  const x1 = x0 + w - PX;
  const z1 = z0 + d - PX;
  const seed = rng.next();
  // flags: 1 = cracked, 2 = a carved mycoglyph in the middle (only on whole 1×1 slabs)
  const crack = (rng.chance(crackChance) ? 1 : 0) + (w === 1 && d === 1 && rng.chance(0.07) ? 2 : 0);
  kit.batch('slab').quad({ x: x0, y: 0, z: z0 }, { x: x0, y: 0, z: z1 }, { x: x1, y: 0, z: z1 }, { x: x1, y: 0, z: z0 }, tint(rng, 0.05, 0.025), [x0, z0, w - PX, d - PX], [seed, crack, seed, crack]);
}

export function buildFloor(kit: Kit, layout: RoomLayout, spec: FloorSpec, field: MoldField): void {
  const rng = kit.rng.derive('floor');
  const W = layout.width;
  const used = new Uint8Array(W * layout.depth);
  const big = spec.big ?? 0.3;
  const bricks = spec.bricks ?? 0.18;
  const cracks = spec.cracks ?? 0.28;
  const bare = (x: number, z: number): boolean => inRects(spec.soil, x, z) || inRects(spec.plankRegions, x, z);
  const free = (x: number, z: number): boolean => isFloor(layout, x, z) && !used[z * W + x] && !bare(x, z);

  // The grout plane: mold velvet one pixel below the slabs, seen through every joint and chip.
  const grout = kit.batch('mold');
  for (let z = 0; z < layout.depth; z++) {
    for (let x = 0; x < W; x++) {
      if (!isFloor(layout, x, z)) continue;
      if (bare(x, z)) {
        kit.batch('soil').add(PRIM.box(), boxMatrix(x, -0.12, z, x + 1, -0.03, z + 1), tint(rng, 0.08, 0.03));
        for (let i = 0; i < 3; i++) {
          const s = rng.range(0.05, 0.11);
          kit.batch('soil').add(PRIM.rock(), trs(x + rng.range(0.15, 0.85), -0.03, z + rng.range(0.15, 0.85), rng.next() * 3, rng.next() * 3, 0, s, s * 0.5, s), tint(rng, 0.12, 0.05));
        }
        continue;
      }
      grout.quad({ x, y: -0.02, z }, { x, y: -0.02, z: z + 1 }, { x: x + 1, y: -0.02, z: z + 1 }, { x: x + 1, y: -0.02, z }, tint(rng, 0.04), [0, 0, 0, 0]);
    }
  }

  const order: [number, number][] = [];
  for (let z = 0; z < layout.depth; z++) for (let x = 0; x < W; x++) if (isFloor(layout, x, z)) order.push([x, z]);
  rng.shuffle(order);
  for (const [x, z] of order) {
    if (!free(x, z)) continue;
    if (rng.chance(big) && free(x + 1, z) && free(x, z + 1) && free(x + 1, z + 1)) {
      used[z * W + x] = used[z * W + x + 1] = used[(z + 1) * W + x] = used[(z + 1) * W + x + 1] = 1;
      slab(kit, rng, x, z, 2, 2, cracks * 1.6);
      continue;
    }
    if (rng.chance(0.14) && free(x + 1, z)) {
      used[z * W + x] = used[z * W + x + 1] = 1;
      slab(kit, rng, x, z, 2, 1, cracks);
      continue;
    }
    used[z * W + x] = 1;
    if (rng.chance(bricks)) {
      // Demo-like split cells: four small stones or two half slabs.
      if (rng.chance(0.55)) {
        for (const [dx, dz] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) slab(kit, rng, x + dx, z + dz, 0.5, 0.5, 0);
      } else if (rng.chance(0.5)) {
        slab(kit, rng, x, z, 1, 0.5, 0);
        slab(kit, rng, x, z + 0.5, 1, 0.5, 0);
      } else {
        slab(kit, rng, x, z, 0.5, 1, 0);
        slab(kit, rng, x + 0.5, z, 0.5, 1, 0);
      }
      continue;
    }
    slab(kit, rng, x, z, 1, 1, cracks);
  }

  // The living mold carpet: one alpha-tested quad per covered cell, just above the slabs.
  const carpet = kit.batch('mold');
  for (let z = 0; z < layout.depth; z++) {
    for (let x = 0; x < W; x++) {
      if (!isFloor(layout, x, z)) continue;
      let max = 0;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) max = Math.max(max, field.sample(x + (i + 0.5) / 4, z + (j + 0.5) / 4));
      if (max < 0.2) continue;
      const y = inRects(spec.plankRegions, x, z) ? 0.085 : 0.012;
      carpet.quad({ x, y, z }, { x, y, z: z + 1 }, { x: x + 1, y, z: z + 1 }, { x: x + 1, y, z }, tint(rng, 0.05), [1, rng.next(), 0, 0]);
    }
  }

  let index = 0;
  for (const region of spec.plankRegions ?? []) {
    for (const p of parquet(rng, region)) plank(kit, rng, layout, p, index++, (x, z) => inRects([region], Math.floor(x), Math.floor(z)));
  }
  for (const p of spec.planks ?? []) plank(kit, rng, layout, p, index++);
}

/** Diagonal rows of planks covering a region, with staggered butt joints and missing boards. */
function parquet(rng: Rng, r: PlankRegion): PlankSpec[] {
  const angle = r.angle ?? -0.72;
  const gaps = r.gaps ?? 0.12;
  const ux = Math.cos(angle);
  const uz = Math.sin(angle);
  const vx = -uz;
  const vz = ux;
  const cx = r.x + r.w / 2;
  const cz = r.z + r.d / 2;
  const reach = Math.hypot(r.w, r.d) / 2 + 1;
  const out: PlankSpec[] = [];
  const width = 0.52;
  for (let v = -reach; v <= reach; v += width + 0.035) {
    let u = -reach - rng.range(0, 2);
    while (u < reach) {
      const len = rng.range(1.6, 3.4);
      const mid = u + len / 2;
      const px = cx + ux * mid + vx * v;
      const pz = cz + uz * mid + vz * v;
      if (!rng.chance(gaps)) out.push({ x: px, z: pz, length: len - 0.04, width, angle: angle + rng.range(-0.025, 0.025), rot: rng.range(0.15, 1) });
      u += len;
    }
  }
  return out;
}

/**
 * A fallen coffin plank lying across the floor: built from short segments so it can be clipped to the
 * floor (ragged ends where it would cross a wall), with continuous grain across the segments.
 */
function plank(kit: Kit, rng: Rng, layout: RoomLayout, p: PlankSpec, index: number, inside: (x: number, z: number) => boolean = () => true): void {
  const width = p.width ?? rng.range(0.42, 0.58);
  const thick = 0.07;
  const seg = 0.25;
  const n = Math.max(1, Math.round(p.length / seg));
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const seed = rng.next() * 10;
  const rot = p.rot ?? rng.range(0.3, 1);
  const base = 0.004 + (index % 7) * 0.0025;
  const c = tint(rng, 0.08, 0.04);
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * seg - p.length / 2;
    const cx = p.x + cos * s;
    const cz = p.z + sin * s;
    // keep segments whose footprint stays on the floor, so planks never reach into walls
    const ok = [-1, 1].every(e => [-1, 1].every(f => {
      const px = cx + cos * e * seg * 0.5 - sin * f * width * 0.5;
      const pz = cz + sin * e * seg * 0.5 + cos * f * width * 0.5;
      return isFloor(layout, Math.floor(px), Math.floor(pz)) && inside(px, pz);
    }));
    if (!ok) continue;
    const u0 = (i * seg) / p.length;
    const u1 = ((i + 1) * seg) / p.length;
    kit.batch('plank').add(PRIM.box(), trs(cx, base + thick / 2, cz, 0, -p.angle, 0, seg + 0.002, thick, width), c, [p.length, width, seed, rot], (u, v) => [u0 + u * (u1 - u0), v]);
    if (rng.chance(0.045)) {
      // a coffin nail still in the board
      kit.batch('iron').add(PRIM.box(), trs(cx, base + thick + 0.015, cz + rng.range(-0.12, 0.12), 0, p.angle, 0, 0.1, 0.03, 0.1), tint(rng, 0.05, 0.02, 0x9890a0));
    }
  }
}

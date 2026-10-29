import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { tint, type BatchName, type Kit } from '../architecture/kit';
import { lathe, PRIM, trs, tube } from '../architecture/mesh';
import { CYCLES } from '../architecture/palette';
import { capProfile, type CapShape } from '../architecture/walls';

/**
 * Parametric mushrooms (art bible §10 M10): conical, convex, umbonate, funnel, bell and lamp-shade caps on
 * bent fibrous stems with a volva; thin translucent caps let the glowing gills shine through as radial
 * stripes with a lub-dub pulse; seeded spots; clusters register one bioluminescent light (anti-light 0.5).
 */

export type Species = 'mycena' | 'violet' | 'flesh' | 'foxfire';

const CAP_BATCH: Record<Species, BatchName> = {
  mycena: 'capMycena',
  violet: 'capViolet',
  flesh: 'capFlesh',
  foxfire: 'capFoxfire',
};

const SPECIES_LIGHT: Record<Species, string> = {
  mycena: CYCLES.mycena[6],
  violet: CYCLES.violet[5],
  flesh: '#FF9A3C',
  foxfire: CYCLES.foxfire[5],
};

export interface MushroomSpec {
  readonly x: number;
  readonly z: number;
  /** Ground height (0 floor, wall height on a wall top). */
  readonly y?: number;
  /** Stem height in tiles. */
  readonly height: number;
  /** Cap radius in tiles. */
  readonly cap: number;
  readonly shape: CapShape;
  readonly species: Species;
  /** Lean of the stem (radians) and its direction. */
  readonly lean?: number;
  readonly leanDir?: number;
  /** Glowing gill stripes (0 = plain cap); never fewer than 24 on big caps (art bible §4). */
  readonly gills?: number;
  /** Gill glow 0..1. */
  readonly glow?: number;
  /** Spot density 0..1 (flesh caps). */
  readonly spots?: number;
}

export function mushroom(kit: Kit, rng: Rng, m: MushroomSpec): THREE.Vector3 {
  const y = m.y ?? 0;
  const lean = m.lean ?? rng.range(0, 0.25);
  const dir = m.leanDir ?? rng.next() * Math.PI * 2;
  const pts: THREE.Vector3[] = [];
  const seg = 5;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const off = Math.sin(lean) * m.height * t * t;
    pts.push(new THREE.Vector3(m.x + Math.cos(dir) * off, y + t * m.height, m.z + Math.sin(dir) * off));
  }
  const r0 = Math.max(0.035, m.cap * 0.22);
  const sides = m.cap > 0.4 ? 8 : 5;
  kit.batch('stem').add(tube(pts, pts.map((_, i) => r0 * (1.15 - 0.25 * (i / seg))), sides), new THREE.Matrix4(), tint(rng, 0.05, 0.02, 0xf2ece4), [0, 0, rng.next(), 0]);
  if (m.cap > 0.18) {
    kit.batch('stem').add(lathe([[r0 * 1.9, 0], [r0 * 1.8, 0.04], [r0 * 1.3, 0.09], [r0 * 1.05, 0.12]], 7), trs(m.x, y, m.z), tint(rng, 0.05, 0.02, 0xe8e0d8), [0, 0, rng.next(), 0]);
  }
  const top = pts[seg];
  const capH = m.cap * (m.shape === 'conical' ? 1.1 : m.shape === 'lampshade' ? 0.45 : m.shape === 'funnel' ? 0.55 : 0.7);
  const tilt = lean * 0.8;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-Math.sin(dir), 0, Math.cos(dir)), tilt);
  const mat = new THREE.Matrix4().compose(new THREE.Vector3(top.x, top.y - capH * 0.15, top.z), q, new THREE.Vector3(1, 1, 1));
  const gills = m.gills ?? (m.cap >= 0.35 ? (m.cap > 0.7 ? 36 : 24) : 0);
  kit.batch(CAP_BATCH[m.species]).add(capProfile(m.cap, capH, m.shape, m.cap > 0.5 ? 24 : m.cap > 0.25 ? 14 : 9), mat, tint(rng, 0.05, 0.03), [gills, m.glow ?? 0.8, rng.next(), m.spots ?? 0]);
  return top;
}

export interface ClusterSpec {
  readonly x: number;
  readonly z: number;
  readonly y?: number;
  readonly count: number;
  readonly radius?: number;
  readonly species: Species;
  /** Overall size multiplier (1 ≈ Mycena pins along a wall base). */
  readonly scale?: number;
  readonly shapes?: readonly CapShape[];
  /** Register a bioluminescent light for the cluster (default: glowing species only). */
  readonly light?: boolean;
  /** Bias leaning away from this direction (radians), e.g. away from a wall. */
  readonly away?: number;
}

export function mushroomCluster(kit: Kit, spec: ClusterSpec): void {
  const rng = kit.rng.derive(`fungi:${spec.x.toFixed(2)},${spec.z.toFixed(2)}`);
  const scale = spec.scale ?? 1;
  const radius = spec.radius ?? 0.3 * scale;
  const shapes = spec.shapes ?? (spec.species === 'mycena' ? (['bell', 'conical', 'bell'] as const) : spec.species === 'flesh' ? (['convex', 'umbonate', 'funnel'] as const) : (['umbonate', 'convex', 'bell'] as const));
  for (let i = 0; i < spec.count; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * radius;
    const x = spec.x + Math.cos(a) * d;
    const z = spec.z + Math.sin(a) * d;
    const big = i === 0 ? 1 : rng.range(0.45, 0.95);
    const shape = rng.pick(shapes);
    const glowing = spec.species !== 'flesh';
    mushroom(kit, rng, {
      x,
      z,
      y: spec.y,
      height: rng.range(0.16, 0.3) * scale * (0.6 + big * 0.6),
      cap: rng.range(0.09, 0.14) * scale * big,
      shape,
      species: spec.species,
      lean: rng.range(0.05, 0.45),
      leanDir: spec.away !== undefined ? spec.away + rng.range(-0.9, 0.9) : a,
      glow: glowing ? rng.range(0.6, 1) : 0,
      spots: spec.species === 'flesh' ? rng.range(0.25, 0.55) : 0,
    });
  }
  if (spec.light ?? spec.species !== 'flesh') {
    kit.light({
      kind: spec.species === 'foxfire' ? 'foxfire' : 'bio',
      fire: false,
      position: { x: spec.x, y: (spec.y ?? 0) + 0.35 * scale, z: spec.z + 0.1 },
      color: SPECIES_LIGHT[spec.species],
      intensity: 0.32 + 0.08 * Math.min(scale, 2),
      radius: 1.3 + 0.5 * scale,
      flicker: 0,
      seed: Math.floor(rng.next() * 1000),
    });
  }
}

/** A lamp-shade mushroom pillar (the North Star bumpers): a stalk column under a wide thin glowing cap. */
export function lampPillar(kit: Kit, x: number, z: number, radius: number, height = 1.35): void {
  const rng = kit.rng.derive(`pillar:${x.toFixed(2)},${z.toFixed(2)}`);
  const stemR = radius * 0.42;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector3(x + Math.sin(t * 2.4) * 0.04, t * height, z + Math.cos(t * 1.7) * 0.03));
  }
  kit.batch('stem').add(tube(pts, pts.map((_, i) => stemR * (1.25 - 0.35 * Math.sin((i / 6) * Math.PI * 0.8))), 10), new THREE.Matrix4(), tint(rng, 0.04, 0.02, 0xf4eee6), [0, 0, rng.next(), 0]);
  // volva: a torn cup at the base, matching the collision radius
  kit.batch('stem').add(lathe([[radius * 1.0, 0], [radius * 0.98, 0.1], [radius * 0.78, 0.22], [stemR * 1.25, 0.32]], 14), trs(x, 0, z), tint(rng, 0.04, 0.02, 0xe0d6cc), [0, 0, rng.next(), 0]);
  // annulus skirt: a flared ring hanging from the upper stem
  kit.batch('stem').add(PRIM.cone(0.55, 12), trs(x, height * 0.7, z, 0, 0, 0, stemR * 1.8, 0.12, stemR * 1.8), tint(rng, 0.04, 0.02, 0xf8f2ea), [0, 0, rng.next(), 0]);
  mushroom(kit, rng, { x, z, y: height - 0.05, height: 0.05, cap: radius * 1.5, shape: 'lampshade', species: 'mycena', lean: 0, gills: 36, glow: 1 });
  kit.light({ kind: 'bio', fire: false, position: { x, y: height + 0.3, z: z + 0.2 }, color: CYCLES.mycena[6], intensity: 0.45, radius: 2.4, flicker: 0, seed: Math.floor(rng.next() * 1000) });
  // a ring of pinheads around the foot
  for (let i = 0; i < 5; i++) {
    const a = rng.next() * Math.PI * 2;
    mushroom(kit, rng, { x: x + Math.cos(a) * radius * 1.05, z: z + Math.sin(a) * radius * 0.95, height: rng.range(0.1, 0.18), cap: rng.range(0.06, 0.09), shape: 'bell', species: 'mycena', leanDir: a, lean: 0.4, glow: 0.9 });
  }
}

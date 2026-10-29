import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { tint, type Kit } from '../architecture/kit';
import { PRIM, trs, tube } from '../architecture/mesh';
import { skull } from '../architecture/walls';

/**
 * Scattered bones (art bible §10 M4): long bones with knobbed ends, ribs, vertebrae, teeth and the cute
 * round skull. Everything lies flat (≤ 0.12 t tall) so loose bones never read as obstacles; skulls and
 * piles stay against the walls.
 */

export function longBone(kit: Kit, rng: Rng, x: number, y: number, z: number, len: number, yaw: number): void {
  const c = tint(rng, 0.06, 0.02);
  const r = Math.max(0.032, len * 0.06);
  const dx = Math.cos(yaw) * len * 0.5;
  const dz = Math.sin(yaw) * len * 0.5;
  kit.batch('bone').add(tube([new THREE.Vector3(x - dx, y + r, z - dz), new THREE.Vector3(x + dx, y + r, z + dz)], r, 5, false), new THREE.Matrix4(), c);
  const px = -Math.sin(yaw);
  const pz = Math.cos(yaw);
  for (const e of [-1, 1]) {
    for (const s of [-1, 1]) {
      const k = r * 1.25;
      kit.batch('bone').add(PRIM.sphere(5, 4), trs(x + e * dx * 1.04 + s * px * k * 0.7, y + k, z + e * dz * 1.04 + s * pz * k * 0.7, 0, 0, 0, k, k, k), c);
    }
  }
}

export function rib(kit: Kit, rng: Rng, x: number, y: number, z: number, len: number, yaw: number): void {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const a = yaw + (t - 0.5) * 1.6;
    pts.push(new THREE.Vector3(x + Math.cos(a) * len * 0.5, y + 0.025, z + Math.sin(a) * len * 0.5));
  }
  kit.batch('bone').add(tube(pts, pts.map((_, i) => 0.026 - i * 0.002), 4), new THREE.Matrix4(), tint(rng, 0.06, 0.02));
}

export function vertebra(kit: Kit, rng: Rng, x: number, y: number, z: number, s: number): void {
  const c = tint(rng, 0.05, 0.02);
  kit.batch('bone').add(PRIM.cylinder(6), trs(x, y + s * 0.3, z, 0, rng.next() * 3, 0, s, s * 0.6, s), c);
  kit.batch('bone').add(PRIM.cone(0.2, 4), trs(x, y + s * 0.9, z - s * 0.2, -0.6, 0, 0, s * 0.35, s * 0.9, s * 0.3), c);
}

/** A scatter of small bones and teeth around (x, z). */
export function boneScatter(kit: Kit, x: number, z: number, y = 0, radius = 0.35, n = 4, skullChance = 0.35): void {
  const rng = kit.rng.derive(`bones:${x.toFixed(2)},${z.toFixed(2)}`);
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * radius;
    const bx = x + Math.cos(a) * d;
    const bz = z + Math.sin(a) * d * 0.8;
    const r = rng.next();
    if (r < 0.4) longBone(kit, rng, bx, y, bz, rng.range(0.45, 0.75), rng.next() * Math.PI);
    else if (r < 0.65) rib(kit, rng, bx, y, bz, rng.range(0.4, 0.6), rng.next() * Math.PI * 2);
    else if (r < 0.85) vertebra(kit, rng, bx, y, bz, rng.range(0.07, 0.1));
    else kit.batch('bone').add(PRIM.rock(), trs(bx, y + 0.03, bz, rng.next(), rng.next(), 0, 0.04, 0.05, 0.035), tint(rng, 0.04, 0.02, 0xfff6ea));
  }
  if (rng.chance(skullChance)) skull(kit, rng, x + rng.range(-0.1, 0.1), y + 0.12, z, rng.range(0.12, 0.16), rng.range(-0.6, 0.6));
}

/** An ossuary rosette: bones laid radially around a skull, like the insect ossuaries of the bible's B2. */
export function boneRosette(kit: Kit, x: number, z: number, y = 0, r = 0.42): void {
  const rng = kit.rng.derive(`rosette:${x.toFixed(2)},${z.toFixed(2)}`);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.1, 0.1);
    longBone(kit, rng, x + Math.cos(a) * r * 0.62, y, z + Math.sin(a) * r * 0.55, r * 0.7, a);
  }
  skull(kit, rng, x, y + 0.13, z, 0.15, rng.range(-0.3, 0.3));
}

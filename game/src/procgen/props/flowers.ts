import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { tint, type Kit } from '../architecture/kit';
import { lathe, PRIM, trs, tube } from '../architecture/mesh';

/**
 * Funeral flowers (art bible §10 M12 paper): paper chrysanthemums of layered petal rings, trumpet lilies on
 * bent stems, and satin ribbons. Petals are faceted (crease normals), so the toon bands read as folded
 * paper. They stand along wall bases, never in open floor.
 */

export function chrysanthemum(kit: Kit, rng: Rng, x: number, y: number, z: number, r: number, tilt = 0.5, yaw = 0): void {
  const c = tint(rng, 0.04, 0.03, rng.chance(0.3) ? 0xe8dcff : 0xffffff);
  const rings = 3;
  const qTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ'));
  for (let k = 0; k < rings; k++) {
    const n = 9 + k * 3;
    const len = r * (0.45 + 0.28 * (rings - k));
    const lift = 0.4 + k * 0.35;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.4;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, lift, 'YXZ'));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.01 * k, 0), q, new THREE.Vector3(len, r * 0.06, r * 0.17));
      m.premultiply(new THREE.Matrix4().makeTranslation(Math.cos(a) * len * 0.45, 0, Math.sin(a) * len * 0.45));
      m.premultiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), qTilt, new THREE.Vector3(1, 1, 1)));
      kit.batch('paper').add(PRIM.box(), m, c);
    }
  }
  const centre = new THREE.Vector3(0, r * 0.12, 0).applyQuaternion(qTilt).add(new THREE.Vector3(x, y, z));
  kit.batch('gold').add(PRIM.sphere(6, 4), trs(centre.x, centre.y, centre.z, 0, 0, 0, r * 0.2, r * 0.14, r * 0.2), tint(rng, 0.04));
}

export function lily(kit: Kit, rng: Rng, x: number, z: number, h: number, dir: number): void {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    pts.push(new THREE.Vector3(x + Math.cos(dir) * t * t * h * 0.35, t * h, z + Math.sin(dir) * t * t * h * 0.35));
  }
  kit.batch('verdigris').add(tube(pts, 0.022, 4), new THREE.Matrix4(), tint(rng, 0.05));
  const top = pts[5];
  const m = new THREE.Matrix4().compose(top, new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, -dir + Math.PI / 2, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  kit.batch('paper').add(lathe([[0.02, 0], [0.05, 0.06], [0.09, 0.15], [0.16, 0.2]].reverse() as [number, number][], 6), m, tint(rng, 0.03, 0.02, 0xfffaf0));
}

/** A bunch of funeral flowers leaning against a wall (`away` = direction from the wall into the room). */
export function flowerBunch(kit: Kit, x: number, z: number, away: number, y = 0): void {
  const rng = kit.rng.derive(`flowers:${x.toFixed(2)},${z.toFixed(2)}`);
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const a = away + rng.range(-1, 1);
    const d = rng.range(0, 0.22);
    chrysanthemum(kit, rng, x + Math.cos(a) * d, y + rng.range(0.04, 0.18), z + Math.sin(a) * d, rng.range(0.13, 0.19), rng.range(0.3, 0.8), -a + Math.PI / 2);
  }
  if (rng.chance(0.6)) lily(kit, rng, x + rng.range(-0.15, 0.15), z, rng.range(0.3, 0.45), away);
  if (rng.chance(0.5)) ribbon(kit, rng, x, y, z, away);
}

/** A funeral satin ribbon lying in a loose S on the ground. */
export function ribbon(kit: Kit, rng: Rng, x: number, y: number, z: number, dir: number): void {
  const pts: THREE.Vector3[] = [];
  const len = rng.range(0.5, 0.8);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const side = Math.sin(t * Math.PI * 2) * 0.12;
    pts.push(new THREE.Vector3(x + Math.cos(dir) * t * len - Math.sin(dir) * side, y + 0.015, z + Math.sin(dir) * t * len + Math.cos(dir) * side));
  }
  const prim = tube(pts, 0.03, 4, false);
  kit.batch('satin').add(prim, new THREE.Matrix4().makeScale(1, 0.4, 1).premultiply(new THREE.Matrix4().makeTranslation(0, y * 0.6, 0)), tint(rng, 0.05));
}

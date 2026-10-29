import * as THREE from 'three';
import { tint, type Kit } from './kit';
import { boxMatrix, PRIM, trs, tube } from './mesh';
import { pointedArch } from './walls';

/**
 * Room exits (North Star NS-EXIT): a doorway in a side wall closed by a curtain of gills: thin lamellae
 * hanging from a bone lintel between two stem posts, with a thin line of light under it (the exit seam,
 * art bible §18.3 light 19) that Vespers opens. The wall cells of the opening are left out by buildWalls.
 */

export interface ExitSpec {
  /** Which wall the exit is in. */
  readonly facing: 'west' | 'east';
  /** The floor edge line (x of the wall face). */
  readonly line: number;
  /** z range of the opening in tiles. */
  readonly from: number;
  readonly to: number;
  /** Height of the lintel (default 1.4 t). */
  readonly height?: number;
}

/** The wall cells an exit replaces (for WallSpec.openings). */
export function exitCells(e: ExitSpec): [number, number][] {
  const x = e.facing === 'west' ? e.line - 1 : e.line;
  const out: [number, number][] = [];
  for (let z = Math.floor(e.from); z < Math.ceil(e.to); z++) out.push([x, z]);
  return out;
}

export function exitCurtain(kit: Kit, e: ExitSpec): void {
  const rng = kit.rng.derive(`exit:${e.facing}:${e.line}:${e.from}`);
  const h = e.height ?? 1.4;
  const out = e.facing === 'west' ? -1 : 1;
  const x = e.line + out * 0.5;
  // threshold: a worn tomb slab step and dark depth behind the curtain
  const seed = rng.next();
  kit.batch('slab').quad({ x: x - 0.5, y: -0.005, z: e.from }, { x: x - 0.5, y: -0.005, z: e.to }, { x: x + 0.5, y: -0.005, z: e.to }, { x: x + 0.5, y: -0.005, z: e.from }, tint(rng, 0.05, 0.02, 0xa8a0a0), [x - 0.5, e.from, 1, e.to - e.from], [seed, 1, seed, 1]);
  kit.batch('lead').add(PRIM.box(), boxMatrix(x + out * 0.2 - 0.25, 0, e.from, x + out * 0.2 + 0.25, h + 0.2, e.to), tint(rng, 0.02));
  // posts and a pointed lintel of bent stems
  for (const z of [e.from + 0.12, e.to - 0.12]) {
    kit.batch('stem').add(tube([new THREE.Vector3(x, 0, z), new THREE.Vector3(x, h * 0.62, z)], 0.12, 7), new THREE.Matrix4(), tint(rng, 0.04, 0.02), [0, 0, rng.next(), 0]);
  }
  const arch = pointedArch(e.from + 0.12, e.to - 0.12, h * 0.6, h * 0.42, 0, 8).map(p => new THREE.Vector3(x, p.y, p.x));
  kit.batch('stem').add(tube(arch, 0.1, 6), new THREE.Matrix4(), tint(rng, 0.04, 0.02), [0, 0, rng.next(), 0]);
  // the gill curtain: lamellae hanging edge-on to the room, swaying slightly apart
  const n = Math.round((e.to - e.from) * 9);
  for (let i = 0; i < n; i++) {
    const z = e.from + 0.2 + ((e.to - e.from - 0.4) * (i + 0.5)) / n;
    const len = h * rng.range(0.78, 0.96) * (1 - 0.25 * Math.abs((i + 0.5) / n - 0.5));
    kit.batch('capFlesh').add(PRIM.box(), trs(x + rng.range(-0.04, 0.04), h * 0.98 - len / 2 + 0.06, z, 0, rng.range(-0.15, 0.15), 0, 0.42, len, 0.025), tint(rng, 0.05, 0.03), [0, 0, rng.next(), 0]);
  }
  kit.batch('capMycena').add(PRIM.box(), boxMatrix(x - 0.2, 0.0, e.from + 0.2, x + 0.2, 0.03, e.to - 0.2), new THREE.Color(1.4, 1.4, 1.4), [0, 1, 0, 0]);
  kit.light({ kind: 'seam', fire: false, position: { x: x - out * 0.4, y: 0.25, z: (e.from + e.to) / 2 }, color: '#FFF3D4', intensity: 0.35, radius: 1.8, flicker: 0 });
}

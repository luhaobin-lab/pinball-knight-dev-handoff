import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import type { Kit } from '../architecture/kit';

/**
 * Cobwebs (art bible §10 M12): 1-px strands with sparkling dew drops, spun across inner wall corners.
 * Forward layer (drawn after lighting into the lit image), so they never get outlines and never hide the
 * floor: they live in the corner between a north wall face and a side wall.
 */

export interface WebSpec {
  /** The corner apex where the web is anchored (world tiles). */
  readonly apex: THREE.Vector3Like;
  /** Two rim anchor directions from the apex (they span the web). */
  readonly a: THREE.Vector3Like;
  readonly b: THREE.Vector3Like;
  readonly spokes?: number;
  readonly rings?: number;
}

export function cobwebs(kit: Kit, webs: readonly WebSpec[]): void {
  if (webs.length === 0) return;
  const rng = kit.rng.derive('webs');
  const lines: number[] = [];
  const dew: number[] = [];
  for (const w of webs) web(rng, w, lines, dew);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const strands = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color('#8E89A0'), transparent: true, opacity: 0.42, depthWrite: false }));
  strands.name = 'arch-cobwebs';
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dew, 3));
  const drops = new THREE.Points(dg, new THREE.PointsMaterial({ color: new THREE.Color('#E8F4FF'), size: 1, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  drops.name = 'arch-dew';
  kit.forward.push(strands, drops);
}

function web(rng: Rng, w: WebSpec, lines: number[], dew: number[]): void {
  const apex = new THREE.Vector3(w.apex.x, w.apex.y, w.apex.z);
  const a = new THREE.Vector3(w.a.x, w.a.y, w.a.z);
  const b = new THREE.Vector3(w.b.x, w.b.y, w.b.z);
  const spokes = w.spokes ?? 7;
  const rings = w.rings ?? 5;
  const rim: THREE.Vector3[] = [];
  for (let i = 0; i < spokes; i++) {
    const t = i / (spokes - 1);
    const dir = a.clone().lerp(b, t);
    dir.multiplyScalar(0.85 + 0.25 * Math.sin(t * Math.PI) + rng.range(-0.06, 0.06));
    rim.push(apex.clone().add(dir));
    lines.push(apex.x, apex.y, apex.z, apex.x + dir.x, apex.y + dir.y, apex.z + dir.z);
  }
  for (let r = 1; r <= rings; r++) {
    const f = (r / (rings + 1)) ** 1.15;
    for (let i = 0; i < spokes - 1; i++) {
      const p = apex.clone().lerp(rim[i], f);
      const q = apex.clone().lerp(rim[i + 1], f + rng.range(-0.02, 0.02));
      // sag toward the ground between spokes
      const m = p.clone().lerp(q, 0.5);
      m.y -= 0.03 * f;
      lines.push(p.x, p.y, p.z, m.x, m.y, m.z, m.x, m.y, m.z, q.x, q.y, q.z);
      if (rng.chance(0.18)) dew.push(m.x, m.y, m.z);
    }
  }
  // a torn strand trailing down
  if (rng.chance(0.7)) {
    const s = rim[rng.int(1, spokes - 2)];
    lines.push(s.x, s.y, s.z, s.x + rng.range(-0.1, 0.1), s.y - rng.range(0.3, 0.6), s.z + rng.range(0, 0.1));
  }
}

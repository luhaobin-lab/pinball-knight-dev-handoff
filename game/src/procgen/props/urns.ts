import { tint, type Kit } from '../architecture/kit';
import { lathe, PRIM, trs } from '../architecture/mesh';

/**
 * Puffball urns (art bible §10 M16, North Star NS-URNS): wax-sealed ossuary jars, glazed with a verdigris
 * band and a crackle of dark lines, a vermilion wax seal and a puffball bulging out of a crack in the
 * crown. Breakable combat props: the footprint equals the collision radius.
 */
export function urn(kit: Kit, x: number, z: number, radius = 0.45): void {
  const rng = kit.rng.derive(`urn:${x.toFixed(2)},${z.toFixed(2)}`);
  const r = radius;
  const body: [number, number][] = [
    [r * 0.62, 0],
    [r * 0.92, 0.12 * r],
    [r * 1.0, 0.45 * r],
    [r * 0.94, 0.8 * r],
    [r * 0.7, 1.08 * r],
    [r * 0.48, 1.2 * r],
    [r * 0.5, 1.32 * r],
    [r * 0.001, 1.36 * r],
  ];
  const yaw = rng.next() * 6;
  kit.batch('ceramic').add(lathe(body, 14), trs(x, 0, z, 0, yaw, 0), tint(rng, 0.05, 0.03));
  // glaze band and lip
  kit.batch('verdigris').add(PRIM.cylinder(14, false, true), trs(x, 0.6 * r, z, 0, yaw, 0, r * 1.012, 0.16 * r, r * 1.012), tint(rng, 0.05));
  kit.batch('verdigris').add(PRIM.cylinder(12), trs(x, 1.3 * r, z, 0, yaw, 0, r * 0.56, 0.08 * r, r * 0.56), tint(rng, 0.05));
  // vermilion wax seal and its drips
  kit.batch('vermilion').add(PRIM.sphere(8, 5), trs(x, 1.38 * r, z, 0, 0, 0, r * 0.32, r * 0.12, r * 0.32), tint(rng, 0.05));
  for (let i = 0; i < 3; i++) {
    const a = yaw + i * 2.1 + rng.range(-0.3, 0.3);
    kit.batch('vermilion').add(PRIM.cylinder(4), trs(x + Math.cos(a) * r * 0.5, 1.22 * r, z + Math.sin(a) * r * 0.5, 0, 0, 0, 0.02, 0.18 * r, 0.02), tint(rng, 0.05));
  }
  // a puffball pushing out of a crack on the shoulder
  const a = rng.range(-0.6, 0.6) + Math.PI / 2;
  kit.batch('ceramic').add(PRIM.sphere(8, 6), trs(x + Math.cos(a) * r * 0.78, 0.92 * r, z + Math.sin(a) * r * 0.7, 0, 0, 0, r * 0.26, r * 0.22, r * 0.24), tint(rng, 0.03, 0.02, 0xfff8ec));
  // crackle: a few dark slivers on the glaze
  for (let i = 0; i < 4; i++) {
    const ca = rng.next() * Math.PI * 2;
    const cy = rng.range(0.2, 0.9) * r;
    kit.batch('lead').add(PRIM.box(), trs(x + Math.cos(ca) * r * 1.0, cy, z + Math.sin(ca) * r * 1.0, rng.range(-0.8, 0.8), -ca, 0, 0.02, rng.range(0.08, 0.16) * r * 2, 0.02), tint(rng, 0.03));
  }
}

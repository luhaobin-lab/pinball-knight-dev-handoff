import * as THREE from 'three';
import { roundedBox } from '../creatures/shapes';
import type { Look } from './palette';

/**
 * The placeholder vocabulary: seven solids and five glyphs, nothing else. Every enemy, boss and prop of the kit
 * is a combination of these, so a hundred placeholders made by dozens of agents still read as one set.
 *
 *   solids  sphere · capsule · cone · box · torus · disc · ring
 *   glyphs  dot (eyes, seeds, rivets) · line (cracks, strings, runes) · arc (folds, emblems)
 *           · crescent (the grin) · fang (its teeth)
 *
 * Solids are lit toon surfaces with the 1-px outline. Glyphs are flat marks (unlit, no outline) facing the camera
 * side (+z), laid onto a surface vertex by vertex: a decal that hugs a curved body, so a mark never sinks into it
 * and never sticks out of its silhouette when the figure turns.
 * Coordinates are the model's own units ([x, y, z], y up, +z the front); the figure scales them to tiles.
 */

export type V3 = readonly [number, number, number];

export const SOLIDS = ['sphere', 'capsule', 'cone', 'box', 'torus', 'disc', 'ring'] as const;
export const GLYPHS = ['dot', 'line', 'arc', 'crescent', 'fang'] as const;
export type Solid = (typeof SOLIDS)[number];
export type GlyphKind = (typeof GLYPHS)[number];

/** Depth of a surface at (x, y) of the model, for glyphs laid on it (undefined: the glyph's own z). */
export type Surface = (x: number, y: number) => number;

/** A sphere's front: z where the ray from the camera side meets the ellipsoid at `c` with radii `r`. */
export function sphereFront(c: V3, r: V3, lift = 0.01): Surface {
  return (x, y) => {
    const u = (x - c[0]) / r[0];
    const v = (y - c[1]) / r[1];
    return c[2] + r[2] * Math.sqrt(Math.max(0, 1 - u * u - v * v)) + lift;
  };
}

/** A plane through `p` with normal `n` (the depth where (x, y) meets it). */
export function planeFront(p: V3, n: V3, lift = 0.01): Surface {
  return (x, y) => p[2] - (n[0] * (x - p[0]) + n[1] * (y - p[1])) / n[2] + lift;
}

const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const geometries = new Map<string, THREE.BufferGeometry>();

/** Shared solid buffers belong to the kit cache, never to an individual prop/creature instance. */
export function isSharedSculptGeometry(geometry: THREE.BufferGeometry): boolean {
  for (const g of geometries.values()) if (g === geometry) return true;
  return false;
}

/** One shared geometry per solid and size: placeholders repeat the same shapes many times. */
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}

const q = (v: number): string => v.toFixed(3);

/** Puts a Y-up part between a and b: centred, its +Y along a→b. */
function between(o: THREE.Object3D, a: V3, b: V3): void {
  tmpA.set(a[0], a[1], a[2]);
  tmpB.set(b[0], b[1], b[2]).sub(tmpA);
  o.position.copy(tmpA).addScaledVector(tmpB, 0.5);
  if (tmpB.lengthSq() > 1e-18) o.quaternion.setFromUnitVectors(UP, tmpB.normalize());
}

export interface SolidOptions {
  /** Euler rotation in radians. */
  rot?: V3;
  name?: string;
}

/** Layer a glyph sits on, in front of its surface: 1 the ground mark (socket, mouth), 2 what lies in it. */
export type Layer = 1 | 2 | 3;
/** Depth between glyph layers (model units). */
const LAYER = 0.006;

type Pt = readonly [number, number];

/**
 * Builds parts into groups with one material per look (the caller's factory decides lit / unlit, rim and emissive).
 * Every mesh it makes is listed in `meshes` with its look.
 */
export class Sculptor {
  readonly meshes: { mesh: THREE.Mesh; look: Look; kind: Solid | GlyphKind }[] = [];

  constructor(private readonly material: (look: Look) => THREE.Material) {}

  group(parent: THREE.Object3D, at: V3 = [0, 0, 0], rot?: V3, name?: string): THREE.Group {
    const g = new THREE.Group();
    g.position.set(...at);
    if (rot) g.rotation.set(...rot);
    if (name) g.name = name;
    parent.add(g);
    return g;
  }

  private add(parent: THREE.Object3D, look: Look, kind: Solid | GlyphKind, geometry: THREE.BufferGeometry, name?: string): THREE.Mesh {
    const m = new THREE.Mesh(geometry, this.material(look));
    m.name = name ?? `${kind}:${look}`;
    parent.add(m);
    this.meshes.push({ mesh: m, look, kind });
    return m;
  }

  /** Sphere or ellipsoid of radii `r` centred at `at`. */
  sphere(parent: THREE.Object3D, look: Look, at: V3, r: number | V3, o: SolidOptions = {}): THREE.Mesh {
    const radii: V3 = typeof r === 'number' ? [r, r, r] : r;
    const m = this.add(parent, look, 'sphere', cached('sphere', () => new THREE.SphereGeometry(1, 20, 14)), o.name);
    m.position.set(...at);
    m.scale.set(...radii);
    if (o.rot) m.rotation.set(...o.rot);
    return m;
  }

  /** Capsule of radius r from point a to point b (round ends at both). */
  capsule(parent: THREE.Object3D, look: Look, a: V3, b: V3, r: number, o: SolidOptions = {}): THREE.Mesh {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const m = this.add(parent, look, 'capsule', cached(`capsule:${q(r)}:${q(len)}`, () => new THREE.CapsuleGeometry(r, len, 4, 12)), o.name);
    between(m, a, b);
    return m;
  }

  /** Cone from the centre of its base to its tip; `sides` 3–6 makes crystals and blades, 8–12 horns and spikes. */
  cone(parent: THREE.Object3D, look: Look, base: V3, tip: V3, r: number, sides = 12, o: SolidOptions & { spin?: number; flat?: number } = {}): THREE.Mesh {
    const len = Math.hypot(tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]);
    const geo = cached(`cone:${sides}`, () => new THREE.ConeGeometry(1, 1, sides, 1));
    const m = this.add(parent, look, 'cone', geo, o.name);
    // the unit cone is centred on its height, so the midpoint of base and tip places it
    between(m, base, tip);
    m.scale.set(r, len, r * (o.flat ?? 1));
    if (o.spin) m.rotateY(o.spin);
    return m;
  }

  /** Box of `size` centred at `at`, edges rounded by `bevel` × the smallest side. */
  box(parent: THREE.Object3D, look: Look, at: V3, size: V3, o: SolidOptions & { bevel?: number } = {}): THREE.Mesh {
    const bevel = (o.bevel ?? 0.18) * Math.min(...size);
    const m = this.add(parent, look, 'box', cached(`box:${size.map(q).join(',')}:${q(bevel)}`, () => roundedBox(size[0], size[1], size[2], bevel, 2)), o.name);
    m.position.set(...at);
    if (o.rot) m.rotation.set(...o.rot);
    return m;
  }

  /**
   * Torus of radius R and tube radius `tube`, lying in its local XY plane (rot [π/2, 0, 0] lays it flat); `axis`
   * instead turns its hole along that direction (rings around a limb).
   */
  torus(parent: THREE.Object3D, look: Look, at: V3, R: number, tube: number, o: SolidOptions & { arc?: number; axis?: V3 } = {}): THREE.Mesh {
    const arc = o.arc ?? Math.PI * 2;
    const m = this.add(parent, look, 'torus', cached(`torus:${q(tube / R)}:${q(arc)}`, () => new THREE.TorusGeometry(1, tube / R, 8, 28, arc)), o.name);
    m.position.set(...at);
    m.scale.setScalar(R);
    if (o.axis) m.quaternion.setFromUnitVectors(FRONT, tmpA.set(...o.axis).normalize());
    else if (o.rot) m.rotation.set(...o.rot);
    return m;
  }

  /** Flat cylinder of radius r and thickness `t` (axis Y): plates, coins, bases, snouts. */
  disc(parent: THREE.Object3D, look: Look, at: V3, r: number, t: number, o: SolidOptions = {}): THREE.Mesh {
    const m = this.add(parent, look, 'disc', cached('disc', () => new THREE.CylinderGeometry(1, 1, 1, 24)), o.name);
    m.position.set(...at);
    m.scale.set(r, t, r);
    if (o.rot) m.rotation.set(...o.rot);
    return m;
  }

  /** Flat ring (a washer) of outer radius r and band width w, thickness t (axis Y). */
  ring(parent: THREE.Object3D, look: Look, at: V3, r: number, w: number, t: number, o: SolidOptions = {}): THREE.Mesh {
    const m = this.add(parent, look, 'ring', cached(`ring:${q(w / r)}`, () => washer(1 - w / r)), o.name);
    m.position.set(...at);
    m.scale.set(r, t, r);
    if (o.rot) m.rotation.set(...o.rot);
    return m;
  }

  // ---- glyphs: flat marks laid on a surface ----------------------------------------------------------

  /**
   * A glyph from its outline (closed, in the parent's x, y) and optional holes, laid on `on` (or at depth `z`) on
   * `layer`. The mesh sits at `pivot` (its vertices relative to it), so scaling it grows or opens the mark there.
   */
  private glyph(parent: THREE.Object3D, look: Look, kind: GlyphKind, outline: readonly Pt[], pivot: Pt, z: number, on: Surface | undefined, layer: Layer, holes: readonly (readonly Pt[])[] = []): THREE.Mesh {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const flat = new THREE.ShapeGeometry(shape);
    const pos = flat.getAttribute('position') as THREE.BufferAttribute;
    const lift = layer * LAYER;
    const pz = (on ? on(pivot[0], pivot[1]) : z) + lift;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setXYZ(i, x - pivot[0], y - pivot[1], (on ? on(x, y) : z) + lift - pz);
    }
    flat.computeVertexNormals();
    const m = this.add(parent, look, kind, flat);
    m.position.set(pivot[0], pivot[1], pz);
    return m;
  }

  /** A round mark of radius r (or radii [rx, ry]) at (x, y); `squareHole` cuts a square of that half-size (a 方孔钱). */
  dot(parent: THREE.Object3D, look: Look, at: V3, r: number | readonly [number, number], on?: Surface, layer: Layer = 1, squareHole = 0): THREE.Mesh {
    const [rx, ry] = typeof r === 'number' ? [r, r] : r;
    const n = 20;
    const pts = Array.from({ length: n }, (_, i): Pt => [at[0] + Math.cos((i / n) * Math.PI * 2) * rx, at[1] + Math.sin((i / n) * Math.PI * 2) * ry]);
    const s = squareHole;
    const hole: Pt[] = [[at[0] - s, at[1] - s], [at[0] + s, at[1] - s], [at[0] + s, at[1] + s], [at[0] - s, at[1] + s]];
    return this.glyph(parent, look, 'dot', pts, [at[0], at[1]], at[2], on, layer, s > 0 ? [hole] : []);
  }

  /** A stroke of width w from a to b (round caps), laid on the surface. */
  line(parent: THREE.Object3D, look: Look, a: V3, b: V3, w: number, on?: Surface, layer: Layer = 1): THREE.Mesh {
    return this.stroke(parent, look, 'line', a, b, w, on, layer);
  }

  /** An arc of radius R and stroke width w from angle a0 to a1 (radians, 0 = +x, counter-clockwise). */
  arc(parent: THREE.Object3D, look: Look, at: V3, R: number, w: number, a0: number, a1: number, on?: Surface, layer: Layer = 1): THREE.Mesh {
    const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-6;
    const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * 8));
    const ring = (r: number, i: number): Pt => {
      const t = a0 + ((a1 - a0) * i) / n;
      return [at[0] + Math.cos(t) * r, at[1] + Math.sin(t) * r];
    };
    const inner = Math.max(0, R - w / 2);
    if (full) {
      const outer = Array.from({ length: n }, (_, i) => ring(R + w / 2, i));
      const hole = Array.from({ length: n }, (_, i) => ring(inner, i));
      return this.glyph(parent, look, 'arc', outer, [at[0], at[1]], at[2], on, layer, inner > 0 ? [hole] : []);
    }
    const outer = Array.from({ length: n + 1 }, (_, i) => ring(R + w / 2, i));
    const back = Array.from({ length: n + 1 }, (_, i) => ring(inner, n - i));
    return this.glyph(parent, look, 'arc', [...outer, ...back], [at[0], at[1]], at[2], on, layer);
  }

  /**
   * The grin: a crescent between two circular lips that meet in pointed corners at (x ± width/2, y). The upper
   * lip dips `rise` below the corners at the middle, the lower lip `rise + open` (a smile: the corners rise).
   * Its pivot is the middle of the corner line, so scale y opens it.
   */
  crescent(parent: THREE.Object3D, look: Look, at: V3, width: number, rise: number, open: number, on?: Surface, layer: Layer = 1): THREE.Mesh {
    const n = 18;
    const lip = (dip: number, i: number): Pt => {
      const t = i / n;
      const x = (t - 0.5) * width;
      // a circular arc through both corners and (0, −dip)
      const a = width / 2;
      const R = (a * a + dip * dip) / (2 * dip);
      return [at[0] + x, at[1] + R - dip - Math.sqrt(Math.max(0, R * R - x * x))];
    };
    const lower = Array.from({ length: n + 1 }, (_, i) => lip(rise + open, i));
    const upper = Array.from({ length: n - 1 }, (_, i) => lip(rise, n - 1 - i));
    return this.glyph(parent, look, 'crescent', [...lower, ...upper], [at[0], at[1]], at[2], on, layer);
  }

  /** A pointed tooth: a triangle with its base centred at (x, y), `w` wide, its point `h` away along `dir` (−1 down). */
  fang(parent: THREE.Object3D, look: Look, at: V3, w: number, h: number, dir: 1 | -1, on?: Surface, layer: Layer = 2): THREE.Mesh {
    const pts: Pt[] = dir < 0 ? [[at[0] - w / 2, at[1]], [at[0], at[1] - h], [at[0] + w / 2, at[1]]] : [[at[0] - w / 2, at[1]], [at[0] + w / 2, at[1]], [at[0], at[1] + h]];
    return this.glyph(parent, look, 'fang', pts, [at[0], at[1]], at[2], on, layer);
  }

  /** A capsule outline from a to b: the cap around b from its left side through its tip, then the cap around a. */
  private stroke(parent: THREE.Object3D, look: Look, kind: 'line', a: V3, b: V3, w: number, on: Surface | undefined, layer: Layer): THREE.Mesh {
    const phi = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const r = w / 2;
    const cap = 6;
    const pts: Pt[] = [];
    for (let i = 0; i <= cap; i++) {
      const t = phi + Math.PI / 2 - (i / cap) * Math.PI;
      pts.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]);
    }
    for (let i = 0; i <= cap; i++) {
      const t = phi - Math.PI / 2 - (i / cap) * Math.PI;
      pts.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]);
    }
    return this.glyph(parent, look, kind, pts, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], (a[2] + b[2]) / 2, on, layer);
  }
}

/** A washer of outer radius 1 and inner radius `inner`, height 1 (axis Y), with its walls. */
function washer(inner: number): THREE.BufferGeometry {
  const pts = [new THREE.Vector2(inner, -0.5), new THREE.Vector2(1, -0.5), new THREE.Vector2(1, 0.5), new THREE.Vector2(inner, 0.5), new THREE.Vector2(inner, -0.5)];
  return new THREE.LatheGeometry(pts, 28);
}

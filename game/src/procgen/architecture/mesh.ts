import * as THREE from 'three';

/**
 * Geometry accumulation for merged static meshes: one MeshBuilder per material batch, thousands of
 * transformed primitives appended into plain arrays, one BufferGeometry at the end (one draw call).
 *
 * Vertex colours are linear tints that multiply the toon ramp colour (1 = the ramp itself). The optional
 * `aData` vec4 attribute carries per-piece parameters for material hooks (seeds, glow masks, ids).
 */

export type Vec4 = readonly [number, number, number, number];

/** A primitive in object space. Normals are per vertex (flat primitives are non-indexed). */
export interface Primitive {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array | null;
}

const ZERO4: Vec4 = [0, 0, 0, 0];
const v = new THREE.Vector3();
const nm = new THREE.Matrix3();

export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly uv: number[] = [];
  private readonly dat: number[] = [];
  private readonly idx: number[] = [];
  private usesData = false;

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get triangleCount(): number {
    return this.idx.length / 3;
  }

  /** Appends `prim` transformed by `matrix`, tinted by `color`, with `data` on every vertex. */
  add(prim: Primitive, matrix: THREE.Matrix4, color: THREE.Color, data: Vec4 = ZERO4, uvTransform?: (u: number, v: number) => [number, number]): this {
    const base = this.vertexCount;
    nm.getNormalMatrix(matrix);
    const p = prim.positions;
    const n = prim.normals;
    const count = p.length / 3;
    if (data !== ZERO4) this.usesData = true;
    for (let i = 0; i < count; i++) {
      v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z);
      v.set(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]).applyMatrix3(nm).normalize();
      this.nor.push(v.x, v.y, v.z);
      this.col.push(color.r, color.g, color.b);
      if (uvTransform) this.uv.push(...uvTransform(prim.uvs[i * 2], prim.uvs[i * 2 + 1]));
      else this.uv.push(prim.uvs[i * 2], prim.uvs[i * 2 + 1]);
      this.dat.push(data[0], data[1], data[2], data[3]);
    }
    if (prim.indices) {
      for (const i of prim.indices) this.idx.push(base + i);
    } else {
      for (let i = 0; i < count; i++) this.idx.push(base + i);
    }
    // A mirroring matrix flips the winding; restore it so front faces stay front faces.
    if (matrix.determinant() < 0) {
      const start = this.idx.length - (prim.indices ? prim.indices.length : count);
      for (let i = start; i < this.idx.length; i += 3) {
        const t = this.idx[i + 1];
        this.idx[i + 1] = this.idx[i + 2];
        this.idx[i + 2] = t;
      }
    }
    return this;
  }

  /** One flat quad a→b→c→d (counter-clockwise seen from the front), uv (0,0)→(1,0)→(1,1)→(0,1). */
  quad(a: THREE.Vector3Like, b: THREE.Vector3Like, c: THREE.Vector3Like, d: THREE.Vector3Like, color: THREE.Color, data: Vec4 = ZERO4, uv: Vec4 = [0, 0, 1, 1]): this {
    const base = this.vertexCount;
    const e1 = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const e2 = new THREE.Vector3(d.x - a.x, d.y - a.y, d.z - a.z);
    const normal = e1.cross(e2).normalize();
    const corners = [a, b, c, d];
    const uvs = [uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]];
    if (data !== ZERO4) this.usesData = true;
    corners.forEach((p, i) => {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(normal.x, normal.y, normal.z);
      this.col.push(color.r, color.g, color.b);
      this.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
      this.dat.push(data[0], data[1], data[2], data[3]);
    });
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  build(name: string): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.name = name;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.usesData) g.setAttribute('aData', new THREE.Float32BufferAttribute(this.dat, 4));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

function fromGeometry(geometry: THREE.BufferGeometry, flat: boolean): Primitive {
  let g = geometry;
  if (flat) {
    g = g.index ? g.toNonIndexed() : g;
    g.computeVertexNormals();
  } else if (!g.getAttribute('normal')) {
    g.computeVertexNormals();
  }
  const uv = g.getAttribute('uv');
  const count = g.getAttribute('position').count;
  return {
    positions: new Float32Array(g.getAttribute('position').array),
    normals: new Float32Array(g.getAttribute('normal').array),
    uvs: uv ? new Float32Array(uv.array) : new Float32Array(count * 2),
    indices: g.index ? new Uint32Array(g.index.array) : null,
  };
}

const cache = new Map<string, Primitive>();

function cached(key: string, make: () => Primitive): Primitive {
  let p = cache.get(key);
  if (!p) {
    p = make();
    cache.set(key, p);
  }
  return p;
}

/** Unit primitives (centred, size 1) and generated shapes. Flat ones suit stone and wood (faceted toon bands). */
export const PRIM = {
  /** Unit cube centred at the origin, flat shaded. */
  box: (): Primitive => cached('box', () => fromGeometry(new THREE.BoxGeometry(1, 1, 1), true)),
  /** Unit-height cylinder (radius 1 at both ends, centred), `sides` facets. */
  cylinder: (sides: number, flat = false, open = false): Primitive =>
    cached(`cyl${sides}${flat}${open}`, () => fromGeometry(new THREE.CylinderGeometry(1, 1, 1, sides, 1, open), flat)),
  /** Truncated cone, bottom radius 1, top radius `top`, height 1, centred. */
  cone: (top: number, sides: number, flat = false): Primitive =>
    cached(`cone${top}:${sides}${flat}`, () => fromGeometry(new THREE.CylinderGeometry(top, 1, 1, sides, 1), flat)),
  /** Unit sphere (radius 1). */
  sphere: (w: number, h: number, flat = false): Primitive => cached(`sph${w}:${h}${flat}`, () => fromGeometry(new THREE.SphereGeometry(1, w, h), flat)),
  /** Upper hemisphere (radius 1). */
  dome: (w: number, h: number): Primitive => cached(`dome${w}:${h}`, () => fromGeometry(new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2), false)),
  /** Regular polyhedron chunk (radius 1), flat: rubble, pebbles, wax lumps. */
  rock: (detail = 0): Primitive => cached(`rock${detail}`, () => fromGeometry(new THREE.DodecahedronGeometry(1, detail), true)),
  /** Flat horizontal disc (radius 1) facing +y. */
  disc: (sides: number): Primitive => cached(`disc${sides}`, () => fromGeometry(new THREE.CircleGeometry(1, sides).rotateX(-Math.PI / 2), false)),
  /** Flat quad 1×1 in the xy plane facing +z. */
  plane: (): Primitive => cached('plane', () => fromGeometry(new THREE.PlaneGeometry(1, 1), false)),
  fromGeometry,
};

/**
 * Lathe around +y from a profile of (radius, height) points (bottom to top). uv.x = angle / 2π,
 * uv.y = profile parameter 0..1. Smooth normals.
 */
export function lathe(profile: readonly (readonly [number, number])[], sides: number, phase = 0): Primitive {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)),
    sides,
    phase,
    Math.PI * 2,
  );
  return fromGeometry(g, false);
}

/**
 * A tube along a polyline with per-point radius: `sides` facets, parallel-transport frames, capped ends.
 * uv.x = around 0..1, uv.y = along 0..1. Used for arches, ribs, roots and stems.
 */
export function tube(points: readonly THREE.Vector3[], radii: readonly number[] | number, sides: number, caps = true): Primitive {
  const n = points.length;
  if (n < 2) throw new Error('tube: needs at least two points');
  const radius = (i: number): number => (typeof radii === 'number' ? radii : radii[Math.min(i, radii.length - 1)]);
  const tangents: THREE.Vector3[] = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    return new THREE.Vector3().subVectors(b, a).normalize();
  });
  const normals: THREE.Vector3[] = [];
  const t0 = tangents[0];
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  normals[0] = new THREE.Vector3().crossVectors(t0, ref).normalize();
  for (let i = 1; i < n; i++) {
    const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i]);
    const nPrev = normals[i - 1].clone();
    if (axis.lengthSq() > 1e-10) {
      axis.normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(tangents[i - 1].dot(tangents[i]), -1, 1));
      nPrev.applyAxisAngle(axis, angle);
    }
    normals[i] = nPrev;
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const ring = sides + 1;
  for (let i = 0; i < n; i++) {
    const t = tangents[i];
    const nn = normals[i];
    const bn = new THREE.Vector3().crossVectors(t, nn);
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const dir = nn.clone().multiplyScalar(Math.cos(a)).addScaledVector(bn, Math.sin(a));
      const p = points[i].clone().addScaledVector(dir, radius(i));
      pos.push(p.x, p.y, p.z);
      nor.push(dir.x, dir.y, dir.z);
      uvs.push(s / sides, i / (n - 1));
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * ring + s;
      const b = a + ring;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  if (caps) {
    for (const end of [0, n - 1]) {
      const centre = pos.length / 3;
      const t = tangents[end].clone().multiplyScalar(end === 0 ? -1 : 1);
      pos.push(points[end].x, points[end].y, points[end].z);
      nor.push(t.x, t.y, t.z);
      uvs.push(0.5, end === 0 ? 0 : 1);
      for (let s = 0; s < sides; s++) {
        const a = end * ring + s;
        if (end === 0) idx.push(centre, a + 1, a);
        else idx.push(centre, a, a + 1);
      }
    }
  }
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(idx),
  };
}

/** Extrudes a closed 2D outline (xy, counter-clockwise) by `depth` along +z from z = 0, flat shaded. */
export function extrude(outline: readonly THREE.Vector2[], depth: number): Primitive {
  const shape = new THREE.Shape(outline.map(p => p.clone()));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  return fromGeometry(g, true);
}

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

/** Matrix from position, Euler rotation (radians, XYZ order) and scale. */
export function trs(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz, 'YXZ')), tmpS.set(sx, sy, sz));
}

/** Matrix that maps the unit cube onto the axis-aligned box [x0,x1]×[y0,y1]×[z0,z1]. */
export function boxMatrix(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, ry = 0): THREE.Matrix4 {
  return trs((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, ry, 0, x1 - x0, y1 - y0, z1 - z0);
}

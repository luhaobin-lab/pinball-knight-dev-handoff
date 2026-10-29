import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import type { Kit } from '../architecture/kit';

/**
 * Hanging roots as Verlet-ready chains (art bible §16.3: CPU Verlet in typed arrays, zero allocation per
 * frame). Each chain is a run of nodes with rest lengths and pins; a rootlet can hang from another chain's
 * node. One dynamic tube mesh draws all chains of a room.
 *
 * The solver here is the reference one (gravity, damping, a slow idle sway, impulses); the VFX lane can
 * drive `impulse()` from the trauma bus or replace `step()` without touching the data layout.
 */

export interface ChainSpec {
  /** Anchor in world tiles. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly nodes: number;
  /** Segment length in tiles. */
  readonly segment: number;
  /** Radius at the anchor and at the tip. */
  readonly r0: number;
  readonly r1: number;
  /** Initial direction of fall (unit-ish), e.g. out from a wall and down. */
  readonly dir?: THREE.Vector3Like;
  /** Hang from another chain's node instead of a fixed anchor. */
  readonly parent?: { chain: number; node: number };
  /** Keep nodes on the positive side of a plane, e.g. in front of the wall face they drape over. */
  readonly plane?: { readonly normal: THREE.Vector3Like; readonly offset: number };
}

export class VerletRoots {
  readonly count: number;
  readonly pos: Float32Array;
  readonly prev: Float32Array;
  readonly anchor: Float32Array;
  readonly radius: Float32Array;
  /** Start node of each chain and its node count. */
  readonly start: Uint16Array;
  readonly length: Uint16Array;
  readonly rest: Float32Array;
  readonly parent: Int32Array;
  readonly sway: Float32Array;
  /** Per chain: plane normal xyz and offset (normal 0 = unconstrained). */
  readonly plane: Float32Array;
  gravity = -6;
  damping = 0.985;
  iterations = 3;
  private readonly impulses: { x: number; y: number; z: number; s: number; r: number }[] = [];

  constructor(specs: readonly ChainSpec[], rng: Rng) {
    const total = specs.reduce((n, s) => n + s.nodes, 0);
    this.count = specs.length;
    this.pos = new Float32Array(total * 3);
    this.prev = new Float32Array(total * 3);
    this.anchor = new Float32Array(specs.length * 3);
    this.radius = new Float32Array(total);
    this.rest = new Float32Array(total);
    this.start = new Uint16Array(specs.length);
    this.length = new Uint16Array(specs.length);
    this.parent = new Int32Array(specs.length).fill(-1);
    this.sway = new Float32Array(specs.length);
    this.plane = new Float32Array(specs.length * 4);
    let at = 0;
    specs.forEach((s, c) => {
      this.start[c] = at;
      this.length[c] = s.nodes;
      this.sway[c] = rng.range(0, Math.PI * 2);
      if (s.plane) this.plane.set([s.plane.normal.x, s.plane.normal.y, s.plane.normal.z, s.plane.offset], c * 4);
      let ox = s.x;
      let oy = s.y;
      let oz = s.z;
      if (s.parent) {
        const p = this.start[s.parent.chain] + s.parent.node;
        this.parent[c] = p;
        ox = this.pos[p * 3];
        oy = this.pos[p * 3 + 1];
        oz = this.pos[p * 3 + 2];
      }
      this.anchor.set([ox, oy, oz], c * 3);
      const d = new THREE.Vector3(s.dir?.x ?? 0, s.dir?.y ?? -1, s.dir?.z ?? 0).normalize();
      for (let i = 0; i < s.nodes; i++) {
        const t = i / Math.max(1, s.nodes - 1);
        // hang: blend from the initial direction toward straight down along the chain
        const dir = d.clone().lerp(new THREE.Vector3(rng.range(-0.15, 0.15), -1, rng.range(-0.1, 0.1)), t).normalize();
        if (i > 0) {
          ox += dir.x * s.segment;
          oy += dir.y * s.segment;
          oz += dir.z * s.segment;
        }
        this.pos.set([ox, oy, oz], (at + i) * 3);
        this.prev.set([ox, oy, oz], (at + i) * 3);
        this.radius[at + i] = s.r0 + (s.r1 - s.r0) * t;
        this.rest[at + i] = s.segment;
      }
      at += s.nodes;
    });
  }

  /** Pushes nodes within `radius` of a point (tiles) by `strength` tiles per second, outward. */
  impulse(point: THREE.Vector3Like, strength: number, radius = 2): void {
    this.impulses.push({ x: point.x, y: point.y, z: point.z, s: strength, r: radius });
  }

  step(dt: number, time: number): void {
    if (dt <= 0) return;
    const h = Math.min(dt, 1 / 30);
    const p = this.pos;
    const q = this.prev;
    for (let c = 0; c < this.count; c++) {
      const s = this.start[c];
      const n = this.length[c];
      const wind = 0.35 * Math.sin(time * 0.7 + this.sway[c]) + 0.2 * Math.sin(time * 1.9 + this.sway[c] * 2);
      for (let i = s + 1; i < s + n; i++) {
        const k = i * 3;
        for (let a = 0; a < 3; a++) {
          const v = (p[k + a] - q[k + a]) * this.damping;
          q[k + a] = p[k + a];
          const acc = a === 1 ? this.gravity : a === 0 ? wind : wind * 0.4;
          p[k + a] += v + acc * h * h;
        }
        for (const im of this.impulses) {
          const dx = p[k] - im.x;
          const dy = p[k + 1] - im.y;
          const dz = p[k + 2] - im.z;
          const d = Math.hypot(dx, dy, dz);
          if (d > im.r || d < 1e-5) continue;
          const f = (im.s * h * (1 - d / im.r)) / d;
          p[k] += dx * f;
          p[k + 1] += dy * f;
          p[k + 2] += dz * f;
        }
      }
    }
    this.impulses.length = 0;
    for (let it = 0; it < this.iterations; it++) {
      for (let c = 0; c < this.count; c++) {
        const s = this.start[c];
        const par = this.parent[c];
        const ax = par >= 0 ? p[par * 3] : this.anchor[c * 3];
        const ay = par >= 0 ? p[par * 3 + 1] : this.anchor[c * 3 + 1];
        const az = par >= 0 ? p[par * 3 + 2] : this.anchor[c * 3 + 2];
        p[s * 3] = ax;
        p[s * 3 + 1] = ay;
        p[s * 3 + 2] = az;
        for (let i = s + 1; i < s + this.length[c]; i++) {
          const a = (i - 1) * 3;
          const b = i * 3;
          const dx = p[b] - p[a];
          const dy = p[b + 1] - p[a + 1];
          const dz = p[b + 2] - p[a + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          const diff = (d - this.rest[i]) / d;
          const wa = i - 1 === s ? 0 : 0.5;
          const wb = 1 - wa;
          p[a] += dx * diff * wa;
          p[a + 1] += dy * diff * wa;
          p[a + 2] += dz * diff * wa;
          p[b] -= dx * diff * wb;
          p[b + 1] -= dy * diff * wb;
          p[b + 2] -= dz * diff * wb;
        }
        const nx = this.plane[c * 4];
        const ny = this.plane[c * 4 + 1];
        const nz = this.plane[c * 4 + 2];
        if (nx !== 0 || ny !== 0 || nz !== 0) {
          for (let i = s + 1; i < s + this.length[c]; i++) {
            const k = i * 3;
            const d = p[k] * nx + p[k + 1] * ny + p[k + 2] * nz - this.plane[c * 4 + 3];
            if (d < 0) {
              p[k] -= nx * d;
              p[k + 1] -= ny * d;
              p[k + 2] -= nz * d;
            }
          }
        }
      }
    }
  }
}

const SIDES = 4;
const TMP_T = new THREE.Vector3();
const TMP_N = new THREE.Vector3();
const TMP_B = new THREE.Vector3();
const REF = new THREE.Vector3(0, 0, 1);

/** One dynamic mesh drawing every chain of `roots` as a tapered tube (rebuilt in place each frame). */
export class RootMesh {
  readonly mesh: THREE.Mesh;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;

  constructor(
    readonly roots: VerletRoots,
    material: THREE.Material,
  ) {
    const nodes = roots.pos.length / 3;
    const verts = nodes * (SIDES + 1);
    this.positions = new Float32Array(verts * 3);
    this.normals = new Float32Array(verts * 3);
    const uvs = new Float32Array(verts * 2);
    const colors = new Float32Array(verts * 3).fill(1);
    const index: number[] = [];
    for (let c = 0; c < roots.count; c++) {
      const s = roots.start[c];
      const n = roots.length[c];
      for (let i = 0; i < n; i++) {
        for (let k = 0; k <= SIDES; k++) {
          const v = (s + i) * (SIDES + 1) + k;
          uvs[v * 2] = k / SIDES;
          uvs[v * 2 + 1] = i / Math.max(1, n - 1);
        }
        if (i === n - 1) continue;
        for (let k = 0; k < SIDES; k++) {
          const a = (s + i) * (SIDES + 1) + k;
          const b = a + SIDES + 1;
          index.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // aData.y: the last nodes of every chain glow (rhizomorph tips), aData.z: a seed for the fibres
    const data = new Float32Array(verts * 4);
    for (let c = 0; c < roots.count; c++) {
      const s = roots.start[c];
      const n = roots.length[c];
      for (let i = 0; i < n; i++) {
        const glow = i >= n - 2 ? (i === n - 1 ? 0.9 : 0.35) : 0;
        for (let k = 0; k <= SIDES; k++) {
          const v = (s + i) * (SIDES + 1) + k;
          data[v * 4 + 1] = glow;
          data[v * 4 + 2] = c * 0.37;
        }
      }
    }
    g.setAttribute('aData', new THREE.BufferAttribute(data, 4));
    g.setIndex(index);
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.name = 'arch-roots';
    this.mesh.frustumCulled = false;
    this.update();
  }

  update(): void {
    const p = this.roots.pos;
    const out = this.positions;
    const nor = this.normals;
    const t = TMP_T;
    const n = TMP_N;
    const b = TMP_B;
    const ref = REF;
    for (let c = 0; c < this.roots.count; c++) {
      const s = this.roots.start[c];
      const len = this.roots.length[c];
      for (let i = 0; i < len; i++) {
        const j = s + i;
        const a = Math.max(s, j - 1);
        const z = Math.min(s + len - 1, j + 1);
        t.set(p[z * 3] - p[a * 3], p[z * 3 + 1] - p[a * 3 + 1], p[z * 3 + 2] - p[a * 3 + 2]).normalize();
        n.crossVectors(t, ref).normalize();
        b.crossVectors(t, n);
        const r = this.roots.radius[j];
        for (let k = 0; k <= SIDES; k++) {
          const ang = (k / SIDES) * Math.PI * 2;
          const cx = Math.cos(ang);
          const sx = Math.sin(ang);
          const v = (j * (SIDES + 1) + k) * 3;
          const dx = n.x * cx + b.x * sx;
          const dy = n.y * cx + b.y * sx;
          const dz = n.z * cx + b.z * sx;
          out[v] = p[j * 3] + dx * r;
          out[v + 1] = p[j * 3 + 1] + dy * r;
          out[v + 2] = p[j * 3 + 2] + dz * r;
          nor[v] = dx;
          nor[v + 1] = dy;
          nor[v + 2] = dz;
        }
      }
    }
    const g = this.mesh.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('normal').needsUpdate = true;
  }
}

/**
 * A hanging root with 1–3 rootlets, draped over a north wall's coping at (x, y, z) and kept in front of
 * the wall face at z = `faceZ`.
 */
export function rootSpecs(rng: Rng, x: number, y: number, z: number, length: number, first: number, faceZ = z - 0.12): ChainSpec[] {
  const nodes = Math.max(4, Math.round(length / 0.16));
  const plane = { normal: { x: 0, y: 0, z: 1 }, offset: faceZ + 0.06 };
  const specs: ChainSpec[] = [{ x, y, z, nodes, segment: length / (nodes - 1), r0: 0.12, r1: 0.045, dir: { x: rng.range(-0.3, 0.3), y: -0.2, z: 1 }, plane }];
  const lets = rng.int(1, 3);
  for (let i = 0; i < lets; i++) {
    const node = rng.int(1, Math.max(1, nodes - 3));
    const ln = rng.range(0.3, 0.6) * length;
    const n2 = Math.max(3, Math.round(ln / 0.14));
    specs.push({ x, y, z, nodes: n2, segment: ln / (n2 - 1), r0: 0.06, r1: 0.03, dir: { x: rng.range(-1, 1), y: -0.5, z: 0.5 }, parent: { chain: first, node }, plane });
  }
  return specs;
}

/** Registers the roots of a room with the kit: one mesh and a per-frame Verlet step. */
export function addRoots(kit: Kit, specs: readonly ChainSpec[]): VerletRoots | null {
  if (specs.length === 0) return null;
  const roots = new VerletRoots(specs, kit.rng.derive('roots'));
  // settle the chains before the first frame so they start at rest
  for (let i = 0; i < 90; i++) roots.step(1 / 60, i / 60);
  const mesh = new RootMesh(roots, kit.mats.root);
  kit.world.push(mesh.mesh);
  kit.updaters.push({
    update(time, dt) {
      roots.step(dt, time);
      mesh.update();
    },
  });
  return roots;
}

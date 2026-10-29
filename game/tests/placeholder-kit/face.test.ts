import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { K_OBLIQUE } from '../../src/procgen/architecture/walls';
import { PPT } from '../../src/render/density';
import { FACE_YAW, MAX_YAW, placeholderEnemy, type PlaceholderMob } from '../../src/procgen/placeholder';
import { MOUTH_IDLE } from '../../src/procgen/placeholder/figure';
import { GLYPHS, SOLIDS } from '../../src/procgen/placeholder/sculpt';
import { ENEMY_ROWS, FAMILIES, figureSpec } from '../../src/procgen/placeholder/spec';

beforeAll(() => {
  const ctx2d = { createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {}, fillStyle: '' };
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
});

/** Sub-pixels per internal pixel of the silhouette raster. */
const SUB = 4;
const v = new THREE.Vector3();

/** The Demo's oblique projection in internal pixels at zoom 1 (framing.ts: x_s = PPT·x, y_s = PPT·(z − k·y)). */
const project = (p: THREE.Vector3): [number, number] => [p.x * PPT, (p.z - K_OBLIQUE * p.y) * PPT];

function screenVertices(mesh: THREE.Mesh): [number, number][] {
  const pos = mesh.geometry.getAttribute('position');
  const out: [number, number][] = [];
  for (let i = 0; i < pos.count; i++) out.push(project(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)));
  return out;
}

/** The figure's solids rasterized into a sub-pixel mask. */
class Silhouette {
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
  readonly bits: Uint8Array;

  constructor(meshes: THREE.Mesh[]) {
    const tris: [number, number][][] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const m of meshes) {
      const pts = screenVertices(m);
      const index = m.geometry.getIndex();
      const n = index ? index.count : pts.length;
      for (let i = 0; i < n; i += 3) {
        const t = [0, 1, 2].map(k => pts[index ? index.getX(i + k) : i + k]);
        tris.push(t);
        for (const [x, y] of t) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    this.x0 = Math.floor(minX) - 1;
    this.y0 = Math.floor(minY) - 1;
    this.w = (Math.ceil(maxX) - this.x0 + 2) * SUB;
    this.h = (Math.ceil(maxY) - this.y0 + 2) * SUB;
    this.bits = new Uint8Array(this.w * this.h);
    for (const t of tris) this.fill(t);
  }

  private fill([a, b, c]: [number, number][]): void {
    const d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(d) < 1e-12) return;
    const sx = (x: number): number => (x - this.x0) * SUB;
    const sy = (y: number): number => (y - this.y0) * SUB;
    const i0 = Math.max(0, Math.floor(Math.min(sx(a[0]), sx(b[0]), sx(c[0]))));
    const i1 = Math.min(this.w - 1, Math.ceil(Math.max(sx(a[0]), sx(b[0]), sx(c[0]))));
    const j0 = Math.max(0, Math.floor(Math.min(sy(a[1]), sy(b[1]), sy(c[1]))));
    const j1 = Math.min(this.h - 1, Math.ceil(Math.max(sy(a[1]), sy(b[1]), sy(c[1]))));
    for (let j = j0; j <= j1; j++) {
      const y = this.y0 + (j + 0.5) / SUB;
      for (let i = i0; i <= i1; i++) {
        const x = this.x0 + (i + 0.5) / SUB;
        const u = ((b[0] - x) * (c[1] - y) - (c[0] - x) * (b[1] - y)) / d;
        const w = ((c[0] - x) * (a[1] - y) - (a[0] - x) * (c[1] - y)) / d;
        if (u >= -1e-9 && w >= -1e-9 && u + w <= 1 + 1e-9) this.bits[j * this.w + i] = 1;
      }
    }
  }

  inside(x: number, y: number): boolean {
    const i = Math.floor((x - this.x0) * SUB);
    const j = Math.floor((y - this.y0) * SUB);
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.bits[j * this.w + i] === 1;
  }
}

/** Every glyph of the figure's face groups: sockets, embers, the grin and its fangs. */
function faceMarks(mob: PlaceholderMob): THREE.Mesh[] {
  const marks = new Set<THREE.Object3D>();
  mob.group.traverse(o => {
    if (o.name === 'face') o.traverse(c => marks.add(c));
  });
  return mob.sculptor.meshes.filter(m => marks.has(m.mesh) && (GLYPHS as readonly string[]).includes(m.kind)).map(m => m.mesh);
}

/** The figure turned `yaw` from the camera, its grin at its widest idle gape. */
function posed(row: string, yaw: number, elite = false): PlaceholderMob {
  const mob = placeholderEnemy(row, { elite });
  mob.position.set(0, 0);
  mob.facing = yaw;
  mob.update(0);
  mob.group.traverse(o => {
    if (o.name === 'mouth') o.scale.y = 1 + MOUTH_IDLE;
  });
  mob.group.updateMatrixWorld(true);
  return mob;
}

/**
 * Marks that leave the silhouette: a compact mark (socket, ember, fang) when a corner of its projected bounding box
 * does (pulled in by a quarter pixel), the grin when a point of its outline does (its box is mostly empty space).
 */
function escaping(mob: PlaceholderMob): string[] {
  const solids = mob.sculptor.meshes.filter(m => (SOLIDS as readonly string[]).includes(m.kind) && m.mesh.visible).map(m => m.mesh);
  const sil = new Silhouette(solids);
  const kinds = new Map(mob.sculptor.meshes.map(m => [m.mesh, m.kind]));
  const out: string[] = [];
  for (const mark of faceMarks(mob)) {
    if (!mark.visible || !mark.parent?.visible) continue;
    const pts = screenVertices(mark);
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const e = 0.25;
    const [x0, x1, y0, y1] = [Math.min(...xs) + e, Math.max(...xs) - e, Math.min(...ys) + e, Math.max(...ys) - e];
    const probe: [number, number][] = kinds.get(mark) === 'crescent' ? pts : [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
    if (!probe.every(([x, y]) => sil.inside(x, y))) out.push(`${mark.name} [${x0.toFixed(1)}..${x1.toFixed(1)}, ${y0.toFixed(1)}..${y1.toFixed(1)}]`);
  }
  return out;
}

const ENEMIES = ENEMY_ROWS.filter(r => FAMILIES[figureSpec(r).family].group === 'enemy');

describe('placeholder faces', () => {
  it('turns the face back to within FACE_YAW of the camera while the body turns MAX_YAW', () => {
    expect(MAX_YAW).toBeCloseTo((43 * Math.PI) / 180, 2);
    expect(FACE_YAW).toBeLessThanOrEqual((20 * Math.PI) / 180 + 1e-9);
  });

  it('keeps every face mark inside the silhouette at yaw 0 and ±43°', () => {
    const failures: string[] = [];
    for (const row of ENEMIES) {
      for (const elite of [false, true]) {
        for (const yaw of [-MAX_YAW, 0, MAX_YAW]) {
          const bad = escaping(posed(row, yaw, elite));
          if (bad.length) failures.push(`${row}${elite ? ' (elite)' : ''} @ ${Math.round((yaw * 180) / Math.PI)}°: ${bad.join('; ')}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('gives every enemy two burning eyes or an eyeball, and a grin with fangs', () => {
    for (const row of ENEMIES) {
      const mob = posed(row, 0);
      const marks = mob.sculptor.meshes;
      expect(marks.some(m => m.kind === 'crescent'), row).toBe(true);
      expect(marks.filter(m => m.kind === 'fang').length, row).toBeGreaterThanOrEqual(5);
      expect(marks.some(m => m.look === 'ember' || m.look === 'iris'), row).toBe(true);
    }
  });
});

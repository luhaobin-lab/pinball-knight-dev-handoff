import * as THREE from 'three';
import { LAYERS, type PointLightOptions } from '../../render/api';
import type { Rng } from '../../core/rng';
import type { KitMaterials } from './materials';
import { MeshBuilder } from './mesh';

/**
 * Shared build context of the room kit and the props: per-material geometry batches (merged into one
 * mesh each at the end), the instanced candle flames, the registered lights and the dynamic parts.
 */

/** What a light is for: lets the GI / atmos / VFX lanes treat window, fire and bio lights differently. */
export type LightKind = 'candle' | 'window' | 'bio' | 'foxfire' | 'seam';

export interface RoomLight extends PointLightOptions {
  readonly kind: LightKind;
  /** Fire channel for anti-light (art bible §9.3): candles and embers, not bioluminescence or glass. */
  readonly fire: boolean;
}

export type BatchName = keyof Omit<KitMaterials, 'uniforms' | 'all'>;

/** One candle flame: an instance of the room's flame mesh, animated by `FlameField.update`. */
export interface Flame {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Height in tiles (0.3–0.8). */
  readonly size: number;
  readonly phase: number;
  lit: boolean;
}

const FLAME_PROFILE: readonly (readonly [number, number])[] = [
  [0.0, 0.0],
  [0.32, 0.12],
  [0.5, 0.32],
  [0.42, 0.55],
  [0.22, 0.8],
  [0.0, 1.0],
];

/**
 * All candle flames of a room in one InstancedMesh (unlit emissive, no outline). Flicker steps at 12 fps
 * (art bible §11.1: flames step at 12–15 fps) and each flame keeps its own phase.
 */
export class FlameField {
  readonly flames: Flame[] = [];
  private mesh: THREE.InstancedMesh | null = null;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  add(flame: Omit<Flame, 'lit'> & { lit?: boolean }): Flame {
    const f: Flame = { ...flame, lit: flame.lit ?? true };
    this.flames.push(f);
    return f;
  }

  build(material: THREE.Material): THREE.InstancedMesh | null {
    if (this.flames.length === 0) return null;
    const geometry = new THREE.LatheGeometry(
      FLAME_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      6,
    );
    const n = geometry.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    // room candles keep a warm core (#FFE6A3): only 丸子's flame burns white (art bible §3 P1)
    const core = new THREE.Color('#FFE6A3');
    const mid = new THREE.Color('#FFB347');
    const tip = new THREE.Color('#FF6A2A');
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const y = geometry.getAttribute('position').getY(i);
      if (y < 0.45) c.copy(core).lerp(mid, y / 0.45);
      else c.copy(mid).lerp(tip, (y - 0.45) / 0.55);
      c.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.InstancedMesh(geometry, material, this.flames.length);
    mesh.name = 'candle-flames';
    mesh.frustumCulled = false;
    this.mesh = mesh;
    this.update(0);
    return mesh;
  }

  update(time: number): void {
    if (!this.mesh) return;
    const tick = Math.floor(time * 12);
    this.flames.forEach((f, i) => {
      const k = f.lit ? 1 : 0;
      const n = Math.sin(tick * 1.7 + f.phase * 13) * 0.5 + Math.sin(tick * 0.63 + f.phase * 7) * 0.5;
      const h = f.size * (1 + 0.16 * n) * k;
      const w = f.size * 0.36 * (1 - 0.08 * n) * k;
      const sway = 0.03 * Math.sin(tick * 0.9 + f.phase * 5) * f.size;
      this.q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), sway * 2);
      this.m.compose(this.p.set(f.x + sway * 0.3, f.y, f.z), this.q, this.s.set(Math.max(w, 1e-4), Math.max(h, 1e-4), Math.max(w, 1e-4)));
      this.mesh!.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export interface Updatable {
  update(time: number, dt: number): void;
}

export class Kit {
  readonly lights: RoomLight[] = [];
  readonly flames = new FlameField();
  readonly forward: THREE.Object3D[] = [];
  readonly world: THREE.Object3D[] = [];
  readonly updaters: Updatable[] = [];
  private readonly batches = new Map<BatchName, MeshBuilder>();

  constructor(
    readonly rng: Rng,
    readonly mats: KitMaterials,
  ) {}

  batch(name: BatchName): MeshBuilder {
    let b = this.batches.get(name);
    if (!b) {
      b = new MeshBuilder();
      this.batches.set(name, b);
    }
    return b;
  }

  light(light: RoomLight): void {
    this.lights.push(light);
  }

  /** Merges every batch into one mesh per material and returns the finished objects. */
  finish(group: THREE.Group): { triangles: number; meshes: number } {
    let triangles = 0;
    let meshes = 0;
    for (const [name, builder] of this.batches) {
      if (builder.vertexCount === 0) continue;
      const mesh = new THREE.Mesh(builder.build(`arch-${name}`), this.mats[name]);
      mesh.name = `arch-${name}`;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      triangles += builder.triangleCount;
      meshes++;
    }
    const flames = this.flames.build(this.mats.flame);
    if (flames) {
      group.add(flames);
      triangles += (flames.geometry.index ? flames.geometry.index.count / 3 : 0) * flames.count;
      meshes++;
      this.updaters.push({ update: t => this.flames.update(t) });
    }
    for (const o of this.world) {
      group.add(o);
      meshes++;
    }
    for (const o of this.forward) {
      o.traverse(c => c.layers.set(LAYERS.forward));
      group.add(o);
      meshes++;
    }
    return { triangles, meshes };
  }
}

/** Linear tint around white: `v` = ±value jitter, `h` = ±hue-ish jitter on the channels. */
export function tint(rng: Rng, v = 0.06, h = 0.02, base: THREE.ColorRepresentation = 0xffffff): THREE.Color {
  const c = new THREE.Color(base);
  const s = 1 + rng.range(-v, v);
  return c.setRGB(c.r * s * (1 + rng.range(-h, h)), c.g * s * (1 + rng.range(-h, h)), c.b * s * (1 + rng.range(-h, h)), THREE.LinearSRGBColorSpace);
}

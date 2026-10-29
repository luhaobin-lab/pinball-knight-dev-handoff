import * as THREE from 'three';
import type { PointLight, PointLightOptions } from './api';

/**
 * Point lights are plain data (not THREE.Light objects): the deferred resolve evaluates them
 * from uniform arrays. Each frame the store applies flicker and `follow`, culls lights whose
 * sphere misses the view, and packs at most `budget` lights (largest reach first when over budget).
 */
export class LightStore {
  readonly list: PointLight[] = [];
  /** xyz = world position, w = radius. */
  readonly positions: THREE.Vector4[];
  /** rgb = linear colour × intensity. */
  readonly colors: THREE.Vector4[];
  count = 0;
  private nextId = 1;
  private readonly visible: PointLight[] = [];
  private readonly world = new THREE.Vector3();
  private readonly view = new THREE.Vector3();

  constructor(readonly budget: number) {
    this.positions = Array.from({ length: budget }, () => new THREE.Vector4());
    this.colors = Array.from({ length: budget }, () => new THREE.Vector4());
  }

  add(options: PointLightOptions = {}): PointLight {
    const id = this.nextId++;
    const p = options.position;
    const light: PointLight = {
      id,
      position: new THREE.Vector3(p?.x ?? 0, p?.y ?? 0, p?.z ?? 0),
      color: new THREE.Color(options.color ?? '#ffb560'),
      intensity: options.intensity ?? 1,
      radius: options.radius ?? 3,
      flicker: options.flicker ?? 0,
      seed: options.seed ?? id,
      follow: options.follow ?? null,
      enabled: true,
    };
    this.list.push(light);
    return light;
  }

  remove(light: PointLight): void {
    const i = this.list.indexOf(light);
    if (i >= 0) this.list.splice(i, 1);
  }

  /** Packs the lights for this frame. `camera` must have current matrices. */
  update(time: number, camera: THREE.OrthographicCamera): void {
    const halfW = (camera.right - camera.left) / (2 * camera.zoom);
    const halfH = (camera.top - camera.bottom) / (2 * camera.zoom);
    const cx = (camera.right + camera.left) / 2;
    const cy = (camera.top + camera.bottom) / 2;
    this.visible.length = 0;
    for (const light of this.list) {
      if (!light.enabled || light.intensity <= 0 || light.radius <= 0) continue;
      this.worldPosition(light, this.world);
      this.view.copy(this.world).applyMatrix4(camera.matrixWorldInverse);
      const r = light.radius;
      if (Math.abs(this.view.x - cx) > halfW + r || Math.abs(this.view.y - cy) > halfH + r) continue;
      if (-this.view.z < camera.near - r || -this.view.z > camera.far + r) continue;
      this.visible.push(light);
    }
    if (this.visible.length > this.budget) {
      this.visible.sort((a, b) => b.intensity * b.radius - a.intensity * a.radius);
    }
    this.count = Math.min(this.visible.length, this.budget);
    for (let i = 0; i < this.count; i++) {
      const light = this.visible[i];
      const f = light.flicker > 0 ? flickerValue(time, light.seed, light.flicker) : 1;
      this.worldPosition(light, this.world);
      this.positions[i].set(this.world.x, this.world.y, this.world.z, light.radius * (1 + (f - 1) * 0.35));
      const k = light.intensity * f;
      this.colors[i].set(light.color.r * k, light.color.g * k, light.color.b * k, 0);
    }
  }

  get total(): number {
    return this.list.length;
  }

  private worldPosition(light: PointLight, out: THREE.Vector3): THREE.Vector3 {
    out.copy(light.position);
    if (light.follow) light.follow.localToWorld(out);
    return out;
  }
}

/** Deterministic candle flicker around 1: layered sines plus occasional short gutters. */
export function flickerValue(time: number, seed: number, amount: number): number {
  const s = seed * 1.618;
  const wobble = 0.5 * Math.sin(time * 8.3 + s * 3.1) + 0.3 * Math.sin(time * 13.9 + s * 1.7) + 0.2 * Math.sin(time * 23.7 + s * 5.3);
  const gutter = Math.max(0, Math.sin(time * 1.9 + s * 2.3) * Math.sin(time * 4.7 + s) - 0.75) * 2.4;
  return Math.max(0, 1 + amount * (wobble * 0.6 - gutter));
}

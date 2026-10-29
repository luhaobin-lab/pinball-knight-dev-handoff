import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { SPARK } from './demo';
import { SpriteBatch } from './gpu';
import { BONE_WHITE, INK } from './palette';

/**
 * 粒子_Hit_01: one stylised impact per victim at the hit point, 30 uu up, turned at random, played once over its life
 * U(0.2, 0.6) s as six frames: a jagged ring, a burst that grows into a ragged disc, and the disc bitten into a
 * crescent that thins away. Bone white (the Demo's #D6D9CA × 3) with an ink rim, a card that reads over both bodies
 * and the slash at the contact.
 */

const UU_PER_TILE = 64;
const PX_PER_UU = 0.375;
/**
 * Toward the camera (tiles): airborne hit effects read over the bodies at the contact, as the Demo's translucent
 * particles draw over its sprites (a tall enemy's head stands up to ≈ 1.7 tiles nearer than the hit point).
 */
export const AIR_BIAS = 3;

interface Spark {
  readonly x: number;
  readonly z: number;
  readonly t: number;
  readonly life: number;
  readonly sizePx: number;
  readonly angle: number;
  readonly seed: number;
}

/** The frame (0..5) at `age` for a spark living `life` s, or −1 once it is gone. */
export function sparkFrame(age: number, life: number): number {
  if (age < 0 || age >= life) return -1;
  return Math.min(SPARK.frames - 1, Math.floor((age / life) * SPARK.frames + 1e-9));
}

const FRAGMENT = /* glsl */ `
uniform vec3 uBone;
uniform vec3 uInk;
const float TAU = 6.2831853;
int sector(vec2 p, float n) {
  return int(floor((atan(p.y, p.x) / TAU + 0.5) * n));
}
// a ragged radius: one random step per 30° sector
float rag(vec2 p, float seed, float amount) {
  return 1.0 - amount * hash3(sector(p, 12.0), 3, seed);
}
bool sparkOn(vec2 p, int frame, float R, float seed) {
  // one return (ANGLE's D3D back end warns about the early returns' uninitialised result)
  float r = length(p);
  bool on;
  if (frame == 0) {
    float outer = R * (0.62 + 0.3 * step(0.72, hash3(sector(p, 8.0), 5, seed)));
    on = r >= R * 0.42 && r <= outer;
  } else if (frame == 1) on = r <= R * 0.72 * rag(p, seed, 0.35) && (r >= R * 0.3 || hash3(1, 1, seed) > 0.5);
  else if (frame == 2) on = r <= R * 0.86 * rag(p, seed, 0.25);
  else if (frame == 3) on = r <= R * 0.9 * rag(p, seed, 0.12);
  else if (frame == 4) on = r <= R * 0.84 * rag(p, seed, 0.1) && length(p - vec2(R * 0.62, 0.0)) > R * 0.62;
  else on = r <= R * 0.74 && length(p - vec2(R * 0.32, 0.0)) > R * 0.62;
  return on;
}
`;

const BODY = /* glsl */ `
  int frame = int(vA.x + 0.5);
  float seed = vA.y;
  // the bone shape is cut 1 px inside the box; its ink outline (the Ink & Bone rim) reads over the slash and the bodies
  float R = vBox.x * 0.5 - 1.0;
  float c = cos(vBox.z), s = sin(vBox.z);
  vec2 ex = vec2(c, -s);
  vec2 ey = vec2(s, c);
  if (sparkOn(vPx, frame, R, seed)) color = uBone;
  else if (sparkOn(vPx + ex, frame, R, seed) || sparkOn(vPx - ex, frame, R, seed) || sparkOn(vPx + ey, frame, R, seed) || sparkOn(vPx - ey, frame, R, seed)) color = uInk;
  else discard;`;

export class Sparks {
  private readonly sparks: Spark[] = [];
  readonly batch: SpriteBatch;

  constructor(
    private readonly rng: Rng,
    size: THREE.IUniform<THREE.Vector2>,
  ) {
    this.batch = new SpriteBatch(64, { pars: FRAGMENT, body: BODY, uniforms: { uBone: { value: new THREE.Color(BONE_WHITE) }, uInk: { value: new THREE.Color(INK) } } }, size);
  }

  /** One spark at the hit point (tiles). The Demo turns it at random; the normal does not orient it. */
  spawn(x: number, z: number, now: number): void {
    const r = this.rng;
    this.sparks.push({
      x,
      z,
      t: now,
      life: r.range(SPARK.lifeS[0], SPARK.lifeS[1]),
      sizePx: Math.round(r.range(SPARK.sizeUu[0], SPARK.sizeUu[1]) * PX_PER_UU),
      angle: r.range(0, Math.PI * 2),
      seed: r.next(),
    });
  }

  update(now: number): void {
    let live = 0;
    for (const s of this.sparks) if (now - s.t < s.life) this.sparks[live++] = s;
    this.sparks.length = live;
    this.batch.clear();
    for (const s of this.sparks) {
      const frame = sparkFrame(now - s.t, s.life);
      if (frame < 0) continue;
      // the rotated shape stays inside the box's inscribed circle
      this.batch.add({ x: s.x, y: SPARK.heightUu / UU_PER_TILE, z: s.z, bias: AIR_BIAS, w: s.sizePx, h: s.sizePx, angle: s.angle, depth: 'card' }, [frame, s.seed, 0, 0]);
    }
    this.batch.commit();
  }

  /** Live sparks (for tests). */
  get list(): readonly Spark[] {
    return this.sparks;
  }
}

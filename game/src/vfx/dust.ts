import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { DUST } from './demo';
import { SpriteBatch } from './gpu';
import { BONE_DIM, VEIL } from './palette';

/**
 * 粒子_Dust_01: a grey puff at the mover's feet every 100 uu (`SpawnPerUnit`), a 4-frame flipbook over 0.4 s (one
 * round puff, then three blobs, two specks, two pixels), lit from the upper left, on the floor in world space.
 */

const UU_PER_TILE = 64;
const PX_PER_UU = 0.375;
/** Above the trail (TRAIL_LIFT 0.11): the Demo draws its puffs over the band. */
export const DUST_LIFT = 0.12;
/** The sprite box: the frame-1 blobs spread ±8 px. */
const BOX = 21;

interface Puff {
  readonly x: number;
  readonly z: number;
  readonly t: number;
  readonly seed: number;
  readonly flip: number;
}

/** The flipbook frame at `age` (0..3), or −1 once the puff is gone. */
export function dustFrame(age: number): number {
  if (age < 0 || age >= DUST.lifeS) return -1;
  return Math.min(DUST.frames - 1, Math.floor((age / DUST.lifeS) * DUST.frames + 1e-9));
}

const FRAGMENT = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uShade;
uniform float uPuff;
// 0 outside, 1 lit, 2 shaded: a round blob lit from the upper left
int blob(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  if (dot(d, d) > r * r) return 0;
  vec2 h = d + vec2(r * 0.38);
  return dot(h, h) <= r * r * 0.72 ? 1 : 2;
}
int pick(int a, int b) { return a != 0 ? a : b; }
// a layout point mirrored and turned by quarter turns (per puff); the light stays upper left
vec2 place(vec2 c, int q, bool m) {
  if (m) c.x = -c.x;
  if (q == 1) return vec2(-c.y, c.x);
  if (q == 2) return -c;
  if (q == 3) return vec2(c.y, -c.x);
  return c;
}
`;

const BODY = /* glsl */ `
  int frame = int(vA.x + 0.5);
  int q = int(vA.y * 4.0);
  bool m = vA.z > 0.5;
  vec2 p = vPx;
  int k = 0;
  if (frame == 0) k = blob(p, vec2(0.0), uPuff);
  else if (frame == 1) {
    k = pick(k, blob(p, place(vec2(-4.5, -1.0), q, m), 3.1));
    k = pick(k, blob(p, place(vec2(3.5, -2.5), q, m), 2.6));
    k = pick(k, blob(p, place(vec2(0.5, 3.5), q, m), 2.8));
  } else if (frame == 2) {
    if (length(p - place(vec2(-5.5, -1.5), q, m)) <= 1.9 || length(p - place(vec2(4.5, 3.0), q, m)) <= 1.6) k = 1;
  } else if (frame == 3) {
    if (length(p - place(vec2(-6.0, -2.0), q, m)) <= 1.3 || length(p - place(vec2(5.0, 3.5), q, m)) <= 1.1) k = 1;
  }
  if (k == 0) discard;
  color = k == 1 ? uLight : uShade;`;

export class Dust {
  private readonly puffs: Puff[] = [];
  readonly batch: SpriteBatch;

  constructor(
    private readonly rng: Rng,
    size: THREE.IUniform<THREE.Vector2>,
  ) {
    this.batch = new SpriteBatch(
      256,
      {
        pars: FRAGMENT,
        body: BODY,
        uniforms: {
          uLight: { value: new THREE.Color(BONE_DIM) },
          uShade: { value: new THREE.Color(VEIL) },
          uPuff: { value: (DUST.puffUu * PX_PER_UU) / 2 },
        },
      },
      size,
    );
  }

  /** One puff for a mover whose floor point is (x, z) (tiles); it sits DUST.dropUu south of it, at the feet. */
  spawn(x: number, z: number, now: number): void {
    this.puffs.push({ x, z: z + DUST.dropUu / UU_PER_TILE, t: now, seed: this.rng.next(), flip: this.rng.chance(0.5) ? 1 : 0 });
  }

  update(now: number): void {
    let live = 0;
    for (const p of this.puffs) if (now - p.t < DUST.lifeS) this.puffs[live++] = p;
    this.puffs.length = live;
    this.batch.clear();
    for (const p of this.puffs) {
      const frame = dustFrame(now - p.t);
      if (frame < 0) continue;
      this.batch.add({ x: p.x, y: 0, z: p.z, bias: DUST_LIFT, w: BOX, h: BOX, depth: 'floor' }, [frame, p.seed, p.flip, 0]);
    }
    this.batch.commit();
  }

  get count(): number {
    return this.puffs.length;
  }
}

/**
 * Niagara SpawnPerUnit for a mover: feed it the mover's position every frame and it returns how many particles are due
 * (one per `everyUu` travelled); they all spawn at that frame's position (the Dust spawn script is not interpolated).
 */
export class SpawnPerUnit {
  private last: { x: number; z: number } | null = null;
  private carried = 0;

  constructor(private readonly everyUu = DUST.everyUu) {}

  /** Particles due after moving to (x, z) (tiles). */
  step(x: number, z: number): number {
    const prev = this.last;
    this.last = { x, z };
    if (!prev) return 0;
    this.carried += Math.hypot(x - prev.x, z - prev.z) * UU_PER_TILE;
    const n = Math.floor(this.carried / this.everyUu);
    this.carried -= n * this.everyUu;
    return n;
  }

  /** Forgets the path (a new launch starts counting from zero). */
  reset(): void {
    this.last = null;
    this.carried = 0;
  }
}

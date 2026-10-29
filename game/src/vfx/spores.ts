import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { SPLAT, SPORES, STAIN } from './demo';
import { paletteUniform, SpriteBatch } from './gpu';
import { CORRUPTION } from './palette';
import { AIR_BIAS } from './spark';

/**
 * The enemies' hit and death effects, reskinned from the Demo's blood (粒子_Blood_01, 粒子_Blood_02, BP_Decal) as
 * corruption: red spore puffs and round ichor droplets with the same timing, amount and stain lifetime, no gore.
 *
 * - `hit` (粒子_Blood_01, per victim, along the hit normal from the enemy toward the hero, 30 uu up): a spore plume
 *   along the normal at the contact; two spore clouds that grow out of the hit point and drift along the normal;
 *   six droplets (20 /s for 0.3 s) shot along the normal that fall to the floor and slide on, stretched by their
 *   speed. All of it vanishes together 0.54 s after the hit. A droplet touching the floor leaves a stain with 50 %
 *   chance: 2 × U(0.9, 1.3) its size per axis, in 0.01 s, held 10 s, dithered out over 4 s.
 * - `splat` (粒子_Blood_02, the Die notify at 0.5 s): a burst of spore blobs thrown up and out, two ichor splashes on
 *   the floor and a spore cloud, at the corpse (+10 uu up the screen, 20 uu above the floor).
 */

const UU_PER_TILE = 64;
const PX = 0.375;
const K_OBLIQUE = 0.625;
/**
 * Floor lifts (tiles): the stains lie under the trail (0.11); the sliding droplets and the splat's splashes lie over
 * it, as the Demo's red dashes do inside the band (rec-02 f198–f204), and under the dust (0.12).
 */
export const STAIN_LIFT = 0.1;
const DROP_FLOOR_LIFT = 0.115;

const enum Kind {
  Plume = 0,
  Cloud = 1,
  Drop = 2,
  Stain = 3,
  Blob = 4,
  Smoke = 5,
}

interface Drop {
  readonly emit: number;
  readonly speed: number;
  readonly dx: number;
  readonly dz: number;
  /** Game seconds after leaving until it touches the floor. */
  readonly fall: number;
  /** The stain it leaves on touching the floor (px per axis), or null (50 %). */
  readonly stain: { readonly w: number; readonly h: number } | null;
  readonly seed: number;
}

interface Cloud {
  readonly size: number;
  /** Where it comes to rest along its direction (uu). */
  readonly rest: number;
  readonly dx: number;
  readonly dz: number;
  readonly seed: number;
}

interface Hit {
  readonly x: number;
  readonly z: number;
  readonly nx: number;
  readonly nz: number;
  readonly t: number;
  readonly seed: number;
  readonly clouds: readonly Cloud[];
  readonly drops: Drop[];
}

interface Stain {
  readonly x: number;
  readonly z: number;
  readonly t: number;
  readonly w: number;
  readonly h: number;
  readonly angle: number;
  readonly seed: number;
}

interface SplatBlob {
  readonly dx: number;
  readonly dz: number;
  readonly speed: number;
  readonly up: number;
  readonly size: number;
  readonly seed: number;
}

interface SplatPuff {
  readonly dx: number;
  readonly dz: number;
  readonly speed: number;
  readonly size: number;
  readonly life: number;
  readonly seed: number;
}

interface Splat {
  readonly x: number;
  readonly z: number;
  readonly t: number;
  readonly blobs: readonly SplatBlob[];
  readonly splashes: readonly (SplatPuff & { readonly grow: number })[];
  readonly smoke: readonly SplatPuff[];
}

/** Total stain life: fade-in, hold, fade-out. */
export const STAIN_LIFE = STAIN.fadeInS + STAIN.holdS + STAIN.fadeS;

/** Drawn fraction of a stain at `age` (0 → 1 in 0.01 s, held 10 s, 1 → 0 over 4 s). */
export function stainCover(age: number): number {
  if (age < 0 || age >= STAIN_LIFE) return 0;
  if (age < STAIN.fadeInS) return age / STAIN.fadeInS;
  if (age < STAIN.fadeInS + STAIN.holdS) return 1;
  return 1 - (age - STAIN.fadeInS - STAIN.holdS) / STAIN.fadeS;
}

/** Distance a droplet has slid along the floor `tau` s after leaving (uu): v0 (1 − e^(−k τ)) / k. */
export function dropDistance(speed: number, tau: number): number {
  const k = SPORES.dropDrag;
  return (speed * (1 - Math.exp(-k * Math.max(0, tau)))) / k;
}

/**
 * Size of a hit's spore clouds at `age`: 0 → 1 between 0.02 and 0.2 s (ease-out), then from 0.3 s down to half
 * (a quarter of the area) when the hit vanishes at 0.54 s.
 */
export function cloudScale(age: number): number {
  const [a, b] = SPORES.splashGrowS;
  if (age <= a || age >= SPORES.endS) return 0;
  const k = Math.min(1, (age - a) / (b - a));
  const grow = 1 - (1 - k) * (1 - k);
  const shrink = age <= SPORES.splashShrinkS ? 1 : 1 - (0.5 * (age - SPORES.splashShrinkS)) / (SPORES.endS - SPORES.splashShrinkS);
  return grow * shrink;
}

/** How far a cloud has drifted toward its rest distance `rest` (uu) `tau` s after leaving. */
export function cloudDrift(rest: number, tau: number): number {
  return rest * (1 - Math.exp(-Math.max(0, tau) / SPORES.splashDriftTau));
}

const FRAGMENT = /* glsl */ `
uniform vec3 uRed[5];
// 0 outside; 1 lit rim (upper left), 2 body, 3 shade (lower right): a round spore blob
int blob(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  float q = dot(d, d);
  if (q > r * r) return 0;
  if (r >= 2.5 && dot(d + vec2(r * 0.45), d + vec2(r * 0.45)) <= r * r * 0.22) return 1;
  if (r >= 1.5 && dot(d - vec2(r * 0.3), d - vec2(r * 0.3)) > r * r * 0.62) return 3;
  return 2;
}
int pick(int a, int b) { return a != 0 ? a : b; }
// the lit rim, the body and the shade of a spore blob (the Demo's blood shows as a dark red on screen); the plume
// and the droplets' heads are one step brighter
vec3 tone(int k, bool bright) {
  int b = bright ? 1 : 0;
  return k == 1 ? uRed[3 + b] : k == 2 ? uRed[2 + b] : uRed[1 + b];
}
`;

const BODY = /* glsl */ `
  int kind = int(vA.x + 0.5);
  float seed = vA.y;
  float cover = vA.z;
  vec2 p = vPx;
  ivec2 ip = ivec2(floor(p + vBox.xy * 0.5));
  if (bayer4(ip) >= cover) discard;
  int k = 0;
  if (kind == 0) {
    // the plume: spore blobs along +x from the base, smaller toward the tip
    float L = vB.x, W = vB.y;
    vec2 b = p + vec2(L * 0.5, 0.0);
    k = pick(k, blob(b, vec2(W * 0.45, 0.0), W * 0.5));
    k = pick(k, blob(b, vec2(L * 0.45, -W * 0.08), W * 0.4));
    k = pick(k, blob(b, vec2(L * 0.7, W * 0.1), W * 0.3));
    k = pick(k, blob(b, vec2(L * 0.9, 0.0), W * 0.2));
  } else if (kind == 1 || kind == 4) {
    // a spore cloud: five overlapping blobs placed by the seed (one blob for the splat's burst)
    float R = vB.x;
    int n = kind == 1 ? 5 : 1;
    for (int i = 0; i < 5; i++) {
      if (i >= n) break;
      float a = hash3(i, 11, seed) * 6.2831853;
      float d = i == 0 ? 0.0 : R * (0.25 + 0.3 * hash3(i, 12, seed));
      float r = kind == 4 ? R : R * (i == 0 ? 0.62 : 0.32 + 0.18 * hash3(i, 13, seed));
      k = pick(k, blob(p, vec2(cos(a), sin(a)) * d, r));
    }
  } else if (kind == 2) {
    // a droplet stretched along +x by its speed, its round head in front
    float L = vB.x * 0.5, W = vB.y * 0.5;
    vec2 q = p / vec2(L, W);
    if (dot(q, q) <= 1.0) k = p.x > L - W * 1.6 ? 1 : 2;
  } else if (kind == 3) {
    // a stain: a ragged ellipse of ichor, darker than the droplets
    vec2 q = p / (vB.xy * 0.5);
    int sector = int(floor((atan(q.y, q.x) / 6.2831853 + 0.5) * 10.0));
    float r = 1.0 - 0.22 * hash3(sector, 21, seed);
    float d = length(q);
    if (d <= r) {
      color = d <= r - 0.3 ? uRed[2] : uRed[1];
      k = 4;
    }
  } else {
    // smoke: a spore cloud thinning out, with a few bright spores in it
    float R = vB.x;
    float d = length(p) / R;
    if (d <= 1.0 && bayer4(ip + ivec2(2, 1)) < 1.0 - d * 0.6) {
      color = hash3(ip.x, ip.y, seed) > 0.9 ? uRed[4] : (d < 0.55 ? uRed[2] : uRed[1]);
      k = 4;
    }
  }
  if (k == 0) discard;
  if (k < 4) color = tone(k, kind == 0);`;

export class Spores {
  private readonly hits: Hit[] = [];
  private readonly stains: Stain[] = [];
  private readonly splats: Splat[] = [];
  readonly batch: SpriteBatch;

  constructor(
    private readonly rng: Rng,
    size: THREE.IUniform<THREE.Vector2>,
  ) {
    this.batch = new SpriteBatch(1024, { pars: FRAGMENT, body: BODY, uniforms: { uRed: paletteUniform(CORRUPTION) } }, size);
  }

  /** 粒子_Blood_01 at the hit point (tiles); (nx, nz) is the unit hit normal, from the enemy toward the hero. */
  hit(x: number, z: number, nx: number, nz: number, now: number): void {
    const r = this.rng;
    const l = Math.hypot(nx, nz) || 1;
    const ux = nx / l;
    const uz = nz / l;
    const turn = (a: number): [number, number] => [ux * Math.cos(a) - uz * Math.sin(a), ux * Math.sin(a) + uz * Math.cos(a)];
    const clouds: Cloud[] = SPORES.splashes.map(sp => {
      const [dx, dz] = turn(r.range(-0.25, 0.25));
      return { size: r.range(sp.sizeUu[0], sp.sizeUu[1]), rest: sp.restUu * r.range(0.9, 1.1), dx, dz, seed: r.next() };
    });
    const rated = Math.round(SPORES.dropRate * SPORES.dropForS);
    const fall = Math.sqrt((2 * SPORES.heightUu) / SPORES.gravity);
    const drops: Drop[] = [];
    const [j0, j1] = STAIN.jitter;
    const stainPx = STAIN.scale * SPORES.dropUu[0] * PX;
    for (let i = 0; i < SPORES.dropBurst + rated; i++) {
      const [dx, dz] = turn(r.range(-SPORES.dropSpreadRad, SPORES.dropSpreadRad));
      const speed = r.range(SPORES.dropSpeed[0], SPORES.dropSpeed[1]);
      const stain = r.chance(STAIN.chance) ? { w: stainPx * r.range(j0, j1), h: stainPx * r.range(j0, j1) } : null;
      const emit = i < SPORES.dropBurst ? 0 : (i - SPORES.dropBurst) / SPORES.dropRate;
      drops.push({ emit, speed, dx, dz, fall, stain, seed: r.next() });
    }
    this.hits.push({ x, z, nx: ux, nz: uz, t: now, seed: r.next(), clouds, drops });
  }

  /** 粒子_Blood_02 for a corpse whose floor point is (x, z) (tiles). */
  splat(x: number, z: number, now: number): void {
    const r = this.rng;
    const blobs: SplatBlob[] = [];
    for (let i = 0; i < 8; i++) {
      const a = ((i + r.range(-0.3, 0.3)) / 8) * Math.PI * 2;
      blobs.push({ dx: Math.cos(a), dz: Math.sin(a), speed: r.range(SPLAT.burstSpeed[0], SPLAT.burstSpeed[1]), up: r.range(60, 160), size: r.range(SPLAT.burstUu[0], SPLAT.burstUu[1]) * 0.5, seed: r.next() });
    }
    const puff = (sizes: readonly [number, number], lives: readonly [number, number], speeds: readonly [number, number]): SplatPuff => {
      const a = r.range(0, Math.PI * 2);
      return { dx: Math.cos(a), dz: Math.sin(a), speed: r.range(speeds[0], speeds[1]), size: r.range(sizes[0], sizes[1]), life: r.range(lives[0], lives[1]), seed: r.next() };
    };
    const splashes = [0, 1].map(() => ({ ...puff(SPLAT.splashUu, SPLAT.splashS, [5, 20]), grow: 0.08 }));
    const smoke = [0, 1, 2, 3, 4].map(() => puff(SPLAT.smokeUu, SPLAT.smokeS, SPLAT.smokeSpeed));
    this.splats.push({ x, z: z - SPLAT.upUu / UU_PER_TILE, t: now, blobs, splashes, smoke });
  }

  update(now: number): void {
    this.landDrops(now);
    this.expire(now);
    const b = this.batch;
    b.clear();
    for (const s of this.stains) {
      const cover = stainCover(now - s.t);
      if (cover <= 0) continue;
      const box = Math.ceil(Math.max(s.w, s.h)) + 2;
      b.add({ x: s.x, y: 0, z: s.z, bias: STAIN_LIFT, w: box, h: box, angle: s.angle, depth: 'floor' }, [Kind.Stain, s.seed, cover, 0], [s.w, s.h]);
    }
    for (const h of this.hits) this.drawHit(h, now);
    for (const s of this.splats) this.drawSplat(s, now);
    b.commit();
  }

  /** Droplets touching the floor leave their stains (50 %), at the point where they touched. */
  private landDrops(now: number): void {
    for (const h of this.hits) {
      for (let i = h.drops.length - 1; i >= 0; i--) {
        const d = h.drops[i];
        const touch = h.t + d.emit + d.fall;
        if (!d.stain || now < touch) continue;
        const s = dropDistance(d.speed, d.fall) / UU_PER_TILE;
        this.stains.push({ x: h.x + d.dx * s, z: h.z + d.dz * s, t: touch, w: d.stain.w, h: d.stain.h, angle: Math.atan2(d.dz, d.dx), seed: d.seed });
        h.drops[i] = { ...d, stain: null };
      }
    }
  }

  private expire(now: number): void {
    const keep = <T>(list: T[], alive: (v: T) => boolean): void => {
      let n = 0;
      for (const v of list) if (alive(v)) list[n++] = v;
      list.length = n;
    };
    keep(this.hits, h => now - h.t < SPORES.endS);
    keep(this.stains, s => now - s.t < STAIN_LIFE);
    keep(this.splats, s => now - s.t < SPLAT.burstS);
  }

  private drawHit(h: Hit, now: number): void {
    const age = now - h.t;
    if (age < 0 || age >= SPORES.endS) return;
    const y = SPORES.heightUu / UU_PER_TILE;
    const angle = Math.atan2(h.nz, h.nx);
    const b = this.batch;
    // the plume at the contact
    if (age < SPORES.burstS) {
      const k = Math.min(1, age / 0.03) * (age < 0.06 ? 1 : 1 - (age - 0.06) / (SPORES.burstS - 0.06));
      const L = SPORES.burstUu[0] * PX * k;
      const W = SPORES.burstUu[1] * PX * k;
      if (W >= 1) {
        const ox = (h.nx * SPORES.burstUu[0] * 0.5 * k) / UU_PER_TILE;
        const oz = (h.nz * SPORES.burstUu[0] * 0.5 * k) / UU_PER_TILE;
        const box = Math.ceil(Math.max(L, W)) + 2;
        b.add({ x: h.x + ox, y, z: h.z + oz, bias: AIR_BIAS, w: box, h: box, angle, depth: 'card' }, [Kind.Plume, h.seed, 1, 0], [L, W]);
      }
    }
    // the two clouds: grow, drift out along the normal to their rest, shrink at the end
    for (const c of h.clouds) {
      // the cloud's blobs reach 1.05 R from its centre: R = size / 2.1 makes it `size` across
      const R = (c.size * PX * cloudScale(age)) / 2.1;
      if (R < 1) continue;
      const s = cloudDrift(c.rest, age - SPORES.splashGrowS[0]) / UU_PER_TILE;
      const box = Math.ceil(R * 2 * 1.3) + 2;
      b.add({ x: h.x + c.dx * s, y, z: h.z + c.dz * s, bias: AIR_BIAS, w: box, h: box, depth: 'card' }, [Kind.Cloud, c.seed, 1, 0], [R]);
    }
    // the droplets: flying from the hit point, then sliding on the floor
    for (const d of h.drops) {
      const tau = age - d.emit;
      if (tau < 0) continue;
      const s = dropDistance(d.speed, tau) / UU_PER_TILE;
      const v = d.speed * Math.exp(-SPORES.dropDrag * tau);
      const flying = tau < d.fall;
      const height = flying ? y - (0.5 * SPORES.gravity * tau * tau) / UU_PER_TILE : 0;
      const vy = flying ? -SPORES.gravity * tau : 0;
      // screen velocity under the oblique camera: x = vx, y = vz − k·vy
      const sx = d.dx * v;
      const sy = d.dz * v - K_OBLIQUE * vy;
      const speed = Math.hypot(sx, sy);
      const W = Math.max(2, SPORES.dropUu[0] * PX);
      const L = Math.max(W, Math.min(SPORES.dropUu[1], SPORES.dropUu[0] + 0.02 * speed) * PX);
      const box = Math.ceil(L) + 2;
      b.add(
        { x: h.x + d.dx * s, y: height, z: h.z + d.dz * s, bias: flying ? AIR_BIAS : DROP_FLOOR_LIFT, w: box, h: box, angle: Math.atan2(sy, sx), depth: flying ? 'card' : 'floor' },
        [Kind.Drop, d.seed, 1, 0],
        [L, W],
      );
    }
  }

  private drawSplat(s: Splat, now: number): void {
    const age = now - s.t;
    if (age < 0 || age >= SPLAT.burstS) return;
    const b = this.batch;
    const y0 = SPLAT.heightUu / UU_PER_TILE;
    for (const o of s.blobs) {
      const k = 2;
      const dist = (o.speed * (1 - Math.exp(-k * age))) / k / UU_PER_TILE;
      const y = Math.max(0, y0 + (o.up * age - 0.5 * SPLAT.burstGravity * age * age) / UU_PER_TILE);
      const R = (o.size * PX * (1 - (age / SPLAT.burstS) ** 2)) / 2;
      if (R < 0.6) continue;
      const box = Math.ceil(R * 2) + 2;
      b.add({ x: s.x + o.dx * dist, y, z: s.z + o.dz * dist, bias: AIR_BIAS, w: box, h: box, depth: 'card' }, [Kind.Blob, o.seed, 1, 0], [R]);
    }
    for (const o of s.splashes) {
      if (age >= o.life) continue;
      const grow = Math.min(1, age / o.grow);
      const R = (o.size * PX * grow) / 2;
      if (R < 1) continue;
      const thin = age < o.life * 0.6 ? 1 : 1 - (age - o.life * 0.6) / (o.life * 0.4);
      const d = (o.speed * age) / UU_PER_TILE;
      const box = Math.ceil(R * 2 * 1.3) + 2;
      b.add({ x: s.x + o.dx * d, y: 0, z: s.z + o.dz * d, bias: DROP_FLOOR_LIFT, w: box, h: box, depth: 'floor' }, [Kind.Cloud, o.seed, thin, 0], [R]);
    }
    for (const o of s.smoke) {
      if (age >= o.life) continue;
      const k = age / o.life;
      const R = ((o.size * PX) / 2) * (0.7 + 0.5 * k);
      const d = (o.speed * age) / UU_PER_TILE;
      const box = Math.ceil(R * 2) + 2;
      b.add({ x: s.x + o.dx * d, y: y0 + (o.speed * 0.5 * age) / UU_PER_TILE, z: s.z + o.dz * d * 0.5, bias: AIR_BIAS, w: box, h: box, depth: 'card' }, [Kind.Smoke, o.seed, 1 - k, 0], [R]);
    }
  }

  /** Counts for tests: live hits, stains and splats. */
  get counts(): { hits: number; stains: number; splats: number } {
    return { hits: this.hits.length, stains: this.stains.length, splats: this.splats.length };
  }

  /** Live stains (for tests). */
  get stainList(): readonly Stain[] {
    return this.stains;
  }
}

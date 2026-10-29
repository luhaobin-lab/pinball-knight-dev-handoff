import * as THREE from 'three';
import { PPT_GLSL } from '../render/density';
import { TRAIL, evalKeys, type Keys } from './demo';
import { vfxMaterial } from './gpu';
import { BONE_WHITE, VEIL } from './palette';

/**
 * 粒子_轨迹, the ribbon the hero lays on the floor during a launch: one point every 8 uu along his path, its head on
 * him, 46 uu wide. Each point dissolves with its age (TRAIL.visible, TRAIL.bright): the fresh band is solid bone
 * white, older parts break into bone streaks over a dim checker veil, which thins out until the point is gone at
 * 1.15 s. So the dissolve runs from the tail toward the head. Ended ribbons lay no new points and fade out by age.
 */

const UU_PER_TILE = 64;
const MAX_POINTS = 1024;
/** View-direction lift over the floor (tiles): above the mold carpet and the planks (≤ 0.09), under the dust. */
export const TRAIL_LIFT = 0.11;
/** Bright streaks: 2-px lanes across the band, dashes 40 uu long along it (the Demo's are 40–80 uu by 4–8 uu). */
const LANES = 9;
const DASH_UU = 40;

export interface TrailPoint {
  /** Floor position (tiles). */
  readonly x: number;
  readonly z: number;
  /** Game time it was laid. */
  readonly t: number;
  /** Ribbon length from the first point (uu). */
  readonly u: number;
}

/** Fraction of a point's band still drawn at `age` game seconds. */
export const trailVisible = (age: number): number => (age >= TRAIL.lifeS ? 0 : evalKeys(TRAIL.visible, age));
/** Fraction of a point's band drawn in bone white at `age` (the rest of `trailVisible` is the dim veil). */
export const trailBright = (age: number): number => Math.min(trailVisible(age), evalKeys(TRAIL.bright, age));

/**
 * The ribbon's points (CPU side). `add` takes the mover's position every frame: points are laid every 8 uu along the
 * straight step from the previous position (SpawnPerUnit with interpolated spawning), their times interpolated over
 * the step; the latest position is the live head. Pass the contact point on a bounce frame and the corner stays sharp.
 */
export class Ribbon {
  readonly points: TrailPoint[] = [];
  private last: { x: number; z: number; t: number } | null = null;
  /** Length laid so far (uu), up to the last received position. */
  private length = 0;
  private nextAt = 0;
  ended = false;

  add(x: number, z: number, now: number): void {
    if (this.ended) return;
    const prev = this.last;
    this.last = { x, z, t: now };
    if (!prev) {
      this.points.push({ x, z, t: now, u: 0 });
      this.nextAt = TRAIL.spacingUu;
      return;
    }
    const step = Math.hypot(x - prev.x, z - prev.z) * UU_PER_TILE;
    if (step <= 0) return;
    const from = this.length;
    this.length += step;
    while (this.nextAt <= this.length) {
      const f = (this.nextAt - from) / step;
      this.points.push({ x: prev.x + (x - prev.x) * f, z: prev.z + (z - prev.z) * f, t: prev.t + (now - prev.t) * f, u: this.nextAt });
      this.nextAt += TRAIL.spacingUu;
    }
  }

  /** Stops laying points (Deactivate): the head becomes the last point. */
  end(): void {
    if (this.ended) return;
    this.ended = true;
    const h = this.head();
    const tail = this.points[this.points.length - 1];
    if (h && tail && h.u > tail.u + 0.5) this.points.push(h);
    this.last = null;
  }

  /** The live head (the latest position), or null once ended. */
  head(): TrailPoint | null {
    if (this.ended || !this.last) return null;
    return { x: this.last.x, z: this.last.z, t: this.last.t, u: this.length };
  }

  /** Drops the points whose band is gone, keeping one before the first live point so the band fades into it. */
  expire(now: number): void {
    let dead = 0;
    while (dead + 1 < this.points.length && now - this.points[dead + 1].t >= TRAIL.lifeS) dead++;
    if (dead > 0) this.points.splice(0, dead);
  }

  /** True while anything of the ribbon can still show. */
  alive(now: number): boolean {
    if (!this.ended) return true;
    const newest = this.points[this.points.length - 1];
    return !!newest && now - newest.t < TRAIL.lifeS;
  }

  /** The points the strip is built from: the laid ones and the live head. */
  vertices(): TrailPoint[] {
    const h = this.head();
    const tail = this.points[this.points.length - 1];
    return h && (!tail || h.u > tail.u + 0.5) ? [...this.points, h] : this.points.slice();
  }
}

const glslKeys = (name: string, keys: Keys): string => {
  const xs = keys.map(k => k[0].toFixed(4)).join(', ');
  const ys = keys.map(k => k[1].toFixed(4)).join(', ');
  return /* glsl */ `
float ${name}(float x) {
  const float X[${keys.length}] = float[${keys.length}](${xs});
  const float Y[${keys.length}] = float[${keys.length}](${ys});
  if (x <= X[0]) return Y[0];
  for (int i = 1; i < ${keys.length}; i++) {
    if (x <= X[i]) return mix(Y[i - 1], Y[i], (x - X[i - 1]) / (X[i] - X[i - 1]));
  }
  return Y[${keys.length - 1}];
}`;
};

/** One material for every ribbon; `uNow` is the effects' game clock. */
export function trailMaterial(now: THREE.IUniform<number>): THREE.ShaderMaterial {
  return vfxMaterial({
    vertexPars: /* glsl */ `
in vec4 aTrail;
uniform float uLift;
out vec2 vFloor;
out vec3 vTrail;`,
    vertex: /* glsl */ `
  vec3 toCam = normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]));
  vFloor = position.xz;
  vTrail = aTrail.xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(position + toCam * uLift, 1.0);`,
    fragmentPars: /* glsl */ `
in vec2 vFloor;
in vec3 vTrail;
uniform float uNow;
uniform float uLife;
uniform vec3 uBone;
uniform vec3 uDim;
${glslKeys('visibleAt', TRAIL.visible)}
${glslKeys('brightAt', TRAIL.bright)}`,
    fragment: /* glsl */ `
  float age = uNow - vTrail.x;
  if (age < 0.0 || age >= uLife) discard;
  float vis = visibleAt(age);
  float br = min(vis, brightAt(age));
  ivec2 p = ivec2(floor(vFloor * ${PPT_GLSL}));
  // bright streaks: dashes along the band, a lane every 2 px across it, each dash with its own threshold
  int lane = int(clamp(floor((vTrail.z * 0.5 + 0.5) * ${LANES.toFixed(1)}), 0.0, ${(LANES - 1).toFixed(1)}));
  float phase = hash3(lane, 7, 0.37);
  int dash = int(floor(vTrail.y / ${DASH_UU.toFixed(1)} + phase));
  if (hash3(lane, dash, 0.61) < br) color = uBone;
  else if (bayer4(p) < (vis - br) / max(1.0 - br, 1e-3)) color = uDim;
  else discard;`,
    uniforms: {
      uNow: now,
      uLift: { value: TRAIL_LIFT },
      uLife: { value: TRAIL.lifeS },
      uBone: { value: new THREE.Color(BONE_WHITE) },
      uDim: { value: new THREE.Color(VEIL) },
    },
  });
}

/** A ribbon's floor strip: two vertices per point, mitred at the corners. */
export class RibbonMesh {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly position = new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 2 * 3), 3);
  private readonly trail = new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 2 * 4), 4);

  constructor(material: THREE.ShaderMaterial) {
    this.position.setUsage(THREE.DynamicDrawUsage);
    this.trail.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.position);
    this.geometry.setAttribute('aTrail', this.trail);
    const index: number[] = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(index);
    this.geometry.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
  }

  /** Rebuilds the strip from the ribbon's points (the oldest ones beyond capacity are dropped). */
  update(points: readonly TrailPoint[]): void {
    const pts = points.length > MAX_POINTS ? points.slice(points.length - MAX_POINTS) : points;
    const n = pts.length;
    const half = TRAIL.widthUu / 2 / UU_PER_TILE;
    const pos = this.position.array as Float32Array;
    const tr = this.trail.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const [sx, sz] = side(pts, i);
      for (let k = 0; k < 2; k++) {
        const sign = k === 0 ? -1 : 1;
        const o = (i * 2 + k) * 3;
        pos[o] = p.x + sx * half * sign;
        pos[o + 1] = 0;
        pos[o + 2] = p.z + sz * half * sign;
        const q = (i * 2 + k) * 4;
        tr[q] = p.t;
        tr[q + 1] = p.u;
        tr[q + 2] = sign;
        tr[q + 3] = 0;
      }
    }
    this.position.clearUpdateRanges();
    this.position.addUpdateRange(0, n * 6);
    this.position.needsUpdate = true;
    this.trail.clearUpdateRanges();
    this.trail.addUpdateRange(0, n * 8);
    this.trail.needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(0, n - 1) * 6);
    this.mesh.visible = n > 1;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}

/** The mitred side vector at point i (unit perpendicular scaled by the miter, capped at 2). */
function side(pts: readonly TrailPoint[], i: number): [number, number] {
  const dir = (a: TrailPoint, b: TrailPoint): [number, number] => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  };
  const prev = i > 0 ? dir(pts[i - 1], pts[i]) : null;
  const next = i < pts.length - 1 ? dir(pts[i], pts[i + 1]) : null;
  const a = prev ?? next ?? [1, 0];
  const b = next ?? prev ?? [1, 0];
  let mx = a[0] + b[0];
  let mz = a[1] + b[1];
  const ml = Math.hypot(mx, mz);
  if (ml < 1e-6) {
    mx = a[0];
    mz = a[1];
  } else {
    mx /= ml;
    mz /= ml;
  }
  // perpendicular of the bisector, scaled so the band keeps its width on both legs
  const px = -mz;
  const pz = mx;
  const cos = Math.max(0.5, Math.abs(-a[1] * px + a[0] * pz));
  return [px / cos, pz / cos];
}

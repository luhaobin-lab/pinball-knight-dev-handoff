import * as THREE from 'three';
import { WHIRLWIND } from './demo';
import { SpriteBatch } from './gpu';
import { BONE_DIM, BONE_WHITE, INK } from './palette';

/**
 * 回旋斩: the knight's Attack02 flipbook, a bone-white spinning crescent around him with an ink outline, 180 uu
 * across, in four poses of 0.1 s each (10 fps, so it steps like the Demo's flipbook and slows with the hit-stop).
 * It follows the hero and sits just behind his body: he covers it where they overlap, it covers the floor and
 * what lies on it (the trail). A new slash restarts it (each enemy contact jumps back to AttackState).
 *
 * The poses are the Demo's (rec-02 f175–f198): a nearly closed thick ring (330° of arc), then crescents on the east
 * (240°), the north-west (184°) and a thin one on the west (124°). Each is an arc of the outer circle whose band is
 * `thick` × R deep at its middle and tapers to nothing at its ends (exponent `taper`).
 */

const PX_PER_UU = 0.375;
/** The pearl ball's centre over the floor point (BALL_RADIUS 0.76 under stand()'s sphere fix): y up, z south. */
export const WHIRL_CENTRE = { y: 0.73, dz: 0.05 } as const;
/** Just behind the ball's centre, so the ball's rim hides it (tiles, toward the camera). */
const BIAS = -0.02;

export interface WhirlPose {
  /** Screen angle of the band's middle (radians, clockwise from east). */
  readonly angle: number;
  /** Half the arc it spans (radians). */
  readonly half: number;
  /** Band depth at the middle, in units of the outer radius. */
  readonly thick: number;
  /** How the band thins toward its ends: depth × (1 − (offset / half)^taper). */
  readonly taper: number;
}

const deg = Math.PI / 180;
export const WHIRL_POSES: readonly WhirlPose[] = [
  { angle: 170 * deg, half: 165 * deg, thick: 0.5, taper: 2.5 },
  { angle: 0, half: 120 * deg, thick: 0.42, taper: 1.6 },
  { angle: 240 * deg, half: 92 * deg, thick: 0.4, taper: 1.6 },
  { angle: 180 * deg, half: 62 * deg, thick: 0.24, taper: 1.3 },
];

/** The pose (0..3) `age` game seconds into the slash, or −1 once it is over. */
export function whirlPose(age: number): number {
  if (age < 0 || age >= WHIRLWIND.frames * WHIRLWIND.frameS) return -1;
  return Math.min(WHIRLWIND.frames - 1, Math.floor(age / WHIRLWIND.frameS + 1e-9));
}

/** Band depth of `pose` at screen angle `a` (units of R), 0 outside its arc. */
export function whirlDepth(pose: WhirlPose, a: number): number {
  const off = Math.abs(Math.atan2(Math.sin(a - pose.angle), Math.cos(a - pose.angle)));
  return off >= pose.half ? 0 : pose.thick * (1 - Math.pow(off / pose.half, pose.taper));
}

const FRAGMENT = /* glsl */ `
uniform vec3 uBone;
uniform vec3 uDim;
uniform vec3 uInk;
uniform vec4 uPose[4];
// band depth (px) at p, 0 outside the arc
float depthAt(vec2 p, float R, vec4 ps) {
  float a = atan(p.y, p.x) - ps.x;
  float off = abs(atan(sin(a), cos(a)));
  return off >= ps.y ? 0.0 : ps.z * R * (1.0 - pow(off / ps.y, ps.w));
}
bool inside(vec2 p, float R, vec4 ps) {
  float r = length(p);
  return r <= R && r >= R - depthAt(p, R, ps);
}
`;

const BODY = /* glsl */ `
  int pose = int(vA.x + 0.5);
  vec2 p = vPx;
  if (vA.y > 0.5) p.x = -p.x;
  float R = vA.z;
  vec4 ps = uPose[pose];
  if (inside(p, R, ps)) {
    // a speed line runs along the band's middle where it is deep enough
    float d = depthAt(p, R, ps);
    color = d > 6.0 && abs(length(p) - (R - d * 0.45)) < 0.55 ? uDim : uBone;
  } else if (inside(p + vec2(1.0, 0.0), R, ps) || inside(p - vec2(1.0, 0.0), R, ps) || inside(p + vec2(0.0, 1.0), R, ps) || inside(p - vec2(0.0, 1.0), R, ps)) {
    color = uInk;
  } else discard;`;

export interface WhirlTarget {
  x: number;
  z: number;
  /** Centre height over the floor (tiles); default the pearl ball's. */
  y?: number;
}

export class Whirlwind {
  readonly batch: SpriteBatch;
  private follow: (() => WhirlTarget) | null = null;
  private start = 0;
  private mirror = false;

  constructor(size: THREE.IUniform<THREE.Vector2>) {
    this.batch = new SpriteBatch(
      4,
      {
        pars: FRAGMENT,
        body: BODY,
        uniforms: {
          uBone: { value: new THREE.Color(BONE_WHITE) },
          uDim: { value: new THREE.Color(BONE_DIM) },
          uInk: { value: new THREE.Color(INK) },
          uPose: { value: WHIRL_POSES.map(p => new THREE.Vector4(p.angle, p.half, p.thick, p.taper)) },
        },
      },
      size,
    );
  }

  /** Starts (or restarts) the slash around whatever `follow` returns each frame. */
  play(follow: () => WhirlTarget, now: number, mirror = false): void {
    this.follow = follow;
    this.start = now;
    this.mirror = mirror;
  }

  /** The pose shown at `now`, or −1. */
  pose(now: number): number {
    return this.follow ? whirlPose(now - this.start) : -1;
  }

  update(now: number): void {
    this.batch.clear();
    const pose = this.pose(now);
    if (pose < 0) this.follow = null;
    else if (this.follow) {
      const at = this.follow();
      const R = (WHIRLWIND.diameterUu / 2) * PX_PER_UU;
      const box = 2 * Math.ceil(R) + 3;
      const y = at.y ?? WHIRL_CENTRE.y;
      this.batch.add({ x: at.x, y, z: at.z + (at.y === undefined ? WHIRL_CENTRE.dz : 0), bias: BIAS, w: box, h: box, depth: 'card' }, [pose, this.mirror ? 1 : 0, R, 0]);
    }
    this.batch.commit();
  }
}

import * as THREE from 'three';
import type { PointLightOptions, ToonMaterial } from '../../render/api';
import { RAMPS, type Ramp } from '../architecture/palette';
import { SQUASH_SECONDS } from '../../anim/reactions';
import { glowCard, mesh, roundedBox, smoothLathe, spherePatch, taperTube, teardrop, type PartOptions } from './shapes';
import type { MobKind } from './mobs';

/**
 * The four small fry as rigs: the model, its living pose and its death. Each death is a 10-frame flipbook at
 * 10 fps (the Demo's Die sequences, demo-juice §7.3): the body gives way, the corruption bursts out as spores at
 * frame 5 (0.5 s, the caller's splat), then it settles into a corpse that stays. In our style and without gore:
 *   acolyte  the robe crumples, the mask comes to rest on the heap still grinning
 *   wickling the flame gutters out and the candle melts into a wax puddle, its face pressed into it
 *   jelly    the dome deflates into a puddle; the swallowed sword and the eye lie in it
 *   skull    the bones collapse into a pile with the skull on top and the helm knocked off
 */

export const BLOOD: Ramp = ['#14040A', '#3A0814', '#6E0F22', '#A8182E', '#E0425A'];
const BLACK: Ramp = ['#07050B', '#120C18', '#1F1626', '#2E2236', '#463650'];
const PORCELAIN: Ramp = ['#4A3A44', '#8F7F88', '#D2C6C6', '#F3EDEA', '#FFFFFF'];
const RED_WAX: Ramp = ['#2A0610', '#6A1022', '#A8203A', '#D85868', '#FFB0B8'];
const CRIMSON_JELLY: Ramp = ['#22030F', '#5A0A2A', '#9A1446', '#E0306E', '#FF9EC0'];
const DARK: Ramp = ['#050307', '#0A0610'];
const TEETH: Ramp = ['#BDB2A6', '#F3ECE0', '#FFFFFF'];
export const EYE_RED: Ramp = ['#FF2A3C', '#FF9A9A'];
const FLAME_OUT: Ramp = ['#FF2E1E', '#FF7A30'];
const FLAME_IN: Ramp = ['#FFB040', '#FFF2B0'];

export type Mat = (ramp: Ramp, extra?: Partial<PartOptions>) => ToonMaterial;

export interface MobRig {
  /** Living pose at time `t`; `hitAge` is the time since the last hit (Infinity before any). */
  idle(t: number, hitAge: number): void;
  /** Death flipbook frame 0..9, then the corpse (frame 9 held). */
  death(frame: number): void;
}

type RigBuilder = (model: THREE.Group, mat: Mat, seed: number, lights: PointLightOptions[], follow: THREE.Object3D) => MobRig;

/** The value of a 10-frame death track at `frame` (the last entry holds). */
const at = (frame: number, track: readonly number[]): number => track[Math.min(frame, track.length - 1)];
/** The hit accents (mouth open, flinch) last as long as the squash. */
const accent = (hitAge: number): boolean => hitAge < SQUASH_SECONDS;

export const rand = (seed: number): (() => number) => {
  let s = (seed * 16807) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

export const glowEye = (mat: Mat): ToonMaterial => mat(EYE_RED, { unlit: true, emissive: '#FF2030', emissiveIntensity: 1.6, outline: false });

/**
 * A wide-open grin facing +Z: a dark half-disc (flat top, round bottom) lined with teeth top and bottom.
 * Returns the group and the mouth mesh (scale y to open/close it).
 */
function grin(mat: Mat, width: number, depth: number, topTeeth: number, bottomTeeth: number): { group: THREE.Group; mouth: THREE.Mesh } {
  const g = new THREE.Group();
  const mouth = mesh(new THREE.CircleGeometry(width / 2, 20, Math.PI, Math.PI), mat(DARK, { unlit: true }));
  mouth.scale.y = depth / (width / 2);
  const teethMat = mat(TEETH);
  const tooth = width / (topTeeth * 2.2);
  for (let i = 0; i < topTeeth; i++) {
    const x = -width / 2 + width * ((i + 0.5) / topTeeth);
    const t = mesh(new THREE.ConeGeometry(tooth, tooth * 2.2, 3), teethMat);
    t.rotation.z = Math.PI;
    t.position.set(x * 0.94, -tooth * 1.0, 0.004);
    g.add(t);
  }
  for (let i = 0; i < bottomTeeth; i++) {
    const a = Math.PI + Math.PI * ((i + 0.7) / (bottomTeeth + 0.4));
    const t = mesh(new THREE.ConeGeometry(tooth * 0.85, tooth * 1.8, 3), teethMat);
    t.position.set(Math.cos(a) * width * 0.4, Math.sin(a) * depth * 0.8 + tooth * 0.7, 0.004);
    g.add(t);
  }
  g.add(mouth);
  return { group: g, mouth };
}

function flame(mat: Mat, scale: number): { group: THREE.Group; eye: THREE.Group; tongues: THREE.Object3D[] } {
  const g = new THREE.Group();
  const outerMat = mat(FLAME_OUT, { unlit: true, emissive: '#FF3A1C', emissiveIntensity: 1.1 });
  const outer = mesh(teardrop(0.1, 0.26), outerMat);
  const inner = mesh(teardrop(0.058, 0.16), mat(FLAME_IN, { unlit: true, emissive: '#FFC060', emissiveIntensity: 1.4, outline: false }));
  inner.position.set(0, -0.01, 0.04);
  g.add(outer, inner);
  const tongues: THREE.Object3D[] = [];
  for (const [x, rz, s] of [[-0.07, 0.5, 0.55], [0.075, -0.45, 0.6], [0.0, 0.0, 0.42]] as const) {
    const t = mesh(teardrop(0.05, 0.16), outerMat);
    t.position.set(x, 0.05, -0.02);
    t.rotation.z = rz;
    t.scale.setScalar(s * 1.6);
    tongues.push(t);
    g.add(t);
  }
  // one huge eye with a slit pupil
  const eye = new THREE.Group();
  eye.position.set(0, 0.03, 0.09);
  const white = mesh(new THREE.SphereGeometry(1, 14, 10), mat(['#FFF4E0', '#FFFFFF'], { unlit: true }));
  white.scale.set(0.068, 0.075, 0.025);
  const iris = mesh(new THREE.SphereGeometry(1, 12, 8), mat(['#C8102A', '#FF5060'], { unlit: true, emissive: '#FF2030', emissiveIntensity: 0.6, outline: false }));
  iris.scale.set(0.04, 0.046, 0.012);
  iris.position.z = 0.018;
  const slit = mesh(new THREE.SphereGeometry(1, 8, 6), mat(DARK, { unlit: true, outline: false }));
  slit.scale.set(0.009, 0.036, 0.008);
  slit.position.z = 0.026;
  eye.add(white, iris, slit);
  g.add(eye);
  g.scale.setScalar(scale);
  const glow = glowCard('#FF5A2A', 0.7, 0.5);
  glow.position.z = -0.04;
  g.add(glow);
  return { group: g, eye, tongues };
}

// ---- 笑面信徒 ----------------------------------------------------------------------------------------
const acolyte: RigBuilder = (body, mat, seed, lights, follow) => {
  const robeMat = mat(BLOOD);
  const blackMat = mat(BLACK);
  const goldMat = mat(RAMPS.gold);
  // the robe, its hem bands and the rope belt crumple together
  const cloth = new THREE.Group();
  const robe = mesh(smoothLathe([[0.34, 0], [0.33, 0.06], [0.27, 0.3], [0.2, 0.6], [0.16, 0.78], [0.001, 0.82]], 14, 22), robeMat);
  for (const [y, r] of [[0.03, 0.335], [0.13, 0.322]] as const) {
    const band = mesh(new THREE.TorusGeometry(r, 0.022, 6, 28), blackMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    cloth.add(band);
  }
  const rope = mesh(new THREE.TorusGeometry(0.205, 0.026, 6, 24), goldMat);
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 0.5;
  cloth.add(robe, rope);
  const head = new THREE.Group();
  head.position.y = 0.86;
  const hood = mesh(smoothLathe([[0.001, -0.17], [0.19, -0.13], [0.255, 0.0], [0.235, 0.14], [0.16, 0.26], [0.001, 0.32]], 14, 22), robeMat);
  // the hood's tip hooks forward over the face
  const tipCurve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0.26, -0.03), new THREE.Vector3(0, 0.46, -0.04), new THREE.Vector3(0, 0.52, 0.12), new THREE.Vector3(0, 0.4, 0.24));
  const tip = mesh(taperTube(tipCurve, t => THREE.MathUtils.lerp(0.09, 0.016, t), 14, 8), robeMat);
  const hole = mesh(spherePatch(0.258, Math.PI / 2, 0.68, 1.05, 2.15, 20), mat(DARK, { unlit: true }));
  const mask = mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(PORCELAIN));
  mask.scale.set(0.16, 0.08, 0.2);
  mask.rotation.x = Math.PI / 2;
  mask.position.set(0, -0.01, 0.2);
  const face = new THREE.Group();
  face.position.set(0, 0, 0.282);
  // eyes: smiling slits with burning pupils; a third eye open on the brow
  for (const side of [-1, 1]) {
    const lid = mesh(new THREE.TorusGeometry(0.036, 0.011, 4, 10, Math.PI), mat(DARK, { unlit: true, outline: false }));
    lid.position.set(side * 0.06, 0.05, 0);
    const pupil = mesh(new THREE.SphereGeometry(1, 8, 6), glowEye(mat));
    pupil.scale.set(0.014, 0.014, 0.008);
    pupil.position.set(side * 0.06, 0.038, 0.004);
    face.add(lid, pupil);
  }
  const third = mesh(new THREE.SphereGeometry(1, 10, 8), glowEye(mat));
  third.scale.set(0.017, 0.03, 0.008);
  third.position.set(0, 0.12, -0.012);
  const thirdRim = mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 14), mat(DARK, { unlit: true, outline: false }));
  thirdRim.scale.set(0.75, 1.2, 1);
  thirdRim.position.set(0, 0.12, -0.014);
  const mouth = grin(mat, 0.21, 0.075, 7, 6);
  mouth.group.position.set(0, -0.035, 0);
  face.add(third, thirdRim, mouth.group);
  // a sunburst halo of gold spikes behind the head
  const halo = new THREE.Group();
  halo.position.set(0, 0.06, -0.2);
  halo.add(mesh(new THREE.TorusGeometry(0.3, 0.018, 6, 30), goldMat));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const spike = mesh(new THREE.ConeGeometry(0.03, 0.13, 4), goldMat);
    spike.position.set(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0);
    spike.rotation.z = a - Math.PI / 2;
    halo.add(spike);
  }
  head.add(hood, tip, hole, mask, face, halo);
  // arms reaching for the hero: a candle and a crooked ritual knife
  const handMat = mat(PORCELAIN);
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.2, 0.62, 0.08);
    const sleeve = mesh(new THREE.CylinderGeometry(0.062, 0.09, 0.3, 10), robeMat);
    sleeve.rotation.x = Math.PI / 2 - 0.55;
    sleeve.position.set(side * 0.03, 0.05, 0.13);
    const hand = mesh(new THREE.SphereGeometry(0.05, 10, 8), handMat);
    hand.position.set(side * 0.04, 0.12, 0.28);
    arm.add(sleeve, hand);
    for (let f = 0; f < 3; f++) {
      const finger = mesh(new THREE.CapsuleGeometry(0.012, 0.06, 2, 4), handMat);
      finger.position.set(side * 0.04 + (f - 1) * 0.022, 0.15, 0.33);
      finger.rotation.x = 1.1;
      arm.add(finger);
    }
    arms.push(arm);
    body.add(arm);
  }
  const knife = new THREE.Group();
  const blade = mesh(taperTube(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.12, 0), new THREE.Vector3(-0.02, 0.24, 0)), t => THREE.MathUtils.lerp(0.024, 0.004, t), 10, 6), mat(PORCELAIN));
  const gem = mesh(new THREE.OctahedronGeometry(0.026, 0), glowEye(mat));
  knife.add(blade, gem);
  knife.position.set(0.04, 0.14, 0.3);
  knife.rotation.x = 0.4;
  arms[1].add(knife);
  const candle = mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.16, 8), mat(RED_WAX));
  candle.position.set(-0.04, 0.22, 0.29);
  const f = flame(mat, 0.42);
  f.group.position.set(-0.04, 0.33, 0.29);
  f.group.remove(f.eye);
  arms[0].add(candle, f.group);
  body.add(cloth, head);
  lights.push({ position: { x: 0, y: 2.2, z: 1.0 }, follow, color: '#FF5A3C', intensity: 0.55, radius: 2.6, flicker: 0.3, seed });
  const phase = rand(seed + 3)() * 6;
  const mouthRest = 0.075 / 0.105;
  return {
    idle(t, hitAge) {
      const chant = Math.sin(t * 2.4 + phase);
      body.position.y = Math.abs(chant) * 0.02;
      // every few seconds the head snaps sideways, holds too long, and snaps back
      const cycle = (t + phase) % 3.8;
      const snap = cycle > 2.9 ? (cycle < 2.96 ? (cycle - 2.9) / 0.06 : cycle < 3.6 ? 1 : 1 - (cycle - 3.6) / 0.2) : 0;
      head.rotation.z = chant * 0.04 + Math.max(0, snap) * 0.62 * (Math.floor((t + phase) / 3.8) % 2 ? 1 : -1);
      head.rotation.x = 0.12 + Math.sin(t * 1.3) * 0.03;
      mouth.mouth.scale.y = mouthRest * (1 + 0.25 * Math.max(0, Math.sin(t * 4.8 + phase)) + (accent(hitAge) ? 0.8 : 0));
      arms[0].rotation.x = -0.1 + chant * 0.1;
      arms[1].rotation.x = -0.1 - chant * 0.1 - (accent(hitAge) ? 0.4 : 0);
      halo.rotation.z = t * 0.4;
      f.group.scale.set(0.42 + Math.sin(t * 17) * 0.03, 0.42 + Math.sin(t * 13 + 1) * 0.06, 0.42);
    },
    death(k) {
      // the death jolt throws the arms up and the head back, then the robe gives way under it
      body.position.y = 0;
      const sy = at(k, [1, 0.94, 0.82, 0.68, 0.54, 0.4, 0.3, 0.24, 0.2, 0.19]);
      const sxz = at(k, [1, 1.02, 1.08, 1.16, 1.24, 1.32, 1.38, 1.42, 1.44, 1.45]);
      cloth.scale.set(sxz, sy, sxz);
      const top = 0.82 * sy;
      head.position.set(at(k, [0, 0, 0.02, 0.04, 0.06, 0.08, 0.09, 0.1, 0.1, 0.1]), top + at(k, [0.04, 0.06, 0.04, 0.02, 0, -0.02, -0.03, -0.04, -0.04, -0.04]), at(k, [0, -0.02, 0, 0.03, 0.06, 0.09, 0.11, 0.12, 0.12, 0.12]));
      head.rotation.set(at(k, [-0.25, -0.4, -0.3, -0.45, -0.6, -0.75, -0.85, -0.9, -0.92, -0.92]), 0, at(k, [0, 0.08, 0.25, 0.4, 0.55, 0.7, 0.78, 0.82, 0.84, 0.84]));
      mouth.mouth.scale.y = mouthRest * at(k, [2.0, 2.2, 2.1, 1.9, 1.8, 1.7, 1.7, 1.6, 1.6, 1.6]);
      halo.rotation.z = 0.4 * k;
      for (const [i, arm] of arms.entries()) {
        const side = i === 0 ? -1 : 1;
        arm.position.set(side * at(k, [0.2, 0.21, 0.23, 0.26, 0.29, 0.32, 0.34, 0.35, 0.36, 0.36]), Math.max(0.07, top * 0.76), 0.08);
        arm.rotation.set(at(k, [-0.9, -1.1, -0.6, -0.2, 0.3, 0.8, 1.1, 1.3, 1.35, 1.35]), 0, side * at(k, [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.78, 0.8, 0.8]));
      }
      // the candle gutters and goes out when the spores burst
      const fl = at(k, [0.5, 0.36, 0.44, 0.24, 0.12, 0]);
      f.group.visible = fl > 0;
      f.group.scale.setScalar(Math.max(fl, 1e-4));
    },
  };
};

// ---- 狂焰烛灵 ----------------------------------------------------------------------------------------
const wickling: RigBuilder = (body, mat, seed, lights, follow) => {
  const r = rand(seed + 11);
  const waxMat = mat(RED_WAX);
  // the candle (stub, rim and drips) melts down as one; the puddle at its foot spreads
  const candle = new THREE.Group();
  const stub = mesh(smoothLathe([[0.24, 0], [0.245, 0.05], [0.23, 0.26], [0.22, 0.44], [0.2, 0.5], [0.15, 0.52], [0.001, 0.5]], 14, 22), waxMat);
  const puddle = mesh(smoothLathe([[0.001, 0.0], [0.32, 0.0], [0.36, 0.014], [0.3, 0.034], [0.001, 0.034]], 6, 22), waxMat);
  candle.add(stub);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.6;
    const len = 0.08 + r() * 0.18;
    const drip = mesh(new THREE.CapsuleGeometry(0.032, len, 3, 6), waxMat);
    drip.position.set(Math.cos(a) * 0.222, 0.49 - len / 2, Math.sin(a) * 0.222);
    candle.add(drip);
  }
  const rim = mesh(new THREE.TorusGeometry(0.18, 0.036, 6, 22), waxMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.5;
  candle.add(rim);
  // an angry face pressed into the wax
  const face = new THREE.Group();
  face.position.set(0, 0.28, 0.232);
  for (const side of [-1, 1]) {
    const brow = mesh(roundedBox(0.09, 0.022, 0.02, 0.008), mat(DARK, { unlit: true, outline: false }));
    brow.position.set(side * 0.07, 0.065, 0);
    brow.rotation.z = side * -0.5;
    const eye = mesh(new THREE.SphereGeometry(1, 10, 8), mat(DARK, { unlit: true, outline: false }));
    eye.scale.set(0.036, 0.026, 0.01);
    eye.position.set(side * 0.07, 0.03, 0);
    const spark = mesh(new THREE.SphereGeometry(1, 6, 4), mat(['#FFD040', '#FFF6C0'], { unlit: true, emissive: '#FFB020', emissiveIntensity: 1.2, outline: false }));
    spark.scale.setScalar(0.012);
    spark.position.set(side * 0.066, 0.03, 0.008);
    face.add(brow, eye, spark);
  }
  const mouth = grin(mat, 0.17, 0.07, 6, 5);
  mouth.group.position.set(0, -0.045, 0);
  face.add(mouth.group);
  const f = flame(mat, 1.5);
  f.group.position.y = 0.66;
  const wick = mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.08, 6), mat(DARK, { unlit: true }));
  wick.position.y = 0.55;
  body.add(candle, puddle, wick, face, f.group);
  lights.push({ position: { x: 0, y: 2.6, z: 0.6 }, follow, color: '#FF5A2A', intensity: 0.85, radius: 3.4, flicker: 0.45, seed });
  const phase = r() * 6;
  const mouthRest = 0.07 / 0.085;
  let lastT = NaN;
  return {
    idle(t, hitAge) {
      const hop = Math.max(0, Math.sin(t * 4.0 + phase));
      body.position.y = hop * hop * 0.08;
      const flare = 1.5 * (1 + 0.12 * Math.sin(t * 3.1 + phase) + (accent(hitAge) ? 0.5 * (1 - hitAge / SQUASH_SECONDS) : 0));
      f.group.scale.set(flare * (1 + Math.sin(t * 19) * 0.04), flare * (1 + Math.sin(t * 14 + 2) * 0.08), flare);
      f.group.rotation.z = Math.sin(t * 6 + phase) * 0.12;
      // the tongues wander a step per frame: once per time, however often the pose is applied
      if (t !== lastT) f.tongues.forEach((tg, i) => (tg.rotation.z += Math.sin(t * (9 + i * 3)) * 0.01));
      lastT = t;
      f.eye.position.x = Math.sin(t * 1.1 + phase) * 0.025;
      mouth.mouth.scale.y = mouthRest * (1 + 0.4 * Math.max(0, Math.sin(t * 6 + phase)) + (accent(hitAge) ? 0.6 : 0));
    },
    death(k) {
      body.position.y = 0;
      // the candle slumps and leans as it melts, its lip runs off, the wax pools thick around it
      const sy = at(k, [1, 1, 0.94, 0.84, 0.7, 0.55, 0.42, 0.33, 0.28, 0.26]);
      const sxz = at(k, [1, 1, 1.02, 1.05, 1.09, 1.14, 1.19, 1.23, 1.25, 1.26]);
      candle.scale.set(sxz, sy, sxz);
      candle.rotation.set(at(k, [0, 0, 0.03, 0.06, 0.1, 0.14, 0.17, 0.19, 0.2, 0.2]), 0, at(k, [0, 0, -0.04, -0.08, -0.13, -0.18, -0.22, -0.24, -0.25, -0.25]));
      rim.scale.setScalar(at(k, [1, 1, 0.95, 0.85, 0.72, 0.6, 0.5, 0.44, 0.4, 0.4]));
      const pool = at(k, [1, 1, 1.03, 1.08, 1.14, 1.2, 1.25, 1.28, 1.3, 1.3]);
      puddle.scale.set(pool, at(k, [1, 1, 1.2, 1.5, 1.9, 2.3, 2.6, 2.8, 2.9, 3]), pool);
      const top = 0.52 * sy;
      wick.position.set(-top * 0.22, top + 0.02, top * 0.18);
      wick.rotation.z = at(k, [0, 0, 0.1, 0.2, 0.35, 0.5, 0.6, 0.65, 0.68, 0.7]);
      // the face sags down the front of the lump and tips up, still snarling
      face.position.set(0.02, at(k, [0.28, 0.28, 0.27, 0.25, 0.22, 0.19, 0.16, 0.14, 0.13, 0.12]), 0.232 * sxz + at(k, [0, 0, 0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.05, 0.05]));
      face.rotation.set(at(k, [0, 0, -0.1, -0.2, -0.32, -0.45, -0.56, -0.62, -0.65, -0.66]), 0, at(k, [0, 0, -0.05, -0.1, -0.15, -0.2, -0.23, -0.25, -0.26, -0.26]));
      face.scale.set(at(k, [1, 1, 1.02, 1.05, 1.08, 1.12, 1.15, 1.17, 1.18, 1.18]), at(k, [1, 1, 0.96, 0.92, 0.88, 0.84, 0.82, 0.8, 0.8, 0.8]), 1);
      mouth.mouth.scale.y = mouthRest * at(k, [1.8, 2.1, 1.6, 1.9, 1.5, 1.4, 1.3, 1.3, 1.3, 1.3]);
      // the flame flares once, gutters and goes out with the spore burst
      const fl = at(k, [1.9, 0.9, 1.3, 0.6, 0.3, 0]);
      f.group.visible = fl > 0;
      f.group.scale.setScalar(Math.max(fl, 1e-4));
      f.group.position.y = top + 0.14;
      f.group.rotation.z = at(k, [0, 0.3, -0.25, 0.4, -0.3, 0]);
    },
  };
};

// ---- 圣餐果冻 ----------------------------------------------------------------------------------------
const jelly: RigBuilder = (body, mat, seed, lights, follow) => {
  const jellyMat = mat(CRIMSON_JELLY, { dither: 0.2 });
  const dome = mesh(smoothLathe([[0.001, 0], [0.4, 0.0], [0.44, 0.05], [0.42, 0.2], [0.34, 0.38], [0.2, 0.5], [0.001, 0.53]], 16, 26), jellyMat);
  // one bloodshot eye
  const eye = new THREE.Group();
  eye.position.set(0.02, 0.33, 0.33);
  eye.rotation.x = -0.4;
  const white = mesh(new THREE.SphereGeometry(1, 16, 12), mat(RAMPS.paper));
  white.scale.set(0.13, 0.14, 0.06);
  const iris = mesh(new THREE.SphereGeometry(1, 12, 8), mat(['#B0102A', '#FF4A5A'], { unlit: true, emissive: '#FF2030', emissiveIntensity: 0.5, outline: false }));
  iris.scale.set(0.06, 0.066, 0.02);
  iris.position.z = 0.05;
  const pupil = mesh(new THREE.SphereGeometry(1, 10, 8), mat(DARK, { unlit: true, outline: false }));
  pupil.scale.set(0.022, 0.024, 0.01);
  pupil.position.z = 0.064;
  eye.add(white, iris, pupil);
  for (const a of [0.4, 2.2, 3.7, 5.2]) {
    const vein = mesh(roundedBox(0.06, 0.008, 0.008, 0.003), mat(['#C01830', '#FF5060'], { unlit: true, outline: false }));
    vein.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.1, 0.045);
    vein.rotation.z = a;
    eye.add(vein);
  }
  // a mouth full of teeth across the front
  const mouth = grin(mat, 0.36, 0.12, 9, 8);
  mouth.group.position.set(0, 0.17, 0.4);
  mouth.group.rotation.x = -0.32;
  // it ate a knight: a sword stuck in its top, and a skull showing through its side
  const sword = new THREE.Group();
  const blade = mesh(roundedBox(0.035, 0.32, 0.012, 0.006), mat(RAMPS.iron));
  blade.position.y = 0.1;
  const guard = mesh(roundedBox(0.13, 0.026, 0.03, 0.01), mat(RAMPS.gold));
  guard.position.y = 0.27;
  const grip = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 6), mat(RAMPS.board));
  grip.position.y = 0.32;
  sword.add(blade, guard, grip);
  sword.position.set(-0.16, 0.36, -0.08);
  sword.rotation.set(-0.3, 0, 0.45);
  const skull = mesh(new THREE.SphereGeometry(0.075, 12, 8), mat(RAMPS.bone));
  skull.position.set(0.3, 0.14, 0.18);
  const halo = new THREE.Group();
  halo.position.y = 0.72;
  halo.rotation.x = Math.PI / 2 - 0.3;
  halo.add(mesh(new THREE.TorusGeometry(0.17, 0.024, 6, 24), mat(RAMPS.gold, { emissive: '#F0BD4A', emissiveIntensity: 0.4 })));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = mesh(new THREE.ConeGeometry(0.022, 0.08, 4), mat(RAMPS.gold));
    spike.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0);
    spike.rotation.z = a - Math.PI / 2;
    halo.add(spike);
  }
  body.add(dome, eye, mouth.group, sword, skull, halo);
  lights.push({ position: { x: 0, y: 1.4, z: 0.8 }, follow, color: '#FF3C78', intensity: 0.45, radius: 2.6, flicker: 0.05, seed });
  const phase = rand(seed + 5)() * 6;
  const mouthRest = 0.12 / 0.18;
  return {
    idle(t, hitAge) {
      const w = Math.sin(t * 3.4 + phase);
      dome.scale.set(1 + w * 0.05, 1 - w * 0.06, 1 + w * 0.05);
      eye.position.y = 0.33 - w * 0.014;
      mouth.group.position.y = 0.17 - w * 0.014;
      sword.position.y = 0.36 - w * 0.02;
      halo.position.y = 0.72 + Math.sin(t * 2.1 + phase) * 0.03;
      halo.rotation.z = t * 0.9;
      // chewing
      mouth.mouth.scale.y = mouthRest * (0.55 + 0.45 * Math.abs(Math.sin(t * 3.2 + phase)) + (accent(hitAge) ? 0.6 : 0));
      pupil.position.x = Math.sin(t * 0.7 + phase) * 0.012;
    },
    death(k) {
      // it bulges once, then deflates into a puddle; what it swallowed is left lying in it
      const sy = at(k, [1.12, 1.04, 0.88, 0.74, 0.6, 0.48, 0.38, 0.32, 0.29, 0.28]);
      const sxz = at(k, [0.94, 0.98, 1.06, 1.13, 1.2, 1.27, 1.32, 1.35, 1.37, 1.38]);
      dome.scale.set(sxz, sy, sxz);
      eye.position.set(0.02, Math.max(0.07, 0.33 * sy + 0.02), 0.33 * sxz * at(k, [1, 1, 1, 1, 0.98, 0.95, 0.92, 0.9, 0.88, 0.88]));
      eye.rotation.x = at(k, [-0.4, -0.45, -0.55, -0.7, -0.85, -1, -1.1, -1.15, -1.18, -1.2]);
      eye.scale.setScalar(at(k, [1.1, 1.05, 1, 0.97, 0.95, 0.93, 0.92, 0.92, 0.92, 0.92]));
      mouth.group.position.set(0, Math.max(0.04, 0.17 * sy), 0.4 * sxz + 0.02);
      mouth.group.rotation.x = at(k, [-0.32, -0.36, -0.45, -0.6, -0.75, -0.9, -1, -1.06, -1.1, -1.1]);
      mouth.mouth.scale.y = mouthRest * at(k, [1.7, 1.9, 1.7, 1.5, 1.4, 1.3, 1.25, 1.2, 1.2, 1.2]);
      // the sword tips over and comes to lie across the puddle, hilt out
      sword.position.set(at(k, [-0.16, -0.16, -0.17, -0.18, -0.19, -0.2, -0.21, -0.22, -0.22, -0.22]), at(k, [0.4, 0.38, 0.34, 0.3, 0.26, 0.22, 0.19, 0.17, 0.16, 0.16]), at(k, [-0.08, -0.08, -0.06, -0.04, -0.01, 0.02, 0.05, 0.07, 0.08, 0.08]));
      sword.rotation.set(at(k, [-0.3, -0.3, -0.35, -0.45, -0.6, -0.8, -1.0, -1.15, -1.22, -1.25]), 0, at(k, [0.45, 0.45, 0.55, 0.7, 0.9, 1.1, 1.3, 1.42, 1.48, 1.5]));
      skull.position.set(0.3 * sxz * 0.9, Math.max(0.06, 0.14 * sy + 0.02), 0.18);
      // the halo drops onto it and lies flat
      halo.position.set(at(k, [0, 0, 0.02, 0.04, 0.06, 0.08, 0.09, 0.1, 0.1, 0.1]), at(k, [0.76, 0.74, 0.64, 0.54, 0.44, 0.34, 0.26, 0.2, 0.18, 0.17]), at(k, [0, 0, -0.01, -0.02, -0.03, -0.04, -0.05, -0.05, -0.05, -0.05]));
      halo.rotation.set(Math.PI / 2 - at(k, [0.3, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.02, 0, 0]), at(k, [0, 0, 0.12, 0.24, 0.32, 0.36, 0.3, 0.2, 0.16, 0.15]), 0.9 * k);
    },
  };
};

// ---- 骷髅卫兵 ----------------------------------------------------------------------------------------
const skull: RigBuilder = (body, mat, seed, lights, follow) => {
  const boneMat = mat(RAMPS.bone);
  const inkMat = mat(DARK, { unlit: true, outline: false });
  // everything above the legs falls as one when they give way
  const torso = new THREE.Group();
  const spine = mesh(new THREE.CapsuleGeometry(0.04, 0.2, 3, 8), boneMat);
  spine.position.y = 0.36;
  const ribs = mesh(roundedBox(0.25, 0.19, 0.16, 0.06), boneMat);
  ribs.position.y = 0.42;
  for (const y of [0.385, 0.45]) {
    const gap = mesh(roundedBox(0.255, 0.018, 0.165, 0.006), inkMat);
    gap.position.y = y;
    torso.add(gap);
  }
  // a blood-red tabard of the congregation
  const tabard = mesh(roundedBox(0.16, 0.26, 0.02, 0.01), mat(BLOOD));
  tabard.position.set(0, 0.3, 0.09);
  const pelvis = mesh(roundedBox(0.18, 0.08, 0.12, 0.03), boneMat);
  pelvis.position.y = 0.24;
  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.07, 0.22, 0);
    const shin = mesh(new THREE.CapsuleGeometry(0.03, 0.13, 3, 6), boneMat);
    shin.position.y = -0.1;
    const foot = mesh(roundedBox(0.09, 0.05, 0.14, 0.022), boneMat);
    foot.position.set(0, -0.2, 0.03);
    leg.add(shin, foot);
    legs.push(leg);
    body.add(leg);
  }
  // the cleaver raised over its head
  const armR = new THREE.Group();
  armR.position.set(0.16, 0.5, 0);
  const upper = mesh(new THREE.CapsuleGeometry(0.026, 0.16, 3, 6), boneMat);
  upper.position.set(0.04, 0.1, 0);
  upper.rotation.z = -0.4;
  const cleaver = new THREE.Group();
  const cBlade = mesh(roundedBox(0.2, 0.15, 0.02, 0.01), mat(RAMPS.rust));
  cBlade.position.set(0.08, 0.06, 0);
  const cEdge = mesh(roundedBox(0.2, 0.024, 0.024, 0.008), mat(RAMPS.iron));
  cEdge.position.set(0.08, -0.015, 0);
  const cHandle = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6), mat(RAMPS.board));
  cHandle.rotation.z = Math.PI / 2;
  cHandle.position.set(-0.08, 0.1, 0);
  cleaver.add(cBlade, cEdge, cHandle);
  cleaver.position.set(0.1, 0.22, 0.02);
  cleaver.rotation.z = 0.9;
  armR.add(upper, cleaver);
  const armL = new THREE.Group();
  armL.position.set(-0.16, 0.46, 0.04);
  const shield = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16), mat(RAMPS.iron));
  shield.rotation.x = Math.PI / 2;
  shield.position.set(-0.04, -0.04, 0.1);
  const emblem = mesh(new THREE.SphereGeometry(1, 10, 8), glowEye(mat));
  emblem.scale.set(0.03, 0.022, 0.01);
  emblem.position.set(-0.04, -0.04, 0.12);
  armL.add(shield, emblem);
  // the big skull
  const head = new THREE.Group();
  head.position.y = 0.8;
  const cranium = mesh(new THREE.SphereGeometry(0.27, 24, 16), boneMat);
  cranium.scale.set(1, 0.93, 0.95);
  for (const [x, y, rz, l] of [[0.08, 0.16, 0.6, 0.12], [0.12, 0.1, -0.4, 0.07]] as const) {
    const crack = mesh(roundedBox(l, 0.014, 0.012, 0.004), inkMat);
    crack.position.set(x, y, 0.235);
    crack.rotation.z = rz;
    head.add(crack);
  }
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.15, 0.05);
  const jawBone = mesh(roundedBox(0.25, 0.09, 0.19, 0.05), boneMat);
  jawBone.position.set(0, -0.02, 0.03);
  jaw.add(jawBone);
  for (let i = 0; i < 6; i++) {
    const tooth = mesh(roundedBox(0.03, 0.04, 0.02, 0.006), mat(TEETH));
    tooth.position.set((i - 2.5) * 0.036, 0.03, 0.125);
    jaw.add(tooth);
  }
  for (let i = 0; i < 6; i++) {
    const tooth = mesh(roundedBox(0.03, 0.036, 0.02, 0.006), mat(TEETH));
    tooth.position.set((i - 2.5) * 0.036, -0.11, 0.24);
    head.add(tooth);
  }
  const fires: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const socket = mesh(new THREE.SphereGeometry(1, 14, 10), inkMat);
    socket.scale.set(0.075, 0.08, 0.03);
    socket.position.set(side * 0.095, 0.0, 0.228);
    socket.rotation.set(-0.2, side * 0.38, side * 0.3);
    const fire = mesh(teardrop(0.026, 0.07), mat(EYE_RED, { unlit: true, emissive: '#FF2A1A', emissiveIntensity: 1.8, outline: false }));
    fire.position.set(side * 0.09, -0.012, 0.25);
    fires.push(fire);
    head.add(socket, fire);
  }
  // horned helm with a red plume
  const ironMat = mat(RAMPS.iron);
  const helm = new THREE.Group();
  const pot = mesh(new THREE.SphereGeometry(0.235, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), ironMat);
  pot.scale.set(1.06, 0.72, 1.06);
  pot.position.y = 0.12;
  const brim = mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 26), ironMat);
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.12;
  helm.add(pot, brim);
  for (const side of [-1, 1]) {
    const horn = mesh(taperTube(new THREE.QuadraticBezierCurve3(new THREE.Vector3(side * 0.2, 0.18, 0), new THREE.Vector3(side * 0.36, 0.26, 0.02), new THREE.Vector3(side * 0.34, 0.46, 0.08)), t => THREE.MathUtils.lerp(0.045, 0.008, t), 10, 6), boneMat);
    helm.add(horn);
  }
  const plume = mesh(taperTube(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.27, 0), new THREE.Vector3(0, 0.42, -0.08), new THREE.Vector3(0, 0.36, -0.26)), t => THREE.MathUtils.lerp(0.05, 0.012, t), 10, 6), mat(BLOOD));
  helm.add(plume);
  helm.rotation.set(-0.06, 0, 0.12);
  head.add(cranium, jaw, helm);
  torso.add(spine, ribs, tabard, pelvis, armR, armL, head);
  body.add(torso);
  lights.push({ position: { x: 0, y: 2.0, z: 0.8 }, follow, color: '#FF3A2A', intensity: 0.4, radius: 2.4, flicker: 0.25, seed });
  const phase = rand(seed + 7)() * 6;
  return {
    idle(t, hitAge) {
      jaw.rotation.x = Math.max(0, Math.sin(t * 15 + phase)) * 0.2 + (accent(hitAge) ? 0.4 : 0);
      head.rotation.z = Math.sin(t * 2.2 + phase) * 0.07;
      head.position.y = 0.8 + Math.abs(Math.sin(t * 2.2 + phase)) * 0.018;
      armR.rotation.z = Math.sin(t * 2.2 + phase) * 0.12 - (accent(hitAge) ? 0.5 : 0);
      helm.rotation.z = 0.12 + (accent(hitAge) ? Math.exp(-hitAge * 6) * Math.sin(hitAge * 30) * 0.4 : 0);
      legs[0].rotation.x = Math.sin(t * 2.2 + phase) * 0.06;
      legs[1].rotation.x = -Math.sin(t * 2.2 + phase) * 0.06;
      for (const [i, fi] of fires.entries()) fi.scale.set(1, 1 + 0.25 * Math.sin(t * 11 + i * 2), 1);
    },
    death(k) {
      // the knees give, the bones drop into a heap, the skull lands on top and the helm rolls off
      for (const [i, leg] of legs.entries()) {
        const side = i === 0 ? -1 : 1;
        leg.position.set(side * at(k, [0.07, 0.07, 0.08, 0.1, 0.12, 0.14, 0.15, 0.16, 0.16, 0.16]), at(k, [0.22, 0.2, 0.17, 0.13, 0.09, 0.06, 0.05, 0.04, 0.04, 0.04]), 0);
        leg.rotation.set(at(k, [0, -0.2, -0.5, -0.8, -1.1, -1.35, -1.45, -1.5, -1.52, -1.52]), 0, side * at(k, [0, 0.1, 0.2, 0.35, 0.5, 0.6, 0.65, 0.68, 0.7, 0.7]));
      }
      torso.position.set(0, at(k, [0, -0.02, -0.06, -0.11, -0.16, -0.2, -0.22, -0.23, -0.24, -0.24]), at(k, [0, 0, 0.02, 0.04, 0.07, 0.1, 0.12, 0.13, 0.14, 0.14]));
      ribs.position.set(at(k, [0, 0, -0.01, -0.03, -0.05, -0.07, -0.08, -0.09, -0.09, -0.09]), 0.42, 0);
      ribs.rotation.set(at(k, [0, 0, 0.12, 0.3, 0.55, 0.8, 1.0, 1.1, 1.15, 1.15]), 0, at(k, [0, 0, 0.05, 0.1, 0.15, 0.2, 0.22, 0.24, 0.25, 0.25]));
      spine.rotation.z = at(k, [0, 0, 0.1, 0.3, 0.6, 0.9, 1.1, 1.2, 1.25, 1.25]);
      tabard.rotation.x = at(k, [0, 0, -0.1, -0.3, -0.6, -0.9, -1.1, -1.2, -1.25, -1.25]);
      tabard.position.set(0, at(k, [0.3, 0.3, 0.29, 0.28, 0.26, 0.24, 0.22, 0.21, 0.21, 0.21]), at(k, [0.09, 0.09, 0.1, 0.12, 0.15, 0.18, 0.2, 0.21, 0.21, 0.21]));
      head.position.set(at(k, [0, 0, 0.02, 0.05, 0.08, 0.12, 0.15, 0.17, 0.18, 0.18]), at(k, [0.84, 0.84, 0.78, 0.7, 0.62, 0.54, 0.48, 0.45, 0.44, 0.44]), at(k, [0, 0, -0.02, -0.05, -0.09, -0.13, -0.17, -0.2, -0.21, -0.21]));
      head.rotation.set(at(k, [-0.35, -0.4, -0.3, -0.3, -0.35, -0.4, -0.45, -0.48, -0.5, -0.5]), 0, at(k, [0.05, 0.1, 0.2, 0.3, 0.4, 0.48, 0.54, 0.57, 0.58, 0.58]));
      jaw.rotation.set(at(k, [0.55, 0.6, 0.5, 0.45, 0.5, 0.55, 0.5, 0.48, 0.48, 0.48]), 0, at(k, [0, 0, 0, 0.05, 0.1, 0.15, 0.18, 0.2, 0.2, 0.2]));
      // the helm is knocked off when the skull hits the heap
      helm.position.set(at(k, [0, 0, 0.02, 0.04, 0.08, 0.2, 0.32, 0.4, 0.44, 0.45]), at(k, [0, 0.03, 0.04, 0.04, 0.02, -0.1, -0.24, -0.34, -0.38, -0.39]), at(k, [0, 0, 0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.1, 0.1]));
      helm.rotation.set(-0.06, 0, at(k, [0.12, 0.2, 0.3, 0.45, 0.7, 1.1, 1.5, 1.8, 1.95, 2.0]));
      armR.position.set(at(k, [0.16, 0.17, 0.18, 0.2, 0.22, 0.24, 0.26, 0.27, 0.28, 0.28]), at(k, [0.5, 0.52, 0.48, 0.42, 0.36, 0.32, 0.29, 0.28, 0.28, 0.28]), 0.02);
      armR.rotation.set(0, 0, at(k, [0.5, 0.6, 0.2, -0.3, -0.8, -1.2, -1.5, -1.65, -1.7, -1.7]));
      armL.position.set(at(k, [-0.16, -0.17, -0.19, -0.21, -0.23, -0.25, -0.26, -0.27, -0.27, -0.27]), at(k, [0.46, 0.46, 0.42, 0.38, 0.34, 0.31, 0.3, 0.29, 0.29, 0.29]), 0.04);
      armL.rotation.set(at(k, [0, 0, 0.2, 0.4, 0.7, 1.0, 1.2, 1.3, 1.35, 1.35]), 0, at(k, [0, -0.1, -0.2, -0.3, -0.4, -0.45, -0.48, -0.5, -0.5, -0.5]));
      // the sockets go dark with the spore burst
      for (const fi of fires) {
        const s = at(k, [1.3, 1.1, 1.2, 0.9, 0.6, 0]);
        fi.visible = s > 0;
        fi.scale.setScalar(Math.max(s, 1e-4));
      }
    },
  };
};

export const RIGS: Record<MobKind, RigBuilder> = { acolyte, wickling, jelly, skull };

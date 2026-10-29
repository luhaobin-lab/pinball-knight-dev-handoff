import * as THREE from 'three';
import type { ToonMaterial } from '../../render/api';
import { UU_PER_TILE } from '../../core/launch/units.ts';
import { recoilTrack, recoilUu, slashFrame } from '../../anim/reactions';
import { SKILL_ARM, type SkillPose } from '../../anim/skill';
import { RAMPS } from '../architecture/palette';
import { dropShadow, faceCamera, mesh, roundedBox, spherePatch, stand, taperTube, toon } from './shapes';

/**
 * 甲壳虫骑士 — the hero. A chibi knight in pearl beetle armour (the cue ball of this billiard game): a
 * big round great-helm with a T-visor and a forked rhinoceros-beetle horn, a round shell body with gold
 * seams, iron limbs, a sapphire scarf, a little sword and a round shield. White, gold and blue: no red,
 * which is the cult's colour. The beetle lives only in the armour: no legs, antennae or mandibles.
 *
 * The launch feel is the Demo's (ART_BIBLE rule 9, demo-juice §4.1) with one reskin, the pearl ball: he curls
 * into it while he already moves (launchStart, 0.1 s) and pops back out while the player can already aim
 * (launchEnd, 0.3 s), so neither adds latency. He never squashes. An enemy contact plays 回旋斩 (slash: the ball
 * spins in four 10-fps steps and flares) and, if the enemy survives, the 可控反弹动画 recoil away from it.
 *
 * World units are floor tiles. The ball has the Demo hero's collision size (radius 0.875 tiles, LAUNCH-002).
 */

/** Collision radius of the Demo hero (56 u = 0.875 tiles). */
export const HERO_RADIUS = 0.875;
/** Visual ball radius (slightly inside the collision circle so contacts read as touching). */
export const BALL_RADIUS = 0.76;
/** The knight model is authored at 1/MODEL_SCALE and scaled up. */
const MODEL_SCALE = 1.7;
const TORSO_R = 0.26;
const TORSO_Y = 0.34;
const HELMET_R = 0.335;
const HELMET_Y = 0.85;
const FRONT = Math.PI / 2;
/** launchStart: the curl into the ball (the ball shows from 45 % in). */
export const CURL_SECONDS = 0.1;
/** launchEnd: the pop back out (non-blocking). */
export const POP_SECONDS = 0.3;
/** The ball turns at most 30° per 60-fps frame, so its seams never strobe at the launch's 2000–4000 uu/s. */
export const ROLL_RATE_MAX = (Math.PI / 6) * 60;
/** The recoil off a surviving enemy: 48 uu (释放者 = the enemy, at rest). */
const RECOIL_TILES = recoilUu(0) / UU_PER_TILE;
/** The slash's flare per 10-fps step: extra ramp bands on every material (brighter, never glowing). */
const SLASH_FLARE = [1.2, 0.8, 0.45, 0.2];

export type KnightMode = 'knight' | 'curling' | 'ball' | 'popping';
export type KnightFace = 'neutral' | 'happy' | 'determined';

const PEARL = ['#463F5E', '#958FB4', '#D7D2E8', '#F6F4FB', '#FFFFFF'] as const;
/** The hero's warm gold silhouette rim (enemies carry a blood-red one). */
const HERO_RIM = { color: '#FFD98A', strength: 0.32 };
const BLADE = ['#22202E', '#5E5E80', '#A9ABC8', '#E6E8FA', '#FFFFFF'] as const;

function materials(): Record<'pearl' | 'pearlHi' | 'gold' | 'iron' | 'scarf' | 'visor' | 'eye' | 'leather' | 'blade', ToonMaterial> {
  return {
    pearl: toon({ ramp: PEARL, dither: 0.2, rim: HERO_RIM, lift: 0.3 }),
    pearlHi: toon({ ramp: ['#4E4766', '#A09ABE', '#E0DBEF', '#FAF8FD', '#FFFFFF'], dither: 0.2, rim: HERO_RIM, lift: 0.3 }),
    gold: toon({ ramp: RAMPS.gold, dither: 0.15, rim: HERO_RIM, lift: 0.3 }),
    iron: toon({ ramp: RAMPS.iron, dither: 0.15, rim: HERO_RIM, lift: 0.4 }),
    // sapphire accents: the hero's colours are white, gold and blue; blood red belongs to the cult
    scarf: toon({ ramp: ['#0E1D44', '#1F4192', '#3B74E0', '#7FB2FF', '#D4E6FF'], dither: 0.15, rim: HERO_RIM, lift: 0.3 }),
    visor: toon({ ramp: ['#0A0610', '#120C18'], unlit: true }),
    eye: toon({ ramp: ['#FFE6A3', '#FFFBE8'], unlit: true, emissive: '#FFD27A', emissiveIntensity: 0.6, outline: false }),
    leather: toon({ ramp: RAMPS.board, rim: HERO_RIM, lift: 0.3 }),
    blade: toon({ ramp: BLADE, dither: 0.15, rim: HERO_RIM, lift: 0.3 }),
  };
}

function bladeGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.04, 0);
  s.lineTo(0.04, 0);
  s.lineTo(0.036, 0.31);
  s.lineTo(0, 0.43);
  s.lineTo(-0.036, 0.31);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false });
  g.translate(0, 0, -0.008);
  return g;
}

export class BeetleKnight {
  /** Add this to the scene: the character (stand-transformed) and its drop shadow. */
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  mode: KnightMode = 'knight';
  face: KnightFace = 'neutral';
  /** Floor position (tiles) and facing (radians, 0 = toward the camera). */
  readonly position = new THREE.Vector2();
  facing = 0;
  private k = 0;
  private transition = 0;
  private time = 0;
  private blinkAt = 1.4;
  private happyUntil = 0;
  private readonly hop = new THREE.Group();
  /** The idle breathing (the only scale change the hero has). */
  private readonly breath = new THREE.Group();
  private readonly model = new THREE.Group();
  /** The pearl shell ball (rolls with the motion). */
  readonly ball = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly helmet = new THREE.Group();
  private readonly eyes: THREE.Mesh[] = [];
  private readonly smiles: THREE.Mesh[] = [];
  private readonly limbs: THREE.Object3D[] = [];
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly scarf = new THREE.Group();
  private readonly tails: THREE.Object3D[][] = [];
  private readonly shadow = dropShadow(HERO_RADIUS * 0.85);
  readonly mats = materials();
  /** Each material's own ramp lift, which the slash's flare adds to. */
  private readonly lifts = Object.values(this.mats).map(m => ({ m, lift: (m.uniforms.uLift?.value as number | undefined) ?? 0 }));
  private hitFlash = 0;
  private hopY = 0;
  private readonly recoilDir = new THREE.Vector2();
  private recoilAge = Infinity;
  private slashAge = Infinity;
  /** Roll asked for since the last update (radians about `rollAxis`, world space). */
  private rollAngle = 0;
  private readonly rollAxis = new THREE.Vector3();
  private skill: {pose:SkillPose;frame:number}|null=null;

  /** Presentation only, selected by the core's existing actor.anim timestamp. launchStart clears this override. */
  setSkillPose(pose:SkillPose|null,frame=-1):void{this.skill=pose&&frame>=0?{pose,frame}:null;this.apply();}

  constructor() {
    this.group.name = 'beetle-knight';
    this.body.name = 'beetle-knight-body';
    this.helmet.name='knight-helmet';
    this.group.add(this.body, this.shadow);
    this.body.add(this.hop);
    this.hop.add(this.breath);
    this.model.scale.setScalar(MODEL_SCALE);
    this.breath.add(this.model, this.ball);
    this.buildTorso();
    this.buildHelmet();
    this.buildScarf();
    this.buildLimbs();
    this.buildBall();
    this.model.add(this.torso, this.helmet, this.scarf, this.armL, this.armR, this.legL, this.legR);
    this.limbs.push(this.armL, this.armR, this.legL, this.legR, this.scarf);
    this.apply();
  }

  private buildTorso(): void {
    const m = this.mats;
    this.torso.position.y = TORSO_Y;
    const chest = mesh(new THREE.SphereGeometry(TORSO_R, 28, 18, 0, Math.PI), m.pearlHi, 'chest');
    const back = mesh(new THREE.SphereGeometry(TORSO_R + 0.006, 28, 18, Math.PI, Math.PI), m.pearl, 'elytra');
    const seam = mesh(new THREE.TorusGeometry(TORSO_R + 0.009, 0.016, 6, 24, Math.PI), m.gold);
    seam.rotation.set(0, -Math.PI / 2, Math.PI / 2);
    const ring = mesh(new THREE.TorusGeometry(TORSO_R + 0.004, 0.022, 6, 36), m.gold, 'equator');
    const belt = mesh(new THREE.TorusGeometry(TORSO_R * 0.955 + 0.004, 0.016, 6, 28, Math.PI), m.gold);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = -0.05;
    const crest = mesh(new THREE.OctahedronGeometry(0.055, 0), m.gold);
    crest.scale.set(0.9, 1.25, 0.5);
    crest.position.set(0, 0.105, TORSO_R - 0.02);
    crest.rotation.x = -0.4;
    this.torso.add(chest, back, seam, ring, belt, crest);
  }

  private buildHelmet(): void {
    const m = this.mats;
    this.helmet.position.y = HELMET_Y;
    const dome = mesh(new THREE.SphereGeometry(HELMET_R, 32, 22), m.pearl, 'helmet');
    // the T-visor: a dark slit across the eyes and down the nose
    const slit = mesh(spherePatch(HELMET_R + 0.008, FRONT, 0.6, 1.42, 1.78, 24), m.visor);
    const nose = mesh(spherePatch(HELMET_R + 0.008, FRONT, 0.09, 1.76, 2.1, 8), m.visor);
    const brow = mesh(new THREE.TorusGeometry(HELMET_R + 0.004, 0.022, 6, 32, Math.PI), m.gold);
    brow.rotation.set(-Math.PI / 2 + 0.24, 0, 0);
    this.helmet.add(dome, slit, nose, brow);
    for (const side of [-1, 1]) {
      const phi = FRONT + side * 0.27;
      const theta = 1.6;
      const dir = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
      const eye = mesh(new THREE.SphereGeometry(1, 12, 8), m.eye);
      eye.scale.set(0.05, 0.058, 0.014);
      eye.position.copy(dir).multiplyScalar(HELMET_R + 0.012);
      eye.lookAt(dir.clone().multiplyScalar(2));
      const smile = mesh(new THREE.TorusGeometry(0.04, 0.013, 4, 10, Math.PI), m.eye);
      smile.position.copy(dir).multiplyScalar(HELMET_R + 0.014).add(new THREE.Vector3(0, -0.016, 0));
      smile.lookAt(dir.clone().multiplyScalar(2).add(new THREE.Vector3(0, -0.032, 0)));
      smile.visible = false;
      this.eyes.push(eye);
      this.smiles.push(smile);
      this.helmet.add(eye, smile);
    }
    // forked rhinoceros-beetle horn sweeping forward and up from the brow
    const hornCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0.2, 0.27),
      new THREE.Vector3(0, 0.36, 0.48),
      new THREE.Vector3(0, 0.54, 0.5),
      new THREE.Vector3(0, 0.6, 0.36),
    );
    const horn = mesh(taperTube(hornCurve, t => THREE.MathUtils.lerp(0.13, 0.065, Math.pow(t, 0.8)), 18, 10), m.gold, 'horn');
    horn.scale.x = 0.85;
    const tip = hornCurve.getPointAt(1);
    const tangent = hornCurve.getTangentAt(1);
    for (const side of [-1, 1]) {
      const prong = new THREE.QuadraticBezierCurve3(
        tip.clone().addScaledVector(tangent, -0.035),
        tip.clone().add(new THREE.Vector3(side * 0.06, 0.03, 0.0)),
        tip.clone().add(new THREE.Vector3(side * 0.1, 0.08, 0.02)),
      );
      this.helmet.add(mesh(taperTube(prong, t => THREE.MathUtils.lerp(0.06, 0.024, t), 8, 8), m.gold));
    }
    const hornBand = mesh(new THREE.TorusGeometry(0.12, 0.026, 6, 20), m.scarf);
    const base = hornCurve.getPointAt(0.05);
    hornBand.position.copy(base);
    hornBand.lookAt(base.clone().add(hornCurve.getTangentAt(0.05)));
    hornBand.scale.x = 0.82;
    for (const side of [-1, 1]) {
      const stud = mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.04, 14), m.gold);
      stud.rotation.z = Math.PI / 2;
      stud.position.set(side * (HELMET_R - 0.006), -0.03, 0.0);
      this.helmet.add(stud);
    }
    this.helmet.add(horn, hornBand);
  }

  private buildScarf(): void {
    const m = this.mats;
    this.scarf.position.y = 0.57;
    const wrap = mesh(new THREE.TorusGeometry(0.19, 0.065, 8, 28), m.scarf, 'scarf');
    wrap.rotation.x = Math.PI / 2;
    wrap.scale.set(1, 1, 0.8);
    this.scarf.add(wrap);
    for (const [side, len] of [[-1, 4], [1, 3]] as const) {
      const chain: THREE.Object3D[] = [];
      let parent: THREE.Object3D = this.scarf;
      for (let i = 0; i < len; i++) {
        const seg = new THREE.Group();
        if (i === 0) seg.position.set(-0.13 + side * 0.04, -0.03, -0.16);
        else seg.position.set(0, 0, -0.09);
        const piece = mesh(roundedBox(0.085 - i * 0.008, 0.03, 0.11, 0.012), m.scarf);
        piece.position.z = -0.047;
        seg.add(piece);
        parent.add(seg);
        chain.push(seg);
        parent = seg;
      }
      this.tails.push(chain);
    }
  }

  private buildLimbs(): void {
    const m = this.mats;
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(side * 0.235, 0.43, 0.02);
      const pauldron = mesh(new THREE.SphereGeometry(0.105, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.pearl);
      pauldron.rotation.z = -side * 0.55;
      const fist = mesh(new THREE.SphereGeometry(0.075, 14, 10), m.iron, 'fist');
      fist.position.set(side * 0.085, -0.13, 0.05);
      arm.add(pauldron, fist);
    }
    const sword = new THREE.Group();
    const grip = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 8), m.leather);
    const guard = mesh(roundedBox(0.21, 0.04, 0.05, 0.015), m.gold);
    guard.position.y = 0.06;
    const pommel = mesh(new THREE.SphereGeometry(0.034, 10, 8), m.gold);
    pommel.position.y = -0.06;
    const blade = mesh(bladeGeometry(), m.blade, 'blade');
    blade.position.y = 0.075;
    sword.add(grip, guard, pommel, blade);
    sword.position.set(0.085, -0.13, 0.09);
    sword.rotation.set(0.45, 0, -0.32);
    this.armR.add(sword);
    const shield = new THREE.Group();
    const board = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 24), m.pearlHi, 'shield');
    const rim = mesh(new THREE.TorusGeometry(0.168, 0.024, 6, 28), m.gold);
    rim.rotation.x = Math.PI / 2;
    const boss = mesh(new THREE.OctahedronGeometry(0.075, 0), m.gold);
    boss.scale.set(0.75, 0.35, 1.2);
    boss.position.y = 0.028;
    const stripe = mesh(roundedBox(0.3, 0.012, 0.05, 0.005), m.scarf);
    stripe.position.y = 0.026;
    shield.add(board, rim, stripe, boss);
    shield.position.set(-0.11, -0.12, 0.1);
    shield.rotation.set(Math.PI / 2 - 0.1, 0, 0.5);
    this.armL.add(shield);
    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(side * 0.105, 0.13, 0.0);
      const boot = mesh(roundedBox(0.13, 0.1, 0.17, 0.04), m.iron, 'boot');
      boot.position.set(side * 0.01, -0.075, 0.025);
      const cuff = mesh(roundedBox(0.14, 0.035, 0.14, 0.014), m.gold);
      cuff.position.set(side * 0.01, -0.03, 0.005);
      leg.add(boot, cuff);
    }
  }

  private buildBall(): void {
    const m = this.mats;
    const R = BALL_RADIUS;
    const shell = mesh(new THREE.SphereGeometry(R, 36, 24), m.pearl, 'ball');
    // two gold seams crossing at the poles, and the crest where the face was
    const seamA = mesh(new THREE.TorusGeometry(R + 0.004, 0.04, 6, 48), m.gold);
    const seamB = mesh(new THREE.TorusGeometry(R + 0.004, 0.032, 6, 48), m.gold);
    seamB.rotation.y = Math.PI / 2;
    const crest = mesh(new THREE.OctahedronGeometry(0.16, 0), m.gold);
    crest.scale.set(0.9, 1.2, 0.45);
    crest.position.set(0, 0, R - 0.03);
    const band = mesh(new THREE.TorusGeometry(R * 0.72, 0.03, 6, 40), m.scarf);
    band.rotation.x = Math.PI / 2;
    band.position.y = R * 0.69;
    this.ball.add(shell, seamA, seamB, crest, band);
    this.ball.position.y = R;
  }

  /** The launch starts: curl into the pearl ball within CURL_SECONDS while already moving; interrupts a pop. */
  launchStart(): void {
    this.skill=null;
    if (this.mode === 'ball' || this.mode === 'curling') return;
    this.mode = 'curling';
  }

  /** The launch ended: pop back out of the ball within POP_SECONDS (non-blocking; launchStart interrupts it). */
  launchEnd(): void {
    if (this.mode === 'knight' || this.mode === 'popping') return;
    this.mode = 'popping';
    this.transition = 1 - this.k;
    this.happyUntil = this.time + 1.1;
  }

  /** 回旋斩 on an enemy contact: four 10-fps steps (0.4 s); the ball whirls a quarter turn per step and flares. */
  slash(): void {
    this.slashAge = 0;
    this.apply();
  }

  /**
   * 可控反弹动画 off a surviving enemy: the body is pushed 48 uu × the recoil track along (nx, nz), the unit contact
   * normal from the enemy toward the hero, and comes back within 0.56 s.
   */
  recoil(nx: number, nz: number): void {
    this.recoilAge = 0;
    this.recoilDir.set(nx, nz).normalize();
    this.apply();
  }

  setCurl(k: number): void {
    this.k = k;
    this.transition = k;
    this.mode = k >= 1 ? 'ball' : k <= 0 ? 'knight' : 'curling';
    this.apply();
  }

  /**
   * Rolls the shell ball by a floor displacement (tiles), without slipping up to ROLL_RATE_MAX; faster than that
   * it slips, so the seams stay readable. Applied by the next update.
   */
  roll(dx: number, dz: number): void {
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-6) return;
    this.rollAxis.set(dz, 0, -dx).normalize();
    this.rollAngle += dist / BALL_RADIUS;
  }

  update(gameDt: number, camera?: THREE.Camera): void {
    // a frame split at a contact can end a rounding error before it (30 × 1/60 < 0.5): a reaction never steps back
    const dt = Math.max(0, gameDt);
    this.time += dt;
    this.recoilAge += dt;
    this.slashAge += dt;
    // (the epsilon keeps whole 60-fps frames exact: six of them are exactly CURL_SECONDS)
    if (this.mode === 'curling') {
      this.k = Math.min(1, this.k + dt / CURL_SECONDS + 1e-9);
      if (this.k >= 1) this.mode = 'ball';
    } else if (this.mode === 'popping') {
      this.transition = Math.min(1, this.transition + dt / POP_SECONDS + 1e-9);
      this.k = 1 - this.transition;
      if (this.transition >= 1) {
        this.mode = 'knight';
        this.ball.quaternion.identity();
      }
    }
    // the pop's hop; an interrupted one settles in a few frames instead of snapping down
    this.hopY = this.mode === 'popping' ? Math.sin(Math.min(1, this.transition / 0.6) * Math.PI) * 0.5 : this.hopY * Math.exp(-dt * 40);
    if (this.rollAngle > 0) {
      const axis = this.rollAxis.clone().applyAxisAngle(UP, -(this.facing + this.whirl()));
      this.ball.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, Math.min(this.rollAngle, ROLL_RATE_MAX * dt)));
      this.rollAngle = 0;
    }
    if (this.time > this.blinkAt + 0.12) this.blinkAt = this.time + 2.2 + ((this.time * 7.31) % 1.7);
    this.apply();
    if (camera) faceCamera(this.group, camera);
  }

  private apply(): void {
    const k = this.k;
    const t = this.time;
    const popping = this.mode === 'popping';
    const curling = this.mode === 'curling';
    const ease = (x: number): number => Math.min(1, Math.max(0, x));
    const outBack = (x: number, s = 1.70158): number => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
    // the ball shows from mid-curl until the pop is well under way
    const ballOn = this.mode === 'ball' || (curling && k > 0.45) || (popping && this.transition < 0.3);
    this.ball.visible = ballOn;
    this.model.visible = !ballOn;
    const idle = this.mode === 'knight' ? 1 : 0;
    const breathe = Math.sin(t * 3.1) * 0.018 * idle;
    this.hop.position.y = this.hopY;
    this.breath.scale.set(1 + breathe * 0.6, 1 - breathe, 1 + breathe * 0.6);
    // knight parts retract while curling and spring back out while popping
    const out = popping ? outBack(ease((this.transition - 0.2) / 0.8), 2.4) : 1 - ease(k / 0.7);
    const limbScale = this.mode === 'ball' ? 0 : Math.max(0.0001, out);
    for (const limb of this.limbs) limb.scale.setScalar(limbScale);
    const helmetIn = popping ? 1 - outBack(ease((this.transition - 0.1) / 0.75), 2.2) : ease(k / 0.8);
    this.helmet.position.y = THREE.MathUtils.lerp(HELMET_Y, TORSO_Y, THREE.MathUtils.clamp(helmetIn, -0.3, 1)) + breathe * 0.6;
    this.helmet.scale.setScalar(Math.max(0.0001, 1 - Math.max(0, helmetIn) * 0.6));
    this.helmet.rotation.z = Math.sin(t * 1.3) * 0.035 * idle;
    this.armR.rotation.x = -0.15 + Math.sin(t * 3.1 + 0.6) * 0.06 * idle;
    this.armL.rotation.x = -0.05 + Math.sin(t * 3.1 + 1.2) * 0.04 * idle;
    this.armR.rotation.z=0;this.armL.rotation.z=0;
    this.armR.position.y=.43;this.armL.position.y=.43;
    if(this.skill&&!ballOn){
      const arm=SKILL_ARM[this.skill.frame]??SKILL_ARM[0];
      this.armR.rotation.x=arm;this.armR.rotation.z=this.skill.pose==='hunter'?-.25:-.12;
      // Source sprite raises its weapon above the shoulder; this short chibi rig has no elbow to translate it.
      this.armR.position.y+=Math.max(0,(-arm-.15)/1.35)*.35;
      if(this.skill.pose==='hunter'){this.armL.rotation.x=arm*.7;this.armL.rotation.z=.25;this.armL.position.y+=Math.max(0,(-arm-.15)/1.35)*.25;}
      this.helmet.rotation.z=0;
    }
    for (let c = 0; c < this.tails.length; c++) {
      const chain = this.tails[c];
      for (let i = 0; i < chain.length; i++) {
        const ph = t * 4.2 - i * 0.7 + c * 1.9;
        chain[i].rotation.x = 0.55 - i * 0.1 + Math.sin(ph) * 0.12;
        chain[i].rotation.y = (c === 0 ? -0.35 : 0.25) + Math.sin(ph * 0.8) * 0.18;
      }
    }
    const happy = this.face === 'happy' || this.time < this.happyUntil;
    const blinking = this.time > this.blinkAt && this.time < this.blinkAt + 0.12;
    for (let i = 0; i < this.eyes.length; i++) {
      this.eyes[i].visible = !happy;
      this.eyes[i].scale.y = blinking ? 0.01 : this.face === 'determined' ? 0.036 : 0.058;
      this.smiles[i].visible = happy;
    }
    // stand transform: lean while a knight, none as a ball; the recoil moves the body and its shadow
    const pose = ballOn ? 1 : THREE.MathUtils.clamp(k * 1.4, 0, 1);
    const push = recoilTrack(this.recoilAge) * RECOIL_TILES;
    const x = this.position.x + this.recoilDir.x * push;
    const z = this.position.y + this.recoilDir.y * push;
    stand(this.body, x, z, this.facing + this.whirl(), pose);
    this.shadow.position.set(x, 0.01, z);
    const shadowScale = 1 - Math.min(0.5, this.hopY * 0.6);
    this.shadow.scale.setScalar(shadowScale * (ballOn ? 1 : 0.8));
    const slash = slashFrame(this.slashAge);
    const flare = slash >= 0 ? SLASH_FLARE[slash] : 0;
    for (const { m, lift } of this.lifts) {
      m.flash = this.hitFlash;
      if (m.uniforms.uLift) m.uniforms.uLift.value = lift + flare;
    }
  }

  /** The slash's extra yaw: a quarter turn more at every step, a whole turn (none) once it has ended. */
  private whirl(): number {
    const step = slashFrame(this.slashAge);
    return step >= 0 ? -(step + 1) * (Math.PI / 2) : 0;
  }

  /** Hit flash on every material (0..1). */
  set flash(v: number) {
    this.hitFlash = v;
    this.apply();
  }
}

const UP = new THREE.Vector3(0, 1, 0);

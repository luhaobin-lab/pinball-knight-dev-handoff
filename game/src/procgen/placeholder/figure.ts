import * as THREE from 'three';
import type { PointLight, PointLightOptions, ToonMaterial } from '../../render/api';
import { UU_PER_TILE } from '../../core/launch/units.ts';
import { createRng } from '../../core/rng';
import {
  blinkOn,
  CORPSE_DESATURATION,
  corpseTint,
  DEATH_SECONDS,
  deathFrame,
  FLASH_SECONDS,
  recoilTrack,
  recoilUu,
  SPLAT_AT,
  SQUASH_SECONDS,
  squashHeight,
  squashWidth,
} from '../../anim/reactions';
import { RAMPS } from '../architecture/palette';
import { dropShadow, faceCamera, glowCard, stand } from '../creatures/shapes';
import type { DieOptions, Mob } from '../creatures/mobs';
import { FORMS, type FormParts } from './forms';
import { isMark, lookMaterial, rampOf } from './materials';
import { ENEMY_FLOOR_GLOW, ENEMY_LIGHT, type Look } from './palette';
import { Sculptor } from './sculpt';
import { FAMILIES, figureSpec, FORM_HEIGHT, type FigureSpec, type SpecOptions } from './spec';

/**
 * A placeholder figure with the Mob API (src/procgen/creatures/mobs.ts): the same members, the same Demo reactions
 * from src/anim/reactions.ts, so the game drives a placeholder exactly like one of the four approved small fry.
 *   hitReact  反弹动画2 squash and stretch (feet on the floor) + 可控反弹动画 recoil away from the hero
 *   flash     蓝图_效果_闪烁: the flat near-white blink, 0.3 s; the mouth opens
 *   die       the 1 s death (10 frames at 10 fps): the body collapses into a flat stain, the embers and the floor glow
 *             go out and the grin closes with the spores at 0.5 s (onSplat), then the corpse darkens (明度 1 → 0.5,
 *             饱和度 0 → 0.35; its marks to the dark bone step) and stays
 * The death pose is the kit's one generic collapse; the timing is the Demo's.
 */

/** The blink's flat near-white (mobs.ts). */
const FLASH_WHITE = new THREE.Color(0.8, 0.8, 0.78);
const EPS = 1e-9;
const FADE_SECONDS = 0.5;
/** Every figure leans a little toward its target, like the small fry. */
const LEAN_IN = 0.12;
/**
 * A figure turns toward its target at most this far from the camera (radians): like the Demo's sprites, which only
 * flip to face the hero, its face always reads.
 */
export const MAX_YAW = 0.75;
/** The face turns back toward the camera so it stays within this angle of it while the body turns MAX_YAW. */
export const FACE_YAW = THREE.MathUtils.degToRad(15);
/** What the light marks (teeth, bone glyphs, runes) darken to on a corpse: the bone ramp's dark step. */
const CORPSE_MARK = new THREE.Color(RAMPS.bone[1]);

/**
 * The 10-frame collapse (body height and spread, head tilt), held on the last frame: it ends as a flat stain on the
 * floor, its grin shut at the spores (frame 5).
 */
const COLLAPSE = {
  sy: [1.08, 1.0, 0.82, 0.62, 0.44, 0.3, 0.2, 0.15, 0.13, 0.12],
  sxz: [0.95, 1.0, 1.1, 1.2, 1.3, 1.38, 1.44, 1.48, 1.5, 1.5],
  tilt: [-0.1, 0.05, 0.16, 0.28, 0.4, 0.5, 0.56, 0.6, 0.62, 0.62],
  fall: [0, 0.35, 0.7, 1, 1, 1, 1, 1, 1, 1],
  mouth: [1.35, 1.4, 1.35, 1.3, 1.25, 0.22, 0.2, 0.2, 0.2, 0.2],
  ember: [1.3, 1.1, 1.2, 0.9, 0.6, 0],
} as const;
/** The death frame at which the spores leave: the embers are out and the grin is shut from here on. */
const SPLAT_FRAME = 5;
/** The grin's idle gape and its opening on a hit (scale y over its rest; the lips drop from the corners). */
export const MOUTH_IDLE = 0.1;
const MOUTH_HIT = 0.35;
const at = (k: number, track: readonly number[]): number => track[Math.min(k, track.length - 1)];

/** What the game drives on a Mob (src/procgen/creatures/mobs.ts): a PlaceholderMob has every member. */
export type MobLike = Pick<Mob, 'group' | 'body' | 'radius' | 'position' | 'facing' | 'target' | 'lights' | 'attacking' | 'bindLights' | 'hitReact' | 'flash' | 'die' | 'corpse' | 'update'>;

export type { DieOptions };

export interface FigureOptions extends SpecOptions {
  /** Overall size multiplier on top of the row's size (default 1). */
  scale?: number;
}

interface Paint {
  readonly material: ToonMaterial;
  readonly emissive: THREE.Color;
  readonly rim: number;
  /** The corpse's per-channel tint: desaturation for solids, the dark bone step for light marks. */
  readonly grey: THREE.Color;
  /** A light mark (teeth, bone glyphs): it darkens to CORPSE_MARK instead of greying. */
  readonly mark: boolean;
}

export class PlaceholderMob {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly spec: FigureSpec;
  /** Collision radius on the floor (tiles): the row's 宽度 / 64 × scale. */
  readonly radius: number;
  /** The drawn footprint radius (tiles): the collision radius times the size policy's floor (spec.visualScale). */
  readonly visualRadius: number;
  /** Top of the silhouette above the floor at rest (tiles), tier marks included: where bars and intents hang. */
  readonly top: number;
  readonly position = new THREE.Vector2();
  facing = 0;
  readonly target = new THREE.Vector2(NaN, NaN);
  readonly lights: PointLightOptions[] = [];
  /** Set while the enemy attacks: the Demo skips the hit flash then. */
  attacking = false;
  /** The parts the kit built, by kind (for tests and tools). */
  readonly sculptor: Sculptor;
  private readonly squash = new THREE.Group();
  private readonly model = new THREE.Group();
  private readonly shadow: THREE.Mesh;
  private readonly aura: THREE.Mesh | null;
  private readonly parts: FormParts;
  private readonly paints: Paint[] = [];
  private readonly enemy: boolean;
  private readonly phase: number;
  private readonly restScale = new THREE.Vector3();
  private readonly restHeadRot = new THREE.Euler();
  private readonly restCrest = new THREE.Vector3();
  private readonly restSway: THREE.Euler[] = [];
  private readonly restEmber: THREE.Vector3[] = [];
  private readonly restTurn: number[] = [];
  private time: number;
  private clock = 0;
  private reactAge = Infinity;
  private hitAge = Infinity;
  private flashLeft = 0;
  private readonly recoilDir = new THREE.Vector2();
  private recoilTiles = 0;
  private dieAge = -1;
  private onSplat: (() => void) | undefined;
  private bound: { light: PointLight; intensity: number }[] = [];

  constructor(rowName: string, o: FigureOptions = {}) {
    this.spec = figureSpec(rowName, o);
    const spec = this.spec;
    const scale = o.scale ?? 1;
    this.radius = spec.radius * scale;
    const unit = this.radius * spec.visualScale;
    this.visualRadius = unit;
    this.enemy = FAMILIES[spec.family].group === 'enemy';
    this.group.name = `placeholder-${spec.row}`;
    this.shadow = dropShadow(unit * 0.95);
    this.group.add(this.body, this.shadow);
    if (this.enemy) {
      // the cast's floor glow (4.2 radii at the small fry's size), growing slower for the big ones
      this.aura = glowCard(ENEMY_FLOOR_GLOW, unit * 2.4 + 1.1, 0.2);
      this.aura.userData.faceCamera = false;
      this.aura.rotation.x = -Math.PI / 2;
      this.group.add(this.aura);
    } else this.aura = null;
    this.body.add(this.squash);
    this.squash.add(this.model);
    // a creature's box is 3 radii tall; a row whose 高度 differs from its 宽度 stretches it
    const tall = spec.height / (spec.radius * (FORM_HEIGHT[spec.form] ?? 3));
    this.model.scale.set(unit, unit * tall, unit);
    const rng = createRng(spec.seed);
    this.phase = rng.next() * 6;
    this.time = rng.next() * 10;
    const materials = new Map<Look, THREE.Material>();
    this.sculptor = new Sculptor(look => {
      let m = materials.get(look);
      if (!m) {
        m = this.material(look);
        materials.set(look, m);
      }
      return m;
    });
    this.parts = FORMS[spec.form]({ s: this.sculptor, root: this.model, spec, unit });
    this.restScale.copy(this.parts.body.scale);
    if (this.parts.head) this.restHeadRot.copy(this.parts.head.rotation);
    if (this.parts.crest) this.restCrest.copy(this.parts.crest.position);
    for (const o3 of this.parts.sway ?? []) this.restSway.push(o3.rotation.clone());
    for (const e of this.parts.embers) this.restEmber.push(e.scale.clone());
    for (const t of this.parts.turn) this.restTurn.push(t.rotation.y);
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    this.top = box.max.y + (this.parts.hover ?? 0) * unit * tall;
    if (this.enemy) {
      const [lx, ly, lz] = ENEMY_LIGHT.at;
      this.lights.push({ position: { x: lx * unit, y: ly * unit, z: lz * unit }, follow: this.body, color: ENEMY_LIGHT.color, intensity: ENEMY_LIGHT.intensity, radius: 1 + unit, flicker: 0.2, seed: spec.seed % 1000 });
    }
    this.pose();
  }

  private material(look: Look): ToonMaterial {
    const m = lookMaterial(look, this.enemy);
    const ramp = rampOf(look);
    const top = new THREE.Color(ramp[ramp.length - 1]);
    const mark = isMark(look) && look !== 'void' && look !== 'vein';
    const grey = mark ? new THREE.Color(CORPSE_MARK.r / Math.max(top.r, 1e-3), CORPSE_MARK.g / Math.max(top.g, 1e-3), CORPSE_MARK.b / Math.max(top.b, 1e-3)) : greyTint(ramp);
    this.paints.push({ material: m, emissive: m.uniforms.uEmissive.value.clone(), rim: m.uniforms.uRimStrength?.value ?? 0, grey, mark });
    return m;
  }

  bindLights(lights: readonly PointLight[]): void {
    this.bound = lights.map(light => ({ light, intensity: light.intensity }));
  }

  /** The touched enemy's reaction to a launch contact; (nx, nz) the unit normal from the enemy toward the hero. */
  hitReact(nx: number, nz: number, hitterSpeedUu: number): void {
    this.reactAge = 0;
    this.hitAge = 0;
    this.recoilDir.set(-nx, -nz).normalize();
    this.recoilTiles = recoilUu(hitterSpeedUu) / UU_PER_TILE;
    this.pose();
  }

  /** 蓝图_效果_闪烁: blinks white for `seconds` of game time, unless attacking. */
  flash(seconds = FLASH_SECONDS): void {
    if (this.attacking) return;
    this.flashLeft = seconds;
    this.hitAge = 0;
    this.pose();
  }

  /** 角色死亡: the collapse (1 s, the splat at 0.5 s), then the darkened corpse stays. */
  die(options: DieOptions = {}): void {
    if (this.dieAge >= 0) return;
    this.dieAge = 0;
    this.onSplat = options.onSplat;
    this.pose();
  }

  get corpse(): boolean {
    return this.dieAge >= DEATH_SECONDS - EPS;
  }

  update(gameDt: number, camera?: THREE.Camera): void {
    const dt = Math.max(0, gameDt);
    this.time += dt;
    this.clock += dt;
    this.reactAge += dt;
    this.hitAge += dt;
    this.flashLeft -= dt;
    if (this.dieAge >= 0) {
      const before = this.dieAge;
      this.dieAge += dt;
      if (before < SPLAT_AT - EPS && this.dieAge >= SPLAT_AT - EPS) this.onSplat?.();
    } else if (Number.isFinite(this.target.x)) {
      const want = Math.atan2(this.target.x - this.position.x, this.target.y - this.position.y);
      let d = want - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 6);
    }
    this.pose();
    if (camera) faceCamera(this.group, camera);
  }

  private pose(): void {
    const dead = this.dieAge >= 0;
    if (dead) this.deathPose(deathFrame(this.dieAge));
    else this.idlePose(this.time, this.hitAge);
    const w = squashWidth(this.reactAge);
    this.squash.scale.set(w, squashHeight(this.reactAge), w);
    this.squash.rotation.set(this.enemy ? LEAN_IN : 0, 0, 0);
    const push = recoilTrack(this.reactAge) * this.recoilTiles;
    const x = this.position.x + this.recoilDir.x * push;
    const z = this.position.y + this.recoilDir.y * push;
    const yaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(this.facing), Math.cos(this.facing)), -MAX_YAW, MAX_YAW);
    stand(this.body, x, z, yaw, 0);
    // the face (or a flat-faced head) turns back so it never shows the camera more than FACE_YAW
    const back = THREE.MathUtils.clamp(yaw, -FACE_YAW, FACE_YAW) - yaw;
    this.parts.turn.forEach((t, i) => (t.rotation.y = this.restTurn[i] + back));
    this.shadow.position.set(x, 0.01, z);
    const out = dead ? Math.min(1, Math.max(0, (this.dieAge - SPLAT_AT) / FADE_SECONDS)) : 0;
    if (this.aura) {
      this.aura.position.set(x, 0.02, z);
      (this.aura.material as THREE.MeshBasicMaterial).opacity = (0.16 + 0.06 * Math.sin(this.time * 2.3)) * (1 - out);
      this.aura.visible = out < 1;
    }
    for (const b of this.bound) b.light.intensity = b.intensity * (1 - out);
    const white = this.flashLeft > 0 && blinkOn(this.clock);
    const { brightness, desaturation } = dead ? corpseTint(this.dieAge) : { brightness: 1, desaturation: 0 };
    const k = desaturation / CORPSE_DESATURATION;
    for (const p of this.paints) {
      const u = p.material.uniforms;
      if (white) {
        u.uTint.value.setScalar(0);
        u.uEmissive.value.copy(FLASH_WHITE);
      } else if (p.mark) {
        u.uTint.value.setRGB(1 + (p.grey.r - 1) * k, 1 + (p.grey.g - 1) * k, 1 + (p.grey.b - 1) * k);
        u.uEmissive.value.copy(p.emissive).multiplyScalar((1 - out) * brightness);
      } else {
        u.uTint.value.setRGB(1 + (p.grey.r - 1) * desaturation, 1 + (p.grey.g - 1) * desaturation, 1 + (p.grey.b - 1) * desaturation).multiplyScalar(brightness);
        u.uEmissive.value.copy(p.emissive).multiplyScalar((1 - out) * brightness);
      }
      if (u.uRimStrength) u.uRimStrength.value = white ? 0 : p.rim * (1 - out) * (1 - k);
    }
  }

  /** The kit's living pose: one idle per style, a head that snaps aside now and then, swaying appendages. */
  private idlePose(t: number, hitAge: number): void {
    const p = this.parts;
    if (!this.enemy) return;
    const ph = this.phase;
    const accent = hitAge < SQUASH_SECONDS;
    const b = p.body;
    const hover = p.hover ?? 0;
    b.scale.copy(this.restScale);
    b.position.y = hover;
    b.rotation.set(0, 0, 0);
    switch (p.idle) {
      case 'breathe': {
        const br = Math.sin(t * 2.2 + ph);
        b.scale.set(this.restScale.x * (1 - br * 0.018), this.restScale.y * (1 + br * 0.03), this.restScale.z * (1 - br * 0.018));
        break;
      }
      case 'hop': {
        const h = Math.max(0, Math.sin(t * 3.6 + ph));
        b.position.y = hover + h * h * 0.12;
        b.scale.set(this.restScale.x * (1 + (1 - h) * 0.04), this.restScale.y * (1 - (1 - h) * 0.05), this.restScale.z * (1 + (1 - h) * 0.04));
        break;
      }
      case 'hover':
        b.position.y = hover + 0.07 * Math.sin(t * 1.7 + ph);
        break;
      case 'sway':
        b.position.y = hover;
        b.rotation.z = 0.035 * Math.sin(t * 1.3 + ph);
        break;
      case 'still':
        break;
    }
    if (p.head) {
      // every few seconds the head snaps aside, holds too long, and snaps back (the cult's twitch)
      const cycle = (t + ph) % 4.2;
      const snap = cycle > 3.2 ? (cycle < 3.26 ? (cycle - 3.2) / 0.06 : cycle < 3.9 ? 1 : 1 - (cycle - 3.9) / 0.3) : 0;
      const side = Math.floor((t + ph) / 4.2) % 2 ? 1 : -1;
      p.head.rotation.set(this.restHeadRot.x, this.restHeadRot.y, this.restHeadRot.z + Math.sin(t * 1.9 + ph) * 0.035 + Math.max(0, snap) * 0.22 * side + (accent ? 0.08 : 0));
    }
    if (p.mouth) p.mouth.scale.y = 1 + MOUTH_IDLE * Math.max(0, Math.sin(t * 4.4 + ph)) + (accent ? MOUTH_HIT : 0);
    if (p.teeth) p.teeth.visible = true;
    p.sway?.forEach((o3, i) => {
      const r = this.restSway[i];
      o3.rotation.set(r.x + Math.sin(t * 2.1 + ph + i * 1.7) * 0.06, r.y, r.z + Math.sin(t * 1.6 + ph + i * 2.3) * 0.08);
    });
    if (p.crest) {
      p.crest.position.copy(this.restCrest);
      if (this.spec.tier === 'boss') {
        p.crest.position.y += 0.04 * Math.sin(t * 1.8 + ph);
        p.crest.rotation.y = t * 0.5;
      }
    }
    p.embers.forEach((e, i) => {
      e.visible = true;
      e.scale.copy(this.restEmber[i]).multiplyScalar(1 + 0.12 * Math.sin(t * 11 + i * 2.1 + ph));
    });
  }

  /** The kit's one death: the body sinks into a spreading heap, the head slumps, the embers die with the spores. */
  private deathPose(k: number): void {
    const p = this.parts;
    const b = p.body;
    b.position.y = (p.hover ?? 0) * (1 - at(k, COLLAPSE.fall));
    b.rotation.set(0, 0, 0);
    b.scale.set(this.restScale.x * at(k, COLLAPSE.sxz), this.restScale.y * at(k, COLLAPSE.sy), this.restScale.z * at(k, COLLAPSE.sxz));
    if (p.head) p.head.rotation.set(this.restHeadRot.x - at(k, COLLAPSE.tilt) * 0.6, this.restHeadRot.y, this.restHeadRot.z + at(k, COLLAPSE.tilt));
    if (p.mouth) p.mouth.scale.y = at(k, COLLAPSE.mouth);
    if (p.teeth) p.teeth.visible = k < SPLAT_FRAME;
    if (p.crest) {
      p.crest.position.copy(this.restCrest);
      p.crest.position.y -= at(k, COLLAPSE.fall) * 0.3;
      p.crest.rotation.z = at(k, COLLAPSE.tilt) * 1.4;
    }
    const e = at(k, COLLAPSE.ember);
    p.embers.forEach((o3, i) => {
      o3.visible = e > 0;
      o3.scale.copy(this.restEmber[i]).multiplyScalar(Math.max(e, 1e-4));
    });
  }
}

/** The tint that turns a ramp's main colour into its luminance (mobs.ts): the corpse's 饱和度. */
function greyTint(ramp: readonly string[]): THREE.Color {
  const c = new THREE.Color(ramp[Math.min(ramp.length - 1, Math.floor(ramp.length * 0.6))]);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const ratio = (v: number): number => Math.min(4, l / Math.max(v, 1e-3));
  return new THREE.Color(ratio(c.r), ratio(c.g), ratio(c.b));
}

/** A placeholder enemy for a row of 数据表_敌人_普通 (any tier). */
export function placeholderEnemy(rowName: string, options: FigureOptions = {}): PlaceholderMob {
  return new PlaceholderMob(rowName, options);
}

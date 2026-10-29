import * as THREE from 'three';
import type { PointLight, PointLightOptions, ToonMaterial } from '../../render/api';
import { LAYERS } from '../../render/api';
import { UU_PER_TILE } from '../../core/launch/units.ts';
import type { Ramp } from '../architecture/palette';
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
  squashHeight,
  squashWidth,
} from '../../anim/reactions';
import { dropShadow, faceCamera, glowCard, stand, toon, type PartOptions } from './shapes';
import { EYE_RED, rand, RIGS, type MobRig } from './mob-rigs';

/**
 * 小怪 — the Smiling Congregation's small fry, built to press in on the hero: as tall as he is or taller,
 * leaning toward him, always staring at him with burning eyes, every one grinning too wide. One family
 * colour (blood red with bone and black) and a red silhouette rim, so the cult never blends into the
 * crypt or into the white knight. Cute proportions; the menace is in the stare, the teeth and the twitch.
 *   acolyte   笑面信徒  hooked hood, porcelain mask with a toothy grin and a third eye, arms reaching, dagger
 *   wickling  狂焰烛灵  a blood-wax candle with an angry face; its flame has one huge slit-pupil eye
 *   jelly     圣餐果冻  a crimson communion jelly: one bloodshot eye, a mouth of teeth, a knight's sword in it
 *   skull     骷髅卫兵  horned helm, fire in the sockets, a cleaver raised over its head, jaw chattering
 * Hits and deaths follow the Demo (demo-juice §7.2, §7.3; src/anim/reactions.ts): the touched enemy squashes
 * (反弹动画2) and recoils (可控反弹动画), every victim blinks (闪烁), and a killed one plays a 1 s death with the
 * spore splat at 0.5 s and then lies there as a darkened corpse. World units are floor tiles.
 */

export type MobKind = 'acolyte' | 'wickling' | 'jelly' | 'skull';
export const MOB_KINDS: readonly MobKind[] = ['acolyte', 'wickling', 'jelly', 'skull'];
export const MOB_NAMES: Record<MobKind, string> = { acolyte: '笑面信徒', wickling: '狂焰烛灵', jelly: '圣餐果冻', skull: '骷髅卫兵' };
/** Collision radius on the floor (tiles), at scale 1. */
export const MOB_RADIUS: Record<MobKind, number> = { acolyte: 0.72, wickling: 0.62, jelly: 0.88, skull: 0.72 };
const MODEL_SCALE = 2.0;
const ENEMY_RIM = { color: '#FF2440', strength: 0.55 };
/** The burning eyes, candles and the floor glow go out over the second half of the death (the spores leave). */
const FADE_FROM = SPLAT_AT;
const FADE_SECONDS = 0.5;
/**
 * The blink's flat near-white (linear; rec-02 f185–f187 read ≈ 240/255): the whole silhouette in one colour, kept
 * under the bloom threshold (0.85) so the flash never glows.
 */
const FLASH_WHITE = new THREE.Color(0.8, 0.8, 0.78);
/** Lets whole 60-fps frames land exactly on the Demo's times (30 frames are 0.5 s). */
const EPS = 1e-9;

export interface MobOptions {
  /** Overall size multiplier (elites are bigger). */
  scale?: number;
  seed?: number;
}

export interface DieOptions {
  /** Called once, 0.5 s into the death (the Demo's 粒子_Blood_02 notify): spawn the spores, play the splat. */
  onSplat?: () => void;
}

/** A material with what its corpse tint and fades start from. */
interface Paint {
  readonly material: ToonMaterial;
  readonly emissive: THREE.Color;
  readonly rim: number;
  /** Per-channel tint that desaturates the ramp's main colour fully toward its luminance. */
  readonly grey: THREE.Color;
}

export class Mob {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly radius: number;
  readonly position = new THREE.Vector2();
  facing = 0;
  /** Where it stares (the hero); the body turns toward it. */
  readonly target = new THREE.Vector2(NaN, NaN);
  /** Lights the mob carries (candles, burning eyes), as follow-lights for the renderer; see `bindLights`. */
  readonly lights: PointLightOptions[] = [];
  /** Set while the enemy attacks: the Demo skips the hit flash then (蓝图_效果_闪烁). */
  attacking = false;
  private readonly squash = new THREE.Group();
  private readonly shadow: THREE.Mesh;
  private readonly aura: THREE.Mesh;
  private readonly paints: Paint[] = [];
  private readonly rig: MobRig;
  private time: number;
  /** Game time since creation: the material clock the hit blink runs on (the same for mobs created together). */
  private clock = 0;
  /** Seconds since the last hitReact (squash and recoil), and since the last hit of any kind (accents). */
  private reactAge = Infinity;
  private hitAge = Infinity;
  private flashLeft = 0;
  private readonly recoilDir = new THREE.Vector2();
  private recoilTiles = 0;
  private dieAge = -1;
  private onSplat: (() => void) | undefined;
  private bound: { light: PointLight; intensity: number }[] = [];

  constructor(readonly kind: MobKind, o: MobOptions = {}) {
    const seed = o.seed ?? 1;
    const scale = o.scale ?? 1;
    this.group.name = `mob-${kind}`;
    this.radius = MOB_RADIUS[kind] * scale;
    this.shadow = dropShadow(this.radius * 0.95);
    // a faint blood-red glow on the floor marks every member of the cult
    this.aura = glowCard('#FF1E3C', this.radius * 4.2, 0.2);
    this.aura.userData.faceCamera = false;
    this.aura.rotation.x = -Math.PI / 2;
    this.group.add(this.body, this.shadow, this.aura);
    this.body.add(this.squash);
    const model = new THREE.Group();
    model.scale.setScalar(MODEL_SCALE * scale);
    this.squash.add(model);
    this.time = ((seed * 7919) % 1000) / 100;
    const mat = (ramp: Ramp, extra: Partial<PartOptions> = {}): ToonMaterial => {
      const lit = !extra.unlit;
      const m = toon({ ramp, rim: lit ? ENEMY_RIM : undefined, lift: lit ? 0.35 : undefined, ...extra });
      this.paints.push({ material: m, emissive: m.uniforms.uEmissive.value.clone(), rim: m.uniforms.uRimStrength?.value ?? 0, grey: greyTint(ramp) });
      return m;
    };
    this.rig = RIGS[kind](model, mat, seed, this.lights, this.body);
  }

  /** The renderer's handles for `lights` (in order), so the lights go out with the mob. */
  bindLights(lights: readonly PointLight[]): void {
    this.bound = lights.map(light => ({ light, intensity: light.intensity }));
  }

  /**
   * The touched enemy's reaction to a launch contact: 反弹动画2 (squash and stretch, 0.5 s) and 可控反弹动画 (the
   * body pushed away from the hero by the track × recoilUu, 1 s). (nx, nz) is the unit contact normal from the enemy
   * toward the hero; `hitterSpeedUu` the hero's 移动当前速度. Restarts on every contact, dead or alive.
   */
  hitReact(nx: number, nz: number, hitterSpeedUu: number): void {
    this.reactAge = 0;
    this.hitAge = 0;
    this.recoilDir.set(-nx, -nz).normalize();
    this.recoilTiles = recoilUu(hitterSpeedUu) / UU_PER_TILE;
    this.pose();
  }

  /** 蓝图_效果_闪烁 on every victim of a hit: blinks white for `seconds` of game time, unless attacking. */
  flash(seconds = FLASH_SECONDS): void {
    if (this.attacking) return;
    this.flashLeft = seconds;
    this.hitAge = 0;
    this.pose();
  }

  /** 角色死亡: the death flipbook (1 s, the splat at 0.5 s), then the corpse darkens and stays. */
  die(options: DieOptions = {}): void {
    if (this.dieAge >= 0) return;
    this.dieAge = 0;
    this.onSplat = options.onSplat;
    this.pose();
  }

  /** True once the death has played out and the darkened corpse lies still (2.1 s after die()). */
  get corpse(): boolean {
    return this.dieAge >= DEATH_SECONDS - EPS;
  }

  update(gameDt: number, camera?: THREE.Camera): void {
    // a frame split at a contact can end a rounding error before it (30 × 1/60 < 0.5): a reaction never steps back
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
      // stare: turn toward the target, quickly but not instantly
      const want = Math.atan2(this.target.x - this.position.x, this.target.y - this.position.y);
      let d = want - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 6);
    }
    this.pose();
    if (camera) faceCamera(this.group, camera);
  }

  /** Applies the pose of the current ages (no time passes, so a reaction shows its first frame at once). */
  private pose(): void {
    const dead = this.dieAge >= 0;
    if (dead) this.rig.death(deathFrame(this.dieAge));
    else this.rig.idle(this.time, this.hitAge);
    // 反弹动画2 scales the sprite's width and height; the model's feet stay on the floor
    const w = squashWidth(this.reactAge);
    this.squash.scale.set(w, squashHeight(this.reactAge), w);
    // they always lean in toward the hero a little
    this.squash.rotation.set(0.12, 0, 0);
    const push = recoilTrack(this.reactAge) * this.recoilTiles;
    const x = this.position.x + this.recoilDir.x * push;
    const z = this.position.y + this.recoilDir.y * push;
    stand(this.body, x, z, this.facing, 0);
    this.shadow.position.set(x, 0.01, z);
    this.aura.position.set(x, 0.02, z);
    const out = dead ? Math.min(1, Math.max(0, (this.dieAge - FADE_FROM) / FADE_SECONDS)) : 0;
    (this.aura.material as THREE.MeshBasicMaterial).opacity = (0.16 + 0.06 * Math.sin(this.time * 2.3)) * (1 - out);
    this.aura.visible = out < 1;
    for (const b of this.bound) b.light.intensity = b.intensity * (1 - out);
    const white = this.flashLeft > 0 && blinkOn(this.clock);
    const { brightness, desaturation } = dead ? corpseTint(this.dieAge) : { brightness: 1, desaturation: 0 };
    const k = desaturation / CORPSE_DESATURATION;
    for (const p of this.paints) {
      const u = p.material.uniforms;
      if (white) {
        u.uTint.value.setScalar(0);
        u.uEmissive.value.copy(FLASH_WHITE);
      } else {
        u.uTint.value.setRGB(1 + (p.grey.r - 1) * desaturation, 1 + (p.grey.g - 1) * desaturation, 1 + (p.grey.b - 1) * desaturation).multiplyScalar(brightness);
        u.uEmissive.value.copy(p.emissive).multiplyScalar((1 - out) * brightness);
      }
      if (u.uRimStrength) u.uRimStrength.value = white ? 0 : p.rim * (1 - out) * (1 - k);
    }
  }
}

/**
 * The tint that turns a ramp's main colour into its luminance: the toon resolve multiplies the ramp by the material
 * tint, so 饱和度 is approximated per material by desaturating its upper-middle band.
 */
function greyTint(ramp: Ramp): THREE.Color {
  const c = new THREE.Color(ramp[Math.min(ramp.length - 1, Math.floor(ramp.length * 0.6))]);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const ratio = (v: number): number => Math.min(4, l / Math.max(v, 1e-3));
  return new THREE.Color(ratio(c.r), ratio(c.g), ratio(c.b));
}

/**
 * Eyes in the dark beyond the walls: the rest of the congregation, watching. Pairs of burning dots that
 * blink at their own pace. Returns the group and its update.
 */
export function watchers(points: { x: number; y: number; z: number }[], seed = 9): { group: THREE.Group; update(t: number): void } {
  const group = new THREE.Group();
  group.name = 'watchers';
  const r = rand(seed);
  const material = toon({ ramp: EYE_RED, unlit: true, emissive: '#FF2030', emissiveIntensity: 1.3, outline: false });
  const pairs: { obj: THREE.Group; phase: number; period: number }[] = [];
  for (const p of points) {
    const pair = new THREE.Group();
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), material);
      e.scale.set(0.05, 0.04, 0.04);
      e.position.x = side * 0.11;
      pair.add(e);
    }
    pair.position.set(p.x, p.y, p.z);
    pair.layers.set(LAYERS.world);
    group.add(pair);
    pairs.push({ obj: pair, phase: r() * 10, period: 2.5 + r() * 4 });
  }
  return {
    group,
    update(t) {
      for (const p of pairs) {
        const c = (t + p.phase) % p.period;
        p.obj.scale.y = c < 0.12 ? 0.1 : 1;
        p.obj.visible = c > 0.05 || c < 0.04;
      }
    },
  };
}

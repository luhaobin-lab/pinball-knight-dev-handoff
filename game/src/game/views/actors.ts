import * as THREE from 'three';
import type { PixelRenderer, PointLight } from '../../render/api';
import { BeetleKnight } from '../../procgen/creatures/beetle-knight';
import { Mob, MOB_KINDS, type MobKind } from '../../procgen/creatures/mobs';
import { ENEMY_ROWS, placeholderBoss, placeholderEnemy, placeholderProp, type MobLike, type PlaceholderProp } from '../../procgen/placeholder';
import { STAND_IN } from '../roster';
import { isSharedSculptGeometry } from '../../procgen/placeholder/sculpt';
import { blinkOn, FLASH_SECONDS } from '../../anim/reactions';
import type { ActorView as FieldActorView, PresentEvent } from '../api';
import {skillFrame,skillPose}from'../../anim/skill';
import { viewKind } from './kinds';

/**
 * One view per field actor (ARCHITECTURE §8.2), in room tiles. Factory order: the hero → `BeetleKnight`; the
 * rows `roster.ts` STAND_IN covers → our small fry (`Mob`); bosses → `placeholderBoss`; other enemy rows →
 * `placeholderEnemy` (an unknown row falls back to the kit's first row); everything else → `placeholderProp`.
 */
export interface ActorView {
  readonly id: number;
  readonly kind: 'hero' | 'mob' | 'prop';
  readonly group: THREE.Object3D;
  /** Silhouette top over the floor (tiles): head bars and intents hang off it. */
  readonly top: number;
  /** Footprint radius (tiles). */
  readonly radius: number;
  dead: boolean;
  place(x: number, z: number): void;
  readonly x: number;
  readonly z: number;
  lookAt(x: number, z: number): void;
  update(dt: number, camera: THREE.Camera, time: number): void;
  hit(nx: number, nz: number, speed: number): void;
  flash(seconds?: number): void;
  die(onSplat?: () => void): void;
  /** The hero's launch beats (可控弹射): curl into the ball, the whirlwind slash on an enemy contact, pop out. */
  launch(beat: 'start' | 'slash' | 'end'): void;
  animate?(event:Extract<PresentEvent,{kind:'actor.anim'}>):void;
  dispose(): void;
}

const ROW_TO_MOB = new Map<string, MobKind>(MOB_KINDS.map(k => [STAND_IN[k], k]));

/** Tiles per uu (UU_PER_TILE = 64). */
const TILE = 1 / 64;

export function createActorView(actor: Pick<FieldActorView, 'id' | 'kind' | 'row' | 'radius' | 'height' | 'elite'>, renderer: PixelRenderer): ActorView {
  const k = viewKind(actor);
  if (k.view === 'hero') return createHeroView(actor.id, renderer);
  if (k.view === 'prop') return propView(actor.id, placeholderProp(k.prop, { seed: actor.id }), renderer);
  const mobKind = ROW_TO_MOB.get(k.row);
  if (mobKind && k.view === 'enemy') {
    const mob = new Mob(mobKind, { seed: actor.id });
    return mobView(actor.id, mob, (mobKind === 'jelly' ? 1.9 : 2.9) * 1, renderer);
  }
  const row = (ENEMY_ROWS as readonly string[]).includes(k.row) ? k.row : ENEMY_ROWS[0];
  const fig = k.view === 'boss' && row === k.row ? placeholderBoss(row) : placeholderEnemy(row, { elite: actor.elite });
  return mobView(actor.id, fig, fig.top, renderer);
}

/** The hero has its own GameView slice and need not be present in the field actor list. */
export function createHeroView(id: number, renderer: PixelRenderer): ActorView {
  const knight = new BeetleKnight();
  const light = renderer.addPointLight({ position: { x: 0, y: 2.4, z: 0.8 }, follow: knight.body, color: '#FFE2B0', intensity: 0.85, radius: 4.6, flicker: 0.06, seed: 11 });
  let last = { x: 0, z: 0 };
  let flashLeft = 0, gameTime = 0;
  let skill:Extract<PresentEvent,{kind:'actor.anim'}>|null=null;
  return {
    id,
    kind: 'hero',
    group: knight.group,
    top: 2.6,
    radius: 56 * TILE,
    dead: false,
    get x() {
      return knight.position.x;
    },
    get z() {
      return knight.position.y;
    },
    place(x, z) {
      knight.roll(x - last.x, z - last.z);
      knight.position.set(x, z);
      last = { x, z };
    },
    lookAt(x, z) {
      knight.facing = Math.atan2(x - knight.position.x, z - knight.position.y);
    },
    update(dt, camera, time) {
      gameTime += Math.max(0, dt);
      flashLeft -= Math.max(0, dt);
      knight.flash = flashLeft > 0 && blinkOn(gameTime) ? 1 : 0;
      const frame=skill?skillFrame(time-skill.t,skill.seconds):-1;
      knight.setSkillPose(frame>=0?skillPose(skill!.sequence):null,frame);
      knight.group.userData.skillFrame=frame;knight.group.userData.skillSequence=frame>=0?skill!.sequence:null;
      knight.update(dt, camera);
    },
    hit(nx, nz) {
      knight.recoil(nx, nz);
    },
    flash(seconds = FLASH_SECONDS) { flashLeft = seconds; },
    die() {
      this.dead = true;
    },
    launch(beat) {
      if(beat==='start')skill=null;
      if (beat === 'start') knight.launchStart();
      else if (beat === 'slash') knight.slash();
      else knight.launchEnd();
    },
    animate(event){skill=skillPose(event.sequence)?event:null;},
    dispose() {
      knight.group.removeFromParent();
      renderer.removeLight(light);
    },
  };
}

function mobView(id: number, mob: MobLike, top: number, renderer: PixelRenderer): ActorView {
  const lights: PointLight[] = mob.lights.map(l => renderer.addPointLight(l));
  mob.bindLights(lights);
  return {
    id,
    kind: 'mob',
    group: mob.group,
    top,
    radius: mob.radius,
    dead: false,
    get x() {
      return mob.position.x;
    },
    get z() {
      return mob.position.y;
    },
    place(x, z) {
      mob.position.set(x, z);
    },
    lookAt(x, z) {
      mob.target.set(x, z);
      mob.facing = Math.atan2(x - mob.position.x, z - mob.position.y);
    },
    update(dt, camera) {
      mob.update(dt, camera);
    },
    hit(nx, nz, speed) {
      mob.hitReact(nx, nz, speed);
    },
    flash(seconds) {
      mob.flash(seconds);
    },
    die(onSplat) {
      if (this.dead) return;
      this.dead = true;
      mob.die({ onSplat: onSplat ?? (() => {}) });
    },
    launch() {},
    dispose() {
      mob.group.removeFromParent();
      for (const l of lights) renderer.removeLight(l);
    },
  };
}

function propView(id: number, prop: PlaceholderProp, renderer: PixelRenderer): ActorView {
  const lights = prop.lights.map(l => renderer.addPointLight(l));
  let at = { x: 0, z: 0 };
  return {
    id,
    kind: 'prop',
    group: prop.group,
    top: 1.2,
    radius: prop.radius,
    dead: false,
    get x() {
      return at.x;
    },
    get z() {
      return at.z;
    },
    place(x, z) {
      at = { x, z };
      prop.place(x, z);
    },
    lookAt() {},
    update(_dt, _camera, time) {
      prop.update(time);
    },
    hit() {},
    flash() {},
    die() {
      this.dead = true;
      prop.group.visible = false;
    },
    launch() {},
    dispose() {
      prop.group.removeFromParent();
      for (const l of lights) renderer.removeLight(l);
      // Glyph/shadow buffers and per-prop materials are owned here; shared kit solid buffers remain cached.
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      prop.group.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      });
      for (const g of geometries) if (!isSharedSculptGeometry(g)) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

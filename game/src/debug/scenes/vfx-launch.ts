import { buildRoom, type BuiltRoom, type RoomSpec } from '../../procgen/architecture/room';
import { northstarSpec, NORTHSTAR_SCREEN } from '../../procgen/architecture/northstar';
import { obliqueCamera, obliqueTargetFor, TILE_PX } from '../../procgen/architecture/framing';
import { createWindowLightPass } from '../../procgen/architecture/windowlight';
import { windowShafts, type Shafts } from '../../procgen/architecture/shafts';
import { B1_LIGHT } from '../../procgen/architecture/palette';
import { BeetleKnight } from '../../procgen/creatures/beetle-knight';
import { Mob, watchers } from '../../procgen/creatures/mobs';
import {
  computeLaunchPreview,
  planLaunch,
  samplePlayback,
  STARTER_HERO,
  tilePointToUu,
  uuPointToTiles,
  type LaunchContact,
  type LaunchPlayback,
} from '../../core/launch/index.ts';
import { advanceLaunchClock } from '../../game/hit-stop';
import { HERO_START, ROOM_ENEMIES, roomBodies, roomSolids, roomWorld } from '../../game/reference-room';
import { createVfx, SpawnPerUnit, type TrailHandle, type Vfx } from '../../vfx';
import { defineScene, type SceneContext } from '../types';

/**
 * The launch effects (src/vfx) on one Demo launch in the reference room: the core's chain for the aim ?aim=
 * (default 243.5°: the pillar, the skull, the west wall, an urn, then the terminal glide; legs 469 / 219 / 162 / 92
 * uu and a 117-uu glide, resting 0.63 s after the release, close to the Demo capture rec-01's 483 / 378 / 154 / 209
 * / 83 uu and 0.67 s), played at the Demo's leg speeds (2000 / 2300 / 2600 / 2900 uu/s along 可控反弹曲线, the glide
 * at 0.3×) with the hit-stop of the enemy contact.
 * A stand-in hero (the knight as the pearl ball) lays the trail and a dust puff every 100 uu; the enemy contact
 * fires the whirlwind, the spark and the spores; the death splat follows at the Die notify (0.5 s); the trail fades
 * after the rest. The release is at RELEASE s; ?release= moves it; ?cast=0 hides the enemies (the launch still hits
 * them). The enemies do not react: that is src/procgen/creatures.
 */

/** Real seconds from the scene start to the release. */
const RELEASE = 0.5;
/** 粒子_Blood_02 fires 0.5 s into the Die animation (眼球 M02 / 大肠 M05 notifies). */
const SPLAT_AT = 0.5;
const DEFAULT_AIM = 243.5;

interface State {
  room: BuiltRoom;
  shafts: Shafts | null;
  watch: { update(t: number): void };
  knight: BeetleKnight;
  mobs: Mob[];
  vfx: Vfx;
  launch: LaunchPlayback;
  enemyContacts: number[];
  release: number;
  /** Real seconds since the scene started. */
  real: number;
  /** Game seconds since the release (dilated by the hit-stop during the launch). */
  game: number;
  /** Next contact to fire. */
  next: number;
  trail: TrailHandle | null;
  ended: boolean;
  meter: SpawnPerUnit;
  last: { x: number; z: number };
  splats: { at: number; x: number; z: number }[];
}

let st: State | null = null;

/** The play scene's room look (gameplay mold only in the corners). */
function roomSpec(): RoomSpec {
  return {
    ...northstarSpec('ns-1'),
    mold: [
      { x: 2.2, z: 4.6, rx: 1.2, rz: 1.0 },
      { x: 21.6, z: 4.7, rx: 1.2, rz: 1.0 },
      { x: 19.6, z: 12.4, rx: 1.3, rz: 0.9 },
      { x: 5.0, z: 9.6, rx: 0.9, rz: 0.6 },
    ],
  };
}

function setup(ctx: SceneContext): void {
  const { renderer, scene, params } = ctx;
  const spec = roomSpec();
  const room = buildRoom(spec);
  scene.add(room.group);
  for (const l of room.lights) renderer.addPointLight(l);
  const pass = createWindowLightPass(room.windows);
  pass.glow = 0.95;
  renderer.addPass('lighting', pass);
  room.uniforms.uWindowGlow.value = 0.5;
  room.uniforms.uSigilGlow.value = 0.12;
  room.uniforms.uBioGlow.value = 0.55;
  const shafts = windowShafts(room.windows);
  shafts.glow = 0.8;
  scene.add(shafts.object);
  const L = renderer.lighting;
  L.background.set(B1_LIGHT.void);
  L.ambientSky.set(B1_LIGHT.ambientSky);
  L.ambientGround.set(B1_LIGHT.ambientGround);
  L.ambientIntensity = 4.4;
  L.keyColor.set(B1_LIGHT.god);
  L.keyDirection.set(-0.19, 0.67, -0.72);
  L.keyIntensity = 0.06;
  L.tint = 0.6;

  const knight = new BeetleKnight();
  knight.position.set(HERO_START.x, HERO_START.z);
  knight.facing = 0.4;
  scene.add(knight.group);
  renderer.addPointLight({ position: { x: 0, y: 2.4, z: 0.8 }, follow: knight.body, color: '#FFE2B0', intensity: 0.85, radius: 4.6, flicker: 0.06, seed: 11 });
  // ?cast=0 leaves the congregation out (to measure the effects on the bare floor)
  const cast = params.get('cast') !== '0';
  const mobs = ROOM_ENEMIES.filter(() => cast).map((e, i) => {
    const mob = new Mob(e.kind, { seed: i + 1, scale: e.scale });
    mob.position.set(e.x, e.z);
    mob.target.set(HERO_START.x, HERO_START.z);
    mob.facing = Math.atan2(HERO_START.x - e.x, HERO_START.z - e.z);
    scene.add(mob.group);
    for (const l of mob.lights) renderer.addPointLight(l);
    return mob;
  });
  const eyes: { x: number; y: number; z: number }[] = [];
  const wr = (n: number): number => ((Math.sin(n * 91.7) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 18; i++) eyes.push({ x: 0.5 + i * 1.32 + wr(i) * 0.6, y: 3.2 + wr(i + 40) * 1.4, z: -1.2 - wr(i + 80) * 1.6 });
  for (let i = 0; i < 7; i++) eyes.push({ x: -1.6 - wr(i + 120) * 2.5, y: 1.4 + wr(i + 160) * 1.2, z: 2 + i * 1.7 });
  const watch = watchers(eyes);
  scene.add(watch.group);

  const t = obliqueTargetFor(renderer, 0, 0, NORTHSTAR_SCREEN.ox * (TILE_PX / 16), NORTHSTAR_SCREEN.oy * (TILE_PX / 16));
  obliqueCamera(renderer, t.x, t.z);

  const world = roomWorld(spec.layout, roomSolids(spec), roomBodies());
  const aim = (Number(params.get('aim') ?? DEFAULT_AIM) * Math.PI) / 180;
  const preview = computeLaunchPreview(world, tilePointToUu(HERO_START.x, HERO_START.z), { x: Math.cos(aim), y: Math.sin(aim) }, { hero: STARTER_HERO });
  const launch = planLaunch(preview);
  st = {
    room,
    shafts,
    watch,
    knight,
    mobs,
    vfx: createVfx(renderer, { seed: ctx.seed }),
    launch,
    enemyContacts: launch.contacts.filter(c => c.kind === 'enemy').map(c => c.time),
    release: Number(params.get('release') ?? RELEASE),
    real: 0,
    game: 0,
    next: 0,
    trail: null,
    ended: false,
    meter: new SpawnPerUnit(),
    last: { x: HERO_START.x, z: HERO_START.z },
    splats: [],
  };
}

/** The enemy contact: 可控挥击's melee hit (whirlwind, then per victim the spark and the spores). */
function contact(s: State, c: LaunchContact): void {
  const hit = c.hit;
  if (c.kind !== 'enemy' || !hit || hit.actor.kind !== 'body') return;
  const ip = uuPointToTiles(hit.impactPoint);
  // the hit normal points away from the enemy, toward the hero, as the effects take it
  const { x: nx, y: nz } = hit.normal;
  const k = s.knight;
  s.vfx.whirlwind(() => ({ x: k.position.x, z: k.position.y }));
  s.vfx.hitSpark(ip.x, ip.z, nx, nz);
  s.vfx.spores(ip.x, ip.z, nx, nz);
  const enemy = ROOM_ENEMIES[Number(hit.actor.id.slice('enemy-'.length))];
  if (enemy) s.splats.push({ at: c.time + SPLAT_AT, x: enemy.x, z: enemy.z });
}

function update(ctx: SceneContext, dt: number): void {
  if (!st) return;
  const s = st;
  const k = s.knight;
  s.real += dt;
  let gdt = 0;
  if (s.real >= s.release) {
    if (!s.trail) {
      // the release: the ball is out at once, the ribbon starts at the hero
      s.trail = s.vfx.trailBegin();
      k.setCurl(1);
      k.facing = 0;
      s.meter.reset();
      s.meter.step(k.position.x, k.position.y);
      s.vfx.update(0);
      s.vfx.trailPoint(s.trail, k.position.x, k.position.y);
    }
    const before = s.game;
    const into = Math.min(dt, s.real - s.release);
    s.game = s.game < s.launch.duration ? advanceLaunchClock(before, into, s.enemyContacts) : before + into;
    gdt = s.game - before;
  }
  const v = s.vfx;
  v.update(gdt);
  if (s.trail && !s.ended) {
    const launch = s.launch;
    while (s.next < launch.contacts.length && launch.contacts[s.next].time <= s.game) {
      const c = launch.contacts[s.next++];
      const at = uuPointToTiles(c.position);
      v.trailPoint(s.trail, at.x, at.z);
      dust(s, at.x, at.z);
      contact(s, c);
    }
    const p = uuPointToTiles(samplePlayback(launch, s.game).position);
    k.roll(p.x - s.last.x, p.z - s.last.z);
    k.position.set(p.x, p.z);
    v.trailPoint(s.trail, p.x, p.z);
    dust(s, p.x, p.z);
    s.last = { x: p.x, z: p.z };
    if (s.game >= launch.duration) {
      // the rest: Deactivate (the ribbon fades by its lifetime), the knight is himself again
      v.trailEnd(s.trail);
      s.ended = true;
      k.setCurl(0);
    }
  }
  for (const sp of s.splats) {
    if (sp.at <= s.game && sp.at > s.game - gdt) v.deathSplat(sp.x, sp.z);
  }
  k.update(gdt, ctx.camera);
  for (const m of s.mobs) m.update(s.real < s.release ? dt : gdt, ctx.camera);
  s.watch.update(s.real);
  s.room.setFires([{ x: k.position.x, y: 1.5, z: k.position.y, reach: 2.8 }]);
  s.room.update(ctx.renderer.time, dt);
  s.shafts?.update(ctx.renderer.time);
}

function dust(s: State, x: number, z: number): void {
  for (let n = s.meter.step(x, z); n > 0; n--) s.vfx.dust(x, z);
}

export default defineScene({
  name: 'vfx-launch',
  description: 'launch effects (trail, dust, whirlwind, spark, spores, death splat) on one Demo launch in the reference room',
  setup,
  update,
});

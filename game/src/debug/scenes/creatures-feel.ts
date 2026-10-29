import * as THREE from 'three';
import { buildRoom, type BuiltRoom } from '../../procgen/architecture/room';
import { SHAPES } from '../../procgen/architecture/layout';
import { obliqueCamera } from '../../procgen/architecture/framing';
import { createWindowLightPass } from '../../procgen/architecture/windowlight';
import { B1_LIGHT } from '../../procgen/architecture/palette';
import { BeetleKnight, HERO_RADIUS } from '../../procgen/creatures/beetle-knight';
import { STAND } from '../../procgen/creatures/shapes';
import { Mob, MOB_KINDS, type MobKind } from '../../procgen/creatures/mobs';
import { CURVE_MAIN_LEG, CURVE_TERMINAL_LEG, evalRichCurve } from '../../core/launch/curves.ts';
import { mainLegSpeed, terminalLegSpeed, UU_PER_TILE } from '../../core/launch/index.ts';
import { advanceLaunchClock } from '../../game/hit-stop';
import { defineScene, type SceneContext } from '../types';

/**
 * The creatures' launch feel (ART_BIBLE rule 9, demo-juice §4.1, §7.2, §7.3): one lane per small fry. In each, the
 * knight launches at the enemy three times on a game-time timeline that runs under the Demo's hit-stop
 * (advanceLaunchClock at every contact), like the live game:
 *   launchStart, a 256-uu main leg (可控反弹曲线, 2000 uu/s) into the enemy → contact 1 at 0.5 s: hitReact + flash,
 *   slash + recoil → the terminal glide back out (0.3 × speed, 可控终末确定曲线) → launchEnd at the stop;
 *   the same with contact 2 at 1.3 s (its launchStart interrupts the pop);
 *   contact 3 at 2.2 s kills: hitReact + flash + die, slash, no recoil; the corpse settles by 4.3 s.
 * Those are game seconds; each hit-stop delays real time by 0.069 s, so the contacts land at 0.5, 1.369 and 2.337 s
 * real (?t=) and the corpse has settled by 4.5 s.
 * The contact normal is rec-02's mirrored top to bottom (the hero below and to the right, so the faces show).
 * ?zoom= (default 1, the Demo's 0.75 px per uu at 1080p) and ?at=x,z (default the floor centre 13,7) frame it;
 * ?kinds=jelly,skull picks lanes. No VFX or sound (other lanes).
 */

const CONTACTS = [0.5, 1.3, 2.2] as const;
const KILL = 2;
/** rec-02's contact normal from the eyeball toward the hero (0.74, −0.67), mirrored top to bottom. */
const NORMAL = new THREE.Vector2(0.74, 0.67).normalize();
const LEG_UU = 256;
const LANE_GAP = 5.2;
/**
 * The mobs' material clock starts this far in, so contact 1 blinks with rec-02's phase (the white comes 0.08 game s
 * after the contact and lasts one 4-Hz half period); contacts 2 and 3 then show two other phases.
 */
const BLINK_PHASE = 0.17;

interface Leg {
  readonly start: number;
  readonly contact: number;
  readonly stop: number;
}

interface Lane {
  readonly mob: Mob;
  readonly knight: BeetleKnight;
  /** Where the knight touches the enemy, and where his legs start and end (tiles). */
  readonly touch: THREE.Vector2;
  readonly far: THREE.Vector2;
}

interface State {
  room: BuiltRoom;
  lanes: Lane[];
  legs: Leg[];
  /** Game time: the router's real time under the hit-stop of every contact. */
  game: number;
}

let st: State | null = null;

const inSpeed = mainLegSpeed(0);
const outSpeed = terminalLegSpeed(inSpeed);
const inSeconds = LEG_UU / inSpeed;
const outSeconds = LEG_UU / outSpeed;

/** The knight's floor point at game time t (on a leg, or resting at the far end). */
function knightAt(lane: Lane, legs: readonly Leg[], t: number, out: THREE.Vector2): THREE.Vector2 {
  for (const leg of legs) {
    if (t >= leg.start && t < leg.contact) return out.lerpVectors(lane.far, lane.touch, evalRichCurve(CURVE_MAIN_LEG, (t - leg.start) / inSeconds));
    if (t >= leg.contact && t < leg.stop) return out.lerpVectors(lane.touch, lane.far, evalRichCurve(CURVE_TERMINAL_LEG, (t - leg.contact) / outSeconds));
  }
  return out.copy(lane.far);
}

function setup(ctx: SceneContext): void {
  const { renderer, scene, params } = ctx;
  const room = buildRoom({ layout: SHAPES.rect(24, 12), seed: ctx.seed, northHeight: 1.5, dressing: 0.3 });
  scene.add(room.group);
  for (const l of room.lights) renderer.addPointLight(l);
  renderer.addPass('lighting', createWindowLightPass(room.windows));
  const L = renderer.lighting;
  L.background.set(B1_LIGHT.void);
  L.ambientSky.set(B1_LIGHT.ambientSky);
  L.ambientGround.set(B1_LIGHT.ambientGround);
  L.ambientIntensity = 4.0;
  L.keyColor.set(B1_LIGHT.god);
  L.keyDirection.set(-0.19, 0.67, -0.72);
  L.keyIntensity = 0.06;
  L.tint = 0.6;
  STAND.correction = 1;

  // the floor of SHAPES.rect(24, 12) is cells 1..24 × 1..12: its centre is (13, 7)
  const cx = 13;
  const cz = 7;
  const pick = params.get('kinds');
  const kinds: MobKind[] = pick ? MOB_KINDS.filter(k => pick.split(',').includes(k)) : [...MOB_KINDS];
  const lanes = kinds.map((kind, i): Lane => {
    const mob = new Mob(kind, { seed: i + 1 });
    mob.position.set(cx + (i - (kinds.length - 1) / 2) * LANE_GAP - 1.6, cz - 2.2);
    const touch = mob.position.clone().addScaledVector(NORMAL, mob.radius + HERO_RADIUS);
    const far = touch.clone().addScaledVector(NORMAL, LEG_UU / UU_PER_TILE);
    mob.target.copy(far);
    mob.facing = Math.atan2(far.x - mob.position.x, far.y - mob.position.y);
    mob.update(BLINK_PHASE);
    scene.add(mob.group);
    mob.bindLights(mob.lights.map(l => renderer.addPointLight(l)));
    const knight = new BeetleKnight();
    knight.position.copy(far);
    knight.facing = Math.atan2(-NORMAL.x, -NORMAL.y);
    knight.face = 'determined';
    scene.add(knight.group);
    renderer.addPointLight({ position: { x: 0, y: 2.4, z: 0.8 }, follow: knight.body, color: '#FFE2B0', intensity: 0.85, radius: 4.6, flicker: 0.06, seed: 11 + i });
    return { mob, knight, touch, far };
  });

  obliqueCamera(renderer, ...((params.get('at') ?? `${cx},${cz}`).split(',').map(Number) as [number, number]));
  renderer.camera.zoom = Math.max(1, Number(params.get('zoom') ?? 1) || 1);
  renderer.camera.updateProjectionMatrix();
  const legs = CONTACTS.map((contact): Leg => ({ start: contact - inSeconds, contact, stop: contact + outSeconds }));
  st = { room, lanes, legs, game: 0 };
}

/** Advances every creature to game time `to`, rolling the ball along its path. */
function advance(s: State, from: number, to: number): void {
  const dt = to - from;
  const a = new THREE.Vector2();
  for (const lane of s.lanes) {
    knightAt(lane, s.legs, from, a);
    const k = lane.knight;
    knightAt(lane, s.legs, to, k.position);
    k.roll(k.position.x - a.x, k.position.y - a.y);
    lane.mob.target.copy(k.position);
  }
  for (const lane of s.lanes) {
    lane.knight.update(dt);
    lane.mob.update(dt);
  }
}

/** The timeline's events in (from, to], in order. */
function events(s: State, from: number, to: number): { t: number; run(): void }[] {
  const out: { t: number; run(): void }[] = [];
  const due = (t: number): boolean => t > from + 1e-9 && t <= to + 1e-9;
  s.legs.forEach((leg, i) => {
    if (due(leg.start)) out.push({ t: leg.start, run: () => s.lanes.forEach(l => l.knight.launchStart()) });
    if (due(leg.contact))
      out.push({
        t: leg.contact,
        run: () =>
          s.lanes.forEach(({ mob, knight }) => {
            // the Demo's order: the bounce (反弹中: squash + recoil), the attack (slash, flash, death), the mirror
            mob.hitReact(NORMAL.x, NORMAL.y, inSpeed);
            knight.slash();
            mob.flash();
            if (i === KILL) mob.die();
            else knight.recoil(NORMAL.x, NORMAL.y);
          }),
      });
    if (due(leg.stop)) out.push({ t: leg.stop, run: () => s.lanes.forEach(l => l.knight.launchEnd()) });
  });
  return out.sort((x, y) => x.t - y.t);
}

function update(ctx: SceneContext, dt: number): void {
  if (!st) return;
  const s = st;
  const from = s.game;
  let to = advanceLaunchClock(from, dt, CONTACTS);
  let t = from;
  for (const e of events(s, from, to)) {
    advance(s, t, Math.max(t, e.t));
    t = Math.max(t, e.t);
    e.run();
  }
  // an event due within the rounding error past the frame (30 × 1/60 < 0.5) ends the frame on it: no step back
  to = Math.max(t, to);
  advance(s, t, to);
  s.game = to;
  for (const lane of s.lanes) {
    lane.knight.update(0, ctx.camera);
    lane.mob.update(0, ctx.camera);
  }
  s.room.setFires(s.lanes.map(l => ({ x: l.knight.position.x, y: 1.5, z: l.knight.position.y, reach: 2.2 })));
  s.room.update(ctx.renderer.time, dt);
}

export default defineScene({
  name: 'creatures-feel',
  description: 'Demo hit and death reactions per small fry, the knight launch states, under the hit-stop clock',
  setup,
  update,
});

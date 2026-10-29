import * as THREE from 'three';
import { createToonMaterial } from '../../render/api';
import { buildRoom, type BuiltRoom, type RoomSpec } from '../../procgen/architecture/room';
import { northstarSpec, NORTHSTAR_SCREEN } from '../../procgen/architecture/northstar';
import { SHAPES, floorBounds } from '../../procgen/architecture/layout';
import { isoCamera, obliqueCamera, obliqueTargetFor } from '../../procgen/architecture/framing';
import { createWindowLightPass, type WindowLightPass } from '../../procgen/architecture/windowlight';
import { windowShafts, type Shafts } from '../../procgen/architecture/shafts';
import { B1_LIGHT } from '../../procgen/architecture/palette';
import { defineScene, type SceneContext } from '../types';

/**
 * Room-kit look-dev: the North Star room shell (art bible §18) from the Demo's gameplay camera, or the
 * 45° iso beauty shot with ?cam=iso.
 * Options: ?room=northstar|rect|ell|stepped, ?seed=, ?fervor=0..7 (window, sigil and fungus glow),
 * ?hero=0 hides the 丸子 stand-in (a lit candle-ball that shows scale and the warm bubble), and
 * ?zoom=3&at=x,z magnifies the gameplay camera around a floor point for inspection.
 */

interface State {
  room: BuiltRoom;
  pass: WindowLightPass;
  shafts: Shafts | null;
}

let state: State | null = null;

/** Window emissive, sigil, fungus and window-pool levels along the Fervor ladder (art bible §5). */
function fervorLevels(f: number): { window: number; sigil: number; bio: number; pool: number } {
  const window = [0.5, 0.55, 0.65, 0.8, 1.0, 1.6, 1.9, 2.2][f];
  return { window, sigil: [0.12, 0.12, 0.15, 0.2, 0.35, 0.6, 0.8, 1][f], bio: 1 + f * 0.08, pool: 0.75 + window * 0.35 };
}

function roomSpec(name: string, seed: number): RoomSpec {
  switch (name) {
    case 'rect':
      return { layout: SHAPES.rect(16, 10), seed, northHeight: 1.5 };
    case 'ell':
      return { layout: SHAPES.ell(18, 12, 7, 5), seed, northHeight: 1.5 };
    case 'stepped':
      return { layout: SHAPES.stepped(), seed, northHeight: 1.5, bays: [{ x0: 5, x1: 9, height: 2.5 }], windows: [{ kind: 'rose', x: 7, y: 1.3, w: 1.9, h: 1.9, petals: 12 }, { kind: 'lancet', x: 15.5, y: 0.8, w: 0.5, h: 1.1 }] };
    default:
      return northstarSpec(seed === 1 ? 'ns-1' : seed);
  }
}

/** A stand-in for 丸子 (owned by p1-hero): a pearl-slate ball with its candle and the L-HERO light. */
function heroStandIn(ctx: SceneContext, x: number, z: number): void {
  const R = 0.85;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), createToonMaterial({ ramp: ['#2E2450', '#5A4E86', '#8E80BE', '#C4B8E6', '#F2EEFF'], dither: true }));
  // sphere correction (art bible §11.1): squash by sin θ along the camera-up axis so the ball is a circle
  const u = new THREE.Vector3(0, 0.53, -0.848);
  const s = 0.848;
  const m = new THREE.Matrix4().set(
    1 + (s - 1) * u.x * u.x, (s - 1) * u.x * u.y, (s - 1) * u.x * u.z, 0,
    (s - 1) * u.y * u.x, 1 + (s - 1) * u.y * u.y, (s - 1) * u.y * u.z, 0,
    (s - 1) * u.z * u.x, (s - 1) * u.z * u.y, 1 + (s - 1) * u.z * u.z, 0,
    0, 0, 0, 1,
  );
  ball.geometry.applyMatrix4(m);
  ball.position.set(x, R, z);
  ctx.scene.add(ball);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.5, 8), createToonMaterial({ ramp: ['#5C3A40', '#A9785E', '#DDB27F', '#F7DDB0', '#FFF6E3'], dither: 0.5, emissive: '#FFBE73', emissiveIntensity: 0.25 }));
  wax.position.set(x, R * 1.62 + 0.25, z - 0.25);
  ctx.scene.add(wax);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), createToonMaterial({ ramp: ['#FFC15E', '#FFFBE8'], unlit: true, outline: false, emissive: '#FFB347', emissiveIntensity: 2.4 }));
  flame.scale.set(0.1, 0.24, 0.1);
  flame.position.set(x, R * 1.62 + 0.72, z - 0.25);
  ctx.scene.add(flame);
  ctx.renderer.addPointLight({ position: { x, y: R * 2 + 0.6, z: z - 0.1 }, color: '#FFB347', intensity: 1.14, radius: 4.1, flicker: 0.3, seed: 7 });
}

function setup(ctx: SceneContext): void {
  const { renderer, scene, params } = ctx;
  const name = params.get('room') ?? 'northstar';
  const spec = roomSpec(name, ctx.seed);
  const room = buildRoom(spec);
  scene.add(room.group);
  for (const l of room.lights) renderer.addPointLight(l);

  const f = THREE.MathUtils.clamp(Math.round(Number(params.get('fervor') ?? 0)), 0, 7);
  const levels = fervorLevels(f);
  room.uniforms.uWindowGlow.value = levels.window;
  room.uniforms.uSigilGlow.value = levels.sigil;
  room.uniforms.uBioGlow.value = levels.bio;
  const pass = createWindowLightPass(room.windows);
  pass.glow = levels.pool;
  renderer.addPass('lighting', pass);
  // preview shafts (p1-gi-atmos replaces them with ray-marched god rays); ?shafts=0 hides them
  const shafts = params.get('shafts') === '0' ? null : windowShafts(room.windows);
  if (shafts) {
    shafts.glow = levels.window * 2;
    scene.add(shafts.object);
  }

  const L = renderer.lighting;
  L.background.set(B1_LIGHT.void);
  L.ambientSky.set(B1_LIGHT.ambientSky);
  L.ambientGround.set(B1_LIGHT.ambientGround);
  L.ambientIntensity = 4.0;
  L.keyColor.set(B1_LIGHT.god);
  L.keyDirection.set(-0.19, 0.67, -0.72);
  L.keyIntensity = 0.06;
  L.exposure = 1;
  L.tint = 0.6;

  const fb = floorBounds(spec.layout);
  if (params.get('hero') !== '0') {
    const hx = name === 'northstar' ? 9.5 : (fb.x0 + fb.x1 + 1) / 2;
    const hz = name === 'northstar' ? 12.5 : fb.z1 - 1;
    heroStandIn(ctx, hx, hz);
    // the hero's flame is the strongest fire: the mold recoils from it (anti-light)
    room.setFires([{ x: hx, y: 1.5, z: hz, reach: 2.6 }]);
  }

  if (params.get('cam') === 'iso') {
    const c = room.bounds.getCenter(new THREE.Vector3());
    isoCamera(renderer, new THREE.Vector3(c.x, 0.6, c.z));
  } else if (name === 'northstar') {
    // §18.1 placement: world (0, 0) of the floor plane lands at internal pixel (187, 76)
    const t = obliqueTargetFor(renderer, 0, 0, NORTHSTAR_SCREEN.ox, NORTHSTAR_SCREEN.oy);
    obliqueCamera(renderer, t.x, t.z);
  } else {
    // centre the room's screen box in the combat play rect x 118–640, y 36–326 (art bible §13.4)
    const top = room.bounds.min.z - 0.625 * room.bounds.max.y;
    const bottom = room.bounds.max.z;
    const t = obliqueTargetFor(renderer, (room.bounds.min.x + room.bounds.max.x) / 2, (top + bottom) / 2, (118 + 640) / 2, (36 + 326) / 2);
    obliqueCamera(renderer, t.x, t.z);
  }
  // look-dev inspection: ?zoom=3&at=6.5,1 magnifies the gameplay camera around a floor point
  const zoom = Number(params.get('zoom') ?? 1);
  const at = params.get('at');
  if (zoom > 1 && params.get('cam') !== 'iso') {
    const [ax, az] = (at ?? '12,7').split(',').map(Number);
    obliqueCamera(renderer, ax, az);
    renderer.camera.zoom = zoom;
  }
  state = { room, pass, shafts };
  console.info(`[architecture] ${name}: ${room.stats.triangles} triangles, ${room.stats.meshes} meshes, ${room.stats.lights} lights, ${room.stats.flames} flames, built in ${room.stats.buildMs.toFixed(1)} ms`);
}

function update(ctx: SceneContext, dt: number): void {
  state?.room.update(ctx.renderer.time, dt);
  state?.shafts?.update(ctx.renderer.time);
}

export default defineScene({
  name: 'architecture',
  description: 'Room kit: the North Star crypt shell from the gameplay camera (?cam=iso for the beauty shot).',
  setup,
  update,
});

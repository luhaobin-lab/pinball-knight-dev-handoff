import * as THREE from 'three';
import { buildRoom, type BuiltRoom } from '../../procgen/architecture/room';
import { SHAPES } from '../../procgen/architecture/layout';
import { obliqueCamera, isoCamera } from '../../procgen/architecture/framing';
import { createWindowLightPass } from '../../procgen/architecture/windowlight';
import { B1_LIGHT } from '../../procgen/architecture/palette';
import { BeetleKnight } from '../../procgen/creatures/beetle-knight';
import { STAND } from '../../procgen/creatures/shapes';
import { Mob, MOB_KINDS } from '../../procgen/creatures/mobs';
import { defineScene, type SceneContext } from '../types';

/**
 * Cast sheet in the crypt: the Beetle Knight turnaround and his curl into the ball, on a plain room
 * floor under the Demo camera. `?zoom=` magnifies (default 2), `?cam=iso` for the beauty camera.
 */

interface State {
  room: BuiltRoom;
  knights: BeetleKnight[];
  mobs: Mob[];
}
let state: State | null = null;

const POSES: { yaw: number; curl: number; spin?: [number, number, number] }[] = [
  { yaw: 0, curl: 0 },
  { yaw: -0.7, curl: 0 },
  { yaw: -Math.PI / 2, curl: 0 },
  { yaw: Math.PI, curl: 0 },
  { yaw: -0.4, curl: 0.4 },
  { yaw: -0.4, curl: 1, spin: [0.5, 0.6, 0.3] },
];

function setup(ctx: SceneContext): void {
  const { renderer, scene, params } = ctx;
  const room = buildRoom({ layout: SHAPES.rect(18, 10), seed: ctx.seed, northHeight: 1.5, dressing: 0.4 });
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

  const cx = (room.bounds.min.x + room.bounds.max.x) / 2;
  const cz = (room.bounds.min.z + room.bounds.max.z) / 2 + 0.5;
  const knights = POSES.map((p, i) => {
    const k = new BeetleKnight();
    k.position.set(cx + (i - (POSES.length - 1) / 2) * 2.4, cz - 1.6);
    k.facing = p.yaw;
    k.setCurl(p.curl);
    if (p.spin) k.ball.rotation.set(...p.spin);
    scene.add(k.group);
    renderer.addPointLight({ position: { x: 0, y: 2.2, z: 0.6 }, follow: k.group.children[0], color: '#FFE2B0', intensity: 0.55, radius: 3.2, flicker: 0.05, seed: i + 3 });
    return k;
  });
  const mobs = MOB_KINDS.map((kind, i) => {
    const m = new Mob(kind, { seed: i + 1 });
    m.position.set(cx + (i - 1.5) * 3.4, cz + 2.4);
    m.facing = -0.2;
    scene.add(m.group);
    for (const l of m.lights) renderer.addPointLight(l);
    return m;
  });
  if (params.get('cam') === 'iso') {
    STAND.correction = 0;
    isoCamera(renderer, new THREE.Vector3(cx, 0.6, cz), 40);
  } else {
    STAND.correction = 1;
    obliqueCamera(renderer, cx, cz);
    renderer.camera.zoom = Number(params.get('zoom') ?? 2);
    renderer.camera.updateProjectionMatrix();
  }
  room.setFires(knights.map(k => ({ x: k.position.x, y: 1.5, z: k.position.y, reach: 2.2 })));
  state = { room, knights, mobs };
}

function update(ctx: SceneContext, dt: number): void {
  if (!state) return;
  state.room.update(ctx.renderer.time, dt);
  for (const k of state.knights) k.update(dt, ctx.camera);
  for (const m of state.mobs) m.update(dt, ctx.camera);
}

export default defineScene({ name: 'cast', description: 'Beetle Knight turnaround + curl, in the crypt', setup, update });

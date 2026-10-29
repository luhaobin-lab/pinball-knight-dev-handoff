import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createToonMaterial, type ImpactKind, type PointLight } from '../../render/api';
import type { Rng } from '../../core/rng';
import { defineScene, type SceneContext } from '../types';

/**
 * Pipeline smoke test: a small crypt (tiled floor, masonry walls, pillars, an altar) lit by
 * 20 flickering candles and two bioluminescent mushroom clusters.
 * Options: ?pan=1 (camera pan, tests sub-pixel compensation), ?orbit=1, ?fx=demo (hit-feel hooks every 1.5 s).
 */

const RAMPS = {
  floor: ['#0a1215', '#16242a', '#2d3d3d', '#5e5c4e', '#ad936d'],
  grout: ['#040607', '#0a1012', '#151d1f'],
  wall: ['#091013', '#142126', '#2a393a', '#525549', '#958264'],
  pillar: ['#0a1215', '#18282b', '#334342', '#6a6858', '#bda37a'],
  wax: ['#4a302c', '#8a6654', '#cfab88', '#f1dcbb', '#fff6e2'],
  flame: ['#ff7a1f', '#ffd27a'],
  stem: ['#0f1819', '#26383a', '#557063', '#a0b89f'],
  cap: ['#04201e', '#0b4740', '#1a8a74', '#76f2d2'],
};

interface Flame {
  mesh: THREE.Mesh;
  phase: number;
}

interface HelloState {
  target: THREE.Vector3;
  flames: Flame[];
  glowLights: PointLight[];
  nextFx: number;
  fxIndex: number;
}

let state: HelloState | null = null;

/** Prepares a fresh geometry for merging: non-indexed, transformed, flat normals, constant vertex colour (linear multiplier). */
function piece(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, tint = new THREE.Color(1, 1, 1)): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.applyMatrix4(matrix);
  g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) tint.toArray(colors, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

const at = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

function mesh(parts: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh {
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('hello: geometry merge failed');
  return new THREE.Mesh(merged, material);
}

function stoneTint(rng: Rng, mossChance: number): THREE.Color {
  const shade = rng.range(0.8, 1.06);
  return rng.chance(mossChance) ? new THREE.Color(0.74 * shade, 0.96 * shade, 0.86 * shade) : new THREE.Color(shade, 0.97 * shade, 0.93 * shade);
}

function floor(rng: Rng): THREE.BufferGeometry[] {
  const tiles: THREE.BufferGeometry[] = [];
  for (let ix = -6; ix < 6; ix++) {
    for (let iz = -4; iz < 4; iz++) {
      const h = rng.range(0.1, 0.15);
      const box = new THREE.BoxGeometry(0.92 + rng.range(-0.04, 0.02), h, 0.92 + rng.range(-0.04, 0.02));
      tiles.push(piece(box, at(ix + 0.5 + rng.range(-0.02, 0.02), h / 2, iz + 0.5 + rng.range(-0.02, 0.02), rng.range(-0.03, 0.03)), stoneTint(rng, 0.2)));
    }
  }
  return tiles;
}

/** Staggered masonry along x (axis 'x', constant z) or along z (constant x). */
function wall(rng: Rng, axis: 'x' | 'z', fixed: number, from: number, to: number, rows: number): THREE.BufferGeometry[] {
  const blocks: THREE.BufferGeometry[] = [];
  const depth = 0.6;
  for (let row = 0; row < rows; row++) {
    let s = from;
    let first = true;
    while (s < to - 0.05) {
      const len = first && row % 2 === 1 ? 0.45 : rng.range(0.7, 1.3);
      const e = Math.min(s + len, to);
      const c = (s + e) / 2;
      const inset = rng.range(-0.04, 0.03);
      const box = new THREE.BoxGeometry(axis === 'x' ? e - s - 0.05 : depth, 0.46, axis === 'x' ? depth : e - s - 0.05);
      const y = row * 0.5 + 0.25;
      const m = axis === 'x' ? at(c, y, fixed + inset, rng.range(-0.02, 0.02)) : at(fixed + inset, y, c, rng.range(-0.02, 0.02));
      blocks.push(piece(box, m, stoneTint(rng, 0.12)));
      s = e;
      first = false;
    }
  }
  return blocks;
}

function pillar(rng: Rng, x: number, z: number, broken: boolean): THREE.BufferGeometry[] {
  const ry = rng.range(0, Math.PI);
  const shaft = broken ? rng.range(0.7, 1.1) : 2.1;
  const parts = [
    piece(new THREE.CylinderGeometry(0.44, 0.5, 0.24, 8), at(x, 0.12, z, ry), stoneTint(rng, 0.3)),
    piece(new THREE.CylinderGeometry(0.31, 0.34, shaft, 8), at(x, 0.24 + shaft / 2, z, ry), stoneTint(rng, 0.3)),
  ];
  if (broken) {
    parts.push(piece(new THREE.CylinderGeometry(0.2, 0.31, 0.22, 8), at(x, 0.32 + shaft, z, ry, rng.range(-0.25, 0.25), rng.range(-0.25, 0.25)), stoneTint(rng, 0.3)));
    parts.push(piece(new THREE.DodecahedronGeometry(0.16, 0), at(x + 0.55, 0.12, z + 0.25, ry), stoneTint(rng, 0.4)));
  } else {
    parts.push(piece(new THREE.CylinderGeometry(0.46, 0.33, 0.26, 8), at(x, 0.37 + shaft, z, ry), stoneTint(rng, 0.1)));
    parts.push(piece(new THREE.BoxGeometry(1.0, 0.16, 1.0), at(x, 0.58 + shaft, z, ry), stoneTint(rng, 0.1)));
  }
  return parts;
}

function setup(ctx: SceneContext): void {
  const { renderer, scene, camera, rng } = ctx;
  const L = renderer.lighting;
  L.ambientSky.set('#24414a');
  L.ambientGround.set('#0c1215');
  L.ambientIntensity = 0.35;
  L.keyDirection.set(-0.35, 1, 0.55);
  L.keyColor.set('#7fb0c8');
  L.keyIntensity = 0.16;
  L.tint = 0.55;
  L.background.set('#040607');

  const stone = (ramp: readonly string[]) => createToonMaterial({ ramp, vertexColors: true, dither: true });
  scene.add(mesh(floor(rng), stone(RAMPS.floor)));
  scene.add(mesh([piece(new THREE.BoxGeometry(12, 0.04, 8), at(0, 0.02, 0))], stone(RAMPS.grout)));
  scene.add(
    mesh(
      [
        ...wall(rng, 'x', -4.3, -6.6, 6.6, 4),
        ...wall(rng, 'z', -6.3, -4.6, 4.0, 4),
        ...wall(rng, 'x', 4.3, -6.6, 6.6, 1),
        ...wall(rng, 'z', 6.3, -4.0, 4.0, 1),
      ],
      stone(RAMPS.wall),
    ),
  );
  scene.add(
    mesh(
      [
        ...pillar(rng, -3.4, -1.7, false),
        ...pillar(rng, 3.4, -1.7, false),
        ...pillar(rng, -3.4, 1.9, true),
        ...pillar(rng, 3.4, 1.9, true),
        piece(new THREE.BoxGeometry(1.6, 0.5, 0.8), at(0, 0.25, -3.45), stoneTint(rng, 0)),
        piece(new THREE.BoxGeometry(1.8, 0.1, 0.95), at(0, 0.55, -3.45), stoneTint(rng, 0)),
      ],
      stone(RAMPS.pillar),
    ),
  );

  // Candles: [x, z, base height]. 5 on the altar, the rest in clusters on the floor.
  const spots: [number, number, number][] = [
    [-0.6, -3.4, 0.6], [-0.3, -3.55, 0.6], [0, -3.35, 0.6], [0.3, -3.55, 0.6], [0.6, -3.4, 0.6],
    [-4.3, -3.6, 0], [-4.0, -3.45, 0], [-4.15, -3.8, 0],
    [1.9, -3.6, 0], [2.15, -3.75, 0], [1.7, -3.8, 0],
    [-5.6, 0.4, 0], [-5.5, 0.75, 0], [-5.7, 1.05, 0],
    [-2.8, -1.3, 0], [4.0, -1.25, 0], [-2.85, 2.35, 0], [2.8, 2.4, 0],
    [0.9, 1.0, 0], [-1.2, 0.3, 0],
  ];
  const wax: THREE.BufferGeometry[] = [];
  const flameMaterial = createToonMaterial({ ramp: RAMPS.flame, unlit: true, outline: false, emissive: '#ffb347', emissiveIntensity: 2.6 });
  const flames: Flame[] = [];
  spots.forEach(([x, z, base], i) => {
    const h = rng.range(0.14, 0.42);
    const r = rng.range(0.045, 0.062);
    wax.push(piece(new THREE.CylinderGeometry(r, r * 1.1, h, 7), at(x, base + h / 2, z, rng.range(0, 1))));
    wax.push(piece(new THREE.CylinderGeometry(r * 2.2, r * 2.5, 0.02, 9), at(x + rng.range(-0.02, 0.02), base + 0.01, z)));
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), flameMaterial);
    flame.position.set(x, base + h + 0.07, z);
    flame.scale.set(0.045, 0.1, 0.045);
    scene.add(flame);
    flames.push({ mesh: flame, phase: rng.range(0, Math.PI * 2) });
    renderer.addPointLight({
      position: { x, y: base + h + 0.14, z },
      color: new THREE.Color('#ffa64d').offsetHSL(rng.range(-0.015, 0.015), 0, 0),
      intensity: rng.range(1.0, 1.3),
      radius: rng.range(2.1, 2.8),
      flicker: rng.range(0.22, 0.4),
      seed: i + 1,
    });
  });
  scene.add(mesh(wax, createToonMaterial({ ramp: RAMPS.wax, vertexColors: true, dither: 0.25 })));

  // Cold accents: glowing mushroom clusters.
  const stems: THREE.BufferGeometry[] = [];
  const caps: THREE.BufferGeometry[] = [];
  const glowLights: PointLight[] = [];
  for (const [cx, cz] of [[-5.3, -3.3], [5.3, 2.7]] as const) {
    for (let k = 0; k < 4; k++) {
      const x = cx + rng.range(-0.35, 0.35);
      const z = cz + rng.range(-0.3, 0.3);
      const h = rng.range(0.12, 0.34);
      const r = rng.range(0.08, 0.17);
      stems.push(piece(new THREE.CylinderGeometry(r * 0.25, r * 0.38, h, 6), at(x, h / 2, z)));
      caps.push(piece(new THREE.SphereGeometry(r, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), at(x, h - 0.01, z, 0, rng.range(-0.2, 0.2), rng.range(-0.2, 0.2))));
    }
    glowLights.push(renderer.addPointLight({ position: { x: cx, y: 0.5, z: cz }, color: '#2ff0c8', intensity: 0.85, radius: 1.9 }));
  }
  scene.add(mesh(stems, createToonMaterial({ ramp: RAMPS.stem, vertexColors: true })));
  scene.add(mesh(caps, createToonMaterial({ ramp: RAMPS.cap, vertexColors: true, emissive: '#16c9a4', emissiveIntensity: 0.55 })));

  // Fits the room: back wall tops to the front wall feet span about 10.5 units on screen at yaw 45°, pitch 34°.
  renderer.viewHeight = 11;
  const target = new THREE.Vector3(0, 0.86, -0.3);
  state = { target, flames, glowLights, nextFx: 1.5, fxIndex: 0 };
  placeCamera(camera, target, 45, 0);
}

function placeCamera(camera: THREE.OrthographicCamera, target: THREE.Vector3, yawDeg: number, panX: number): void {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(34);
  const d = 40;
  const tx = target.x + panX * Math.cos(yaw);
  const tz = target.z - panX * Math.sin(yaw);
  camera.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * d, target.y + Math.sin(pitch) * d, tz + Math.cos(yaw) * Math.cos(pitch) * d);
  camera.lookAt(tx, target.y, tz);
}

const IMPACTS: ImpactKind[] = ['invert', 'silhouette', 'white'];

function update(ctx: SceneContext, dt: number): void {
  if (!state) return;
  const t = ctx.renderer.time;
  for (const f of state.flames) {
    const k = 1 + Math.sin(t * 13 + f.phase) * 0.14 + Math.sin(t * 7.3 + f.phase * 2) * 0.09;
    f.mesh.scale.set(0.045 / Math.sqrt(k), 0.1 * k, 0.045 / Math.sqrt(k));
  }
  state.glowLights.forEach((light, i) => (light.intensity = 0.85 + 0.25 * Math.sin(t * 1.3 + i * 2.1)));

  const p = ctx.params;
  if (p.has('pan') || p.has('orbit')) {
    placeCamera(ctx.camera, state.target, 45 + (p.has('orbit') ? ctx.time * 12 : 0), p.has('pan') ? Math.sin(ctx.time * 0.5) * 1.5 : 0);
  }
  if (p.get('fx') === 'demo' && dt > 0 && ctx.time >= state.nextFx) {
    state.nextFx += 1.5;
    const flame = state.flames[state.fxIndex % state.flames.length].mesh.position;
    ctx.fx.shake(0.65, { x: 1, y: 0.4 });
    ctx.fx.hitstop(90);
    ctx.fx.chroma(0.8);
    ctx.fx.flash('#fff1c9', { intensity: 0.45, ms: 140 });
    ctx.fx.impactFrame(IMPACTS[state.fxIndex % IMPACTS.length], { focus: flame });
    state.fxIndex++;
  }
}

export default defineScene({
  name: 'hello',
  description: 'Lit crypt test room: floor, walls, pillars, altar, 20 flickering candles, glowing mushrooms.',
  setup,
  update,
});

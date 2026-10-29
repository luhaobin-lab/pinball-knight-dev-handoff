import * as THREE from 'three';
import { createRng, type Rng } from '../../core/rng';
import { boneRosette, boneScatter } from '../props/bones';
import { candleCluster, candleMound, type CandleClusterSpec, type MoundSpec } from '../props/candles';
import { cobwebs, type WebSpec } from '../props/cobwebs';
import { flowerBunch } from '../props/flowers';
import { lampPillar, mushroomCluster, type ClusterSpec } from '../props/mushrooms';
import { addRoots, rootSpecs, type ChainSpec, type VerletRoots } from '../props/roots';
import { urn } from '../props/urns';
import { buildFloor, moldField, type FloorSpec, type MoldPatch } from './floor';
import { makeGlyphs } from './glyphs';
import { corners, floorBounds, isFloor, wallDistance, wallRuns, type Rect, type RoomLayout } from './layout';
import { Kit, type RoomLight } from './kit';
import { createKitMaterials, createKitUniforms, MAX_FIRES, MAX_SIGILS, type KitUniforms, type SigilSpec } from './materials';
import { buildWalls, gargoyle, godLightDir, spire, type WallResult, type WallSpec, type WindowLight } from './walls';
import { exitCells, exitCurtain, type ExitSpec } from './exits';

/**
 * buildRoom: the room kit's entry point. From a floor-cell layout it builds the floor, the walls, the
 * windows and every piece of set dressing for the 菌冢 fungal necropolis, merged into one mesh per material,
 * and returns the lights to register and the window descriptors for the GI / atmos lanes.
 */

export interface KnotholeSpec {
  /** Centre of the light pool on the floor (tiles). */
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  /** Height of the coffin lid the knothole is cut in (default 6 t). */
  readonly height?: number;
  readonly intensity?: number;
}

export interface PillarSpec {
  readonly x: number;
  readonly z: number;
  /** Collision radius in tiles. */
  readonly radius: number;
  readonly height?: number;
}

export interface UrnSpec {
  readonly x: number;
  readonly z: number;
  readonly radius?: number;
}

export interface RoomSpec extends WallSpec, FloorSpec {
  readonly layout: RoomLayout;
  readonly seed?: number | string;
  readonly sigils?: readonly SigilSpec[];
  readonly knotholes?: readonly KnotholeSpec[];
  readonly pillars?: readonly PillarSpec[];
  readonly mounds?: readonly MoundSpec[];
  readonly candles?: readonly CandleClusterSpec[];
  readonly urns?: readonly UrnSpec[];
  readonly fungi?: readonly ClusterSpec[];
  readonly exits?: readonly ExitSpec[];
  /** Automatic set dressing density 0..1 (default 1): candles, fungi, bones, flowers, roots, webs. */
  readonly dressing?: number;
  /** Floor cells kept clear of automatic floor dressing (gameplay spots). */
  readonly clear?: readonly Rect[];
  /** Point-light budget for the room (default 30): nearby lights of a kind merge until it fits. */
  readonly maxLights?: number;
}

export interface RoomStats {
  readonly triangles: number;
  readonly meshes: number;
  readonly lights: number;
  readonly flames: number;
  readonly buildMs: number;
}

export interface BuiltRoom {
  readonly group: THREE.Group;
  readonly lights: readonly RoomLight[];
  readonly windows: readonly WindowLight[];
  readonly roots: VerletRoots | null;
  readonly uniforms: KitUniforms;
  readonly walls: WallResult;
  /** World AABB of everything built (walls, finials, props). */
  readonly bounds: THREE.Box3;
  readonly stats: RoomStats;
  /**
   * Sets the anti-light fire sources: the room's lit candles plus `extra` (丸子's flame, embers).
   * Mold, fungi, foxfire and sigil glow dim within each source's reach.
   */
  setFires(extra?: readonly FireSource[]): void;
  update(time: number, dt: number): void;
  dispose(): void;
}

export interface FireSource {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Reach of the fear field in tiles. */
  readonly reach: number;
}

/** Floor-mold patches when the spec gives none: 3–5 blobs, biased away from the room centre. */
function autoMold(layout: RoomLayout, rng: Rng): MoldPatch[] {
  const fb = floorBounds(layout);
  const out: MoldPatch[] = [];
  const n = rng.int(3, 5);
  for (let i = 0; i < n * 4 && out.length < n; i++) {
    const x = rng.range(fb.x0 + 1, fb.x1);
    const z = rng.range(fb.z0 + 1, fb.z1);
    if (!isFloor(layout, Math.floor(x), Math.floor(z))) continue;
    const k = Math.min(1, Math.sqrt((fb.x1 - fb.x0 + 1) * (fb.z1 - fb.z0 + 1)) / 18);
    out.push({ x, z, rx: rng.range(0.9, 2.0) * k, rz: rng.range(0.7, 1.5) * k });
  }
  return out;
}

function inRects(rects: readonly Rect[] | undefined, x: number, z: number): boolean {
  return !!rects?.some(r => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d);
}

/** Merges the closest same-kind lights until the room fits its light budget (art bible §9.2). */
export function fitLights(lights: RoomLight[], max: number): RoomLight[] {
  const out = lights.map(l => ({ ...l }));
  const pos = (l: RoomLight): THREE.Vector3 => new THREE.Vector3(l.position?.x ?? 0, l.position?.y ?? 0, l.position?.z ?? 0);
  while (out.length > max) {
    let best = -1;
    let bestJ = -1;
    let bestD = Infinity;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (out[i].kind !== out[j].kind) continue;
        const d = pos(out[i]).distanceTo(pos(out[j]));
        if (d < bestD) {
          bestD = d;
          best = i;
          bestJ = j;
        }
      }
    }
    if (best < 0) break;
    const a = out[best];
    const b = out[bestJ];
    const wa = a.intensity ?? 1;
    const wb = b.intensity ?? 1;
    const p = pos(a).multiplyScalar(wa).add(pos(b).multiplyScalar(wb)).divideScalar(wa + wb);
    out[best] = { ...a, position: { x: p.x, y: p.y, z: p.z }, intensity: Math.max(wa, wb) * 1.15, radius: Math.max(a.radius ?? 3, b.radius ?? 3) + bestD * 0.5 };
    out.splice(bestJ, 1);
  }
  return out;
}

export function buildRoom(spec: RoomSpec): BuiltRoom {
  const t0 = performance.now();
  const rng = createRng(spec.seed ?? 1);
  const layout = spec.layout;
  const uniforms = createKitUniforms(makeGlyphs(rng.derive('glyphs')));
  const mats = createKitMaterials(uniforms);
  const kit = new Kit(rng, mats);
  const dressing = spec.dressing ?? 1;
  const drng = rng.derive('dressing');

  const occluders = [...(spec.pillars ?? []), ...(spec.urns ?? []).map(u => ({ x: u.x, z: u.z, radius: u.radius ?? 0.45 })), ...(spec.mounds ?? [])];
  const mold = moldField(layout, spec.mold ?? autoMold(layout, rng.derive('mold-patches')), rng.derive('mold'), occluders);
  uniforms.uMold.value = mold.texture;
  uniforms.uMoldRect.value.set(mold.x0, mold.z0, 1 / mold.width, 1 / mold.depth);
  const sigils = (spec.sigils ?? []).slice(0, MAX_SIGILS);
  sigils.forEach((s, i) => uniforms.uSigils.value[i].set(s.x, s.z, s.radius, s.gills));
  uniforms.uSigilCount.value = sigils.length;

  buildFloor(kit, layout, spec, mold);
  const walls = buildWalls(kit, layout, { ...spec, openings: [...(spec.openings ?? []), ...(spec.exits ?? []).flatMap(exitCells)] });
  for (const e of spec.exits ?? []) exitCurtain(kit, e);

  for (const p of spec.pillars ?? []) lampPillar(kit, p.x, p.z, p.radius, p.height);
  for (const m of spec.mounds ?? []) candleMound(kit, m);
  for (const c of spec.candles ?? []) candleCluster(kit, c);
  for (const u of spec.urns ?? []) urn(kit, u.x, u.z, u.radius);
  for (const f of spec.fungi ?? []) mushroomCluster(kit, f);

  const windows: WindowLight[] = [...walls.windows];
  for (const k of spec.knotholes ?? []) {
    const h = k.height ?? 6;
    const dir = godLightDir(THREE.MathUtils.degToRad(80), THREE.MathUtils.degToRad(-15));
    windows.push({
      kind: 'roundel',
      centre: new THREE.Vector3(k.x + (dir.x / dir.y) * h, h, k.z + (dir.z / dir.y) * h),
      right: new THREE.Vector3(1, 0, 0),
      up: new THREE.Vector3(0, 0, -1),
      halfWidth: k.radius,
      halfHeight: k.radius,
      petals: 6,
      seed: rng.next(),
      lightDir: dir,
      intensity: k.intensity ?? 0.9,
    });
  }

  const roots = dressing > 0 ? dress(kit, layout, walls, spec, drng, dressing) : null;

  const group = new THREE.Group();
  group.name = 'room';
  const { triangles, meshes } = kit.finish(group);
  const lights = fitLights(kit.lights, spec.maxLights ?? 30);
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const updaters = kit.updaters;
  const roomFires: FireSource[] = lights
    .filter(l => l.fire)
    .map(l => ({ x: l.position?.x ?? 0, y: l.position?.y ?? 0, z: l.position?.z ?? 0, reach: (l.radius ?? 3) * 0.55 }));
  const setFires = (extra: readonly FireSource[] = []): void => {
    const all = [...extra, ...roomFires].slice(0, MAX_FIRES);
    all.forEach((f, i) => uniforms.uFire.value[i].set(f.x, f.y, f.z, f.reach));
    uniforms.uFireCount.value = all.length;
  };
  setFires();
  return {
    group,
    lights,
    windows,
    roots,
    uniforms,
    walls,
    bounds,
    stats: { triangles, meshes, lights: lights.length, flames: kit.flames.flames.length, buildMs: performance.now() - t0 },
    setFires,
    update(time, dt) {
      for (const u of updaters) u.update(time, dt);
    },
    dispose() {
      group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const m of mats.all()) m.dispose();
      mold.texture.dispose();
    },
  };
}

/** Seeded set dressing along the walls: candles, fungi, bones, flowers, roots and cobwebs. */
function dress(kit: Kit, layout: RoomLayout, walls: WallResult, spec: RoomSpec, rng: Rng, density: number): VerletRoots | null {
  const dist = wallDistance(layout);
  const W = layout.width;
  const nearWall = (x: number, z: number): number => dist[Math.floor(z) * W + Math.floor(x)];
  const clearAt = (x: number, z: number): boolean => !inRects(spec.clear, Math.floor(x), Math.floor(z));
  const runs = wallRuns(layout);
  const roots: ChainSpec[] = [];
  const webs: WebSpec[] = [];

  // North walls: wall-base Mycena, flower bunches between pilasters, roots over the coping, top candles.
  for (const bay of walls.bays) {
    const mid = (bay.x0 + bay.x1) / 2;
    const w = bay.x1 - bay.x0;
    if (rng.chance(0.8 * density)) {
      mushroomCluster(kit, { x: bay.x0 + rng.range(0.2, 0.5), z: bay.line + 0.12, count: rng.int(3, 6), species: 'mycena', scale: rng.range(0.8, 1.1), away: Math.PI / 2, light: rng.chance(0.6) });
    }
    if (!bay.window && w > 1.4 && rng.chance(0.55 * density) && clearAt(mid, bay.line + 0.2)) flowerBunch(kit, mid + rng.range(-0.4, 0.4), bay.line + 0.18, Math.PI / 2);
    if (rng.chance(0.6 * density)) {
      const rx = rng.range(bay.x0 + 0.3, bay.x1 - 0.3);
      if (!bay.window || Math.abs(rx - bay.window.x) > bay.window.w * 0.7) {
        roots.push(...rootSpecs(rng, rx, bay.height + 0.04, bay.line - 0.04, rng.range(0.55, 0.85) * bay.height, roots.length, bay.line - 0.12));
      }
    }
    if (rng.chance(0.35 * density)) {
      candleCluster(kit, { x: mid + rng.range(-0.5, 0.5), z: bay.line - 0.5, y: bay.height, count: rng.int(2, 4), radius: 0.22, maxHeight: 0.55, lit: 0.8, light: 0.85 });
    }
    if (rng.chance(0.4 * density)) boneScatter(kit, rng.range(bay.x0, bay.x1), bay.line - 0.55, bay.height + 0.01, 0.3, 3, 0.5);
  }

  // Floor corners: candle clusters in the north corners, fungi and bones in the others.
  for (const c of corners(layout)) {
    const fx = c.kind === 'outer' ? c.x + c.dx * 0.55 : c.x - c.dx * 0.45;
    const fz = c.kind === 'outer' ? c.z + c.dz * 0.5 : c.z - c.dz * 0.45;
    if (!isFloor(layout, Math.floor(fx), Math.floor(fz)) || !clearAt(fx, fz)) continue;
    if (c.kind === 'outer' && c.dz === 1) {
      if (rng.chance(0.85 * density)) candleCluster(kit, { x: fx, z: fz, count: rng.int(4, 7), radius: 0.32, lit: 0.6 });
      const apex = { x: c.x, y: (walls.pilasters.find(p => Math.abs(p.x - c.x) < 0.6)?.height ?? 2) * 0.9, z: c.z };
      if (rng.chance(0.9 * density)) webs.push({ apex, a: { x: c.dx * 1.0, y: -0.35, z: 0 }, b: { x: 0, y: -apex.y * 0.75, z: 0.95 } });
    } else if (rng.chance(0.75 * density)) {
      if (rng.chance(0.5)) mushroomCluster(kit, { x: fx, z: fz, count: rng.int(3, 6), species: rng.chance(0.6) ? 'violet' : 'mycena', scale: rng.range(1, 1.5), light: true });
      else boneScatter(kit, fx, fz, 0, 0.35, 4, 0.6);
    }
  }

  // Bug-gargoyles crouch on a few pilaster capitals (North Star NS-NORTH: four of them).
  const perch = walls.pilasters.filter(p => p.height < 2.6);
  for (let i = 0; i < Math.min(4, perch.length); i++) {
    const p = perch[Math.floor(((i + 0.5) * perch.length) / Math.min(4, perch.length))];
    gargoyle(kit, rng, p.x, p.height + 0.02, p.line - 0.24);
  }

  // Silhouettes above the north wall line: cap clusters, candle trios and bone spires on the pilasters.
  for (const p of walls.pilasters) {
    const r = rng.next();
    // spires stand on the back edge of the coping so they break the skyline above the wall band
    if (r < 0.55 * density) spire(kit, rng, p.x, p.height, p.line - 0.82, rng.range(1.0, 1.5) * (p.height > 2.5 ? 0.5 : 1));
    else if (r < 0.72 * density) mushroomCluster(kit, { x: p.x, z: p.line - 0.62, y: p.height, count: rng.int(2, 4), species: rng.chance(0.5) ? 'violet' : 'flesh', scale: rng.range(1.1, 1.6), light: false });
    else if (r < 0.9 * density) candleCluster(kit, { x: p.x, z: p.line - 0.45, y: p.height, count: 3, radius: 0.16, minHeight: 0.3, maxHeight: 0.75, lit: 1, light: 0.8 });
  }

  // A rhythm of small warm candle groups on the low walls, so the room edge reads as a lit perimeter.
  let last = -10;
  for (const t of walls.tops) {
    if (t.kind === 'north' || t.y > 1) continue;
    const key = t.x * 0.37 + t.z * 1.13;
    if (Math.abs(key - last) < 1.5 || !rng.chance(0.2 * density)) continue;
    last = key;
    candleCluster(kit, { x: t.x, z: t.z, y: t.y, count: rng.int(2, 3), radius: 0.18, minHeight: 0.2, maxHeight: 0.5, lit: 0.9, light: 0.75 });
  }

  // South and side walls: bones, skull rosettes and small fungi on the low tops and against the bases.
  for (const t of walls.tops) {
    if (t.kind === 'north') continue;
    const r = rng.next();
    if (r < 0.12 * density) boneScatter(kit, t.x + rng.range(-0.2, 0.2), t.z, t.y, 0.25, 2, 0.4);
    else if (r < 0.2 * density) mushroomCluster(kit, { x: t.x + rng.range(-0.25, 0.25), z: t.z, y: t.y, count: rng.int(2, 4), species: rng.chance(0.7) ? 'mycena' : 'violet', scale: 0.8, light: false });
    else if (r < 0.23 * density) boneRosette(kit, t.x, t.z, t.y, 0.32);
  }
  for (const run of runs) {
    if (run.facing === 'north') continue;
    for (let s = run.from + 0.5; s < run.to; s += rng.range(1.8, 3.4)) {
      const inward = run.facing === 'south' ? [0, -0.3] : run.facing === 'west' ? [0.3, 0] : [-0.3, 0];
      const x = run.facing === 'south' ? s : run.line + inward[0];
      const z = run.facing === 'south' ? run.line + inward[1] : s;
      if (!isFloor(layout, Math.floor(x), Math.floor(z)) || nearWall(x, z) > 1 || !clearAt(x, z)) continue;
      if (rng.chance(0.35 * density)) boneScatter(kit, x, z, 0, 0.22, 2, 0.15);
      else if (rng.chance(0.3 * density)) mushroomCluster(kit, { x, z, count: rng.int(2, 4), species: 'mycena', scale: 0.7, light: false });
    }
  }

  cobwebs(kit, webs);
  return addRoots(kit, roots);
}

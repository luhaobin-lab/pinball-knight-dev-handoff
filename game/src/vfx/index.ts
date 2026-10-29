import * as THREE from 'three';
import { createRng } from '../core/rng';
import type { PixelRenderer } from '../render/api';
import { Dust } from './dust';
import { Sparks } from './spark';
import { Spores } from './spores';
import { Ribbon, RibbonMesh, trailMaterial } from './trail';
import { Whirlwind, type WhirlTarget } from './whirlwind';

export { SpawnPerUnit, dustFrame } from './dust';
export { trailBright, trailVisible } from './trail';
export { sparkFrame } from './spark';
export { cloudDrift, cloudScale, dropDistance, stainCover, STAIN_LIFE } from './spores';
export { whirlDepth, whirlPose, WHIRL_POSES, type WhirlTarget } from './whirlwind';
export { DUST, SPARK, SPLAT, SPORES, STAIN, TRAIL, WHIRLWIND } from './demo';

/**
 * The launch effects of the Demo (src/vfx/README.md): the trail ribbon, the dust puffs, the hit spark, the spores
 * (the reskinned blood) with their floor stains, the death splat and the knight's whirlwind slash, drawn as crisp
 * pixel art in the G-buffer at the internal resolution. Coordinates are floor tiles (x east, z south); normals point
 * from the enemy toward the hero. Every effect runs on the game clock that `update(gameDt)` advances (so the
 * hit-stop slows it) and on a seeded RNG, so ?t= stills and clips reproduce.
 *
 * Per frame: `update(gameDt)` first, then the frame's events; the GPU lists are built when the frame renders.
 */

/** A ribbon from trailBegin. */
export interface TrailHandle {
  readonly id: number;
}

export interface VfxOptions {
  readonly seed: number;
}

export interface Vfx {
  /** Starts a ribbon (粒子_轨迹 at launch start). */
  trailBegin(): TrailHandle;
  /** The mover is at (x, z) now: the head follows, and a point is laid every 8 uu. Pass the contact point on a bounce frame. */
  trailPoint(h: TrailHandle, x: number, z: number): void;
  /** Lays no more points (Deactivate at the rest); the ribbon fades out by its points' ages. */
  trailEnd(h: TrailHandle): void;
  /** One dust puff for a mover whose floor point is (x, z); call it every 100 uu travelled (SpawnPerUnit). */
  dust(x: number, z: number): void;
  /** 粒子_Hit_01 at the hit point. */
  hitSpark(x: number, z: number, nx: number, nz: number): void;
  /** 粒子_Blood_01 reskinned: spores and ichor at the hit point, along the normal (enemy → hero). */
  spores(x: number, z: number, nx: number, nz: number): void;
  /** 粒子_Blood_02 reskinned, at a corpse's floor point (fire it at the Die animation's 0.5 s). */
  deathSplat(x: number, z: number): void;
  /** 回旋斩 around whatever `follow` returns every frame (the hero's floor point). `mirror` flips it like 更新朝向. */
  whirlwind(follow: () => WhirlTarget, options?: { mirror?: boolean }): void;
  /** Advances the effects' game clock (the hit-stop's dilated dt). */
  update(gameDt: number): void;
  /** The effects' game clock (s). */
  readonly time: number;
  dispose(): void;
}

let instances = 0;

export function createVfx(renderer: PixelRenderer, options: VfxOptions): Vfx {
  const rng = createRng(options.seed);
  const root = new THREE.Group();
  root.name = 'vfx';
  root.matrixAutoUpdate = false;
  renderer.scene.add(root);
  const size: THREE.IUniform<THREE.Vector2> = { value: new THREE.Vector2(renderer.internal.width, renderer.internal.height) };
  const clock: THREE.IUniform<number> = { value: 0 };

  const dust = new Dust(rng.derive('dust'), size);
  const sparks = new Sparks(rng.derive('spark'), size);
  const spores = new Spores(rng.derive('spores'), size);
  const whirl = new Whirlwind(size);
  root.add(spores.batch.mesh, dust.batch.mesh, sparks.batch.mesh, whirl.batch.mesh);

  const trailMat = trailMaterial(clock);
  const ribbons = new Map<number, { ribbon: Ribbon; mesh: RibbonMesh }>();
  let nextId = 1;
  const passName = `vfx-build-${++instances}`;

  const build = (width: number, height: number): void => {
    const now = clock.value;
    size.value.set(width, height);
    for (const [id, r] of ribbons) {
      r.ribbon.expire(now);
      if (!r.ribbon.alive(now)) {
        root.remove(r.mesh.mesh);
        r.mesh.dispose();
        ribbons.delete(id);
        continue;
      }
      r.mesh.update(r.ribbon.vertices());
    }
    dust.update(now);
    sparks.update(now);
    spores.update(now);
    whirl.update(now);
  };
  // the GPU lists are rebuilt right before the scene pass draws, from the clock and the spawns of this frame
  const removePass = renderer.addPass('gbuffer', { name: passName, order: -10, render: ctx => build(ctx.width, ctx.height) });

  const ribbon = (h: TrailHandle): Ribbon | undefined => ribbons.get(h.id)?.ribbon;

  return {
    trailBegin() {
      const id = nextId++;
      const mesh = new RibbonMesh(trailMat);
      root.add(mesh.mesh);
      ribbons.set(id, { ribbon: new Ribbon(), mesh });
      return { id };
    },
    trailPoint(h, x, z) {
      ribbon(h)?.add(x, z, clock.value);
    },
    trailEnd(h) {
      ribbon(h)?.end();
    },
    dust(x, z) {
      dust.spawn(x, z, clock.value);
    },
    hitSpark(x, z) {
      sparks.spawn(x, z, clock.value);
    },
    spores(x, z, nx, nz) {
      spores.hit(x, z, nx, nz, clock.value);
    },
    deathSplat(x, z) {
      spores.splat(x, z, clock.value);
    },
    whirlwind(follow, o) {
      whirl.play(follow, clock.value, o?.mirror ?? false);
    },
    update(gameDt) {
      if (gameDt > 0) clock.value += gameDt;
    },
    get time() {
      return clock.value;
    },
    dispose() {
      removePass();
      renderer.scene.remove(root);
      for (const r of ribbons.values()) r.mesh.dispose();
      ribbons.clear();
      trailMat.dispose();
      for (const b of [dust.batch, sparks.batch, spores.batch, whirl.batch]) b.dispose();
    },
  };
}

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { PixelRenderer, RenderPass } from '../../src/render/api';
import { createVfx, SpawnPerUnit, SPORES, STAIN, STAIN_LIFE, TRAIL, type Vfx } from '../../src/vfx';
import { Ribbon } from '../../src/vfx/trail';
import { Spores } from '../../src/vfx/spores';
import { createRng } from '../../src/core/rng';

const UU = 64;

/** Just enough of the renderer for the effects: a scene, the internal size and the pass registry. */
function stubRenderer(): { renderer: PixelRenderer; passes: RenderPass[]; build(): void } {
  const passes: RenderPass[] = [];
  const scene = new THREE.Scene();
  const renderer = {
    scene,
    internal: { width: 960, height: 540, scale: 2, outputWidth: 1920, outputHeight: 1080 },
    addPass(_stage: string, pass: RenderPass) {
      passes.push(pass);
      return () => passes.splice(passes.indexOf(pass), 1);
    },
  } as unknown as PixelRenderer;
  const build = (): void => {
    for (const p of passes) p.render({ width: 960, height: 540 } as never);
  };
  return { renderer, passes, build };
}

/** Every instance and vertex the effects would draw, as plain numbers. */
function snapshot(renderer: PixelRenderer): number[][] {
  const out: number[][] = [];
  renderer.scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry as THREE.InstancedBufferGeometry;
    if (g.isInstancedBufferGeometry) {
      const n = g.instanceCount;
      for (const name of ['aAnchor', 'aBox', 'aA', 'aB']) out.push([n, ...Array.from((g.getAttribute(name).array as Float32Array).subarray(0, n * 4))]);
    } else {
      const count = g.drawRange.count;
      out.push([count, ...Array.from((g.getAttribute('position').array as Float32Array).subarray(0, 120))]);
    }
  });
  return out;
}

/** One scripted launch: a trail along two legs, dust, a hit with every effect, then the rest. */
function script(v: Vfx, steps: number[]): void {
  const h = v.trailBegin();
  const z = 5;
  let x = 5;
  v.trailPoint(h, x, z);
  let t = 0;
  for (const dt of steps) {
    v.update(dt);
    const before = t;
    t += dt;
    // the mover crosses the room at 3 tiles/s for 1 s
    x = 5 + 3 * Math.min(1, t);
    if (t < 1) v.trailPoint(h, x, z);
    else v.trailEnd(h);
    if (before < 0.3 - 1e-9 && t >= 0.3 - 1e-9) {
      v.hitSpark(x + 0.5, z, -1, 0);
      v.spores(x + 0.5, z, -1, 0);
      v.whirlwind(() => ({ x, z }));
      v.dust(x, z);
    }
    if (before < 0.8 - 1e-9 && t >= 0.8 - 1e-9) v.deathSplat(x + 1, z);
  }
}

describe('the trail ribbon', () => {
  it('lays a point every 8 uu along each step, with interpolated times, and keeps its head on the mover', () => {
    const r = new Ribbon();
    r.add(0, 0, 0);
    r.add(40 / UU, 0, 0.1);
    expect(r.points.map(p => Math.round(p.u))).toEqual([0, 8, 16, 24, 32, 40]);
    expect(r.points[2].t).toBeCloseTo(0.04, 12);
    expect(r.points[2].x).toBeCloseTo(16 / UU, 12);
    const head = r.head()!;
    expect(head.x).toBeCloseTo(40 / UU, 12);
    expect(head.t).toBe(0.1);
    r.add(44 / UU, 0, 0.11);
    expect(r.vertices().at(-1)!.u).toBeCloseTo(44, 9);
  });

  it('keeps a corner it is given', () => {
    const r = new Ribbon();
    r.add(0, 0, 0);
    r.add(1, 0, 0.1);
    r.add(1, 1, 0.2);
    const corner = r.vertices().find(p => Math.abs(p.x - 1) < 1e-9 && Math.abs(p.z) < 1e-9);
    expect(corner).toBeDefined();
  });

  it('stops laying points when ended and fades out by its points’ ages', () => {
    const r = new Ribbon();
    r.add(0, 0, 0);
    r.add(1, 0, 0.2);
    r.end();
    const n = r.points.length;
    r.add(2, 0, 0.3);
    expect(r.points.length).toBe(n);
    expect(r.head()).toBeNull();
    expect(r.alive(0.2 + TRAIL.lifeS - 0.01)).toBe(true);
    expect(r.alive(0.2 + TRAIL.lifeS)).toBe(false);
    r.expire(0.1 + TRAIL.lifeS);
    // the points laid up to 0.1 s are dead; only the last of them stays, for the band to fade into
    expect(r.points[0].t).toBeCloseTo(0.1, 12);
    expect(r.points[1].t).toBeGreaterThan(0.1);
  });
});

describe('SpawnPerUnit', () => {
  it('asks for one puff per 100 uu, all at the frame’s position', () => {
    const s = new SpawnPerUnit();
    expect(s.step(0, 0)).toBe(0);
    expect(s.step(60 / UU, 0)).toBe(0);
    expect(s.step(120 / UU, 0)).toBe(1);
    expect(s.step(450 / UU, 0)).toBe(3);
    s.reset();
    expect(s.step(0, 0)).toBe(0);
  });
});

describe('spores and stains', () => {
  it('shoot 10 droplets (4 at once, then 20 /s for 0.3 s) and vanish together at 0.54 s', () => {
    const s = new Spores(createRng(3), { value: new THREE.Vector2(960, 540) });
    s.hit(0, 0, 0, -1, 0);
    const emits = (s as unknown as { hits: { drops: { emit: number }[] }[] }).hits[0].drops.map(d => d.emit);
    expect(emits.length).toBe(SPORES.dropBurst + 6);
    expect(emits.map(e => Math.round(e * 100))).toEqual([0, 0, 0, 0, 0, 5, 10, 15, 20, 25]);
    s.update(SPORES.endS - 0.001);
    expect(s.counts.hits).toBe(1);
    s.update(SPORES.endS);
    expect(s.counts.hits).toBe(0);
  });

  it('leaves a stain for half of the droplets, 2 × U(0.9, 1.3) their size, for 14.01 s', () => {
    let stains = 0;
    let drops = 0;
    const width = STAIN.scale * SPORES.dropUu[0] * 0.375;
    for (let seed = 1; seed <= 200; seed++) {
      const s = new Spores(createRng(seed), { value: new THREE.Vector2(960, 540) });
      s.hit(0, 0, 1, 0, 0);
      s.update(1);
      drops += SPORES.dropBurst + 6;
      stains += s.counts.stains;
      for (const st of s.stainList) {
        expect(st.w).toBeGreaterThanOrEqual(width * STAIN.jitter[0] - 1e-9);
        expect(st.w).toBeLessThanOrEqual(width * STAIN.jitter[1] + 1e-9);
      }
      if (seed === 1) {
        const t0 = Math.min(...s.stainList.map(x => x.t));
        s.update(t0 + STAIN_LIFE - 0.01);
        expect(s.counts.stains).toBeGreaterThan(0);
        s.update(10_000);
        expect(s.counts.stains).toBe(0);
      }
    }
    expect(stains / drops).toBeGreaterThan(0.44);
    expect(stains / drops).toBeLessThan(0.56);
  });
});

describe('createVfx', () => {
  it('adds its meshes and a build pass, and removes both on dispose', () => {
    const { renderer, passes } = stubRenderer();
    const v = createVfx(renderer, { seed: 1 });
    expect(passes.length).toBe(1);
    expect(renderer.scene.getObjectByName('vfx')).toBeDefined();
    v.dispose();
    expect(passes.length).toBe(0);
    expect(renderer.scene.getObjectByName('vfx')).toBeUndefined();
  });

  it('reproduces the same pixels from the same seed and calls', () => {
    const runs = [1, 1, 2].map(seed => {
      const { renderer, build } = stubRenderer();
      const v = createVfx(renderer, { seed });
      script(v, Array.from({ length: 30 }, () => 1 / 60));
      build();
      return snapshot(renderer);
    });
    expect(runs[0]).toEqual(runs[1]);
    expect(runs[0]).not.toEqual(runs[2]);
  });

  it('draws the same at a time whatever the steps that led to it', () => {
    const at = (steps: number[]): number[][] => {
      const { renderer, build } = stubRenderer();
      const v = createVfx(renderer, { seed: 5 });
      script(v, steps);
      build();
      return snapshot(renderer);
    };
    // both cross the hit at 0.3 s and the splat at 0.8 s in their own step, and end at 0.9 s
    const fine = at([...Array.from({ length: 6 }, () => 0.05), ...Array.from({ length: 6 }, () => 0.1)]);
    const coarse = at([0.15, 0.15, 0.25, 0.25, 0.1]);
    // trail points differ (they sample the mover per step); the sprites only depend on the clock and the spawns
    const sprites = (s: number[][]): number[][] => s.filter(a => a.length > 1 && a.length !== 121);
    expect(sprites(fine)).toEqual(sprites(coarse));
  });

  it('keeps time on the game clock it is given', () => {
    const { renderer } = stubRenderer();
    const v = createVfx(renderer, { seed: 1 });
    v.update(0.25);
    v.update(-1);
    v.update(0.05);
    expect(v.time).toBeCloseTo(0.3, 12);
  });
});

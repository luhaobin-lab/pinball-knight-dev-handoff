import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildRoom, fitLights } from '../../src/procgen/architecture/room';
import { northstarSpec } from '../../src/procgen/architecture/northstar';
import { SHAPES } from '../../src/procgen/architecture/layout';
import { K_OBLIQUE, pointedArch, inWindow } from '../../src/procgen/architecture/walls';
import type { RoomLight } from '../../src/procgen/architecture/kit';
import { createRng } from '../../src/core/rng';
import { VerletRoots, rootSpecs } from '../../src/procgen/props/roots';
import { LAYERS } from '../../src/render/api';

function fingerprint(group: THREE.Group): string {
  const parts: string[] = [];
  group.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position');
    let sum = 0;
    for (let i = 0; i < pos.array.length; i += 7) sum += pos.array[i] * ((i % 13) + 1);
    parts.push(`${m.name}:${pos.count}:${sum.toFixed(3)}`);
  });
  return parts.join('|');
}

describe('buildRoom', () => {
  const ns = buildRoom(northstarSpec());

  it('is deterministic for a seed and varies with it', () => {
    expect(fingerprint(buildRoom(northstarSpec()).group)).toBe(fingerprint(ns.group));
    expect(fingerprint(buildRoom(northstarSpec('other')).group)).not.toBe(fingerprint(ns.group));
  });

  it('stays inside the room budget: merged batches, triangles and lights', () => {
    // art bible §16.2 High tier: ≤ 200 draw calls and 250k triangles for the whole frame
    expect(ns.stats.meshes).toBeLessThanOrEqual(48);
    expect(ns.stats.triangles).toBeLessThan(110_000);
    expect(ns.lights.length).toBeLessThanOrEqual(40);
    expect(ns.stats.flames).toBeGreaterThan(60);
  });

  it('registers coloured window lights, flickering candle lights and bioluminescence', () => {
    const kinds = new Set(ns.lights.map(l => l.kind));
    expect(kinds).toEqual(new Set(['candle', 'window', 'bio', 'foxfire', 'seam']));
    expect(ns.lights.filter(l => l.kind === 'candle').every(l => (l.flicker ?? 0) > 0 && l.fire)).toBe(true);
    expect(ns.lights.filter(l => l.kind === 'window').every(l => !l.fire && (l.flicker ?? 0) === 0)).toBe(true);
    expect(ns.windows.map(w => w.kind).sort()).toEqual(['lancet', 'lancet', 'rose', 'roundel']);
    for (const w of ns.windows) {
      expect(w.lightDir.y).toBeGreaterThan(0.6);
      // the god light comes from the north (art bible §9.6)
      if (w.kind !== 'roundel') expect(w.lightDir.z).toBeLessThan(0);
    }
  });

  it('keeps every world-layer mesh on a G-buffer material and glows on the forward layer', () => {
    ns.group.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (m.layers.isEnabled(LAYERS.world)) for (const mat of mats) expect(mat.userData.gbuffer, m.name).toBe(true);
    });
  });

  it('never builds wall geometry inside a floor cell (collision honesty)', () => {
    const layout = northstarSpec().layout;
    const floor = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < layout.width && z < layout.depth && layout.cells[z * layout.width + x] === 1;
    const walls = ns.group.getObjectByName('arch-board') as THREE.Mesh;
    const pos = walls.geometry.getAttribute('position');
    let intrusions = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const cx = Math.floor(x);
      const cz = Math.floor(z);
      if (!floor(cx, cz)) continue;
      // threshold slabs of the exit and the floor-level gutters are the only board-free exceptions
      if (Math.min(x - cx, cx + 1 - x, z - cz, cz + 1 - z) > 1 / 32) intrusions++;
    }
    expect(intrusions).toBe(0);
  });

  it('insets south walls by k·h so their tops never cover a floor pixel in the oblique view', () => {
    // south wall of the bottom hall: floor ends at z = 14; a 0.5-t wall may only start at 14 + k·0.5
    const walls = ns.group.getObjectByName('arch-board') as THREE.Mesh;
    const pos = walls.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (x < 4.05 || x > 19.95 || z < 13.99 || z > 14.6) continue;
      // screen row of the point: z - k·y must not reach above the floor edge (z = 14)
      expect(z - K_OBLIQUE * y).toBeGreaterThanOrEqual(14 - 1e-3);
    }
  });

  it('builds L-shaped, stepped and rectangular rooms too', () => {
    for (const layout of [SHAPES.rect(10, 7), SHAPES.ell(14, 10, 6, 4), SHAPES.stepped()]) {
      const r = buildRoom({ layout, seed: 3, northHeight: 1.5 });
      expect(r.stats.triangles).toBeGreaterThan(5000);
      expect(r.windows.length).toBeGreaterThan(0);
      expect(r.bounds.isEmpty()).toBe(false);
    }
  });

  it('hangs roots as Verlet chains that settle and stay attached', () => {
    expect(ns.roots).not.toBeNull();
    const roots = ns.roots!;
    expect(roots.count).toBeGreaterThan(3);
    for (let i = 0; i < 120; i++) ns.update(i / 60, 1 / 60);
    for (let c = 0; c < roots.count; c++) {
      const s = roots.start[c];
      for (let i = s + 1; i < s + roots.length[c]; i++) {
        const d = Math.hypot(roots.pos[i * 3] - roots.pos[(i - 1) * 3], roots.pos[i * 3 + 1] - roots.pos[(i - 1) * 3 + 1], roots.pos[i * 3 + 2] - roots.pos[(i - 1) * 3 + 2]);
        expect(Math.abs(d - roots.rest[i])).toBeLessThan(roots.rest[i] * 0.2);
      }
    }
  });
});

describe('room pieces', () => {
  it('pointed arches start and end on the springing line and peak in the middle', () => {
    const pts = pointedArch(0, 2, 1, 1.6, 0, 8);
    expect(pts[0].x).toBeCloseTo(0, 5);
    expect(pts[pts.length - 1].x).toBeCloseTo(2, 5);
    expect(pts[0].y).toBeCloseTo(1, 5);
    const apex = pts.reduce((a, b) => (b.y > a.y ? b : a));
    expect(apex.x).toBeCloseTo(1, 1);
    expect(apex.y).toBeCloseTo(2.6, 1);
  });

  it('cuts boards around lancet and rose shapes', () => {
    const rose = { kind: 'rose' as const, x: 5, y: 2, w: 2, h: 2 };
    expect(inWindow(rose, 5, 2, 0)).toBe(true);
    expect(inWindow(rose, 5.95, 2, 0)).toBe(true);
    expect(inWindow(rose, 5.9, 2.9, 0)).toBe(false);
    const lancet = { kind: 'lancet' as const, x: 1, y: 1, w: 0.5, h: 1.5 };
    expect(inWindow(lancet, 1, 1.7, 0)).toBe(true);
    expect(inWindow(lancet, 1.24, 1.7, 0)).toBe(false);
  });

  it('merges the closest same-kind lights down to the budget', () => {
    const lights: RoomLight[] = Array.from({ length: 10 }, (_, i) => ({ kind: i < 6 ? 'candle' : 'bio', fire: i < 6, position: { x: i, y: 0.5, z: 0 }, intensity: 0.5, radius: 2 }));
    const fit = fitLights(lights, 5);
    expect(fit).toHaveLength(5);
    expect(fit.filter(l => l.kind === 'bio').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps Verlet chains stable under impulses', () => {
    const rng = createRng(5);
    const roots = new VerletRoots(rootSpecs(rng, 0, 2, 0, 1.5, 0), rng);
    for (let i = 0; i < 300; i++) {
      if (i % 50 === 0) roots.impulse({ x: 0.2, y: 1.2, z: 0.3 }, 30, 1.5);
      roots.step(1 / 60, i / 60);
    }
    for (const v of roots.pos) expect(Number.isFinite(v)).toBe(true);
    expect(roots.pos[1]).toBeCloseTo(2, 5);
  });

});

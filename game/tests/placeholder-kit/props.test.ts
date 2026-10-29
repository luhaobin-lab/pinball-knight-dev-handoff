import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { placeholderProp, PROP_FOR_ROW, PROP_KINDS, PROP_NAMES } from '../../src/procgen/placeholder/props';
import { FIRE_LIGHT } from '../../src/procgen/placeholder/palette';
import { 数据表_玩家, 数据表_道具_通用 } from '../../src/content/demo/index.ts';

beforeAll(() => {
  const ctx2d = { createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {}, fillStyle: '' };
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
});

/** Every mesh's material is a toon G-buffer material (no stray MeshBasic on the world layer). */
function toonOnly(o: THREE.Object3D): boolean {
  let ok = true;
  o.traverse(c => {
    if (c instanceof THREE.Mesh) ok &&= (c.material as THREE.Material).userData.gbuffer === true;
  });
  return ok;
}

describe('placeholder props', () => {
  it('builds every kind with toon materials, a footprint and its lights following the piece', () => {
    expect(PROP_KINDS.length).toBeGreaterThanOrEqual(20);
    for (const kind of PROP_KINDS) {
      const p = placeholderProp(kind);
      // Currency's source Box is only 8 uu across its half extent.
      if (kind === 'soul-shard') expect(p.radius).toBe(8 / 64);
      else expect(p.radius, kind).toBeGreaterThan(0.3);
      expect(toonOnly(p.group), kind).toBe(true);
      for (const l of p.lights) expect(l.follow, kind).toBe(p.body);
    }
  });

  it('stands upright pieces like the cast and lays floor pieces flat', () => {
    for (const kind of ['spikes', 'vortex', 'bounce-pad', 'campfire'] as const) expect(placeholderProp(kind).stands, kind).toBe(false);
    for (const kind of ['chest', 'statue', 'shop', 'portal', 'altar'] as const) expect(placeholderProp(kind).stands, kind).toBe(true);
    const shop = placeholderProp('shop');
    shop.place(4, 6);
    expect(shop.body.matrixAutoUpdate).toBe(false);
    expect(shop.body.matrix.elements[12]).toBeCloseTo(4, 9);
    expect(shop.body.matrix.elements[14]).toBeCloseTo(6, 9);
  });

  it('maps the interactable rows of 数据表_道具_通用 and the NPC rows of 数据表_玩家 to set pieces', () => {
    for (const row of Object.keys(PROP_FOR_ROW)) expect(row in 数据表_道具_通用.rows || row in 数据表_玩家.rows, row).toBe(true);
    expect(PROP_FOR_ROW.任务祭坛).toBe('altar');
    expect(PROP_FOR_ROW.商人).toBe('shop');
  });

  it('keeps fire light small and amber: radius ≤ 2.5 tiles, intensity ≤ 0.6, #FF9A3C', () => {
    let fires = 0;
    for (const kind of PROP_KINDS) {
      for (const l of placeholderProp(kind).lights) {
        if (l.color !== FIRE_LIGHT.color) continue;
        fires++;
        expect(l.intensity ?? 1, kind).toBeLessThanOrEqual(0.6 + 1e-9);
        expect(l.radius ?? 0, kind).toBeLessThanOrEqual(2.5 + 1e-9);
      }
    }
    expect(FIRE_LIGHT.color).toBe('#FF9A3C');
    expect(fires).toBeGreaterThanOrEqual(4);
  });

  it('draws the spikes as a 3 × 3 bed of iron cones on a dark plate, the portal as a dark disc in a teal rim', () => {
    const names = (kind: (typeof PROP_KINDS)[number]): string[] => {
      const out: string[] = [];
      placeholderProp(kind).group.traverse(o => out.push(o.name));
      return out;
    };
    const spikes = names('spikes');
    expect(spikes.filter(n => n === 'cone:iron')).toHaveLength(9);
    expect(spikes).toContain('box:soot');
    const portal = names('portal');
    expect(portal).toContain('disc:soot');
    expect(portal).toContain('torus:teal');
    expect(portal).not.toContain('disc:teal');
  });

  it('raises every floor piece at least 0.16 tiles, enough depth for the outline pass', () => {
    for (const kind of PROP_KINDS) {
      const p = placeholderProp(kind);
      p.group.updateMatrixWorld(true);
      const top = new THREE.Box3().setFromObject(p.body).max.y;
      expect(top, kind).toBeGreaterThanOrEqual(0.16);
    }
  });

  it('names every set piece in Chinese', () => {
    for (const kind of PROP_KINDS) expect(PROP_NAMES[kind], kind).toMatch(/^[一-鿿]+$/);
  });

  it('is deterministic per kind and seed', () => {
    const shape = (kind: (typeof PROP_KINDS)[number], seed: number): string => {
      const out: string[] = [];
      placeholderProp(kind, { seed }).group.traverse(o => out.push(`${o.name}:${o.position.toArray().map(v => v.toFixed(4))}`));
      return out.join('|');
    };
    for (const kind of PROP_KINDS) expect(shape(kind, 3), kind).toBe(shape(kind, 3));
  });
});

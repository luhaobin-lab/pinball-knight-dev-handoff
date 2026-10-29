import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createActorView } from '../../src/game/views/actors';
import { isSharedSculptGeometry } from '../../src/procgen/placeholder/sculpt';
import type { PixelRenderer } from '../../src/render/api';

describe('owned procedural prop resources', () => {
  it('releases private buffers/materials but keeps solid buffers shared by another live rock', () => {
    const renderer = { addPointLight: vi.fn(), removeLight: vi.fn() } as unknown as PixelRenderer;
    const actor = { id: -1, kind: 'terrain' as const, row: '石墙', radius: 32, height: 100, elite: false };
    const a = createActorView(actor, renderer), b = createActorView({ ...actor, id: -2 }, renderer);
    const meshes = (g: THREE.Object3D) => { const out: THREE.Mesh[] = []; g.traverse(o => { if (o instanceof THREE.Mesh) out.push(o); }); return out; };
    const ma = meshes(a.group), mb = meshes(b.group);
    const shared = [...new Set(ma.map(m => m.geometry).filter(isSharedSculptGeometry))];
    expect(shared.length).toBeGreaterThan(0);
    for (const geometry of shared) expect(mb.some(m => m.geometry === geometry)).toBe(true);
    const sharedSpies = shared.map(g => vi.spyOn(g, 'dispose'));
    const privateGeometry = ma.find(m => !isSharedSculptGeometry(m.geometry))!.geometry;
    const privateSpy = vi.spyOn(privateGeometry, 'dispose');
    const material = Array.isArray(ma[0]!.material) ? ma[0]!.material[0]! : ma[0]!.material;
    const materialSpy = vi.spyOn(material, 'dispose');
    a.dispose();
    sharedSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    expect(privateSpy).toHaveBeenCalledOnce();
    expect(materialSpy).toHaveBeenCalledOnce();
    expect(b.group.children.length).toBeGreaterThan(0);
    b.dispose();
    sharedSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  });
});

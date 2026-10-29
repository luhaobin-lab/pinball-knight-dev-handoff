import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { advanceLaunchClock } from '../../src/game/hit-stop';
import { ENEMY, GLOW, MARK, NEUTRAL } from '../../src/procgen/placeholder/palette';
import { GLYPHS, SOLIDS } from '../../src/procgen/placeholder/sculpt';
import { ENEMY_ROWS, FAMILIES, figureSpec, KNIGHT_HEIGHT } from '../../src/procgen/placeholder/spec';
import { placeholderBoss, placeholderEnemy, type MobLike, type PlaceholderMob } from '../../src/procgen/placeholder';
import { Mob } from '../../src/procgen/creatures/mobs';
import { DEATH_SECONDS, SPLAT_AT } from '../../src/anim/reactions';

// glowCard draws its gradient on a canvas the first time a figure is built; nothing read here depends on it
beforeAll(() => {
  const ctx2d = { createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {}, fillStyle: '' };
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
});

const STEP = 1 / 60;
const find = (mob: PlaceholderMob, name: string): THREE.Object3D | undefined => mob.group.getObjectByName(name);

/**
 * The figure's parts in its own upright frame (tiles, the floor at y 0): what the stand() lean toward the camera
 * leaves out, so heights read as the figure's own.
 */
function upright(mob: PlaceholderMob, keep: (m: PlaceholderMob['sculptor']['meshes'][number]) => boolean = () => true): THREE.Box3 {
  mob.group.updateMatrixWorld(true);
  const toBody = new THREE.Matrix4().copy(mob.body.matrixWorld).invert();
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const m of mob.sculptor.meshes) {
    if (!keep(m) || !m.mesh.visible) continue;
    const pos = m.mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.mesh.matrixWorld).applyMatrix4(toBody));
  }
  return box;
}
const height = (mob: PlaceholderMob): number => upright(mob, m => m.kind !== 'cone').getSize(new THREE.Vector3()).y;

/** A fingerprint of a figure's parts: kinds, looks and rounded local positions. */
function fingerprint(mob: PlaceholderMob): string {
  return mob.sculptor.meshes.map(({ mesh, look, kind }) => `${kind}:${look}:${mesh.position.toArray().map(v => v.toFixed(4)).join(',')}`).join('|');
}

describe('placeholder figures', () => {
  it('builds every row from the kit vocabulary only', () => {
    const allowed = new Set<string>([...SOLIDS, ...GLYPHS]);
    for (const row of ENEMY_ROWS) {
      const mob = placeholderEnemy(row);
      expect(mob.sculptor.meshes.length, row).toBeGreaterThan(3);
      for (const m of mob.sculptor.meshes) expect(allowed.has(m.kind), `${row} ${m.kind}`).toBe(true);
    }
  });

  it('keeps the three groups apart: enemies in blood, bone and black; set pieces in the neutral ramps', () => {
    const enemyLooks = new Set([...Object.keys(ENEMY), ...Object.keys(MARK), ...Object.keys(GLOW)]);
    const neutralLooks = new Set([...Object.keys(NEUTRAL), ...Object.keys(MARK), 'teal']);
    for (const row of ENEMY_ROWS) {
      const mob = placeholderEnemy(row);
      const ok = FAMILIES[mob.spec.family].group === 'enemy' ? enemyLooks : neutralLooks;
      for (const m of mob.sculptor.meshes) expect(ok.has(m.look), `${row} uses ${m.look}`).toBe(true);
    }
  });

  it('is deterministic: the same row builds the same figure', () => {
    for (const row of ENEMY_ROWS) expect(fingerprint(placeholderEnemy(row)), row).toBe(fingerprint(placeholderEnemy(row)));
  });

  it('gives every enemy the face formula: burning embers and a grin; elites the horns, bosses the crown', () => {
    for (const row of ENEMY_ROWS) {
      const mob = placeholderEnemy(row);
      const spec = mob.spec;
      if (FAMILIES[spec.family].group !== 'enemy') continue;
      expect(mob.sculptor.meshes.some(m => m.look === 'ember' || m.look === 'iris'), row).toBe(true);
      expect(find(mob, 'mouth'), row).toBeDefined();
      expect(!!find(mob, 'elite-horns'), `${row} horns`).toBe(spec.elite && spec.tier !== 'boss');
      expect(!!find(mob, 'boss-crown'), `${row} crown`).toBe(spec.tier === 'boss');
    }
    expect(find(placeholderEnemy('眼球', { elite: true }), 'elite-horns')).toBeDefined();
  });

  it('makes bosses much bigger than the small fry, and every figure stand on its own footprint', () => {
    const tops = ENEMY_ROWS.map(r => ({ r, mob: placeholderEnemy(r) }));
    const normal = Math.max(...tops.filter(t => t.mob.spec.tier === 'normal').map(t => t.mob.top));
    const boss = Math.min(...tops.filter(t => t.mob.spec.tier === 'boss').map(t => t.mob.top));
    expect(boss).toBeGreaterThan(2 * KNIGHT_HEIGHT);
    expect(boss).toBeGreaterThan(1.8 * normal);
    for (const { r, mob } of tops) {
      expect(mob.radius, r).toBeCloseTo(figureSpec(r).radius, 9);
      expect(mob.top, r).toBeGreaterThan(mob.radius);
    }
  });

  it('draws every normal row at least as tall as the knight (ART_BIBLE rule 5), its collision radius still 宽度 / 64', () => {
    for (const r of ENEMY_ROWS) {
      const spec = figureSpec(r);
      if (spec.tier !== 'normal') continue;
      expect(spec.height * spec.visualScale, r).toBeGreaterThanOrEqual(KNIGHT_HEIGHT - 1e-9);
      expect(placeholderEnemy(r).radius, r).toBeCloseTo(spec.radius, 9);
      // the Demo's own relative sizes stay available for the producer's ruling
      expect(figureSpec(r, { sizes: 'demo' }).visualScale, r).toBe(1);
    }
    expect(figureSpec('眼球').visualScale).toBeCloseTo(KNIGHT_HEIGHT / figureSpec('眼球').height, 9);
    expect(figureSpec('守门人').visualScale).toBe(1);
  });

  it('can stand wherever the game holds a Mob (the same members, typed)', () => {
    const cast: MobLike[] = [new Mob('jelly'), placeholderEnemy('结晶')];
    for (const m of cast) {
      m.position.set(3, 4);
      m.target.set(3, 8);
      m.update(STEP);
    }
    expect(cast[1].radius).toBeCloseTo(54 / 64, 9);
  });

  it('refuses a non-boss row as a boss', () => {
    expect(() => placeholderBoss('眼球')).toThrow();
    expect(placeholderBoss('幽焰龙').spec.tier).toBe('boss');
  });

  it('recoils 48 uu away from the hero like the small fry (可控反弹动画)', () => {
    const mob = placeholderEnemy('大肠');
    mob.position.set(5, 5);
    mob.update(STEP);
    mob.hitReact(0.6, -0.8, 2000);
    let game = 0;
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      const next = advanceLaunchClock(game, STEP, [0]);
      mob.update(next - game);
      game = next;
      const e = mob.body.matrix.elements;
      peak = Math.max(peak, Math.hypot(e[12] - 5, e[14] - 5) * 64);
    }
    expect(peak).toBeGreaterThan(47.5);
    expect(peak).toBeLessThan(48.5);
  });

  it('blinks white on a hit, unless attacking', () => {
    const mob = placeholderEnemy('结晶');
    mob.update(STEP);
    const paint = (): THREE.ShaderMaterial => (mob.sculptor.meshes.find(m => m.look === 'black')!.mesh.material as THREE.ShaderMaterial);
    let white = false;
    mob.flash();
    for (let i = 0; i < 18; i++) {
      mob.update(STEP);
      white ||= paint().uniforms.uTint.value.r === 0;
    }
    expect(white).toBe(true);
    const busy = placeholderEnemy('结晶');
    busy.attacking = true;
    busy.flash();
    busy.update(STEP);
    expect((busy.sculptor.meshes.find(m => m.look === 'black')!.mesh.material as THREE.ShaderMaterial).uniforms.uTint.value.r).toBe(1);
  });

  it('dies in the Demo’s second: the splat once at 0.5 s, the embers out with it, the corpse at 2.1 s', () => {
    const mob = placeholderEnemy('水母脑');
    let splats = 0;
    let at = -1;
    let t = 0;
    mob.die({ onSplat: () => ((splats += 1), (at = t)) });
    const embers = mob.sculptor.meshes.filter(m => m.look === 'ember').map(m => m.mesh);
    for (let i = 0; i < 150; i++) {
      t += STEP;
      mob.update(STEP);
      if (t > SPLAT_AT + 0.01 && t < SPLAT_AT + 0.05) for (const e of embers) expect(e.visible).toBe(false);
    }
    expect(splats).toBe(1);
    expect(at).toBeCloseTo(SPLAT_AT, 6);
    expect(mob.corpse).toBe(true);
    expect(t).toBeGreaterThan(DEATH_SECONDS);
  });

  it('settles into a flat, darkened stain: the grin shut and its fangs hidden from the splat, the light marks dark', () => {
    const mob = placeholderEnemy('大肠');
    mob.update(STEP);
    const rest = height(mob);
    const teeth = find(mob, 'teeth')!;
    const mouth = find(mob, 'mouth')!;
    let t = 0;
    mob.die();
    for (let i = 0; i < 150; i++) {
      t += STEP;
      mob.update(STEP);
      if (t > SPLAT_AT + 0.01 && t < SPLAT_AT + 0.05) {
        expect(teeth.visible).toBe(false);
        expect(mouth.scale.y).toBeLessThan(0.3);
      }
    }
    expect(height(mob)).toBeLessThan(rest * 0.2);
    const tooth = mob.sculptor.meshes.find(m => m.look === 'tooth')!.mesh.material as THREE.ShaderMaterial;
    // #FFFFFF tinted to the bone ramp's dark step (#8B755F, linear ≈ 0.26 / 0.18 / 0.12)
    expect(tooth.uniforms.uTint.value.r).toBeLessThan(0.35);
    expect(tooth.uniforms.uTint.value.b).toBeLessThan(0.2);
  });

  it('hovers the 水母脑 with its tendrils ending about a fifth of a tile above the floor', () => {
    const mob = placeholderEnemy('水母脑');
    mob.update(STEP);
    const low = upright(mob, m => m.kind === 'capsule').min.y;
    expect(low).toBeGreaterThan(0.08);
    expect(low).toBeLessThan(0.35);
  });

  it('carries one red light that pools at its feet and goes out with the death; set pieces carry none', () => {
    const mob = placeholderEnemy('眼球');
    expect(mob.lights).toHaveLength(1);
    expect(mob.lights[0].follow).toBe(mob.body);
    expect(placeholderEnemy('宝箱').lights).toHaveLength(0);
  });
});

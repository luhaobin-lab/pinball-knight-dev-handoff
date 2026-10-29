import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { advanceLaunchClock } from '../../src/game/hit-stop';
import { BeetleKnight, CURL_SECONDS, POP_SECONDS } from '../../src/procgen/creatures/beetle-knight';
import { Mob, MOB_KINDS } from '../../src/procgen/creatures/mobs';
import type { PointLight } from '../../src/render/api';

// glowCard draws its gradient on a canvas the first time a mob is built; nothing read here depends on it
beforeAll(() => {
  const ctx2d = { createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {}, fillStyle: '' };
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
});

const STEP = 1 / 60;

/** The body's visual offset from its floor point, in uu. */
function offsetUu(body: THREE.Object3D, at: THREE.Vector2): { x: number; z: number } {
  const e = body.matrix.elements;
  return { x: (e[12] - at.x) * 64, z: (e[14] - at.y) * 64 };
}

/** Steps a mob at 60 fps under the hit-stop of a contact at game time 0 (the contact frame shows age 0). */
function hitTimeline(mob: Mob, frames: number, onFrame: (real: number, game: number) => void): void {
  let game = 0;
  for (let i = 1; i <= frames; i++) {
    const next = advanceLaunchClock(game, STEP, [0]);
    mob.update(next - game);
    game = next;
    onFrame(i * STEP, game);
  }
}

describe('Mob reactions', () => {
  it('recoils away from the hero along the contact normal, 48 uu × the track, under the hit-stop', () => {
    const mob = new Mob('jelly');
    mob.position.set(5, 5);
    mob.update(STEP);
    const n = new THREE.Vector2(0.6, -0.8);
    mob.hitReact(n.x, n.y, 2000);
    // the contact frame already shows the track's first value, 0.3 × 48 uu
    let o = offsetUu(mob.body, mob.position);
    expect(Math.hypot(o.x, o.z)).toBeCloseTo(14.4, 6);
    expect(o.x / Math.hypot(o.x, o.z)).toBeCloseTo(-0.6, 6);
    const seen: { real: number; uu: number }[] = [];
    hitTimeline(mob, 60, real => {
      o = offsetUu(mob.body, mob.position);
      seen.push({ real, uu: -(o.x * n.x + o.z * n.y) });
    });
    const peak = seen.reduce((a, b) => (b.uu > a.uu ? b : a));
    expect(peak.uu).toBeGreaterThan(47.5);
    // the 0.2× / 1.5× dilation puts the peak 0.13–0.16 s real after the contact (rec-02: f181–f183)
    expect(peak.real).toBeGreaterThan(0.12);
    expect(peak.real).toBeLessThan(0.17);
    // back through zero, a 9.6-uu swing toward the hero, settled by 0.56 game s
    expect(Math.min(...seen.map(s => s.uu))).toBeCloseTo(-9.6, 0);
    expect(Math.abs(seen[seen.length - 1].uu)).toBeLessThan(0.05);
  });

  it('recoils the same 48 uu whatever the kind or size: the Demo’s mass factor is always 1', () => {
    for (const kind of MOB_KINDS) {
      for (const scale of [1, 1.6]) {
        const mob = new Mob(kind, { scale });
        mob.position.set(4, 4);
        mob.update(STEP);
        mob.hitReact(0, 1, 2000);
        mob.update(0.07);
        const o = offsetUu(mob.body, mob.position);
        expect(o.z).toBeCloseTo(-48, 6);
        expect(o.x).toBeCloseTo(0, 6);
      }
    }
  });

  it('keeps the contact frame when a frame split ends a rounding error before the contact', () => {
    // thirty 1/60-s frames end at 0.49999999999999994: the update after a contact at 0.5 gets dt ≈ −5.6e-17
    let frameEnd = 0;
    for (let i = 0; i < 30; i++) frameEnd += STEP;
    const mob = new Mob('jelly');
    const knight = new BeetleKnight();
    mob.position.set(5, 5);
    knight.position.set(5, 6.6);
    mob.update(0.5);
    knight.update(0.5);
    mob.hitReact(0, -1, 2000);
    knight.recoil(0, -1);
    mob.update(frameEnd - 0.5);
    knight.update(frameEnd - 0.5);
    expect(offsetUu(mob.body, mob.position).z).toBeCloseTo(14.4, 6);
    expect(offsetUu(knight.body, knight.position).z).toBeCloseTo(-14.4, 6);
  });

  it('squashes on the visual scale only, feet on the floor, and restarts on each contact', () => {
    const mob = new Mob('acolyte');
    mob.update(STEP);
    const squash = mob.body.children[0];
    mob.hitReact(1, 0, 2000);
    let game = 0;
    while (game < 2351 / 24000 - 1e-9) {
      const step = Math.min(STEP, 2351 / 24000 - game);
      mob.update(step);
      game += step;
    }
    expect(squash.scale.x).toBeCloseTo(0.9, 6);
    expect(squash.scale.y).toBeCloseTo(1.2, 6);
    expect(squash.scale.z).toBeCloseTo(0.9, 6);
    expect(squash.position.y).toBe(0);
    mob.update(0.2);
    mob.hitReact(1, 0, 2000);
    expect(squash.scale.x).toBe(1);
    expect(squash.scale.y).toBe(1);
  });

  it('blinks flat white for 0.3 s on the material clock, and not while attacking', () => {
    const mob = new Mob('skull');
    mob.update(0.5);
    const paint = (mob.body.getObjectByProperty('type', 'Mesh') as THREE.Mesh).material as THREE.ShaderMaterial;
    const white = (): boolean => paint.uniforms.uTint.value.r === 0;
    mob.flash();
    const pattern: boolean[] = [white()];
    for (let i = 0; i < 24; i++) {
      mob.update(STEP);
      pattern.push(white());
    }
    // clock 0.5 → 0.8: on to 0.625, off to 0.75, on to the end of the 0.3 s
    expect(pattern.slice(0, 7).every(Boolean)).toBe(true);
    expect(pattern.slice(9, 14).some(Boolean)).toBe(false);
    expect(pattern[16]).toBe(true);
    expect(pattern[19]).toBe(false);
    mob.attacking = true;
    mob.update(0.25);
    mob.flash();
    expect(white()).toBe(false);
  });

  it('dies in 1 s with one splat at 0.5 s, then darkens into a corpse that stays', () => {
    for (const kind of MOB_KINDS) {
      const mob = new Mob(kind, { seed: 3 });
      const light = { intensity: 0.8 } as PointLight;
      mob.bindLights([light]);
      mob.update(STEP);
      let splats = 0;
      let splatAt = -1;
      let t = 0;
      mob.die({ onSplat: () => ((splats += 1), (splatAt = t)) });
      while (t < 2.5) {
        t += STEP;
        mob.update(STEP);
        if (t < 2.1 - 1e-9) expect(mob.corpse).toBe(false);
      }
      expect(splats).toBe(1);
      expect(splatAt).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect(splatAt).toBeLessThan(0.5 + STEP + 1e-9);
      expect(mob.corpse).toBe(true);
      expect(light.intensity).toBe(0);
      expect(mob.group.visible && mob.body.visible).toBe(true);
    }
  });
});

describe('BeetleKnight launch states', () => {
  it('curls into the ball within 0.1 s and pops back within 0.3 s, interruptibly', () => {
    const k = new BeetleKnight();
    // read through a function: the calls below change the mode behind the compiler's narrowing
    const mode = (): string => k.mode;
    k.update(STEP);
    k.launchStart();
    let t = 0;
    while (mode() !== 'ball') {
      k.update(STEP);
      t += STEP;
    }
    expect(t).toBeLessThanOrEqual(CURL_SECONDS + 1e-9);
    expect(k.ball.visible).toBe(true);
    k.launchEnd();
    t = 0;
    while (mode() !== 'knight') {
      k.update(STEP);
      t += STEP;
    }
    expect(t).toBeLessThanOrEqual(POP_SECONDS + STEP);
    k.launchEnd();
    k.launchStart();
    for (let i = 0; i < 9; i++) k.update(STEP);
    k.launchEnd();
    k.update(STEP * 4);
    k.launchStart();
    expect(mode()).toBe('curling');
  });


  it('whirls a quarter turn per 10-fps step of the slash and flares', () => {
    const k = new BeetleKnight();
    k.update(STEP);
    const yaw = (): number => {
      const e = k.body.matrix.elements;
      return Math.atan2(e[8], e[10]);
    };
    const lift = (): number => k.mats.pearl.uniforms.uLift.value;
    const rest = lift();
    k.slash();
    const steps: number[] = [];
    for (let i = 0; i < 30; i++) {
      k.update(STEP);
      const y = Math.round((yaw() / (Math.PI / 2)) * 1000) / 1000;
      if (steps[steps.length - 1] !== y) steps.push(y);
    }
    expect(steps.length).toBe(4);
    expect(lift()).toBe(rest);
  });

  it('recoils 48 uu off a surviving enemy and settles', () => {
    const k = new BeetleKnight();
    k.position.set(3, 3);
    k.update(STEP);
    k.recoil(0, 1);
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      k.update(STEP);
      peak = Math.max(peak, offsetUu(k.body, k.position).z);
    }
    expect(peak).toBeGreaterThan(47.5);
    expect(peak).toBeLessThanOrEqual(48 + 1e-9);
    expect(Math.abs(offsetUu(k.body, k.position).z)).toBeLessThan(1e-9);
  });

  it('rolls at most 30° per 60-fps frame however fast it moves', () => {
    const k = new BeetleKnight();
    k.launchStart();
    k.update(0.2);
    for (const tilesPerFrame of [0.2, 0.7, 1.1]) {
      const before = k.ball.quaternion.clone();
      k.roll(tilesPerFrame, 0);
      k.update(STEP);
      const turned = (before.angleTo(k.ball.quaternion) * 180) / Math.PI;
      expect(turned).toBeCloseTo(Math.min(30, ((tilesPerFrame / 0.76) * 180) / Math.PI), 4);
    }
  });
});

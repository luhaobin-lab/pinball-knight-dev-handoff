import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { blueNoiseRanks } from '../../src/render/bluenoise';
import { snapCamera, type SnapResult } from '../../src/render/camera';
import { Fx } from '../../src/render/fx';
import { flickerValue, LightStore } from '../../src/render/lights';
import { rampColor, registerRamp } from '../../src/render/ramps';

// Baseline tests for the pure parts of the render internals (no WebGL needed).

describe('blue noise', () => {
  const size = 32;
  const ranks = blueNoiseRanks(size);

  it('is a deterministic permutation of every rank', () => {
    expect(blueNoiseRanks(size)).toEqual(ranks);
    const sorted = Array.from(ranks, v => Math.round(v * size * size)).sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: size * size }, (_, i) => i));
  });

  it('spreads the lowest ranks out (no clumps, unlike white noise)', () => {
    const points: [number, number][] = [];
    ranks.forEach((v, i) => {
      if (v < 0.1) points.push([i % size, Math.floor(i / size)]);
    });
    let closest = Infinity;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = Math.min(Math.abs(points[i][0] - points[j][0]), size - Math.abs(points[i][0] - points[j][0]));
        const dy = Math.min(Math.abs(points[i][1] - points[j][1]), size - Math.abs(points[i][1] - points[j][1]));
        closest = Math.min(closest, Math.hypot(dx, dy));
      }
    }
    expect(closest).toBeGreaterThanOrEqual(2);
  });
});

describe('ramp atlas', () => {
  const params = { dither: 0.35, curve: 0.8, overbright: 0.35 };

  it('registers each distinct ramp once and stores linear colours', () => {
    const id = registerRamp(['#808080', '#ffffff'], params);
    expect(id).toBeGreaterThan(0);
    expect(registerRamp(['#808080', '#ffffff'], params)).toBe(id);
    expect(registerRamp(['#808080', '#ffffff'], { ...params, dither: 0 })).not.toBe(id);
    expect(rampColor(id, 0).r).toBeCloseTo(0.2158, 3);
    expect(rampColor(id, 1).g).toBeCloseTo(1, 5);
    expect(rampColor(id, 5).b).toBeCloseTo(1, 5); // the last colour repeats to the end of the row
  });

  it('rejects ramps with fewer than 2 or more than 6 colours', () => {
    expect(() => registerRamp(['#000000'], params)).toThrow();
    expect(() => registerRamp(Array.from({ length: 7 }, () => '#000000'), params)).toThrow();
  });
});

describe('camera snapping', () => {
  const unit = 10 / 360;

  const setup = () => {
    const camera = new THREE.OrthographicCamera();
    camera.position.set(12.3456, 20.123, 17.89);
    camera.lookAt(0.1, 0.2, 0.3);
    camera.updateMatrixWorld();
    return camera;
  };

  it('puts the camera on the internal pixel grid and reports the remainder', () => {
    const camera = setup();
    const before = camera.position.clone();
    const out: SnapResult = { originX: 0, originY: 0, fracX: 0, fracY: 0 };
    snapCamera(camera, 640, 360, 10, true, out);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    expect(camera.position.dot(right) / unit).toBeCloseTo(out.originX, 6);
    expect(camera.position.dot(up) / unit).toBeCloseTo(out.originY, 6);
    expect(Math.abs(out.fracX)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(out.fracY)).toBeLessThanOrEqual(0.5);
    const restored = camera.position.clone().addScaledVector(right, out.fracX * unit).addScaledVector(up, out.fracY * unit);
    expect(restored.distanceTo(before)).toBeLessThan(1e-9);
    expect(camera.top - camera.bottom).toBeCloseTo(10, 9);
    expect(camera.right - camera.left).toBeCloseTo((10 * 640) / 360, 9);
  });

  it('moves the origin by whole pixels when the camera moves by whole pixels', () => {
    const a = setup();
    const b = setup();
    const right = new THREE.Vector3().setFromMatrixColumn(b.matrixWorld, 0);
    b.position.addScaledVector(right, 7 * unit);
    const outA: SnapResult = { originX: 0, originY: 0, fracX: 0, fracY: 0 };
    const outB: SnapResult = { ...outA };
    snapCamera(a, 640, 360, 10, true, outA);
    snapCamera(b, 640, 360, 10, true, outB);
    expect(outB.originX - outA.originX).toBe(7);
    expect(outB.fracX).toBeCloseTo(outA.fracX, 6);
  });
});

describe('light store', () => {
  const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100);
  camera.position.set(0, 20, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  it('culls lights outside the view and keeps the strongest within budget', () => {
    const store = new LightStore(2);
    store.add({ position: { x: 0, y: 0, z: 0 }, intensity: 1, radius: 2 });
    const strong = store.add({ position: { x: 1, y: 0, z: 1 }, intensity: 3, radius: 3, color: '#ff0000' });
    store.add({ position: { x: 2, y: 0, z: 0 }, intensity: 2, radius: 2 });
    store.add({ position: { x: 60, y: 0, z: 0 }, intensity: 9, radius: 2 });
    store.update(0, camera);
    expect(store.count).toBe(2);
    expect(store.positions[0].toArray()).toEqual([1, 0, 1, 3]);
    expect(store.colors[0].x).toBeCloseTo(3, 6);
    store.remove(strong);
    store.update(0, camera);
    expect(store.total).toBe(3);
    expect(store.count).toBe(2);
  });

  it('follows objects and flickers deterministically', () => {
    const store = new LightStore(4);
    const holder = new THREE.Object3D();
    holder.position.set(1, 2, 3);
    holder.updateMatrixWorld();
    store.add({ follow: holder, position: { x: 0, y: 0.5, z: 0 }, flicker: 0.4, seed: 9 });
    store.update(1.25, camera);
    expect(store.positions[0].x).toBeCloseTo(1, 9);
    expect(store.positions[0].y).toBeCloseTo(2.5, 9);
    expect(flickerValue(1.25, 9, 0.4)).toBe(flickerValue(1.25, 9, 0.4));
    for (let t = 0; t < 10; t += 0.01) {
      const f = flickerValue(t, 9, 0.4);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1.5);
    }
  });
});

describe('fx hooks', () => {
  const project = () => ({ x: 10, y: 20 });

  it('freezes game time during hitstop only', () => {
    const fx = new Fx();
    fx.hitstop(100);
    expect(fx.timeScale).toBe(0);
    fx.update(0.05, 0.05, 640, 360, project);
    expect(fx.timeScale).toBe(0);
    fx.update(0.06, 0.11, 640, 360, project);
    expect(fx.timeScale).toBe(1);
  });

  it('shakes with trauma squared, deterministically, and decays to rest', () => {
    const a = new Fx();
    const b = new Fx();
    a.shake(0.8, { x: 1, y: 0 });
    b.shake(0.8, { x: 1, y: 0 });
    a.update(1 / 60, 3.2, 640, 360, project);
    b.update(1 / 60, 3.2, 640, 360, project);
    expect(a.state.shakeX).toBe(b.state.shakeX);
    expect(Math.hypot(a.state.shakeX, a.state.shakeY)).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) a.update(1 / 60, 3.2 + i / 60, 640, 360, project);
    expect(a.state.trauma).toBe(0);
    expect(a.state.shakeX).toBe(0);
    a.settings.shake = 0;
    a.shake(1);
    a.update(1 / 60, 9, 640, 360, project);
    expect(a.state.shakeX).toBe(0);
  });

  it('shows impact frames for the requested frame count at the projected focus', () => {
    const fx = new Fx();
    fx.impactFrame('invert', { frames: 2, focus: { x: 0, y: 0, z: 0 } });
    fx.update(1 / 60, 0, 640, 360, project);
    expect(fx.state.impact).toBe('invert');
    expect([fx.state.impactX, fx.state.impactY]).toEqual([10, 20]);
    fx.endFrame();
    expect(fx.state.impact).toBe('invert');
    fx.endFrame();
    expect(fx.state.impact).toBeNull();
  });

  it('fades flashes and chroma pulses out', () => {
    const fx = new Fx();
    fx.flash('#ffffff', { intensity: 0.6, ms: 100 });
    fx.chroma(1);
    fx.update(0.01, 0.01, 640, 360, project);
    expect(fx.state.flashAmount).toBeGreaterThan(0.4);
    expect(fx.state.chroma).toBeGreaterThan(0.8);
    fx.update(0.2, 0.21, 640, 360, project);
    expect(fx.state.flashAmount).toBe(0);
    expect(fx.state.chroma).toBeLessThan(0.2);
  });
});

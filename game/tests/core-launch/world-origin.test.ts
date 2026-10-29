import { describe, expect, it } from 'vitest';
import { computeLaunchPreview, createLaunchWorld, STARTER_HERO, sweepProbe } from '../../src/core/launch/index.ts';

describe('FloorGrid world origin', () => {
  const cells = new Uint8Array(10 * 8).fill(1);
  const probe = { radius: 16, halfHeight: 16, z: 16 };

  it('omitting origin preserves the complete legacy preview', () => {
    const grid = { width: 10, depth: 8, cells };
    const legacy = createLaunchWorld({ grid });
    const explicit = createLaunchWorld({ grid: { ...grid, origin: { x: 0, y: 0 } } });
    const options = { hero: { ...STARTER_HERO, launchDistance: 1200 } };
    expect(computeLaunchPreview(explicit, { x: 160, y: 192 }, { x: 1, y: 0 }, options))
      .toEqual(computeLaunchPreview(legacy, { x: 160, y: 192 }, { x: 1, y: 0 }, options));
  });

  it('translates all four wall contacts without changing radius, time, normal or penetration', () => {
    const origin = { x: -320, y: -256 };
    const plain = createLaunchWorld({ grid: { width: 10, depth: 8, cells } });
    const moved = createLaunchWorld({ grid: { width: 10, depth: 8, cells, origin } });
    const from = { x: 320, y: 256 };
    for (const to of [{ x: -100, y: 256 }, { x: 740, y: 256 }, { x: 320, y: -100 }, { x: 320, y: 612 }]) {
      const a = sweepProbe(plain, from, to, probe, new Set())!;
      const b = sweepProbe(moved, { x: from.x + origin.x, y: from.y + origin.y }, { x: to.x + origin.x, y: to.y + origin.y }, probe, new Set())!;
      expect(a).not.toBeNull(); expect(b).not.toBeNull();
      expect(b.time).toBeCloseTo(a.time, 12);
      expect(b.normal).toEqual(a.normal);
      expect(b.startPenetrating).toBe(a.startPenetrating);
      expect(b.location).toEqual({ x: a.location.x + origin.x, y: a.location.y + origin.y });
      expect(b.impactPoint).toEqual({ x: a.impactPoint.x + origin.x, y: a.impactPoint.y + origin.y });
    }
  });

  it('offsets blocked interior cells as well as outer walls and keeps previews translation-equivalent', () => {
    const floor = cells.slice(); floor[4 * 10 + 5] = 0;
    const offset = { x: -320, y: -256 };
    const plain = createLaunchWorld({ grid: { width: 10, depth: 8, cells: floor } });
    const moved = createLaunchWorld({ grid: { width: 10, depth: 8, cells: floor, origin: offset } });
    const options = { hero: { ...STARTER_HERO, launchDistance: 600, maxBounces: 0 } };
    const a = computeLaunchPreview(plain, { x: 160, y: 288 }, { x: 1, y: 0 }, options);
    const b = computeLaunchPreview(moved, { x: -160, y: 32 }, { x: 1, y: 0 }, options);
    expect(a.legs[0]!.marker).toBe('wall');
    expect(b.legs).toHaveLength(a.legs.length);
    a.legs.forEach((leg, i) => {
      expect(b.legs[i]!.marker).toBe(leg.marker);
      expect(b.legs[i]!.end.x).toBeCloseTo(leg.end.x + offset.x, 4);
      expect(b.legs[i]!.end.y).toBeCloseTo(leg.end.y + offset.y, 4);
      expect(b.legs[i]!.length).toBeCloseTo(leg.length, 4);
    });
  });
});

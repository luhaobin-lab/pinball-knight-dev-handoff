import { describe, expect, it } from 'vitest';
import { corners, floorBounds, floorCount, isFloor, layoutFromAscii, SHAPES, wallCells, wallDistance, wallRuns } from '../../src/procgen/architecture/layout';
import { NORTHSTAR_MAP } from '../../src/procgen/architecture/northstar';
import { acceptableGlyph, makeGlyphs } from '../../src/procgen/architecture/glyphs';
import { createRng } from '../../src/core/rng';

describe('room layouts', () => {
  it('parses ASCII maps: # and spaces are walls, everything else is floor', () => {
    const l = layoutFromAscii(['#####', '#.~.#', '#...#', '#####']);
    expect(l.width).toBe(5);
    expect(l.depth).toBe(4);
    expect(floorCount(l)).toBe(6);
    expect(isFloor(l, 2, 1)).toBe(true);
    expect(isFloor(l, 0, 1)).toBe(false);
    expect(isFloor(l, -1, 1)).toBe(false);
  });

  it('classifies the wall ring of a rectangle: north, south, side and corner cells', () => {
    const l = SHAPES.rect(4, 3);
    const cells = wallCells(l);
    const kind = (x: number, z: number) => cells.find(c => c.x === x && c.z === z)?.kind;
    expect(cells).toHaveLength(2 * 6 + 2 * 3);
    expect(kind(2, 0)).toBe('north');
    expect(kind(2, 4)).toBe('south');
    expect(kind(0, 2)).toBe('side');
    expect(kind(0, 0)).toBe('corner');
    expect(kind(5, 4)).toBe('corner');
  });

  it('finds convex and reflex corners of an L and a notched room', () => {
    const ell = SHAPES.ell(6, 5, 3, 2);
    const c = corners(ell);
    expect(c.filter(k => k.kind === 'outer')).toHaveLength(5);
    expect(c.filter(k => k.kind === 'inner')).toHaveLength(1);
    const inner = c.find(k => k.kind === 'inner')!;
    // the reflex vertex of the L sits where the cut meets the hall
    expect([inner.x, inner.z]).toEqual([4, 3]);
    const stepped = corners(SHAPES.stepped());
    expect(stepped.filter(k => k.kind === 'inner').length).toBeGreaterThanOrEqual(3);
  });

  it('splits the outline into straight runs per facing', () => {
    const runs = wallRuns(SHAPES.rect(4, 3));
    expect(runs).toEqual(
      expect.arrayContaining([
        { facing: 'north', line: 1, from: 1, to: 5 },
        { facing: 'south', line: 4, from: 1, to: 5 },
        { facing: 'west', line: 1, from: 1, to: 4 },
        { facing: 'east', line: 5, from: 1, to: 4 },
      ]),
    );
    expect(runs).toHaveLength(4);
  });

  it('measures the walk distance from each floor cell to the nearest wall', () => {
    const l = SHAPES.rect(5, 5);
    const d = wallDistance(l);
    expect(d[1 * l.width + 1]).toBe(1);
    expect(d[3 * l.width + 3]).toBe(3);
  });

  it('builds the North Star 凸 room with the bible floor polygon', () => {
    const l = layoutFromAscii(NORTHSTAR_MAP.map((r, z) => (z === 0 ? '#'.repeat(r.length) : r.replace(/D/g, '#'))));
    expect(l.width).toBe(24);
    expect(l.depth).toBe(15);
    expect(floorBounds(l)).toEqual({ x0: 1, z0: 1, x1: 22, z1: 13 });
    // top hall x 1–22, z 1–7; bottom hall x 4–19, z 8–13 (§18.1)
    expect(floorCount(l)).toBe(22 * 7 + 16 * 6);
    expect(corners(l).filter(c => c.kind === 'inner')).toHaveLength(2);
  });
});

describe('mycoglyphs (art bible §4)', () => {
  it('generates distinct glyphs with no symmetric, cross or plus shapes', () => {
    const glyphs = makeGlyphs(createRng('glyphs'));
    expect(new Set(glyphs).size).toBe(32);
    for (const g of glyphs) expect(acceptableGlyph(g)).toBe(true);
    expect(makeGlyphs(createRng('glyphs'))).toEqual(glyphs);
  });

  it('rejects a plus sign and a mirror-symmetric glyph', () => {
    const bit = (x: number, y: number) => 1 << (y * 5 + x);
    let plus = 0;
    for (let i = 0; i < 5; i++) plus |= bit(2, i) | bit(i, 2);
    expect(acceptableGlyph(plus)).toBe(false);
    const sym = bit(0, 0) | bit(4, 0) | bit(1, 1) | bit(3, 1) | bit(2, 2) | bit(2, 3) | bit(2, 4) | bit(1, 4);
    expect(acceptableGlyph(sym | bit(3, 4))).toBe(false);
  });
});

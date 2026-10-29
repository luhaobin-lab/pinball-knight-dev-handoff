import { describe, expect, it } from 'vitest';
import { aimVector, computeLaunchPreview, contactAttack, planLaunch, STARTER_HERO, tilePointToUu, type LaunchPreview, type Vec2 } from '../../src/core/launch/index.ts';
import { aimOf } from '../../src/game/auto-aim';
import { placeMarks, PREVIEW_MARKS, previewStrokes, type PreviewDrawOptions } from '../../src/game/launch-preview';
import { BONE_DIM, dashedRingPixels, discPixels, INK, LIT_WHITE, WHITE, type CorePixel } from '../../src/game/overlay';
import { placeholderHit } from '../../src/game/placeholder-combat';
import { clientToInternal, internalToFloor } from '../../src/game/pointer';
import { PreviewPulse } from '../../src/game/preview-pulse';
import { HERO_START, KNIGHT_BOX, ROOM_ENEMIES, roomBodies, roomSolids, roomWorld } from '../../src/game/reference-room';
import { northstarSpec } from '../../src/procgen/architecture/northstar';

const spec = northstarSpec('ns-1');
const solids = roomSolids(spec);
const start = tilePointToUu(HERO_START.x, HERO_START.z);

/** The play scene's floor projection: the camera target (8⅓, 6.5) tiles at the internal centre, 24 px per tile per zoom. */
const TARGET = { x: 200 / 24, z: 6.5 };
const projector =
  (zoom: number, target = TARGET) =>
  (p: Vec2): { x: number; y: number } => ({ x: 480 + (p.x / 64 - target.x) * 24 * zoom, y: 270 + (p.y / 64 - target.z) * 24 * zoom });

/**
 * The knight's sprite box at zoom 1 (px from his rounded floor point): his mesh projected over every aim and his idle
 * (x −21.2…+23.1, y −59.7…+2.8), rounded out, with the 1-px outline.
 */
const SPRITE = { x0: -23, x1: 25, y0: -61, y1: 4 };

/** A pulse resting between cycles: everything at the rest tone. */
function resting(preview: LaunchPreview): PreviewPulse {
  const p = new PreviewPulse();
  p.update(0, preview.pulse);
  p.head = preview.pulse.totalLength + 1e4;
  p.update(1 / 60, preview.pulse);
  return p;
}

const options = (preview: LaunchPreview, hero: Vec2, zoom = 1, pulse = resting(preview)): PreviewDrawOptions => ({
  pxPerUu: (24 * zoom) / 64,
  zoom,
  hero,
  heroBox: KNIGHT_BOX,
  pulse,
  time: 0.4,
});

/** The 06-reaim position: where the interactive run's first launch (aimed at client 1000, 420 at 1080p) comes to rest, with the dead removed. */
function reaimCorner(): { hero: Vec2; bodies: ReturnType<typeof roomBodies> } {
  const internal = clientToInternal(1000, 420, { left: 0, top: 0, width: 1920, height: 1080 }, { width: 960, height: 540, scale: 2, outputWidth: 1920, outputHeight: 1080 });
  const floor = internalToFloor(internal, { width: 960, height: 540, scale: 2, outputWidth: 1920, outputHeight: 1080 }, { target: TARGET, ppt: 24 });
  const world = roomWorld(spec.layout, solids, roomBodies());
  const launch = planLaunch(computeLaunchPreview(world, start, aimVector(start, tilePointToUu(floor.x, floor.z)), { hero: STARTER_HERO }));
  const hp = new Map(ROOM_ENEMIES.map((e, i) => [`enemy-${i}`, e.hp]));
  let hits = 0;
  for (const c of launch.contacts) {
    const id = c.hit?.actor.kind === 'body' ? c.hit.actor.id : null;
    if (id === null || (hp.get(id) ?? 0) <= 0 || contactAttack(c, STARTER_HERO) !== 'melee') continue;
    hp.set(id, Math.max(0, (hp.get(id) ?? 0) - placeholderHit(hits++).pips));
  }
  return { hero: launch.end, bodies: roomBodies().filter(b => (hp.get(b.id) ?? 0) > 0) };
}

const positions = [
  { name: 'the start', hero: start, world: roomWorld(spec.layout, solids, roomBodies()) },
  (() => {
    const c = reaimCorner();
    return { name: 'the 06-reaim corner', hero: c.hero, world: roomWorld(spec.layout, solids, c.bodies) };
  })(),
];

const key = (x: number, y: number): string => `${x},${y}`;
const touching = (cells: Set<string>, x: number, y: number): boolean => [-1, 0, 1].some(i => [-1, 0, 1].some(j => cells.has(key(x + i, y + j))));

/** Every whole-degree preview from each position. */
function* sweep(zoom = 1): Generator<{ where: string; deg: number; preview: LaunchPreview; o: PreviewDrawOptions; project: ReturnType<typeof projector> }> {
  for (const at of positions)
    for (let deg = 0; deg < 360; deg++) {
      const preview = computeLaunchPreview(at.world, at.hero, aimOf(deg), { hero: STARTER_HERO });
      yield { where: at.name, deg, preview, o: options(preview, at.hero, zoom), project: projector(zoom) };
    }
}

describe('aim preview drawing (every whole degree from the start and from the 06-reaim corner)', () => {
  it('rests in BONE.base and lights in #FFF6E3, never in BONE.dim', () => {
    const preview = computeLaunchPreview(positions[0].world, start, aimOf(205), { hero: STARTER_HERO });
    const project = projector(1);
    const rest = previewStrokes(preview, project, options(preview, start)).cores;
    expect(new Set(rest.filter(c => c.kind !== 'digit').map(c => c.color))).toEqual(new Set([WHITE]));
    expect(new Set(rest.filter(c => c.kind === 'digit').map(c => c.color))).toEqual(new Set([INK]));
    // the pulse half-way along the chain: both bone steps, nothing else
    const lit = new PreviewPulse();
    lit.update(0, preview.pulse);
    lit.head = preview.pulse.totalLength / 2;
    const cores = previewStrokes(preview, project, options(preview, start, 1, lit)).cores;
    expect(new Set(cores.filter(c => c.kind !== 'digit').map(c => c.color))).toEqual(new Set([WHITE, LIT_WHITE]));
    expect(cores.some(c => c.color === BONE_DIM)).toBe(false);
  });

  it('keeps every chevron core at least a pixel of ink away from every ring and arc core', () => {
    for (const { where, deg, preview, o, project } of sweep()) {
      const cores = previewStrokes(preview, project, o).cores;
      const marks = new Set(cores.filter(c => c.kind === 'mark').map(c => key(c.x, c.y)));
      const bad = cores.filter(c => c.kind === 'chevron' && touching(marks, c.x, c.y));
      expect(bad, `${where}, ${deg}°`).toEqual([]);
    }
  });

  it('keeps every two chevrons 2 px apart, so their outlines never merge: chevron pixels within 2 px of each other are one stamp', () => {
    for (const { where, deg, preview, o, project } of sweep()) {
      const cells = new Set(previewStrokes(preview, project, o).cores.filter(c => c.kind === 'chevron').map(c => key(c.x, c.y)));
      const seen = new Set<string>();
      for (const start of cells) {
        if (seen.has(start)) continue;
        let size = 0;
        const stack = [start];
        seen.add(start);
        while (stack.length) {
          const [x, y] = stack.pop()!.split(',').map(Number);
          size++;
          for (const i of [-2, -1, 0, 1, 2])
            for (const j of [-2, -1, 0, 1, 2]) {
              const k = key(x + i, y + j);
              if (cells.has(k) && !seen.has(k)) {
                seen.add(k);
                stack.push(k);
              }
            }
        }
        expect(size, `${where}, ${deg}°`).toBeLessThanOrEqual(11);
      }
    }
  });

  it('never overlaps two dots (with their rims), nor a dot and the knight', () => {
    for (const { where, deg, preview, o, project } of sweep()) {
      const marks = placeMarks(preview, project, o);
      const h = project(o.hero);
      const hx = Math.round(h.x);
      const hy = Math.round(h.y);
      const owner = new Map<string, number>();
      marks.forEach((m, i) => {
        for (const [x, y] of discPixels(m.pos.x, m.pos.y, m.diameter + 2)) {
          expect(owner.has(key(x, y)), `${where}, ${deg}°: dots ${owner.get(key(x, y))} and ${i}`).toBe(false);
          owner.set(key(x, y), i);
          expect(x >= hx + SPRITE.x0 && x <= hx + SPRITE.x1 && y >= hy + SPRITE.y0 && y <= hy + SPRITE.y1, `${where}, ${deg}°: dot ${i} on the knight`).toBe(false);
        }
      });
    }
  });

  it('draws nothing, not even ink, inside the knight’s sprite box', () => {
    for (const { where, deg, preview, o, project } of sweep()) {
      const s = previewStrokes(preview, project, o);
      const h = project(o.hero);
      const box = { x0: Math.round(h.x) + SPRITE.x0, x1: Math.round(h.x) + SPRITE.x1, y0: Math.round(h.y) + SPRITE.y0, y1: Math.round(h.y) + SPRITE.y1 };
      for (let i = 0; i < s.inks.length; i += 4) {
        const [x, y, w, hh] = s.inks.slice(i, i + 4);
        const inside = x <= box.x1 && x + w - 1 >= box.x0 && y <= box.y1 && y + hh - 1 >= box.y0;
        expect(inside, `${where}, ${deg}°: ink at ${x},${y}`).toBe(false);
      }
    }
  });

  it('draws every enemy ring and wall arc whole, but where it would cross a dot or the knight, and nothing else as marks', () => {
    for (const { where, deg, preview, o, project } of sweep()) {
      const cores = previewStrokes(preview, project, o).cores;
      const marks = placeMarks(preview, project, o);
      const drawn = new Set(cores.filter(c => c.kind === 'mark').map(c => key(c.x, c.y)));
      const radius = PREVIEW_MARKS.ringRadius * o.pxPerUu;
      const h = project(o.hero);
      const kept = ([x, y]: readonly [number, number]): boolean =>
        drawn.has(key(x, y)) ||
        marks.some(m => Math.hypot(x - m.pos.x, y - m.pos.y) < m.diameter / 2 + 2.5 || Math.hypot(x - Math.round(m.end.x), y - Math.round(m.end.y)) < 4) ||
        (Math.abs(x - h.x) <= o.heroBox.halfWidth * o.pxPerUu + 1 && y >= h.y - o.heroBox.up * o.pxPerUu - 1 && y <= h.y + o.heroBox.down * o.pxPerUu + 1);
      preview.legs.forEach((leg, k) => {
        if (leg.marker !== 'enemy') return;
        const { end } = marks[k];
        expect(dashedRingPixels(end.x, end.y, radius, PREVIEW_MARKS.ringDashes).every(kept), `${where}, ${deg}°: ring ${k}`).toBe(true);
      });
      // no connector ticks or other strokes: every mark pixel lies on a ring or arc
      const onShape = (c: CorePixel): boolean => marks.some((m, k) => preview.legs[k].marker !== 'none' && Math.abs(Math.hypot(c.x - m.end.x, c.y - m.end.y) - radius) <= 1);
      expect(cores.filter(c => c.kind === 'mark' && !onShape(c)), `${where}, ${deg}°`).toEqual([]);
    }
  });

  it('numbers every bounce point on the Demo’s bone dot, the digit knocked out in ink', () => {
    const preview = computeLaunchPreview(positions[0].world, start, aimOf(205), { hero: STARTER_HERO });
    const project = projector(1);
    const o = options(preview, start);
    const marks = placeMarks(preview, project, o);
    expect(marks.map(m => m.label)).toEqual(['1', '2', '3', '4']);
    expect(marks.map(m => m.diameter)).toEqual(preview.legs.map(l => (l.marker === 'enemy' ? 13 : 11)));
    const cores = previewStrokes(preview, project, o).cores;
    for (const m of marks) {
      const inDot = cores.filter(c => Math.hypot(c.x - m.pos.x, c.y - m.pos.y) <= m.diameter / 2);
      const ink = inDot.filter(c => c.color === INK).length;
      expect(ink).toBeGreaterThan(5);
      expect(ink).toBeLessThan(inDot.length / 2);
    }
  });
});

describe('aim preview at zoom 2', () => {
  it('keeps the dots, the digits and the chevron pitch at their zoom-1 pixel size, and the rings at world size', () => {
    const preview = computeLaunchPreview(positions[0].world, start, aimOf(205), { hero: STARTER_HERO });
    const project = projector(2, { x: 9, z: 7 });
    const o = options(preview, start, 2);
    expect(placeMarks(preview, project, o).map(m => m.diameter)).toEqual(preview.legs.map(l => (l.marker === 'enemy' ? 13 : 11)));
    const cores = previewStrokes(preview, project, o).cores;
    // the first leg's chevrons, in order along it: one every 11.25 px as at zoom 1
    const leg = preview.legs[0];
    const a = project(leg.start);
    const b = project(leg.end);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const along = cores
      .filter(c => c.kind === 'chevron' && Math.abs((c.x - a.x) * -u.y + (c.y - a.y) * u.x) <= 4)
      .map(c => (c.x - a.x) * u.x + (c.y - a.y) * u.y);
    const groups = [...new Set(along.map(t => Math.round(t / 11.25)))].sort((x, y) => x - y);
    expect(groups.length).toBeGreaterThan(len / 11.25 - 8);
    const rings = cores.filter(c => c.kind === 'mark');
    const end = placeMarks(preview, project, o)[preview.legs.findIndex(l => l.marker === 'enemy')].end;
    const near = rings.filter(c => Math.abs(Math.hypot(c.x - end.x, c.y - end.y) - PREVIEW_MARKS.ringRadius * o.pxPerUu) <= 1);
    expect(near.length).toBeGreaterThan(40);
  });
});

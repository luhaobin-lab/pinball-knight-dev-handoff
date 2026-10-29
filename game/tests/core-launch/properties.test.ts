import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import { type Vec2, distance, dot, length, reflect, safeNormal2D, sub, vec } from '../../src/core/launch/math.ts';
import { type Trajectory } from '../../src/core/launch/path.ts';
import { planLaunch, samplePlayback } from '../../src/core/launch/playback.ts';
import { computeLaunchPreview, type LaunchPreview } from '../../src/core/launch/preview.ts';
import { type HeroLaunchStats, LAUNCH_RULES, SOUL_HUNTER, STARTER_HERO } from '../../src/core/launch/settings.ts';
import { createLaunchWorld, type LaunchWorld, probeOverlaps, sweepProbe } from '../../src/core/launch/world.ts';
import { boxRoom, PLAY_HERO, playRoom, tile } from './fixtures.ts';

const PLAY = playRoom();
const HEROES: HeroLaunchStats[] = [STARTER_HERO, SOUL_HUNTER, { ...STARTER_HERO, maxBounces: 12 }];

/** Previews for `n` seeded random aims from the hero spot of the play room. */
function sweepAims(n: number, seed: string, world: LaunchWorld = PLAY, origin: Vec2 = PLAY_HERO) {
  const rng = createRng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = rng.range(0, Math.PI * 2);
    const hero = HEROES[i % HEROES.length];
    return { hero, preview: computeLaunchPreview(world, origin, vec(Math.cos(a) * 300, Math.sin(a) * 300), { hero }) };
  });
}

const segmentDistance = (p: Vec2, a: Vec2, b: Vec2): number => {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const u = l2 > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return distance(p, { x: a.x + ab.x * u, y: a.y + ab.y * u });
};

/** Distance to the polyline and the arc length of the closest point on it. */
function project(p: Vec2, path: Trajectory): { off: number; along: number } {
  let best = { off: Infinity, along: 0 };
  const pts = path.points;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1].location;
    const b = pts[i].location;
    const off = segmentDistance(p, a, b);
    if (off < best.off) best = { off, along: pts[i - 1].distance + distance(a, p) };
  }
  return best;
}

const probeOf = (radius: number, hero: HeroLaunchStats) => ({ radius, halfHeight: radius, z: hero.height });
const mainRadius = (hero: HeroLaunchStats) => Math.fround(hero.width * LAUNCH_RULES.probeRadiusFactor);
const legsOf = (p: LaunchPreview) => [...p.legs.map(c => ({ path: c.path, radius: mainRadius(p.hero) })), ...(p.terminal ? [{ path: p.terminal.path, radius: Math.fround(p.hero.width) }] : [])];

describe('determinism', () => {
  it('the same aim gives the same preview and launch, whatever ran in between', () => {
    const aim = vec(0.4, -1);
    const a = computeLaunchPreview(PLAY, PLAY_HERO, aim);
    sweepAims(20, 'noise');
    const b = computeLaunchPreview(playRoom(), PLAY_HERO, aim);
    expect(b).toEqual(a);
    expect(planLaunch(b)).toEqual(planLaunch(a));
    const pa = planLaunch(a);
    for (const t of [0, 0.1, 0.33, pa.duration / 2, pa.duration]) expect(samplePlayback(pa, t)).toEqual(samplePlayback(planLaunch(b), t));
  });

  it('a seeded sweep is reproducible', () => {
    const summary = (n: number) => sweepAims(n, 'repro').map(({ preview }) => [preview.legs.length, preview.finalLaunchValue, preview.legs.map(c => c.end)]);
    expect(summary(40)).toEqual(summary(40));
  });
});

describe('preview == playback', () => {
  const sweep = sweepAims(240, 'preview-equals-playback');

  it('replays exactly the displayed paths, contacts at the markers, rests at the terminal end', () => {
    for (const { preview } of sweep) {
      const p = planLaunch(preview);
      expect(p.complete).toBe(true);
      expect(p.legs).toHaveLength(preview.legs.length + (preview.terminal ? 1 : 0));
      preview.legs.forEach((c, i) => {
        expect(p.legs[i].path).toBe(c.path);
        const contact = p.legs[i].contact;
        expect(contact !== null).toBe(c.hit !== null || c.deferredGravityBounce);
        if (contact) {
          expect(contact.position).toBe(c.end);
          expect(contact.hit).toBe(c.hit);
          expect(samplePlayback(p, contact.time - 1e-9).position).toEqual(c.end);
        }
      });
      expect(p.contacts).toEqual(p.legs.flatMap(l => (l.contact ? [l.contact] : [])));
      expect(p.end).toEqual(preview.terminal ? preview.terminal.end : preview.legs[preview.legs.length - 1].end);
      expect(samplePlayback(p, p.duration + 1).position).toEqual(p.end);
    }
  });

  it('every sample lies on the leg it reports and moves forward along it', () => {
    for (const { preview } of sweep.slice(0, 80)) {
      const p = planLaunch(preview);
      let last = { leg: -1, along: 0 };
      for (let t = 0; t < p.duration; t += 1 / 120) {
        const s = samplePlayback(p, t);
        const leg = p.legs[s.leg];
        const { off, along } = project(s.position, leg.path);
        expect(off).toBeLessThan(1e-6);
        if (s.leg === last.leg) expect(along).toBeGreaterThanOrEqual(last.along - 1e-4);
        last = { leg: s.leg, along };
      }
    }
  });

  it('each leg starts where the hero stands (the Demo refuses a start more than 8 uu away)', () => {
    for (const { preview } of sweep) {
      const p = planLaunch(preview);
      let hero = preview.origin;
      for (const leg of p.legs) {
        expect(distance(leg.path.points[0].location, hero)).toBeLessThanOrEqual(LAUNCH_RULES.startOffset + 1e-9);
        hero = leg.path.points[leg.path.points.length - 1].location;
      }
    }
  });
});

describe('chain rules', () => {
  const sweep = sweepAims(240, 'chain-rules');

  it('every main leg runs at most 弹射距离 and exactly that in free flight (the distance resets per bounce)', () => {
    for (const { preview, hero } of sweep) {
      for (const c of [...preview.legs, ...(preview.next ? [preview.next] : [])]) {
        expect(c.path.totalDistance).toBeLessThanOrEqual(hero.launchDistance + 1e-3);
        if (!c.hit && c.pickups.length === 0) expect(c.path.totalDistance).toBe(hero.launchDistance);
      }
    }
  });

  it('shows at most Bounce Limit + 1 legs and marks every leg end', () => {
    for (const { preview, hero } of sweep) {
      expect(preview.legs.length).toBeLessThanOrEqual(hero.maxBounces + 1);
      for (const c of preview.legs) expect(c.marker).toBe(c.hit === null ? 'none' : c.hit.actor.kind === 'body' ? 'enemy' : 'wall');
    }
  });
});

describe('reflection law', () => {
  it('outgoing = mirror of the last segment about the contact normal, on walls and on circles', () => {
    let walls = 0;
    let circles = 0;
    for (const { preview } of sweepAims(400, 'reflection')) {
      for (const c of preview.legs) {
        if (!c.hit || !c.bounceable || c.path.stationaryCollision) continue;
        const pts = c.path.points;
        const travel = safeNormal2D(sub(pts[pts.length - 1].location, pts[pts.length - 2].location));
        const want = reflect(travel, c.hit.normal);
        const err = Math.acos(Math.min(1, dot(want, c.bounceDirection)));
        // CalculateDirection's float acos quantises angles near the Demo's ±X axis by up to ~0.02°
        expect(err, `circle ${c.index} on ${c.hit.actor.id}`).toBeLessThan(1e-3);
        // angle of incidence = angle of reflection, the outgoing leg leaves the surface
        expect(dot(c.bounceDirection, c.hit.normal)).toBeCloseTo(-dot(travel, c.hit.normal), 3);
        expect(dot(c.bounceDirection, c.hit.normal)).toBeGreaterThan(0);
        if (c.hit.actor.kind === 'wall') walls++;
        else circles++;
      }
    }
    expect(walls).toBeGreaterThan(50);
    expect(circles).toBeGreaterThan(20);
  });

  it('a circle normal is radial at the contact', () => {
    for (const { preview } of sweepAims(200, 'radial')) {
      for (const c of preview.legs) {
        if (!c.hit || c.hit.actor.kind === 'wall') continue;
        const centre = PLAY.circles.find(s => s.actor === c.hit!.actor)!.center;
        const radial = safeNormal2D(sub(c.end, centre));
        expect(dot(radial, c.hit.normal)).toBeCloseTo(1, 9);
      }
    }
  });
});

describe('no penetration, no tunnelling', () => {
  it('a path never enters a solid it did not start in, and its segments past the start are clear', () => {
    const ids = [...PLAY.actors.keys()];
    let exits = 0;
    for (const { preview, hero } of sweepAims(150, 'penetration')) {
      for (const { path, radius } of legsOf(preview)) {
        if (path.stationaryCollision) continue;
        const probe = probeOf(radius, hero);
        const start = path.points[0].location;
        // A terminal leg starts where the 0.95·宽度 main probe touched; its 宽度 probe starts inside by up to 2.8 uu.
        // The leg-start recovery steps out within MaxExit (12 uu for the wall mesh), or stops at whatever blocks
        // the way out, still inside (NATIVE-016/018).
        const startedIn = new Set(ids.filter(id => probeOverlaps(PLAY, start, probe, new Set(ids.filter(o => o !== id)))));
        if (startedIn.size > 0) {
          exits++;
          expect(distance(start, path.points[1].location)).toBeLessThanOrEqual(12 + 1e-9);
        }
        for (const pt of path.points.slice(1)) expect(probeOverlaps(PLAY, pt.location, probe, startedIn)).toBe(false);
        for (let i = 2; i < path.points.length; i++) {
          expect(sweepProbe(PLAY, path.points[i - 1].location, path.points[i].location, probeOf(radius - 0.01, hero), new Set())).toBeNull();
        }
      }
    }
    expect(exits).toBeGreaterThan(10);
  });

  it('a 1-uu wall stops a 6000 uu/s leg', () => {
    // 80 × 8 corridor, aimed 60° down-right: legs zigzag east, 14 bounces in the speed is capped at 6000
    const thin = { id: 'thin', minX: 3800, minY: 0, maxX: 3801, maxY: 640 };
    const world = createLaunchWorld({ grid: boxRoom(80, 8), boxes: [thin] });
    const hero = { ...STARTER_HERO, maxBounces: 30 };
    const preview = computeLaunchPreview(world, vec(192, 288), vec(0.5, Math.sqrt(3) / 2), { hero });
    const p = planLaunch(preview);
    const hitLeg = p.legs.find(l => l.contact?.hit?.actor.id === 'thin');
    expect(hitLeg?.speed).toBe(6000);
    const limit = thin.minX - mainRadius(hero);
    for (let t = 0; t <= p.duration; t += 1 / 60) {
      const s = samplePlayback(p, t);
      expect(s.position.x).toBeLessThanOrEqual(limit + 1e-6);
      if (p.legs[s.leg]?.speed === 6000) expect(length(s.velocity)).toBeLessThan(6000 * 1.42 * 1.01);
    }
    expect(p.legs.filter(l => l.speed === 6000).length).toBeGreaterThan(2);
  });

  it('a 0.5-uu wall stops a single sweep step that is longer than it is thick', () => {
    const world = createLaunchWorld({ boxes: [{ id: 'sheet', minX: 300, minY: -1000, maxX: 300.5, maxY: 1000 }] });
    const preview = computeLaunchPreview(world, vec(0, 0), vec(1, 0));
    expect(preview.legs[0].hit?.actor.id).toBe('sheet');
    expect(preview.legs[0].end.x).toBeCloseTo(300 - mainRadius(STARTER_HERO), 6);
  });

  it('the hero spot of the play room starts clear', () => {
    expect(probeOverlaps(PLAY, PLAY_HERO, probeOf(mainRadius(STARTER_HERO), STARTER_HERO), new Set())).toBe(false);
    expect(tile(10.5, 11.6)).toEqual(PLAY_HERO);
  });
});

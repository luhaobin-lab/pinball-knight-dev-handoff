import { computeLaunchPreview, STARTER_HERO, UU_PER_TILE, type LaunchPreview, type LaunchWorld, type Vec2 } from '../core/launch/index.ts';
import { placeholderHit } from './placeholder-combat';

/** The unit aim of a whole-degree angle (x east, y south: positive degrees turn clockwise on screen). */
export const aimOf = (degrees: number): Vec2 => ({ x: Math.cos((degrees * Math.PI) / 180), y: Math.sin((degrees * Math.PI) / 180) });

/** Bounce points closer than two ring radii crowd their marks; legs shorter than one ring radius hide theirs. */
const SPREAD = 120;
const SHORT_LEG = 60;

/**
 * How good a scripted shot is: kills (with the placeholder hits, starting at the session's `hitsSoFar`-th) count
 * most; at equal kills a chain whose bounce points stand two ring radii apart wins and every leg shorter than a
 * ring radius costs; then distinct enemies hit, up to three wall bounces, a first contact on a wall and a long
 * first leg.
 */
export function aimScore(preview: LaunchPreview, hp: ReadonlyMap<string, number>, hitsSoFar: number): number {
  const legs = preview.legs;
  const left = new Map(hp);
  const hitIds = new Set<string>();
  let kills = 0;
  let hits = hitsSoFar;
  let walls = 0;
  for (const leg of legs) {
    if (leg.marker === 'wall') walls++;
    if (leg.marker !== 'enemy' || !leg.hit) continue;
    const id = leg.hit.actor.id;
    const before = left.get(id) ?? 0;
    if (before <= 0) continue;
    hitIds.add(id);
    const after = Math.max(0, before - placeholderHit(hits++).pips);
    left.set(id, after);
    if (after === 0) kills++;
  }
  const ends = legs.map(l => l.end);
  const spread = ends.every((a, i) => ends.slice(0, i).every(b => Math.hypot(a.x - b.x, a.y - b.y) >= SPREAD));
  const short = legs.filter(l => l.length < SHORT_LEG).length;
  const first = legs[0];
  const firstWall = first?.marker === 'wall' ? 2 : 0;
  const firstLen = first ? Math.min(first.length / 64, 6) : 0;
  return kills * 1000 + (spread ? 100 : 0) - short * 50 + hitIds.size * 10 + Math.min(walls, 3) + firstWall + firstLen * 0.3;
}

/**
 * The scripted shot (?t=, ?auto=1): the best whole degree for the hero at `origin` (circle 0 snaps every aim to
 * whole degrees, launch-movement LAUNCH-005), among the aims into the upper part of the room.
 */
export function bestAim(world: LaunchWorld, origin: Vec2, hp: ReadonlyMap<string, number>, hitsSoFar = 0): number {
  let best = -90;
  let bestScore = -Infinity;
  for (let deg = 0; deg < 360; deg++) {
    const aim = aimOf(deg);
    if (aim.y > -0.35) continue;
    const score = aimScore(computeLaunchPreview(world, origin, aim, { hero: STARTER_HERO }), hp, hitsSoFar);
    if (score > bestScore) {
      bestScore = score;
      best = deg;
    }
  }
  return best;
}

/**
 * The scripted cursor's angle at `t` seconds: from 10° short of `final` it swings 10° past it by `sweep / 2`,
 * settles on it at `sweep` (each half eased) and holds there.
 */
export function sweepAngle(final: number, t: number, sweep: number): number {
  const ease = (u: number): number => u * u * (3 - 2 * u);
  const h = sweep / 2;
  if (t >= sweep) return final;
  if (t < h) return final - 10 + 20 * ease(t / h);
  return final + 10 - 10 * ease((t - h) / h);
}

/** How far along its aim the scripted cursor rests (tiles), in order of preference. */
const CURSOR_REACH = [6, 5, 7, 4, 8, 3] as const;
/** The arrow (src/game/cursor.ts) reaches 22 px right of and below its hot spot: 60 uu at zoom 1 (0.375 px per uu). */
const ARROW_REACH = 60;
/** A leg end's dot with its rim and a pixel of air (uu). */
const DOT_CLEAR = 24;

/**
 * Where the scripted cursor rests (uu): on the aim line from `origin`, at the first reach where the arrow keeps
 * clear of every leg end's dot, so it never hides a bounce number.
 */
export function cursorPoint(preview: LaunchPreview, origin: Vec2): Vec2 {
  const marks = [...preview.legs.map(l => l.end), ...(preview.terminal ? [preview.terminal.end] : [])];
  const at = (tiles: number): Vec2 => ({ x: origin.x + preview.aim.x * tiles * UU_PER_TILE, y: origin.y + preview.aim.y * tiles * UU_PER_TILE });
  const off = (p: Vec2, m: Vec2): number => Math.hypot(Math.max(p.x - m.x, 0, m.x - p.x - ARROW_REACH), Math.max(p.y - m.y, 0, m.y - p.y - ARROW_REACH));
  const clear = (p: Vec2): boolean => marks.every(m => off(p, m) >= DOT_CLEAR);
  return at(CURSOR_REACH.find(t => clear(at(t))) ?? CURSOR_REACH[0]);
}

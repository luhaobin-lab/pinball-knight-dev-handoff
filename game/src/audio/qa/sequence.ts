import { tilesToUu, uuToTiles } from '../../core/launch/units.ts';
import type { Audio } from '../index.ts';
import type { Timed } from './offline.ts';

/**
 * One Demo launch as timed API calls, for the audio-sfx debug scene and tests: the 60-fps timeline of the Demo's
 * frame model (demo-juice §1, scripts/launch_timeline.py) with three contacts:
 * - release at RELEASE: launch whoosh; the hero moves along the Demo's leg curves and drops a dust puff, and asks
 *   for a step, every 100 uu (粒子_Dust_01 SpawnPerUnit; 音效并发_脚步 lets one through per 0.2 s);
 * - 0.267 s wall: bump; 0.500 s enemy: bump, swing (attack notify at t = 0), hit at the victim (splatter 0.1 s
 *   later inside the cue); 0.767 s wall: bump, and an item reaches full charge (charge is per bounce);
 * - the victim's Die animation plays its splat notify at 0.503 game s, under the hit-stop: DEATH_AFTER_HIT real s;
 * - terminal glide (0.3 × 2600 uu/s over 500 uu) to rest at 1.408 s.
 * The wind loop starts at t = 0, the room's start. The listener follows the hero every frame.
 */

export const RELEASE = 0.5;
export const SEQUENCE_SECONDS = 4.8;
const LEG_TILES = uuToTiles(500);
/** demo-juice §3.1: distance fraction at each tenth of a leg's time (可控反弹曲线, 可控终末确定曲线). */
const MAIN_CURVE = [0, 0.14, 0.275, 0.405, 0.528, 0.643, 0.749, 0.843, 0.921, 0.977, 1];
const TERMINAL_CURVE = [0, 0.236, 0.426, 0.581, 0.704, 0.802, 0.878, 0.934, 0.972, 0.993, 1];
/** 0.503 game s of the Die animation after a hostile contact: 0.022 s at 0.2×, 0.058 s at 1.5×, the rest at 1×. */
const DEATH_AFTER_HIT = 0.022 / 0.2 + 0.058 / 1.5 + (0.503 - 0.08);

interface Point {
  readonly x: number;
  readonly z: number;
}
interface Leg {
  readonly from: Point;
  readonly to: Point;
  readonly t0: number;
  readonly t1: number;
  readonly curve: readonly number[];
}

const offset = (p: Point, dx: number, dz: number, k: number): Point => ({ x: p.x + dx * k, z: p.z + dz * k });
const along = (curve: readonly number[], f: number): number => {
  const i = Math.min(9, Math.floor(f * 10));
  return curve[i] + (curve[i + 1] - curve[i]) * (f * 10 - i);
};

/** The scripted launch, sorted by time. */
export function launchSequence(): Timed[] {
  const start = { x: 14, z: 12 };
  const c1 = offset(start, 1, 0, LEG_TILES);
  const c2 = offset(c1, -0.6, -0.8, LEG_TILES);
  const enemy = offset(c2, -0.6, -0.8, 1.6);
  const c3 = offset(c2, -0.8, 0.6, LEG_TILES);
  const rest = offset(c3, 0.6, 0.8, LEG_TILES);
  const legs: Leg[] = [
    { from: start, to: c1, t0: 0, t1: 0.267, curve: MAIN_CURVE },
    { from: c1, to: c2, t0: 0.267, t1: 0.5, curve: MAIN_CURVE },
    { from: c2, to: c3, t0: 0.5, t1: 0.767, curve: MAIN_CURVE },
    { from: c3, to: rest, t0: 0.767, t1: 1.408, curve: TERMINAL_CURVE },
  ];
  const hero = (t: number): Point => {
    const leg = legs.find(l => t <= l.t1) ?? legs[legs.length - 1];
    const f = along(leg.curve, Math.min(1, Math.max(0, (t - leg.t0) / (leg.t1 - leg.t0))));
    return { x: leg.from.x + (leg.to.x - leg.from.x) * f, z: leg.from.z + (leg.to.z - leg.from.z) * f };
  };
  const steps: Timed[] = [
    { t: 0, run: a => a.loop('wind', true) },
    { t: 0, run: a => a.setListener(start.x, start.z) },
    { t: RELEASE, run: a => a.play('launch') },
  ];
  let travelled = 0;
  let last = start;
  for (let f = 1; f <= Math.round(1.408 * 60); f++) {
    const p = hero(f / 60);
    travelled += tilesToUu(Math.hypot(p.x - last.x, p.z - last.z));
    last = p;
    const t = RELEASE + f / 60;
    steps.push({ t, run: a => a.setListener(p.x, p.z) });
    for (; travelled >= 100; travelled -= 100) steps.push({ t, run: a => a.play('step', p) });
  }
  const at = (t: number, run: (a: Audio) => void): void => void steps.push({ t: RELEASE + t, run });
  at(0.267, a => a.play('bump', c1));
  at(0.5, a => {
    a.play('bump', c2);
    a.play('swing', c2);
    a.play('hit', enemy);
  });
  at(0.767, a => {
    a.play('bump', c3);
    a.play('charge');
  });
  at(0.5 + DEATH_AFTER_HIT, a => a.play('death', enemy));
  return steps.sort((a, b) => a.t - b.t);
}

export const PINGPONG_SECONDS = 3;
/** demo-juice §6: the bounce hit-stop's global dilation, by game seconds since the hostile contact that (re)started it. */
const hitStop = (since: number): number => (since < 0.022 ? 0.2 : since < 0.08 ? 1.5 : 1);
const FRAME = 1 / 60;

/**
 * The eviction case (音效并发_默认 holds 6 voices): a launch that ping-pongs between enemy A and a pair B1, B2, both
 * inside the knight's AoE (110 uu) when it touches B1, so every contact adds a bump and a hit per victim, the group
 * overflows from the third contact on and its farthest voices are stolen while the listener follows the hero. The
 * contact points are 120 uu apart, 104 uu from the touched enemy. The Demo's frame model at 60 fps
 * (scripts/launch_timeline.py): leg k at min(2000 + 300k, 6000) uu/s over max(L / v, 0.01) game s, a world step of
 * one frame × the hit-stop dilation (restarted by every hostile contact), contacts on the frame a leg completes,
 * then the terminal glide at 0.3 × the last speed over the next leg's length, no contact at its end.
 */
export function pingPongSequence(): Timed[] {
  const centre = { x: 14, z: 12 };
  const at = (dxUu: number, dzUu: number): Point => offset(centre, uuToTiles(dxUu), uuToTiles(dzUu), 1);
  const sideA = at(-60, 0);
  const sideB = at(60, 0);
  const victimsA = [at(-164, 0)];
  const victimsB = [at(164, 0), at(130, 80)];
  const legs: { to: Point; victims: Point[] }[] = [
    { to: sideB, victims: victimsB },
    { to: sideA, victims: victimsA },
    { to: sideB, victims: victimsB },
    { to: sideA, victims: victimsA },
    { to: sideB, victims: [] },
  ];
  const steps: Timed[] = [
    { t: 0, run: a => a.loop('wind', true) },
    { t: 0, run: a => a.setListener(centre.x, centre.z) },
    { t: RELEASE, run: a => a.play('launch') },
  ];
  let real = 0;
  let from = centre;
  let speed = 0;
  let sinceHit = Infinity;
  let travelled = 0;
  legs.forEach((leg, k) => {
    const terminal = k === legs.length - 1;
    speed = terminal ? speed * 0.3 : Math.min(2000 + 300 * k, 6000);
    const length = tilesToUu(Math.hypot(leg.to.x - from.x, leg.to.z - from.z));
    const duration = Math.max(length / speed, 0.01);
    const curve = terminal ? TERMINAL_CURVE : MAIN_CURVE;
    let last = from;
    for (let elapsed = 0; elapsed < duration; ) {
      real += FRAME;
      const world = FRAME * hitStop(sinceHit);
      sinceHit += world;
      elapsed += world;
      const f = along(curve, Math.min(1, elapsed / duration));
      const p = { x: from.x + (leg.to.x - from.x) * f, z: from.z + (leg.to.z - from.z) * f };
      travelled += tilesToUu(Math.hypot(p.x - last.x, p.z - last.z));
      last = p;
      const t = RELEASE + real;
      steps.push({ t, run: a => a.setListener(p.x, p.z) });
      for (; travelled >= 100; travelled -= 100) steps.push({ t, run: a => a.play('step', p) });
    }
    from = leg.to;
    if (terminal) return;
    const hero = leg.to;
    steps.push({
      t: RELEASE + real,
      run: a => {
        a.play('bump', hero);
        a.play('swing', hero);
        for (const v of leg.victims) a.play('hit', v);
      },
    });
    sinceHit = 0;
  });
  return steps.sort((a, b) => a.t - b.t);
}

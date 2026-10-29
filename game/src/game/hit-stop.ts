import { HIT_STOP } from '../core/launch/index.ts';

/**
 * The launch's game clock under the hit-stop of hostile contacts (src/core/launch HIT_STOP, hitStopDilation;
 * launch-movement LAUNCH-065): from every enemy contact, game time runs at the 变速 track's dilation for 0.25 game
 * seconds (the timeline itself runs in dilated time, so it lasts ≈ 0.3187 s real). Advancing `game` by `realDt`
 * real seconds walks every contact and every step of the track inside the frame, so the result does not depend on
 * the frame rate. `enemyContacts` are the game times of the launch's enemy contacts.
 */
export function advanceLaunchClock(game: number, realDt: number, enemyContacts: readonly number[]): number {
  let g = game;
  let left = realDt;
  for (let guard = 0; left > 0 && guard < 64; guard++) {
    let last = -Infinity;
    let next = Infinity;
    for (const c of enemyContacts) {
      if (c <= g) last = Math.max(last, c);
      else next = Math.min(next, c);
    }
    // the track's steps as absolute times, so a boundary the clock has just reached counts as passed
    let dilation = 1;
    let until = next;
    const end = last + HIT_STOP.duration;
    if (g < end) {
      for (const step of HIT_STOP.steps) {
        const from = last + step.from;
        if (from <= g) dilation = step.dilation;
        else {
          until = Math.min(until, from);
          break;
        }
      }
      until = Math.min(until, end);
    }
    const need = (until - g) / dilation;
    if (!(need < left)) return g + left * dilation;
    g = until;
    left -= need;
  }
  return g;
}

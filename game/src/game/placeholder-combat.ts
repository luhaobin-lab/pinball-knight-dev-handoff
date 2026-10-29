/**
 * SPEC-GAP: the damage formula (damage-crit-weakspot), crits and the enemy turns are not ported yet. Until they
 * are, the art-p placeholder stays as it was: a hit takes one pip of an enemy's HP, the session's third hit is a
 * crit taking three, and the numbers shown cycle through a fixed list (doubled on the crit).
 */
export interface PlaceholderHit {
  readonly pips: number;
  readonly crit: boolean;
  /** The number the damage popup shows. */
  readonly damage: number;
}

const SHOWN = [6, 8, 12, 7, 9] as const;

/** The `index`-th hit of the session (0-based). */
export function placeholderHit(index: number): PlaceholderHit {
  const crit = index === 2;
  return { pips: crit ? 3 : 1, crit, damage: SHOWN[index % SHOWN.length] * (crit ? 2 : 1) };
}

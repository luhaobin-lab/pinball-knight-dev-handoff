import { advanceLaunchClock } from './hit-stop';
import { advanceDeathResistClock, DEATH_RESIST_LENGTH } from './death-resist-clock';

/**
 * Real time → game time for `game.advance` (ARCHITECTURE §8.1). The core announces dilations with `time.dilation`
 * events at game time `from`:
 * - `hitStop`: the 变速 track after an enemy contact (`advanceLaunchClock`, exact across frames);
 * - `death`: 全局时间变速 when a character dies. SPEC-GAP: the curve is not in the specs yet; the clock holds
 *   DEATH_DILATION for DEATH_SECONDS of game time;
 * - `none`: back to real time at once.
 * The shell pauses explicit pause warnings. Reward and choice modals keep their latent settlement work running;
 * their core modal gate restricts input. `speed` scales game time (`?speed=` for the browser bot).
 */
export const DEATH_DILATION = 0.25;
export const DEATH_SECONDS = 0.5;

export class GameClock {
  /** Game seconds the clock has handed out. */
  time = 0;
  speed = 1;
  private contacts: number[] = [];
  private deathUntil = -Infinity;
  private resistFrom = -Infinity;

  /** Starts counting from the game's own time (a new game, or a load). */
  sync(gameTime: number): void {
    this.time = gameTime;
    this.contacts = [];
    this.deathUntil = -Infinity;
    this.resistFrom = -Infinity;
  }

  dilate(curve: 'hitStop' | 'death' | 'deathResist' | 'ratingReward' | 'none', from: number): void {
    // These two source timelines are byte-for-byte equal in the imported data; the equality contract is tested.
    if (curve === 'deathResist' || curve === 'ratingReward') {
      this.resistFrom = from;
      this.contacts = []; this.deathUntil = -Infinity;
      return;
    }
    // SPEC-GAP: competing UE timelines write global dilation per tick. We preserve the latest delivered
    // presentation override here; their simultaneous callback ordering still needs an original trace.
    this.resistFrom = -Infinity;
    if (curve === 'hitStop') this.contacts.push(from);
    else if (curve === 'death') this.deathUntil = from + DEATH_SECONDS;
    else {
      this.contacts = [];
      this.deathUntil = -Infinity;
    }
  }

  /** The game seconds for `realDt` real seconds. */
  step(realDt: number, paused: boolean): number {
    if (paused || !(realDt > 0)) return 0;
    const real = realDt * this.speed;
    const before = this.time;
    if (before >= this.resistFrom && before < this.resistFrom + DEATH_RESIST_LENGTH) {
      this.time = advanceDeathResistClock(before, real, this.resistFrom);
      return this.time - before;
    }
    let g = (this.contacts.length > 0 ? advanceLaunchClock(before, real, this.contacts) : before + real) - before;
    if (before < this.deathUntil) {
      const slow = (this.deathUntil - before) / DEATH_DILATION;
      g = g <= slow ? g * DEATH_DILATION : this.deathUntil - before + (g - slow);
    }
    const after = before + g;
    this.time = after;
    // contacts older than the track can be forgotten
    if (this.contacts.length > 8) this.contacts = this.contacts.slice(-8);
    return after - before;
  }
}

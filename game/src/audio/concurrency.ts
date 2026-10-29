import { GROUPS, type GroupName } from './cues.ts';

/**
 * UE sound concurrency, per SoundConcurrency asset (all sounds that use one asset share its group):
 * - RetriggerTime: a start less than this after the group's last start is rejected;
 * - MaxCount with UE's default resolution rule StopFarthestThenOldest: when the group is full, the farthest
 *   playing voice (the oldest on a tie) is stopped if it is at least as far from the listener as the new one;
 *   otherwise the new one is rejected.
 * Times are seconds on the audio clock (the hit-stop does not slow audio); distances are uu.
 */

export interface VoiceRecord {
  readonly id: number;
  readonly group: GroupName;
  readonly start: number;
  /** OnFinished: the voice frees its slot here. */
  readonly end: number;
}

/** Clock jitter allowed on RetriggerTime (frame times summed in floating point: 0.6 − 0.4 < 0.2). */
const EPSILON = 1e-6;

export type Admission = { readonly ok: true; readonly evict: VoiceRecord | null } | { readonly ok: false; readonly reason: 'retrigger' | 'voices' };

export class Concurrency {
  private voices: VoiceRecord[] = [];
  private readonly lastStart = new Map<GroupName, number>();

  /** Voices still holding a slot at `now`. */
  active(now: number, group?: GroupName): VoiceRecord[] {
    this.voices = this.voices.filter(v => v.end > now);
    return group ? this.voices.filter(v => v.group === group) : this.voices.slice();
  }

  /**
   * Decides whether a new voice in `group` may start at `now`, `distance` uu from the listener; `distanceOf`
   * gives a playing voice's current distance.
   */
  admit(group: GroupName, now: number, distance: number, distanceOf: (v: VoiceRecord) => number): Admission {
    const spec = GROUPS[group];
    const last = this.lastStart.get(group);
    if (spec.retrigger > 0 && last !== undefined && now - last < spec.retrigger - EPSILON) return { ok: false, reason: 'retrigger' };
    const playing = this.active(now, group);
    if (playing.length < spec.maxCount) return { ok: true, evict: null };
    let evict: VoiceRecord | null = null;
    let far = -Infinity;
    for (const v of playing) {
      const d = distanceOf(v);
      if (d > far || (d === far && evict !== null && v.start < evict.start)) {
        far = d;
        evict = v;
      }
    }
    return evict && far >= distance ? { ok: true, evict } : { ok: false, reason: 'voices' };
  }

  /** Records an admitted voice (and frees the evicted one). */
  start(voice: VoiceRecord, evict: VoiceRecord | null): void {
    if (evict) this.voices = this.voices.filter(v => v.id !== evict.id);
    this.voices.push(voice);
    this.lastStart.set(voice.group, voice.start);
  }
}

import { evalRichCurve, type RichKey } from '../../core/launch/curves.ts';

/**
 * The Demo's UI motion, reproduced without frame-rate dependence beyond what UE itself has.
 */

/**
 * 函数库_工具.浮点滑动 (UE FInterpTo with snap): moves `current` toward `target` by
 * `(target - current) * clamp(dt * speed, 0, 1)` and snaps once closer than 0.001. Every HUD bar
 * (HP, DoT, armour, stamina, corruption) uses speed 2.0 (UI_背包栏_3d Get_*_Percent).
 */
export function interpTo(current: number, target: number, dt: number, speed: number): number {
  if (Math.abs(current - target) < 0.001 || speed <= 0) return target;
  return current + (target - current) * Math.min(1, Math.max(0, dt * speed));
}

/** Bar fill speed of every side-panel bar (UI_背包栏_3d: 浮点滑动(…, 2.0)). */
export const BAR_SPEED = 2;

/** Every widget animation the HUD plays is keyed in ticks of 1/60000 s (MovieScene TickResolution). */
export const TICKS_PER_SECOND = 60000;

/**
 * One key of a widget animation channel (FMovieSceneFloatChannel), verbatim from
 * D:/TAPTAPGAME_ref/dump/widgets: [tick, value, interp of the segment it starts, arrive and leave tangents in value
 * per tick, then the tangent weight mode and weights only for a weighted key].
 */
export type ChannelKey = readonly [
  tick: number,
  value: number,
  interp: RichKey['interp'],
  arrive: number,
  leave: number,
  weight?: Exclude<RichKey['weightMode'], 'none'>,
  arriveWeight?: number,
  leaveWeight?: number,
];

/** One key of a 曲线表 row (FRichCurve, cubic, unweighted): [time, value, arrive, leave], tangents per second. */
export type TableKey = readonly [time: number, value: number, arrive: number, leave: number];

/**
 * A UE curve: cubic Béziers from the stored tangents (control points value ± tangent × Δt / 3, or the weighted
 * handles), linear and constant segments, constant outside the keys. Evaluated by the launch core's FRichCurve
 * port (src/core/launch/curves.ts); a channel is the same curve with its ticks and per-tick tangents in seconds.
 */
export class Curve {
  private constructor(readonly keys: readonly RichKey[]) {
    if (keys.length === 0) throw new Error('Curve: no keys');
  }

  /** A widget animation channel (ticks → seconds, tangents per tick → per second). */
  static channel(keys: readonly ChannelKey[]): Curve {
    return new Curve(
      keys.map(([tick, value, interp, arrive, leave, weight, arriveWeight, leaveWeight]) => ({
        time: tick / TICKS_PER_SECOND,
        value,
        interp,
        arriveTangent: arrive * TICKS_PER_SECOND,
        leaveTangent: leave * TICKS_PER_SECOND,
        arriveTangentWeight: arriveWeight ?? 0,
        leaveTangentWeight: leaveWeight ?? 0,
        weightMode: weight ?? 'none',
      })),
    );
  }

  /** A 曲线表 row. */
  static table(keys: readonly TableKey[]): Curve {
    return new Curve(
      keys.map(([time, value, arrive, leave]) => ({
        time,
        value,
        interp: 'cubic',
        arriveTangent: arrive,
        leaveTangent: leave,
        arriveTangentWeight: 0,
        leaveTangentWeight: 0,
        weightMode: 'none',
      })),
    );
  }

  at(t: number): number {
    return evalRichCurve(this.keys, t);
  }
}

/**
 * A UMG widget animation: its channels (with the dumped keys) and its playback range in ticks ([from, to), the
 * dump's playback_range). PlayAnimation starts at `from`; after `to` the widget keeps the last state (KeepState).
 */
export interface WidgetAnim<C extends string> {
  readonly from: number;
  readonly to: number;
  readonly keys: Readonly<Record<C, readonly ChannelKey[]>>;
  readonly channels: Readonly<Record<C, Curve>>;
}

export function widgetAnim<C extends string>(from: number, to: number, keys: Record<C, readonly ChannelKey[]>): WidgetAnim<C> {
  const channels = Object.fromEntries(Object.entries<readonly ChannelKey[]>(keys).map(([name, k]) => [name, Curve.channel(k)])) as Record<C, Curve>;
  return { from, to, keys, channels };
}

/** Seconds from PlayAnimation to the end of the playback range. */
export function animLength(a: WidgetAnim<string>): number {
  return (a.to - 1 - a.from) / TICKS_PER_SECOND;
}

/** Channel `c` of `a`, `elapsed` seconds after PlayAnimation (held at the range's last tick afterwards). */
export function sample<C extends string>(a: WidgetAnim<C>, c: C, elapsed: number): number {
  const t = Math.min(a.from + Math.max(0, elapsed) * TICKS_PER_SECOND, a.to - 1);
  return a.channels[c].at(t / TICKS_PER_SECOND);
}

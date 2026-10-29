import { demoClasses } from '../content/demo/classes';
import { evalRichCurve, type RichKey } from '../core/launch/curves';

/** Original 抵抗致死 时间轴.时间变速, not the generic death slowdown.
 * Timeline age is game time. Integrate dt_real=dt_game/dilation and invert the same monotone table so frame size
 * does not change the recovery curve. Simpson integration at0.1ms game intervals is a numerical adapter;
 * it is not a claim of bit-identical UE tick timing. Constant tail at1 keeps the source's lack of Finished reset.
 */
const source = demoClasses['CatapultHero/BP/Skill/效果/物品/蓝图_效果_抵抗致死'].timelines.时间轴;
const keys: readonly RichKey[] = source.tracks.时间变速.Keys.map(k => ({
  time: k.Time, value: k.Value, interp: 'cubic', arriveTangent: k.ArriveTangent, leaveTangent: k.LeaveTangent,
  arriveTangentWeight: k.ArriveTangentWeight, leaveTangentWeight: k.LeaveTangentWeight, weightMode: 'none',
}));
export const DEATH_RESIST_LENGTH = source.length;
export const deathResistDilation = (age: number): number => evalRichCurve(keys, age);
const end = keys.at(-1)!.time;
const count = Math.round(end / 0.0001);
const game = Array.from({ length: count + 1 }, (_, i) => i * end / count);
const real = [0];
for (let i = 1; i <= count; i++) {
  const a = game[i - 1]!, b = game[i]!;
  real.push(real[i - 1]! + (b - a) / 6 * (1 / deathResistDilation(a) + 4 / deathResistDilation((a + b) / 2) + 1 / deathResistDilation(b)));
}
const interpolate = (x: number, xs: readonly number[], ys: readonly number[]): number => {
  if (x <= 0) return 0;
  if (x >= xs.at(-1)!) return ys.at(-1)! + x - xs.at(-1)!;
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (xs[mid]! <= x) lo = mid; else hi = mid; }
  return ys[lo]! + (x - xs[lo]!) / (xs[hi]! - xs[lo]!) * (ys[hi]! - ys[lo]!);
};
export function advanceDeathResistClock(time: number, realDt: number, from: number): number {
  const age = Math.max(0, time - from);
  const elapsed = interpolate(age, game, real);
  return from + interpolate(elapsed + realDt, real, game);
}

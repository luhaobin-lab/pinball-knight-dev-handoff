import type { CueHandler } from '../cues';

/**
 * Placeholder cues by Demo asset name: the launch feel's shakes (摄像机晃动_*), hits and deaths (粒子_Hit_*,
 * 粒子_Blood_*, 粒子_Death*) and the matching sounds. The feel branches replace these with their own handlers.
 */
const handlers: readonly CueHandler[] = [
  { kind: 'shake', match: a => /会心|暴击|crit/i.test(a), play: (_e, t) => t.shake('crit') },
  { kind: 'shake', match: a => /零点二|伤害|damage/i.test(a), play: (_e, t) => t.shake('damage') },
  { kind: 'shake', match: a => /摄像机晃动/.test(a), play: (_e, t) => t.shake('bounce') },
  {
    kind: 'vfx',
    match: a => /Hit|Blood|Death|死亡/i.test(a),
    play: (e, t) => {
      const at = t.place(e);
      if (at) t.spark(at);
    },
  },
  { kind: 'sound', match: a => /Hit|击中|受伤/i.test(a), play: (e, t) => t.sound('hit', t.place(e)) },
  { kind: 'sound', match: a => /Death|死亡/i.test(a), play: (e, t) => t.sound('death', t.place(e)) },
  { kind: 'sound', match: a => /Swing|挥/i.test(a), play: (e, t) => t.sound('swing', t.place(e)) },
  { kind: 'sound', match: a => /Bounce|反弹|弹/i.test(a), play: (e, t) => t.sound('bump', t.place(e)) },
];
export default handlers;

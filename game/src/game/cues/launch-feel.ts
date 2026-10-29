import type { CueHandler } from '../cues';

/** Restore the already-approved feel lanes in the ordinary route (spec/launch-feel + src/audio/cues.ts).
 * Exact source assets beat the legacy generic-placeholder regex. The source lifecycle starts the ribbon itself.
 */
const handlers: readonly CueHandler[] = [
  { kind: 'vfx', priority: 100, match: a => a.endsWith('/粒子_轨迹'), play() {} },
  { kind: 'vfx', priority: 100, match: a => a.endsWith('/粒子_Hit_01'), play: (e, t) => { const p = t.place(e); if (p) t.spark(p); } },
  { kind: 'vfx', priority: 100, match: a => a.endsWith('/粒子_Blood_01'), play: (e, t) => {
    const p = t.place(e); if (p) t.spores?.(p, t.normal?.(e) ?? { x: 0, z: 0 });
  } },
  { kind: 'vfx', priority: 100, match: a => a.endsWith('/粒子_Blood_02'), play: (e, t) => { const p = t.place(e); if (p) t.deathSplat?.(p); } },
  // launch.start owns the release sound, so the source ability's same whoosh must not double-play it.
  { kind: 'sound', priority: 100, match: a => a.endsWith('/音效_基础_启动弹射'), play() {} },
  { kind: 'sound', priority: 100, match: a => a.endsWith('/音效_基础_普通撞'), play: (e, t) => t.sound('bump', t.place(e)) },
  { kind: 'sound', priority: 100, match: a => a.endsWith('/音效_基础_砍中肉'), play: (e, t) => t.sound('hit', t.place(e)) },
  { kind: 'sound', priority: 100, match: a => a.endsWith('/音效_基础_挥剑'), play: (e, t) => t.sound('swing', t.place(e)) },
  { kind: 'sound', priority: 100, match: a => a.endsWith('/音效_基础_血浆01'), play: (e, t) => t.sound('death', t.place(e)) },
  { kind: 'sound', priority: 100, match: a => a.endsWith('/音效_基础_充能完毕'), play: (e, t) => t.sound('charge', t.place(e)) },
  { kind: 'sound', priority: 100, match: a => /(?:^|\/)音效_基础_格挡$/.test(a), play: (e, t) => t.sound('block', t.place(e)) },
  { kind: 'sound', priority: 100, match: a => /(?:^|\/)音效_基础_飞箭$/.test(a), play: (e, t) => t.sound('arrow', t.place(e)) },
  { kind: 'shake', priority: 100, match: a => a.includes('摄像机晃动_零点二:750'), play: (_e, t) => t.shake('crit') },
];
export default handlers;

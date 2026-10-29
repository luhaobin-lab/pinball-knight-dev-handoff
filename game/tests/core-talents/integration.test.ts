import { describe, expect, it } from 'vitest';
import { ability } from '../../src/core/sys/ability/index.ts';
import { kernel } from '../../src/core/sys/kernel/index.ts';
import { talentWorld } from './fixture.ts';

// The same flows on the merged runtime (wa/ability): the real ability and kernel modules, doubles for turn and rewards.
describe('on the real ability / kernel modules', () => {
  it('TF-TV-08: two level-ups, two picks, both learned, then 新回合后', () => {
    const t = talentWorld({ systems: { ability, kernel } });
    const m = t.w.mode;
    m.升级点 = 2;
    m.退出回合开始(null);
    for (let k = 0; k < 2; k++) {
      t.w.clock.runUntil(() => t.w.modal.current !== null, 10);
      expect(t.w.modal.current?.kind).toBe('multiChoice');
      t.w.modal.answer({ type: 'modal.pick', option: 0 });
      t.w.clock.advance(0.25);
    }
    expect(m.升级点).toBe(0);
    expect(t.turnLog).toEqual(['退出回合开始', '加入回合开始', '退出回合开始', '加入回合开始', '退出回合开始', '新回合后']);
    expect(m.已获取天赋数).toBeGreaterThanOrEqual(2);
    expect(t.hero.拥有的被动能力.filter(a => a?.是天赋).length).toBeGreaterThanOrEqual(1);
    expect(t.hero.拥有的效果.some(e => e?.def.name === '蓝图_效果_升级获取天赋')).toBe(false);
  });
});

/**
 * COMBAT-TV (spec-drafts/combat-statuses.md §14) for the status effect classes this card ports, on the local test world
 * (lifecycle double of 蓝图_效果 until wa/ability). Vectors that test the damage pipeline (失去生命/护甲, 受到即时伤害,
 * 格挡处理 / 闪避处理 / 免疫处理, DoT, heals) are core-damage's and listed at the end with their owner.
 */
import { describe, expect, it } from 'vitest';
import batch from '../../src/content/bp/batches/core-status-rating.ts';
import { 蓝图_效果_免疫抵消伤害时 } from '../../src/content/bp/Skill/效果/蓝图_效果_免疫抵消伤害时.ts';
import { 蓝图_效果_免疫状态 } from '../../src/content/bp/Skill/效果/蓝图_效果_免疫状态.ts';
import { 蓝图_效果_免疫状态_转阶 } from '../../src/content/bp/Skill/效果/蓝图_效果_免疫状态_转阶.ts';
import { 蓝图_效果_易伤 } from '../../src/content/bp/Skill/效果/蓝图_效果_易伤.ts';
import { 蓝图_效果_格挡 } from '../../src/content/bp/Skill/效果/蓝图_效果_格挡.ts';
import { 蓝图_效果_眩晕 } from '../../src/content/bp/Skill/效果/蓝图_效果_眩晕.ts';
import { 蓝图_效果_闪避 } from '../../src/content/bp/Skill/效果/蓝图_效果_闪避.ts';
import { demoClasses } from '../../src/content/demo/classes.ts';
import { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sciOf, 科学数变普通, 科学数零 } from '../../src/core/math/sci.ts';
import { 添加科学映射值, 获取科学映射词条 } from '../../src/core/math/stats.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { apply, enemy, floorEnd, hero, roundStart, testWorld, type TestWorld } from './world.ts';

const skill = (w: TestWorld, 唯一ID: string): 蓝图_能力 => {
  const s = new 蓝图_能力(w, demoClasses[蓝图_能力.path]!);
  s.唯一ID = 唯一ID;
  return s;
};
/** The instant-damage factor of 受到即时伤害 step 8: (1 − 伤害减免%) with the 乘算 rule (COMBAT-056/059). */
const takenFactor = (a: BP_ManeActor): number => 1 - 科学数变普通(获取科学映射词条(a.词条, '伤害减免%').输出值);

describe('registry (batch core-status-rating)', () => {
  it('registers the 7 classes, each with its manifest path, parent 蓝图_效果 and no own tags', () => {
    expect(batch.map(c => c.path.split('/').pop())).toEqual(['蓝图_效果_格挡', '蓝图_效果_闪避', '蓝图_效果_易伤', '蓝图_效果_眩晕', '蓝图_效果_免疫状态', '蓝图_效果_免疫状态_转阶', '蓝图_效果_免疫抵消伤害时']);
    for (const c of batch) {
      expect(demoClasses[c.path]?.parent).toBe('CatapultHero/BP/Skill/蓝图_效果');
      expect(Object.getOwnPropertyNames(c)).not.toContain('tags');
    }
  });
});

describe('Vulnerable 易伤 (COMBAT-059…063)', () => {
  it('TV-21: 3 stacks write −0.3 into 伤害减免% → 130 % damage taken', () => {
    const w = testWorld();
    const e = enemy(w);
    apply(w, 蓝图_效果_易伤, e, { 叠加层数: 3, 来自技能: skill(w, 'A') });
    expect(科学数变普通(获取科学映射词条(e.词条, '伤害减免%').输出值)).toBeCloseTo(-0.3, 12);
    expect(100 * takenFactor(e)).toBeCloseTo(130, 9);
  });
  it('TV-22: combines multiplicatively with other reduction sources (强韧 0.05 → 123.5)', () => {
    const w = testWorld();
    const e = enemy(w);
    添加科学映射值(e.词条, '伤害减免%', '强韧', sciOf(0.05, 0), false);
    apply(w, 蓝图_效果_易伤, e, { 叠加层数: 3, 来自技能: skill(w, 'A') });
    expect(100 * takenFactor(e)).toBeCloseTo(123.5, 9);
  });
  it('TV-23: instances of two source skills multiply (1.2 × 1.3 → 156)', () => {
    const w = testWorld();
    const e = enemy(w);
    apply(w, 蓝图_效果_易伤, e, { 叠加层数: 2, 来自技能: skill(w, 'A') });
    apply(w, 蓝图_效果_易伤, e, { 叠加层数: 3, 来自技能: skill(w, 'B') });
    expect(100 * takenFactor(e)).toBeCloseTo(156, 9);
  });
  it('TV-24: a re-activation with 5 stacks replaces the source value (−0.5, ×1.5)', () => {
    const w = testWorld();
    const e = enemy(w);
    const v = apply(w, 蓝图_效果_易伤, e, { 叠加层数: 3, 来自技能: skill(w, '淬毒利刃') });
    v.叠加层数 = 5; // 附加效果前处理's Clamp(3 + 2, 1, 1000) (core-ability), then 激活效果 again
    v.激活效果('');
    expect(科学数变普通(e.词条.get('伤害减免%')!.来源映射.get('淬毒利刃')!)).toBeCloseTo(-0.5, 12);
    expect(takenFactor(e)).toBeCloseTo(1.5, 12);
  });
  it('uses the victim\'s 易伤倍率% (COMBAT-062) and sets 销毁延迟 1.0', () => {
    const w = testWorld();
    const h = hero(w);
    添加科学映射值(h.词条, '易伤倍率%', '腐蚀精炼', sciOf(-0.1, 0), false); // 加算: 0.1 − 0.1
    const v = apply(w, 蓝图_效果_易伤, h, { 叠加层数: 4, 来自技能: skill(w, 'X') });
    expect(takenFactor(h)).toBeCloseTo(1, 12);
    expect(v.销毁延迟).toBe(1.0);
  });
  it('TV-25 (status part): destruction removes the source, 伤害减免% back to 0; no turn decay', () => {
    const w = testWorld();
    const e = enemy(w);
    const v = apply(w, 蓝图_效果_易伤, e, { 持续回合: -1, 叠加层数: 3, 来自技能: skill(w, 'A') });
    roundStart(e); // 易伤 has no 新一天时 tag
    expect(v.valid).toBe(true);
    v.销毁效果();
    expect(takenFactor(e)).toBe(1);
    expect(e.词条.get('伤害减免%')!.来源映射.has('A')).toBe(false);
  });
  it('is a 减益 and shows 粒子_虚弱 once', () => {
    const w = testWorld();
    const e = enemy(w);
    const v = apply(w, 蓝图_效果_易伤, e, { 来自技能: skill(w, 'A') });
    v.激活效果('');
    expect(v.HasMatchingGameplayTag('效果.类型.减益')).toBe(true);
    expect(w.events.filter(x => x.kind === 'vfx').map(x => x.args[0])).toEqual(['粒子_虚弱']);
  });
});

describe('Immunity 免疫状态 (COMBAT-046…054)', () => {
  it('adds 状态.免疫 on activation, removes it before destruction, sets 销毁延迟 0.5', () => {
    const w = testWorld();
    const h = hero(w);
    const im = apply(w, 蓝图_效果_免疫状态, h, { 持续回合: 1 });
    expect(h.HasMatchingGameplayTag('状态.免疫')).toBe(true);
    expect(im.销毁延迟).toBe(0.5);
    expect(w.events.map(e => [e.kind, e.args[0]])).toEqual([['vfx', 'Mat_FX_免疫'], ['sound', 'MAGIC_SPELL_Shield_mono']]);
    im.销毁效果();
    expect(h.HasMatchingGameplayTag('状态.免疫')).toBe(false);
  });
  it('无特效？ hides the sphere', () => {
    const w = testWorld();
    const h = hero(w);
    const im = new 蓝图_效果_免疫状态(w, demoClasses[蓝图_效果_免疫状态.path]!);
    im.拥有者 = h;
    im.无特效 = true;
    im.激活效果('');
    expect(w.events.map(e => e.kind)).toEqual(['sound']);
  });
  it('TV-19: 持续回合 0 / 1 / 5 / −1 → removed at 新一天时 N+1 / N+2 / N+6 / only at 结束层时', () => {
    for (const [k, gone] of [[0, 1], [1, 2], [5, 6], [-1, Infinity]] as const) {
      const w = testWorld();
      const h = hero(w);
      const im = apply(w, 蓝图_效果_免疫状态, h, { 持续回合: k });
      let starts = 0;
      while (im.valid && starts < 10) { roundStart(h); starts++; }
      if (gone === Infinity) {
        expect(im.valid).toBe(true);
        floorEnd(h);
        expect(im.valid).toBe(false);
      } else {
        expect(starts).toBe(gone);
      }
      expect(h.HasMatchingGameplayTag('状态.免疫')).toBe(false);
    }
  });
  it('the tag is not refcounted: destroying one of two grants removes it for both (COMBAT-046)', () => {
    const w = testWorld();
    const h = hero(w);
    const a = apply(w, 蓝图_效果_免疫状态, h, { 持续回合: 0 });
    const b = apply(w, 蓝图_效果_免疫状态, h, { 持续回合: 5 });
    roundStart(h);
    expect(a.valid).toBe(false);
    expect(b.valid).toBe(true);
    expect(h.HasMatchingGameplayTag('状态.免疫')).toBe(false);
  });
  it('TV-17 (status part): 免疫抵消伤害时 shows "免疫" at the hit point and destroys itself', () => {
    const w = testWorld();
    const h = hero(w);
    h.当前受伤数据 = make伤害({ 伤害数值: sciOf(5, 1), 击中点位置: { x: 1, y: 2, z: 3 } });
    const fx = apply(w, 蓝图_效果_免疫抵消伤害时, h);
    expect(w.events.filter(e => e.kind === 'popup').map(e => e.args[0])).toEqual([{ popup: 'text', value: '免疫', target: null, at: { x: 1, y: 2, z: 3 }, damageType: h.当前受伤数据.伤害类型 }]);
    expect(fx.valid).toBe(false);
    expect(h.拥有的效果).not.toContain(fx);
    expect(h.被击特效A).toBe(null);
  });
});

describe('免疫状态_转阶 (COMBAT-052)', () => {
  it('purges debuffs, adds 状态.僵直 + 状态.免疫; 新一天时 keeps it, 结束层时 destroys it and undoes both', () => {
    const calls: string[] = [];
    const w = testWorld({ damage: { BP_ManeActor: { 移除减益效果: self => { calls.push(`移除减益效果:${self.id}`); } } } });
    const boss = enemy(w, '守门人');
    const t = apply(w, 蓝图_效果_免疫状态_转阶, boss);
    expect(calls).toEqual([`移除减益效果:${boss.id}`]);
    expect(boss.HasMatchingGameplayTag('状态.僵直') && boss.HasMatchingGameplayTag('状态.免疫')).toBe(true);
    roundStart(boss);
    expect(t.valid).toBe(true);
    floorEnd(boss);
    expect(t.valid).toBe(false);
    expect(boss.HasMatchingGameplayTag('状态.僵直') || boss.HasMatchingGameplayTag('状态.免疫')).toBe(false);
  });
});

describe('Stun 眩晕 (COMBAT-064…066)', () => {
  it('TV-39: activation interrupts and re-checks skills; 持续回合 1 survives N+1 and is gone at N+2', () => {
    const calls: string[] = [];
    const w = testWorld({
      turn: { BP_ManeActor: { 打断当前动画: (_s, 中断技能) => { calls.push(`打断当前动画:${中断技能}`); } } },
      ai: { BP_ManeActor: { 检查技能条件: () => { calls.push('检查技能条件'); } } },
    });
    const e = enemy(w);
    const s = apply(w, 蓝图_效果_眩晕, e, { 持续回合: 1 });
    expect(calls).toEqual(['打断当前动画:true', '检查技能条件']);
    expect(s.剩余回合).toBe(2);
    expect(s.HasMatchingGameplayTag('状态.僵直') && s.HasMatchingGameplayTag('效果.类型.减益')).toBe(true);
    roundStart(e); // N+1
    expect(s.valid).toBe(true);
    expect(s.剩余回合).toBe(1);
    roundStart(e); // N+2
    expect(s.valid).toBe(false);
  });
  it('a re-application (re-activation) resets 剩余回合 to 2 (COMBAT-066)', () => {
    const w = testWorld();
    const e = enemy(w);
    const s = apply(w, 蓝图_效果_眩晕, e, { 持续回合: 1 });
    roundStart(e);
    s.激活效果('');
    expect(s.剩余回合).toBe(2);
    expect(w.events.filter(x => x.kind === 'vfx').length).toBe(2);
  });
});

describe('Block / Dodge feedback effects (COMBAT-032 step 9, COMBAT-039/040)', () => {
  it('蓝图_效果_格挡 plays the block sound and destroys itself', () => {
    const w = testWorld();
    const h = hero(w);
    const b = apply(w, 蓝图_效果_格挡, h);
    expect(w.events.map(e => [e.kind, e.args[0]])).toEqual([['sound', '音效_基础_格挡']]);
    expect(b.valid).toBe(false);
  });
  it('TV-14 (status part): a Perfect Dodge (damage exactly 0) logs and shows "完美闪避"', () => {
    const logs: string[] = [];
    const w = testWorld({
      damage: {
        函数库_战斗日志: {
          日志__获取角色名: () => ({ Output: { zh: '甲虫', en: 'Beetle' } }),
          日志__获取能力名: () => ({ Output: { zh: '酸液', en: 'Acid' } }),
          日志__输出: (_c, t) => { logs.push(t.zh); return null; },
        },
      },
    });
    const h = hero(w);
    h.当前受伤数据 = make伤害({ 伤害数值: 科学数零 });
    const d = apply(w, 蓝图_效果_闪避, h);
    expect(logs).toEqual(['<强调>甲虫</>完美闪避了来自<技能>“酸液”</>的伤害。']);
    expect(w.events.filter(e => e.kind === 'popup').map(e => (e.args[0] as { value: string }).value)).toEqual(['完美闪避']);
    expect(w.events.find(e => e.kind === 'sound')!.args[2]).toEqual({ volume: 1.3, pitch: 1.0 });
    expect(d.valid).toBe(false);
  });
  it('an ordinary dodge (damage left) only plays the sound', () => {
    const w = testWorld();
    const h = hero(w);
    h.当前受伤数据 = make伤害({ 伤害数值: sciOf(1, 1) });
    apply(w, 蓝图_效果_闪避, h);
    expect(w.events.map(e => e.kind)).toEqual(['sound']);
  });
});

describe('vectors owned by other modules', () => {
  // Cross-module acceptance now lives in tests/game-g2/status-rating-integration.test.ts:
  // S241 TV01–05; S242 TV06/07; S243 TV08–11/13–16; S244 TV12; S245 TV14/17; S248 TV25; S249 TV40.
  // S246 proves TV18/26–36 in that file and TV38's actual HUD projection in tests/game-g2/dot-hud.test.ts.
  // The selective-cleanse class serves 解毒剂 / 绷带A, assigned to Wave B bp-items-5 (WAVE_B:112), outside G2.
  it.todo('S246 TV37 selective poison cleanse (Wave B bp-items-5: 解毒剂 / 绷带A)');
  it.todo('TV-20 绝命 抵抗致死 (蓝图_效果_抵抗致死: wave-B bp-items / bp-hero-knight)');
  it.todo('TV-41 爆裂火星 燃烧效能 (wave-B bp-talents)');
  it.todo('TV-42 DoT save / reload (core-run save v0)');
});

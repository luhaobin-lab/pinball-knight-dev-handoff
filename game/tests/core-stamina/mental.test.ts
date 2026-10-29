/**
 * Mental-state vectors: SCM-TV-21, 22, 26, 27, 32, 33, 40, 42 (Pain, Luck, Flowstate, save/reload of the grant), the
 * Block / Dodge mirrors (combat-statuses COMBAT-031/033/036), 迷茫 and 临时属性（精神）.
 */
import { describe, expect, it } from 'vitest';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sciOf, 科学数变普通, type 科学数 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条 } from '../../src/core/math/stats.ts';
import { 记录英雄百分比, 恢复英雄百分比 } from '../../src/core/sys/stamina/index.ts';
import type { 结构_技能 } from '../../src/content/demo/types.ts';
import { harness, P, type Harness } from './harness.ts';

const stat = (_h: Harness, m: Map<string, { 计算类型: '加算' | '乘算'; 来源映射: Map<string, 科学数> }>, name: string): number =>
  科学数变普通(获取科学映射词条(m, name).输出值);
const hp = (h: Harness): number => 科学数变普通(h.hero.当前最大生命);

function hit(h: Harness, dmg: number, armour: number, type: '物理' | '流血'): void {
  h.hero.当前受伤数值 = sciOf(dmg);
  h.hero.当前护甲值 = sciOf(armour);
  h.passive.伤害数据 = make伤害({ 伤害类型: type });
  h.passive.触发时机 = '效果.时机.受到伤害后';
  h.passive.持续中触发('效果.时机.受到伤害后');
}

/** Spawn a struct-granted effect on the hero the way the grantors do (spawn, AddUnique, attach, 激活效果). */
function give(h: Harness, path: string, init: (e: 蓝图_效果) => void): 蓝图_效果 {
  const e = h.w.spawn<蓝图_效果>(path, x => { x.拥有者 = h.hero; x.释放者 = h.hero; init(x); });
  h.hero.拥有的效果.push(e);
  e.K2_AttachToActor(h.hero);
  e.激活效果('');
  return e;
}

describe('SCM-TV-21 / 22 / 42: Pain', () => {
  it('TV-21: a 10-turn state gained in turn T fires 11 turn starts and dies in the 11th cleanup', () => {
    const h = harness();
    h.grant('疼痛');
    const e = h.find(P.疼痛)!;
    expect(e.剩余回合).toBe(11);
    const seen: number[] = [];
    for (let i = 1; i <= 11; i++) {
      h.turnStart();
      if (i < 11) seen.push(e.剩余回合);
    }
    expect(seen).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(h.find(P.疼痛)).toBeUndefined();
  });

  it('TV-22: the ratio, the stacks and max HP', () => {
    const r: boolean[] = [];
    for (const [d, a, t] of [[50, 0, '物理'], [45, 0, '物理'], [44, 0, '物理'], [45, 30, '流血']] as const) {
      const h = harness();
      hit(h, d, a, t);
      r.push(h.find(P.疼痛) !== undefined);
    }
    expect(r).toEqual([true, true, false, true]);
    const h = harness();
    // Max HP comes from the kernel's 更新最大生命魔力 (core-ability); this card owns the source 额外生命%[uid] = {stacks × p0, 0}.
    const want = [135, 120, 104.99999999999999, 90, 75];
    for (let n = 1; n <= 5; n++) {
      h.grant('疼痛');
      const uid = h.find(P.疼痛)!.来自技能!.唯一ID;
      expect(h.hero.词条.get('额外生命%')!.来源映射.get(uid)).toEqual({ 系数: n * -0.1, 指数: 0 });
      expect(hp(h)).toBe(want[n - 1]);
    }
    h.turnStart();
    h.grant('疼痛'); // the 6th: stacks stay 5, 剩余回合 back to 持续回合 + 1
    const e = h.find(P.疼痛)!;
    expect([e.叠加层数, e.剩余回合]).toEqual([5, 11]);
    expect(h.hero.拥有的效果.filter(x => x?.def.path === P.疼痛)).toHaveLength(1);
    h.hero.当前生命 = sciOf(70);
    e.销毁效果();
    expect(hp(h)).toBe(150);
    expect(h.hero.当前生命).toEqual(sciOf(70)); // not refilled
  });

  it('TV-42: a refresh after a reload restores only the saved remaining turns', () => {
    const a = harness();
    a.grant('疼痛');
    for (let i = 0; i < 4; i++) a.turnStart();
    expect(a.find(P.疼痛)!.剩余回合).toBe(7);
    a.grant('疼痛');
    expect([a.find(P.疼痛)!.叠加层数, a.find(P.疼痛)!.剩余回合, hp(a)]).toEqual([2, 11, 120]);

    const b = harness();
    b.hero.精神存档.set('疼痛', { 能力实例: null, 唯一ID: '疼痛//精神状态', 能力等级: 1, 能力品质: 1, 剩余回合: 6, 叠加层数: 1 });
    b.hero.获得精神状态('疼痛', true);
    const e = b.find(P.疼痛)!;
    expect([e.持续回合, e.剩余回合, hp(b)]).toEqual([6, 7, 135]);
    hit(b, 50, 0, '物理');
    expect([e.叠加层数, e.剩余回合, hp(b)]).toEqual([2, 7, 120]);
  });
});

describe('SCM-TV-26: Luck', () => {
  it('one stack: 品质提升修正% {1, 0}; RandRange(0, 1) Essencite at a turn start', () => {
    const h = harness();
    h.grant('幸运');
    const e = h.find(P.幸运)!;
    expect(h.w.mode.全局词条.get('品质提升修正%')!.来源映射.get(e.来自技能!.唯一ID)).toEqual({ 系数: 1, 指数: 0 });
    h.scriptCombat(16383);
    h.turnStart();
    h.scriptCombat(16384);
    h.turnStart();
    expect(h.calls.gold).toEqual([{ 金币: false, v: 0 }, { 金币: false, v: 1 }]);
  });

  it('three stacks with 幸运增益% 0.5: n = 4, RandRange(2, 4); a 4th grant keeps 3 stacks', () => {
    const h = harness();
    h.w.mode.全局词条.get('幸运增益%')!.来源映射.set('x', sciOf(0.5));
    for (let i = 0; i < 4; i++) h.grant('幸运');
    const e = h.find(P.幸运)!;
    expect(e.叠加层数).toBe(3);
    expect(h.w.mode.全局词条.get('品质提升修正%')!.来源映射.get(e.来自技能!.唯一ID)).toEqual({ 系数: 4, 指数: 0 });
    for (const k of [10922, 10923, 21845]) { h.scriptCombat(k); h.turnStart(); }
    expect(h.calls.gold.map(g => g.v)).toEqual([2, 3, 4]);
    e.销毁效果();
    expect(h.w.mode.全局词条.get('品质提升修正%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
  });
});

describe('SCM-TV-27 / 40: Flowstate', () => {
  function setup(rem: number | null, stacks: number, slot: number): { h: Harness; skill: 蓝图_能力; cd: 蓝图_效果 | null; flow: 蓝图_效果 } {
    const h = harness();
    const launch = h.w.spawn<蓝图_能力>(P.能力);
    const skill = h.w.spawn<蓝图_能力>(P.能力);
    h.hero.拥有的主动能力 = [launch, skill];
    const cd = rem === null ? null : h.w.spawn<蓝图_效果>(P.效果, x => { x.持续回合 = rem - 1; x.剩余回合 = rem; });
    skill.冷却效果 = cd;
    launch.冷却效果 = cd;
    h.hero.当前能力 = slot === 0 ? launch : skill;
    const flow = give(h, P.光阴, e => { e.叠加层数 = stacks; });
    return { h, skill, cd, flow };
  }
  const cast = (flow: 蓝图_效果): void => { flow.触发时机 = '效果.时机.释放技能后'; flow.持续中触发('效果.时机.释放技能后'); };

  it('TV-27: stacks ≤ remaining turns cut the cooldown and end Flowstate; more stacks destroy the cooldown', () => {
    const a = setup(4, 3, 1);
    cast(a.flow);
    expect(a.cd!.剩余回合).toBe(1); // 技能减少冷却(3): three 持续效果 ticks
    expect(a.h.w.isValid(a.cd)).toBe(true);
    expect(a.h.w.isValid(a.flow)).toBe(false);

    const b = setup(2, 5, 1);
    cast(b.flow);
    expect(b.flow.叠加层数).toBe(3);
    expect(b.h.w.isValid(b.cd)).toBe(false);
    expect(b.h.w.isValid(b.flow)).toBe(true);

    const c = setup(4, 3, 0);
    cast(c.flow);
    expect([c.flow.叠加层数, c.cd!.剩余回合]).toEqual([3, 4]);

    const d = setup(4, 3, 1);
    d.flow.触发时机 = '效果.时机.结束层时';
    d.flow.持续中触发('效果.时机.结束层时');
    expect(d.h.w.isValid(d.flow)).toBe(false);
  });

  it('TV-40: a skill without 冷却效果 reads 0 remaining turns; Flowstate is unchanged', () => {
    const { h, flow } = setup(null, 3, 1);
    h.events();
    cast(flow);
    expect(flow.叠加层数).toBe(3);
    expect(h.w.isValid(flow)).toBe(true);
    expect(h.events('ui').some(e => e.kind === 'ui' && e.widget === 'UI_增减益格' && e.op === 'update')).toBe(true); // L740 refresh
  });
});

describe('SCM-TV-32 / 33: the save entry and the snapshot', () => {
  it('TV-32 (a): phase 8/9 snapshot 0.6 reloads as {5.999999999999999, 1}; the saved states re-create', () => {
    const a = harness();
    a.hero.魔力百分比 = 0.6;
    a.w.mode.当前环节 = '创建房间';
    expect(记录英雄百分比(a.hero)).toBe(true);
    expect(a.w.mode.英雄魔力百分比保存).toBe(0.6);

    const b = harness(); // the reloaded run: entries as 保存精神状态 wrote them (剩余回合 − 1), no live ability
    b.w.mode.英雄魔力百分比保存 = a.w.mode.英雄魔力百分比保存;
    const save = b.hero.精神存档;
    save.set('饱腹', { 能力实例: null, 唯一ID: '饱腹//精神状态', 能力等级: 1, 能力品质: 1, 剩余回合: 29, 叠加层数: 1 });
    save.set('疼痛', { 能力实例: null, 唯一ID: '疼痛//精神状态', 能力等级: 1, 能力品质: 1, 剩余回合: 6, 叠加层数: 2 });
    save.set('饥饿', { 能力实例: null, 唯一ID: '饥饿//精神状态', 能力等级: 1, 能力品质: 1, 剩余回合: 0, 叠加层数: 0 });
    for (const k of [...save.keys()]) b.hero.获得精神状态(k, true);
    const full = b.find(P.饥饱) as 蓝图_效果 & { 溢出的体力: 科学数 };
    expect(full.来自技能!.能力名).toBe('饱腹');
    expect([full.持续回合, full.剩余回合, full.溢出的体力]).toEqual([29, 30, { 系数: 0, 指数: 0 }]);
    expect(stat(b, b.hero.词条, '弹射距离')).toBe(550);
    const pain = b.find(P.疼痛)!;
    expect([pain.叠加层数, pain.剩余回合]).toEqual([2, 7]);
    expect(b.hero.拥有的效果.filter(e => e?.def.path === P.饥饱)).toHaveLength(1); // 饥饿 not re-created
    恢复英雄百分比(b.hero);
    expect(b.hero.魔力百分比).toBe(0.6);
    expect(b.hero.当前魔力).toEqual({ 系数: 5.999999999999999, 指数: 1 });
  });

  it('TV-32 (b) / TV-33: outside phases 8/9 the snapshot is not taken; the reload refunds the room', () => {
    const h = harness({ 当前魔力: { 系数: 8.499999999999998, 指数: 1 } });
    h.w.mode.英雄魔力百分比保存 = 1.0;
    h.w.mode.当前环节 = '进行战斗';
    expect(记录英雄百分比(h.hero)).toBe(false);
    expect(h.w.mode.英雄魔力百分比保存).toBe(1.0);
    恢复英雄百分比(h.hero);
    expect(h.hero.当前魔力).toEqual({ 系数: 1, 指数: 2 });
    expect(h.hero.魔力百分比).toBe(1.0);
  });

  it('a fresh grant writes the save entry; the destroy writes the zero entry and calls 保存精神状态', () => {
    const h = harness();
    h.grant('疼痛');
    const entry = h.hero.精神存档.get('疼痛') as unknown as { 能力实例: unknown; 唯一ID: string; 剩余回合: number; 叠加层数: number };
    expect(entry).toMatchObject({ 唯一ID: '疼痛//精神状态', 剩余回合: 10, 叠加层数: 1 });
    expect(h.w.isValid(entry.能力实例)).toBe(true);
    h.find(P.疼痛)!.销毁效果();
    expect(h.hero.精神存档.get('疼痛')).toEqual({ 能力实例: null, 唯一ID: '疼痛//精神状态', 能力等级: 1, 能力品质: 1, 剩余回合: 0, 叠加层数: 0 });
    expect(h.calls.saves).toBe(2); // 销毁前触发 and again from ReceiveDestroyed (SCM-076)
    h.grant('疼痛'); // the old entry (None, uid kept) spawns a new ability with the saved 唯一ID
    expect(h.find(P.疼痛)!.来自技能!.唯一ID).toBe('疼痛//精神状态');
  });
});

describe('Block and Dodge mirrors (精神状态_格挡 / _闪避)', () => {
  it('activation syncs the counter; each 格挡后 removes one stack; 0 destroys and zeroes', () => {
    const h = harness();
    h.hero.词条.set('格挡层上限', { 计算类型: '加算', 来源映射: new Map([['', sciOf(1, 1)]]) });
    h.hero.词条.set('格挡减伤%', { 计算类型: '加算', 来源映射: new Map([['', sciOf(0.15)]]) });
    const b = give(h, P.格挡, e => { e.叠加层数 = 2; });
    expect(h.hero.格挡层计数).toBe(2);
    h.hero.格挡层计数 = 0; // 格挡处理 spent both stacks of a 2-hit packet
    b.持续中触发('效果.时机.格挡后');
    expect([b.叠加层数, h.w.isValid(b)]).toEqual([1, true]);
    b.持续中触发('效果.时机.格挡后');
    expect(h.w.isValid(b)).toBe(false);
    expect(h.hero.格挡层计数).toBe(0);
    const d = give(h, P.闪避, e => { e.叠加层数 = 3; });
    expect(h.hero.闪避层计数).toBe(3);
    d.持续中触发('效果.时机.结束层时');
    expect([h.w.isValid(d), h.hero.闪避层计数]).toEqual([false, 0]);
  });

  it('without a cell (a non-hero owner) the stack reaches 0 and the effect stays (COMBAT-033)', () => {
    const h = harness();
    h.hero.OwnedGameplayTags.remove('可交互.角色.玩家');
    const d = give(h, P.闪避, e => { e.叠加层数 = 1; });
    d.持续中触发('效果.时机.闪避后');
    expect([d.叠加层数, h.w.isValid(d)]).toEqual([0, true]);
  });
});

describe('迷茫, 临时属性（精神）, the 获得精神状态 ability', () => {
  it('迷茫 can be granted directly (no Demo grant path) and refreshes the map tiles', () => {
    const h = harness();
    h.events();
    h.grant('迷茫');
    expect(h.find(P.迷茫)).toBeDefined();
    const ui = h.events('ui').map(e => (e.kind === 'ui' ? `${e.op}:${e.widget}` : ''));
    expect(ui).toContain('update:UI_地图格.更新地图格数据');
    expect(ui).toContain('update:区域判断.负面全屏警告');
    expect(ui).toContain('open:UI_增减益格');
  });

  it('临时属性（精神） from 节肢: +50 弹射距离 while present; a re-use replaces it (能力.时机.主动.覆盖)', () => {
    const h = harness();
    const row = h.w.data.table('CatapultHero/数据表/技能/数据表_技能_修炼物品')!.rows['节肢'] as 结构_技能;
    const a = h.w.spawn<蓝图_能力>(P.获得精神状态, x => { x.拥有者 = h.hero; x.能力名 = '节肢'; x.唯一ID = 'card/节肢'; });
    a.技能配置 = row;
    a.初始化();
    a.执行技能(false);
    expect(stat(h, h.hero.词条, '弹射距离')).toBe(550);
    const first = h.find(P.临时属性)!;
    expect(first.临时).toBe(false); // the CDO says 临时？ = true, but the spawn writes 临时？ = false (AG L2568)
    expect(h.w.spawn<蓝图_效果>(P.临时属性).临时).toBe(true);
    a.执行技能(false);
    expect(h.w.isValid(first)).toBe(false);
    expect(h.hero.拥有的效果.filter(e => e?.def.path === P.临时属性)).toHaveLength(1);
    expect(stat(h, h.hero.词条, '弹射距离')).toBe(550);
    h.find(P.临时属性)!.销毁效果();
    expect(stat(h, h.hero.词条, '弹射距离')).toBe(500);
  });

  it('精神系统 is an empty stub', () => {
    const h = harness();
    expect(() => h.hero.精神系统(1, 2, 'x', true)).not.toThrow();
  });

  it('a dead hero gets no new mental effect', () => {
    const h = harness();
    h.hero.死掉了 = true;
    h.grant('疼痛');
    expect(h.find(P.疼痛)).toBeUndefined();
  });
});

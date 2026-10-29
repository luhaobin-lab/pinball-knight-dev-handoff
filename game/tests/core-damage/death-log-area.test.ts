/** DMG-TV-41…48, 51…56 (draft damage-crit-weakspot §12): area primitives, log lines, kill resolution. */
import { describe, expect, it, vi } from 'vitest';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci } from '../../src/core/math/sci.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import type { HitResult } from '../../src/core/sim/types.ts';
import { abbreviate, harness, hitResult, n, type Harness } from './harness.ts';


const logs = (h: Harness): string[] => h.w.events.drain().filter(e => e.kind === 'log').map(e => (e as { rich: string }).rich);
/** Fixed sphere-trace results (the planar trace of core-sim needs room geometry). */
function fixTrace(h: Harness, hits: () => BP_ManeActor[]): void {
  (h.w as unknown as { trace: { sphere(): HitResult[]; line(): null } }).trace = { sphere: () => hits().map(a => hitResult(a, a.当前位置)), line: () => null };
}
const X = 'CatapultHero/BP/Skill/效果/';

describe('爆炸 / 闪电链 / 对周围敌人造成伤害 (DAMAGE-100…104)', () => {
  for (const [type, expectFn] of [['爆炸', '造成即时伤害'], ['中毒', '造成持续伤害'], ['物理', null]] as const) {
    it(`DMG-TV-41 序号 2 resolves at 0.3 s, type ${type}`, () => {
      const h = harness();
      const p = h.hero();
      const e1 = h.enemy({}, 100);
      const e2 = h.enemy({}, 100);
      fixTrace(h, () => [e1, e2, p]);
      const spy = vi.spyOn(p, expectFn ?? '造成即时伤害');
      const spyDot = vi.spyOn(p, '造成持续伤害');
      const boom = h.w.spawn(`${X}蓝图_效果_爆炸`, (x: never) => {
        Object.assign(x, { 拥有者: e1, 释放者: p, 序号: 2, 伤害数据: make伤害({ 伤害来源: '装备', 伤害类型: type, 伤害数值: sci(12) }) });
      }) as unknown as { 激活后触发(d: string): void };
      boom.激活后触发('');
      h.advance(0.29);
      expect(spy).toHaveBeenCalledTimes(0);
      h.advance(0.02);
      if (expectFn) expect(spy).toHaveBeenCalledTimes(2);
      else { expect(spy).toHaveBeenCalledTimes(0); expect(spyDot).toHaveBeenCalledTimes(0); }
    });
  }

  it('DMG-TV-42 a chain of 2 gives 3 explosions at 0, 0.2, 0.4 s', () => {
    const h = harness();
    const p = h.hero();
    const e1 = h.enemy({}, 1000);
    fixTrace(h, () => [e1]);
    const times: number[] = [];
    vi.spyOn(p, '造成即时伤害').mockImplementation(() => { times.push(Math.round(h.w.clock.now * 100) / 100); });
    const boom = h.w.spawn(`${X}蓝图_效果_爆炸`, (x: never) => {
      Object.assign(x, { 拥有者: e1, 释放者: p, 连锁爆炸: true, 连锁次数: 2, 伤害数据: make伤害({ 伤害来源: '装备', 伤害类型: '爆炸', 伤害数值: sci(5) }) });
    }) as unknown as { 激活后触发(d: string): void };
    boom.激活后触发('');
    h.advance(1);
    expect(times.length).toBe(3);
    expect(times[1] - times[0]).toBeCloseTo(0.2, 1);
    expect(times[2] - times[1]).toBeCloseTo(0.2, 1);
  });

  it('DMG-TV-43 three hops at 0.1 s each, type 电击, value kept', () => {
    const h = harness();
    const c = h.hero();
    const targets = [h.enemy({}, 100), h.enemy({}, 100), h.enemy({}, 100)];
    let k = 0;
    fixTrace(h, () => [targets[Math.min(k, 2)]]);
    const hits: { t: number; type: string; v: number }[] = [];
    vi.spyOn(c, '造成即时伤害').mockImplementation(d => { hits.push({ t: Math.round(h.w.clock.now * 100) / 100, type: d.伤害类型, v: n(d.伤害数值) }); k++; });
    const chain = h.w.spawn(`${X}蓝图_效果_闪电链`, (x: never) => {
      Object.assign(x, { 拥有者: c, 跳跃次数: 3, 伤害数据: make伤害({ 伤害来源: '装备', 伤害数值: sci(8), 触发次数: 1, 来自角色: c }) });
    }) as unknown as { 激活后触发(d: string): void };
    chain.激活后触发('');
    h.advance(1);
    expect(hits.map(x => x.type)).toEqual(['电击', '电击', '电击']);
    expect(hits.map(x => x.v)).toEqual([8, 8, 8]);
    expect(hits[1].t - hits[0].t).toBeCloseTo(0.1, 1);
    expect(targets[1].拥有的效果.some(e => e?.def.name === '蓝图_效果_闪电链')).toBe(true);
  });

  it('DMG-TV-44 对周围敌人造成伤害: instant hits force 触发次数 1, DoT keeps it; 指定特效 true', () => {
    for (const [type, fn, count] of [['物理', '造成即时伤害', 1], ['流血', '造成持续伤害', 3]] as const) {
      const h = harness();
      const r = h.hero();
      const owner = h.card();
      const s = h.skill(owner);
      const es = [h.enemy({}, 100), h.enemy({}, 100)];
      fixTrace(h, () => es);
      const spy = vi.spyOn(owner, fn).mockImplementation(() => {});
      h.w.sys.damage.函数库_技能!.对周围敌人造成伤害!(r, r, s, '装备', type, 150, sci(10), 3, 0);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls.map(c => [c[0].触发次数, c[1], c[0].来自角色])).toEqual([[count, true, owner], [count, true, owner]]);
    }
  });
});

describe('combat log (DAMAGE-005, DAMAGE-125…133)', () => {
  it('DMG-TV-45 科学数字缩写(v, 2) (the text-module double used here)', () => {
    const vs = [2.5, 3.5, 7.5, 37.5, 147, 999, 1000, 1234.5, 12345, 123456, 2000, 2000000, 64000000, 10000000000, 1500000000000000, 0.5];
    expect(vs.map(v => abbreviate(sci(v), 2))).toEqual(['2', '4', '8', '38', '147', '999', '1k', '1.23k', '12.3k', '123k', '2k', '2M', '64M', '10B', '1500T', '0']);
  });

  it('DMG-TV-46 merged record shows first + latest hit', () => {
    const h = harness();
    h.hero();
    const y = h.enemy({}, 1000);
    y.描述 = [{ zh: 'Y', en: 'Y' }];
    const x = h.card();
    x.描述 = [{ zh: 'X', en: 'X' }];
    for (const v of [10, 20, 30]) {
      y.当前受伤数据 = make伤害({ 伤害来源: '装备', 伤害类型: '物理', 来自角色: x });
      y.当前受伤数值 = sci(v);
      y.输出受伤日志();
    }
    const ev = h.w.events.drain();
    expect(ev.filter(e => e.kind === 'log').map(e => (e as { rich: string }).rich)).toEqual(['<强调>X</>对<强调>Y</>造成了<即时伤害>10</>伤害。']);
    const ups = ev.filter(e => e.kind === 'ui').map(e => ((e as { data: { rich: string } }).data.rich));
    expect(ups).toEqual(['<强调>X</>对<强调>Y</>造成了<即时伤害>30</>伤害。', '<强调>X</>对<强调>Y</>造成了<即时伤害>40</>伤害。']);
  });

  it('DMG-TV-47 the three templates', () => {
    const h = harness();
    const knight = h.hero();
    const eye = h.enemy();
    const s1 = h.skill(knight, '回旋斩');
    eye.当前受伤数据 = make伤害({ 伤害来源: '攻击', 伤害类型: '物理', 来自角色: knight, 来自技能: s1 });
    eye.当前受伤数值 = sci(30);
    eye.输出受伤日志();
    const z = h.skill(eye, 'Z');
    knight.当前受伤数据 = make伤害({ 伤害来源: '攻击', 伤害类型: '物理', 来自角色: eye, 来自技能: z, 断开骨骼名: '格挡' });
    knight.当前受伤数值 = sci(12);
    knight.输出受伤日志();
    knight.当前受伤数据 = make伤害({ 伤害来源: '环境', 伤害类型: '物理', 来自角色: null, 断开骨骼名: '地刺' });
    knight.当前受伤数值 = sci(5);
    knight.输出受伤日志();
    expect(logs(h)).toEqual([
      '<技能>“回旋斩”</>对<强调>眼球</>造成了<即时伤害>30</>伤害。',
      '<技能>“Z”</>对<强调>幽冥骑士</>造成了<玩家伤害>12</>伤害。（格挡）',
      '<强调>地刺</>对<强调>幽冥骑士</>造成了<玩家伤害>5</>伤害。',
    ]);
  });

  it('DMG-TV-48 a DoT application shows the type; source 减益 does not', () => {
    const h = harness();
    const x = h.card();
    for (const src of ['攻击', '减益'] as const) {
      const e = h.enemy();
      e.当前受伤数据 = make伤害({ 伤害来源: src, 伤害类型: '流血', 来自角色: x });
      e.当前受伤数值 = sci(9);
      e.输出受伤日志();
    }
    expect(logs(h)).toEqual(['<强调>旧剑</>对<强调>眼球</>造成了<持续伤害>9流血</>伤害。', '<强调>旧剑</>对<强调>眼球</>造成了<即时伤害>9</>伤害。']);
  });
});

describe('kill resolution (DAMAGE-110…118)', () => {
  it('DMG-TV-51 EXP 经验 × U(0.8, 1.2) and the death line', () => {
    const h = harness();
    h.hero();
    const eye = h.enemy({ '经验': 50 });
    eye.角色死亡();
    const exp = h.named('增加经验')[0].args[0] as number;
    expect(exp).toBeGreaterThanOrEqual(40);
    expect(exp).toBeLessThanOrEqual(60);
    expect(eye.死亡产生经验).toBe(exp);
    expect(logs(h)).toEqual([`<强调>眼球</>死掉了。（<经验>+${Math.round(exp)}经验</>）`]);
  });

  it('DMG-TV-52 mental change on kill: elite / boss', () => {
    const out: unknown[] = [];
    for (const [elite, boss] of [[false, false], [true, false], [true, true], [false, true]]) {
      const h = harness();
      h.hero();
      const e = h.enemy({}, 30, boss ? ['可交互.角色.AI.仇恨.首领'] : ['可交互.角色.AI.仇恨']);
      e.是精英 = elite;
      e.角色死亡();
      out.push(h.named('精神系统')[0].args.slice(0, 2));
    }
    expect(out).toEqual([[-5, 10], [-10, 20], [-25, 50], [-5, 10]]);
  });

  it('DMG-TV-53 有物理 enemies: EXP but no 击杀敌人 stat and no 精神系统', () => {
    const h = harness();
    h.hero();
    const box = h.enemy({ '经验': 0 }, 30, ['可交互.角色.AI.仇恨', '可交互.角色.AI.有物理']);
    box.角色死亡();
    expect(h.named('增加经验')).toHaveLength(1);
    expect(h.named('精神系统')).toHaveLength(0);
    expect(h.named('更新回合战斗统计').filter(c => c.args[0] === '击杀敌人')).toHaveLength(0);
    const h2 = harness();
    h2.hero();
    h2.enemy().角色死亡();
    expect(h2.named('更新回合战斗统计').filter(c => c.args[0] === '击杀敌人').map(c => c.args.slice(2, 5))).toEqual([[65, 2, '速降衰减']]);
  });

  it('DMG-TV-54 camera shake by source and crit', () => {
    const out: (string | null)[] = [];
    for (const [src, crit] of [['攻击', true], ['投射物', false], ['主动', true]] as const) {
      const h = harness();
      const k = h.hero();
      const t = h.enemy({}, 100);
      t.受到即时伤害(make伤害({ 伤害来源: src, 伤害类型: '物理', 伤害数值: sci(5), 是暴击: crit, 来自角色: k, 目标角色: t }), true, false);
      const s = h.w.events.drain().find(e => e.kind === 'shake') as { asset: string } | undefined;
      out.push(s ? s.asset : null);
    }
    expect(out).toEqual(['摄像机晃动_零点二:750', '摄像机晃动_零点二:550', null]);
  });

  it('DMG-TV-55 SPEC-GAP: one popup per hit (the Demo merges per victim and skill)', () => {
    const h = harness();
    const k = h.hero();
    const t = h.enemy({}, 1000);
    const s1 = h.skill(k, 'S1');
    const s2 = h.skill(k, 'S2');
    for (const [s, v] of [[s1, 10], [s1, 20], [s2, 5]] as const) {
      t.受到即时伤害(make伤害({ 伤害来源: '主动', 伤害类型: '物理', 伤害数值: sci(v), 来自角色: k, 来自技能: s, 目标角色: t }), true, true);
    }
    expect(h.w.events.drain().filter(e => e.kind === 'popup').map(e => (e as { value: number }).value)).toEqual([10, 20, 5]);
  });

  it('DMG-TV-56 the kill order', () => {
    const h = harness();
    const hero = h.hero();
    const k = hero;
    const v = h.enemy({}, 5);
    const card = h.card();
    h.w.cult.已装备牌.push(card);
    const order: string[] = [];
    let deadDuringKill: boolean | null = null;
    h.probe(v, ['效果.时机.死亡前'], () => order.push('V.死亡前'));
    const dot = h.probe(v, ['效果.类型.减益']);
    h.w.sys.turn.蓝图_动作游戏模式!.有角色死亡时 = (_m, a) => { order.push('有角色死亡时'); if (a) a.当前受伤数据.来自角色?.杀死敌人时(a); };
    h.probe(k, ['效果.时机.击杀敌人时'], () => { order.push('K 击杀敌人时'); deadDuringKill = v.死掉了; });
    h.probe(k, ['效果.时机.造成伤害后'], () => order.push('K 造成伤害后'));
    h.w.sys.rewards.BP_ManeActor!.触发掉落 = () => { order.push('触发掉落'); };
    const fns = h.w.sys.damage.BP_Actor_Other as { 角色死亡: (a: never) => void };
    const orig = fns.角色死亡;
    fns.角色死亡 = (a: never) => { order.push('角色死亡'); orig(a); };
    k.造成即时伤害(make伤害({ 伤害来源: '攻击', 伤害类型: '物理', 伤害数值: sci(10), 来自角色: k, 目标角色: v }), false, false);
    expect(order).toEqual(['V.死亡前', '有角色死亡时', 'K 击杀敌人时', '角色死亡', '触发掉落', 'K 造成伤害后']);
    expect(dot.valid).toBe(false);
    expect(deadDuringKill).toBe(false);
    expect(k.当前杀死目标).toBe(v);
  });

  it('a 死亡前 effect that heals saves the actor', () => {
    const h = harness();
    h.hero();
    const v = h.enemy({}, 30);
    v.当前生命 = sci(-5);
    h.probe(v, ['效果.时机.死亡前'], () => { v.当前生命 = sci(1); });
    v.检查死亡(false, false);
    expect(v.死掉了).toBe(false);
    expect(h.named('有角色死亡时')).toHaveLength(0);
  });

  it('a card dies when its durability is 0 and leaves the bags', () => {
    const h = harness();
    h.hero();
    const c = h.card({ '生命': 0 });
    h.w.cult.已装备牌.push(c);
    c.检查死亡(false, false);
    expect(c.死掉了).toBe(true);
    expect(h.w.cult.已装备牌).toEqual([]);
    expect(h.named('有角色死亡时')).toHaveLength(1);
  });

  it('the player death spawns 死亡特效', () => {
    const h = harness();
    const p = h.hero();
    p.角色死亡();
    expect(p.死掉了).toBe(true);
    expect(p.拥有的效果.map(e => e?.def.name)).toEqual(['蓝图_效果_死亡特效']);
  });
});

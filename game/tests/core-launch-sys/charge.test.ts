/**
 * CHARGE-TV (draft charge-infuse-echocast §20) for the charge pipeline this card owns: 给装备的物品充能, the card's
 * 添加行动力, the base 添加行动力 and the completion (module turn's, through turn-double.ts), Infuse (蓝图_能力_灌注) and the charged-effect
 * families. Vectors whose subject belongs to another card are listed in the card result (UI, durability, wave-B items).
 */
import { describe, expect, it } from 'vitest';
import { fixture, spy, SpyEffect } from './helpers.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';
import { chargePerBounce, chargePopupNumber } from '../../src/core/sys/charge/index.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { sciOf, 科学数变普通 } from '../../src/core/math/sci.ts';
import type { BP_Actor_Card } from '../../src/core/sim/card.ts';
import type { 蓝图_效果_蓄能攻击时XX } from '../../src/content/bp/Skill/效果/蓝图_效果_蓄能攻击时XX.ts';
import { 蓝图_效果_蓄能碰撞XX时XX } from '../../src/content/bp/Skill/效果/蓝图_效果_蓄能碰撞XX时XX.ts';

const bounce = (w: ReturnType<typeof fixture>) => 函数库_技能.给装备的物品充能(w.hero, w.world.mode, '反弹', false, 1);
const popups = (w: ReturnType<typeof fixture>) => w.events('popup').map(p => `${p.popup}:${p.value}`);

describe('charge per bounce (CHARGE-020…027)', () => {
  it('CHARGE-TV-01: 旧剑 7 bounces, the completion on the 7th and its event order', () => {
    const log: string[] = [];
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }], log });
    const card = w.cards[0];
    spy(card, 'card', ['效果.时机.自身完成充能'], log);
    spy(w.hero, 'hero', ['效果.时机.有物品完成充能'], log);
    const after: number[] = [];
    for (let i = 0; i < 7; i++) { bounce(w); after.push(card.当前行动力); }
    expect(after).toEqual([15, 30, 45, 60, 75, 90, 5]);
    expect(popups(w)).toEqual(Array(7).fill('charge:15'));
    expect(w.world.cult.当前完成充能次数).toBe(1);
    expect(w.world.cult.当前完成充能的牌).toBe(card);
    expect(log.filter(l => !l.startsWith('更新回合'))).toEqual(['card 效果.时机.自身完成充能 1', 'hero 效果.时机.有物品完成充能 1', '更新角色战斗统计 旧剑 完成充能 1']);
    // the card's own 蓄能造成额外伤害 (造成普伤: p0 = 基础伤害 20, p1 = 3) got its three slots
    const slots = (w.effect('旧剑', '蓝图_效果_蓄能造成额外伤害') as 蓝图_效果_蓄能攻击时XX).待触发充能值.map(科学数变普通);
    expect(slots).toEqual([20, 20, 20]);
    const kinds = w.events().map(e => e.kind === 'sound' ? `sound:${e.asset?.split('/').pop()}` : e.kind).filter(k => k === 'actor.flash' || k.startsWith('sound:'));
    expect(kinds).toEqual(['sound:音效_基础_充能完毕', 'actor.flash']);
  });

  it('CHARGE-TV-02/03/05: Δ = 行动力 × (1 + 加速冷却%) in IEEE double, popup round half up', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }] });
    const card = w.cards[0];
    card.行动力 = 14;
    添加科学映射值(card.词条, '加速冷却%', 'aura', sciOf(0.15, 0), false);
    expect(chargePerBounce(card)).toBe(16.099999999999998);
    const after: number[] = [];
    for (let i = 0; i < 8; i++) { bounce(w); after.push(card.当前行动力); }
    expect(after).toEqual([16.099999999999998, 32.199999999999996, 48.3, 64.39999999999999, 80.49999999999999, 96.59999999999998, 12.699999999999974, 28.799999999999972]);
    expect(new Set(popups(w))).toEqual(new Set(['charge:16']));
    expect(chargePopupNumber(20 * (0.15 + 1.0))).toBe(23);
    expect(chargePopupNumber(12 * (0.1 + 1.0))).toBe(13);
    expect(chargePopupNumber(15 * (0.1 + 1.0))).toBe(17); // TV-04: 16.5 → 17
  });

  it('CHARGE-TV-06: the 反弹中 gate (疲劳 ≤ 最大疲劳, 进行战斗) and 场上有敌人; 反弹时 always fires', () => {
    const cases = [
      { name: 'no enemies', enemies: false, phase: '进行战斗', 疲劳: 0, expect: 30 },
      { name: 'phase 2', enemies: true, phase: '交互场牌', 疲劳: 0, expect: 30 },
      { name: 'tired', enemies: true, phase: '进行战斗', 疲劳: 5, expect: 30 },
      { name: 'at limit', enemies: true, phase: '进行战斗', 疲劳: 4, expect: 45 },
    ] as const;
    for (const c of cases) {
      const log: string[] = [];
      const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }], log });
      const card = w.cards[0];
      card.当前行动力 = 30;
      w.world.mode.场上有敌人 = c.enemies;
      w.world.mode.当前环节 = c.phase;
      w.hero.疲劳 = c.疲劳;
      spy(w.hero, 'spy', ['效果.时机.反弹时'], log);
      const e = w.world.spawn<SpyEffect>('CatapultHero/BP/Skill/效果/蓝图_效果_反弹中', x => { x.拥有者 = w.hero; x.释放者 = w.hero; x.持续时长 = 0.2; });
      w.hero.拥有的效果.push(e);
      e.激活效果('');
      expect(card.当前行动力, c.name).toBe(c.expect);
      expect(log.includes('spy 效果.时机.反弹时 1'), c.name).toBe(true);
      expect(log.filter(l => l.startsWith('更新回合战斗统计 反弹')).length, c.name).toBe(1);
    }
  });

  it('CHARGE-TV-07: a card without 有充能 is never charged by bounces', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧手套' }] });
    for (let i = 0; i < 10; i++) bounce(w);
    expect(w.cards[0].当前行动力).toBe(0);
    expect(popups(w)).toEqual([]);
  });

  it('CHARGE-TV-08: a 僵直 card gets nothing; afterwards the popup shows, the add is refused and the stored value completes', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }] });
    const card = w.cards[0];
    card.当前行动力 = 120;
    const stiff = spy(card, 'stiff', ['状态.僵直'], []);
    bounce(w);
    expect(card.当前行动力).toBe(120);
    expect(popups(w)).toEqual([]);
    card.拥有的效果.splice(card.拥有的效果.indexOf(stiff), 1);
    bounce(w);
    expect(popups(w)).toEqual(['charge:15']);
    expect(card.当前行动力).toBe(20);
    expect(w.world.cult.当前完成充能次数).toBe(1);
  });

  it('CHARGE-TV-09: one combat draw per attribute-path add that reaches L1238, none otherwise', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }] });
    const card = w.cards[0];
    const rng = w.world.rng.combat;
    const draws = (f: () => void): number => { const s = rng.state; f(); return rng.state === s ? 0 : 1; };
    card.当前行动力 = 30;
    expect(draws(() => card.添加行动力(false, 1, 1, false, false))).toBe(1);
    expect(card.当前行动力).toBe(45);
    card.行动力 = 0;
    expect(draws(() => card.添加行动力(false, 1, 1, false, false))).toBe(0);
    card.行动力 = 15; card.当前行动力 = 120;
    expect(draws(() => card.添加行动力(false, 1, 1, false, false))).toBe(0);
    card.当前行动力 = 0;
    expect(draws(() => card.添加行动力(true, 10, 1, true, false))).toBe(0);
    expect(popups(w)).toEqual(['charge:15', 'charge:0', 'charge:15', 'infuse:10']);
  });

  it('CHARGE-TV-15: cards resolve one after the other in 已装备牌 order, before 反弹时', () => {
    const log: string[] = [];
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }, { row: '旧剑' }], log });
    const [a, b] = w.cards;
    a.名字 = 'A'; b.名字 = 'B';
    a.当前行动力 = 90; b.当前行动力 = 90;
    spy(a, 'A', ['效果.时机.自身完成充能'], log);
    spy(b, 'B', ['效果.时机.自身完成充能'], log);
    spy(w.hero, 'hero', ['效果.时机.有物品完成充能', '效果.时机.反弹时'], log);
    const e = w.world.spawn<SpyEffect>('CatapultHero/BP/Skill/效果/蓝图_效果_反弹中', x => { x.拥有者 = w.hero; x.释放者 = w.hero; x.持续时长 = 0.2; });
    w.hero.拥有的效果.push(e);
    e.激活效果('');
    expect(log).toEqual([
      'A 效果.时机.自身完成充能 1', 'hero 效果.时机.有物品完成充能 1', '更新角色战斗统计 A 完成充能 1',
      'B 效果.时机.自身完成充能 1', 'hero 效果.时机.有物品完成充能 1', '更新角色战斗统计 B 完成充能 1',
      '更新回合战斗统计 反弹 1', '更新轮回战斗统计 反弹 1', 'hero 效果.时机.反弹时 1',
    ]);
    expect([a.当前行动力, b.当前行动力]).toEqual([5, 5]);
  });

  it('CHARGE-TV-19 (QUIRK): a card leaving 已装备牌 during its completion makes the loop skip the next card', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }, { row: '旧剑' }, { row: '旧剑' }] });
    const [a, b, c] = w.cards;
    a.当前行动力 = 95;
    const s = spy(a, 'A', ['效果.时机.自身完成充能'], []);
    s.onFire = () => { const l = w.world.cult.已装备牌; l.splice(l.indexOf(a), 1); };
    bounce(w);
    expect([a.当前行动力, b.当前行动力, c.当前行动力]).toEqual([10, 0, 15]);
  });

  it('CHARGE-TV-35: a fixed add (电塔, true, 50) is not an Infuse: teal popup, 判断行动力 completes it', () => {
    const log: string[] = [];
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }, { row: '旧手套' }], log });
    const [sword, glove] = w.cards;
    sword.当前行动力 = 60;
    spy(sword, 'sword', ['效果.时机.被灌注时'], log);
    函数库_技能.给装备的物品充能(w.hero, w.world.mode, '电塔', true, 50);
    expect(popups(w)).toEqual(['charge:50']);
    expect(sword.当前行动力).toBe(10);
    expect(glove.当前行动力).toBe(0);
    expect(log.some(l => l.includes('被灌注时'))).toBe(false);
  });
});

describe('Infuse (CHARGE-050…058)', () => {
  it('CHARGE-TV-10: Infuse 200 → q 2, r 0, one event with 触发次数 2', () => {
    const log: string[] = [];
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }], log });
    const card = w.cards[0];
    spy(card, 'inf', ['效果.时机.被灌注时'], log);
    spy(card, 'self', ['效果.时机.自身完成充能'], log);
    spy(w.hero, 'any', ['效果.时机.有物品完成充能'], log);
    card.添加行动力(true, 200, 1, true, false);
    expect(popups(w)).toEqual(['infuse:200']);
    expect(card.上次被灌注值).toBe(200);
    expect(card.当前行动力).toBe(0);
    expect(log).toEqual(['inf 效果.时机.被灌注时 1', 'self 效果.时机.自身完成充能 2', 'any 效果.时机.有物品完成充能 2', '更新角色战斗统计 旧剑 完成充能 2']);
    const sounds = w.events('sound').map(s => s.asset?.split('/').pop());
    expect(sounds).toEqual(['音效_基础_灌注', '音效_基础_充能完毕']);
  });

  it('CHARGE-TV-11: 被灌注时 listeners see the new 当前行动力 before the completion', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }] });
    const card = w.cards[0];
    card.当前行动力 = 95;
    const seen: number[] = [];
    spy(card, 'inf', ['效果.时机.被灌注时'], []).onFire = () => seen.push(card.当前行动力);
    card.添加行动力(true, 50, 1, true, false);
    expect(seen).toEqual([145]);
    expect(card.当前行动力).toBe(45);
  });

  it('CHARGE-TV-12: 魔力药剂 (蓝图_能力_灌注) Infuses 50 × 等级 with trunc(连击), then ends after 0.5 s', () => {
    for (const [quality, amount, q, rest] of [[1, 50, 0, 50], [2, 100, 1, 0], [3, 200, 2, 0], [4, 400, 4, 0]] as const) {
      const w = fixture({
        enemies: ['眼球'], equip: [{ row: '旧剑' }, { row: '魔力药剂', quality }],
        extra: { ability: { 函数库_技能: { 技能条件筛选物品: ctx => ({ 筛选后: [ctx.world.cult.已装备牌[0] as BP_Actor_Card] }) } } },
      });
      const [sword, potion] = w.cards;
      const skill = potion.拥有的主动能力.find(a => a?.def.name === '蓝图_能力_灌注') ?? potion.拥有的被动能力.find(a => a?.def.name === '蓝图_能力_灌注');
      expect(skill, 'the potion owns 蓝图_能力_灌注').toBeTruthy();
      // 等级 = 2^(品质 − 1) (CORE-M-062) is set by the item's 升级此牌 (core-inventory); set here until it lands.
      skill!.等级 = 2 ** (quality - 1);
      let ended = 0;
      const real = skill!.释放结束.bind(skill);
      skill!.释放结束 = (x: boolean) => { ended++; real(x); };
      skill!.执行技能(false);
      expect(popups(w)).toEqual([`infuse:${amount}`]);
      expect(sword.当前行动力).toBe(rest);
      expect(w.world.cult.当前完成充能次数).toBe(q);
      expect(ended).toBe(0);
      w.advance(0.5);
      expect(ended).toBe(1);
    }
  });

  it('CHARGE-TV-17 (QUIRK): a nested completion overwrites the shared scratch the outer completion reads afterwards', () => {
    const log: string[] = [];
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }, { row: '旧剑' }, { row: '旧剑' }], log });
    const [a, b, c] = w.cards;
    a.名字 = 'A'; b.名字 = 'B'; c.名字 = 'C';
    b.当前行动力 = 95;
    // 雷霆溢能 stand-in: on 有物品完成充能 of A, Infuse B and C with 5 × 触发次数.
    const t = spy(w.hero, 'thunder', ['效果.时机.有物品完成充能'], log);
    t.onFire = e => { const n = e.触发次数; if (w.world.cult.当前完成充能的牌 === a) for (const x of [b, c]) x.添加行动力(true, 5, n, true, false); };
    const x = spy(w.hero, 'X', ['效果.时机.有物品完成充能'], []);
    const seen: string[] = [];
    x.onFire = e => seen.push(`${e.触发次数} ${w.world.cult.当前完成充能的牌?.名字}`);
    a.添加行动力(true, 200, 1, true, false);
    expect(c.当前行动力).toBe(10);
    expect(b.当前行动力).toBe(5);
    expect(seen).toEqual(['1 B', '1 B']); // B's own nested event, then A's outer event reading B's scratch
    expect(log.filter(l => l.startsWith('更新角色战斗统计'))).toEqual(['更新角色战斗统计 B 完成充能 1', '更新角色战斗统计 A 完成充能 1']);
  });
});

describe('charged-effect families (CHARGE-070…074)', () => {
  it('CHARGE-TV-24: 旧剑 slots [40,40,40] after q 2; an attack uses slot 0 and drops it; q 1 adds to the first three; 结束层时 clears', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }] });
    const e = w.effect('旧剑', '蓝图_效果_蓄能造成额外伤害') as 蓝图_效果_蓄能攻击时XX;
    const slots = () => e.待触发充能值.map(科学数变普通);
    e.触发次数 = 2;
    e.持续中触发('效果.时机.自身完成充能');
    expect(slots()).toEqual([40, 40, 40]);
    e.持续中触发('效果.时机.发动攻击后');
    expect(slots()).toEqual([40, 40]);
    e.触发次数 = 1;
    e.持续中触发('效果.时机.自身完成充能');
    expect(slots()).toEqual([60, 60, 20]);
    e.持续中触发('效果.时机.结束层时');
    expect(slots()).toEqual([]);
  });

  it('CHARGE-TV-18: a collision slot is consumed only on a matching contact (蓄能碰撞XX时XX)', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }] });
    const card = w.cards[0];
    const skill = card.拥有的被动能力[0] ?? card.拥有的主动能力[0];
    const fired: number[] = [];
    class Collide extends 蓝图_效果_蓄能碰撞XX时XX {
      static override readonly path = 'Test/core-launch-sys/Collide';
      override 额外子触发(v: { 系数: number; 指数: number }, n: number): void { fired.push(科学数变普通(v) * 100 + n); }
    }
    const e = w.world.spawn(Collide, x => { x.拥有者 = w.hero; x.来自技能 = skill; x.无延迟连击 = true; });
    skill!.目标标签.add('可交互.角色.AI.仇恨');
    e.待触发充能值 = [sciOf(5), sciOf(5), sciOf(5)];
    e.命中数据 = { ...e.命中数据, actor: null };
    e.持续中触发('效果.时机.反弹时'); // a wall: no match
    expect(e.待触发充能值.length).toBe(3);
    e.命中数据 = { ...e.命中数据, actor: w.enemies[0] };
    e.持续中触发('效果.时机.反弹时');
    expect(e.待触发充能值.map(科学数变普通)).toEqual([5, 5]);
    expect(fired.length).toBe(1);
  });
});

describe('Echocast through the charged families (CHARGE-061…063, runtime of core-ability / core-sim)', () => {
  function collider(w: ReturnType<typeof fixture>, instant: boolean, echo: number, fired: { t: number; v: number; n: number }[]) {
    const card = w.cards[0];
    添加科学映射值(card.词条, '连击', 'test', sciOf(echo - 1, 0), false);
    const skill = card.拥有的被动能力[0] ?? card.拥有的主动能力[0];
    class Collide extends 蓝图_效果_蓄能碰撞XX时XX {
      static override readonly path = 'Test/core-launch-sys/Collide2';
      override 额外子触发(v: { 系数: number; 指数: number }, n: number): void { fired.push({ t: w.world.clock.now, v: 科学数变普通(v), n }); }
    }
    const e = w.world.spawn(Collide, x => { x.拥有者 = w.hero; x.来自技能 = skill; x.无延迟连击 = instant; });
    e.待触发充能值 = [sciOf(12), sciOf(12)];
    return e;
  }

  it('CHARGE-TV-20: instant echo = one call with trunc(连击)', () => {
    for (const [c, n] of [[1, 1], [2, 2], [2.5, 2], [3, 3], [6, 6]] as const) {
      const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }] });
      const fired: { t: number; v: number; n: number }[] = [];
      collider(w, true, c, fired).持续中触发('效果.时机.反弹时');
      expect(fired.map(f => f.n), `连击 ${c}`).toEqual([n]);
    }
  });

  it('CHARGE-TV-21: delayed echo (连击 2) fires at t and t + 0.3 (the first synchronously)', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }] });
    const fired: { t: number; v: number; n: number }[] = [];
    const e = collider(w, false, 2, fired);
    const t0 = w.world.clock.now;
    e.持续中触发('效果.时机.反弹时');
    expect(e.待触发充能值.map(科学数变普通)).toEqual([12]);
    w.advance(1);
    expect(fired.map(f => f.n)).toEqual([1, 1]);
    expect(fired[0].t).toBeCloseTo(t0, 6);
    expect(fired[1].t - fired[0].t).toBeGreaterThanOrEqual(0.3 - 1e-9);
    expect(fired[1].t - fired[0].t).toBeLessThan(0.3 + 2 / 60);
  });
});

/**
 * The launch as a game action (WAVE_A A16): release → 可控挥击 → 可控反弹时交互 + 可控弹射 → legs at their game times →
 * contacts in the Demo order (launch-movement §9.2, LM-TV-21…26) → 结束行动; leg speeds (LM-TV-01…06); preview equals
 * playback; 旧剑 "next 3 attacks +20" end to end; the hunter's ranged contact choice (LM-TV-23/24).
 */
import { describe, expect, it } from 'vitest';
import { fixture, roomPlan, spy } from './helpers.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { LaunchTrajectoryLibrary } from '../../src/core/sys/launch/index.ts';
import { mainLegSpeed, terminalLegSpeed } from '../../src/core/launch/index.ts';
import { sciOf, 科学数变普通 } from '../../src/core/math/sci.ts';
import type { 伤害 } from '../../src/core/bp/structs.ts';
import type { SystemOverrides } from '../fixtures/index.ts';
import type { 蓝图_效果_蓄能攻击时XX } from '../../src/content/bp/Skill/效果/蓝图_效果_蓄能攻击时XX.ts';

const HERO_AT = { x: 288, y: 288, z: 56 };

function setup(o: { hero?: string; enemyAt?: { x: number; y: number }; equip?: { row: string }[]; log?: string[]; attack?: (ranged: boolean) => void } = {}) {
  const log = o.log ?? [];
  const hits: 伤害[] = [];
  const plan = roomPlan();
  const extra: SystemOverrides = {
    room: { view: () => ({ room: plan }) } as SystemOverrides['room'],
    damage: { BP_ManeActor: { 造成即时伤害: (self, d) => { hits.push(d); log.push(`damage ${self.名字} → ${d.目标角色?.名字} ${科学数变普通(d.伤害数值)}`); } } },
    ...(o.attack ? { launch: { BP_ManeActor: { 发动攻击: (_s, _a, _h, r) => o.attack!(r) } } } : {}),
  };
  const w = fixture({ hero: o.hero ?? '幽冥骑士', enemies: ['眼球'], equip: o.equip ?? [], log, extra });
  w.hero.K2_SetActorLocation(HERO_AT);
  const at = o.enemyAt ?? { x: 488, y: 288 };
  w.enemies[0].K2_SetActorLocation({ x: at.x, y: at.y, z: 40 });
  w.world.mode.敌方场上.push(w.enemies[0]);
  w.world.mode.当前环节 = '交互场牌';
  return { w, log, hits };
}

/** TURN-042/043: build the circles for the aim, check circle 0, cast skill 0. */
function release(w: ReturnType<typeof setup>['w'], aim: { x: number; y: number }) {
  const preview = LaunchTrajectoryLibrary.UpdateLaunchPreview(w.hero, aim)!;
  expect(LaunchTrajectoryLibrary.CanRelease(w.hero)).toBe(true);
  const r = 函数库_工具.使目标执行自身技能(w.hero, 0, w.hero, false);
  return { preview, released: r.完成释放 };
}

describe('the controlled launch', () => {
  it('a release plays the preview: contacts at the planned times and places, leg speeds 2000 + 300·疲劳, terminal 0.3 × last (LM-TV-05, preview = playback)', () => {
    const { w, log } = setup();
    const contactLog: { t: number; x: number; y: number; speed: number; fatigue: number }[] = [];
    const s = spy(w.hero, 'contact', ['效果.时机.主动激活.可控反弹'], []);
    s.onFire = () => { const p = w.hero.K2_GetActorLocation(); contactLog.push({ t: w.world.clock.now, x: p.x, y: p.y, speed: w.hero.移动当前速度, fatigue: w.hero.疲劳 }); };
    const { preview } = release(w, { x: 488, y: 288 });
    const planned = LaunchTrajectoryLibrary.ActiveLaunch(w.hero)!;
    expect(planned).not.toBeNull();
    expect(w.world.mode.当前环节).toBe('进行战斗');
    expect(w.hero.HasMatchingGameplayTag('状态.可控弹射')).toBe(true);
    w.runUntilInput(10);
    const pb = planned.playback;
    expect(pb.legs.length).toBe(preview.legs.length + 1);
    expect(contactLog.length).toBe(pb.contacts.length);
    contactLog.forEach((c, i) => {
      const leg = pb.legs[i];
      expect(c.t).toBeCloseTo(planned.startedAt + leg.end, 9);
      expect(c.x).toBeCloseTo(preview.legs[i].end.x, 6);
      expect(c.y).toBeCloseTo(preview.legs[i].end.y, 6);
      expect(c.speed).toBe(mainLegSpeed(i));
      expect(c.fatigue).toBe(i);
    });
    const end = w.hero.K2_GetActorLocation();
    expect(end.x).toBeCloseTo(preview.terminal!.end.x, 6);
    expect(end.y).toBeCloseTo(preview.terminal!.end.y, 6);
    expect(pb.legs[pb.legs.length - 1].speed).toBe(terminalLegSpeed(mainLegSpeed(preview.legs.length - 1)));
    expect(w.hero.疲劳).toBe(preview.legs.length);
    expect(w.hero.HasMatchingGameplayTag('状态.可控弹射')).toBe(false);
    expect(LaunchTrajectoryLibrary.ActiveLaunch(w.hero)).toBeNull();
    expect(log.some(l => l.startsWith('结束行动 幽冥骑士 可控挥击//'))).toBe(true);
    expect(log.some(l => l.startsWith('更新回合战斗统计 乱舞'))).toBe(true);
  });

  it('the hero position follows the leg curve between contacts', () => {
    const { w } = setup();
    const { preview } = release(w, { x: 488, y: 288 });
    const planned = LaunchTrajectoryLibrary.ActiveLaunch(w.hero)!;
    const leg = planned.playback.legs[1];
    w.world.clock.runUntil(() => w.world.clock.now >= planned.startedAt + leg.start + leg.duration / 2, 5);
    const p = w.hero.K2_GetActorLocation();
    const a = preview.legs[1].start, b = preview.legs[1].end;
    const along = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    expect(along).toBeGreaterThan(0.2);
    expect(along).toBeLessThan(1);
  });

  it('LM-TV-21: an enemy contact runs 碰撞时, 反弹中 (charge, 反弹, 反弹时, squash), the melee attack, then the mirrored contact', () => {
    const log: string[] = [];
    const { w } = setup({ equip: [{ row: '旧剑' }], log });
    spy(w.hero, 'hero', ['效果.时机.碰撞时', '效果.时机.反弹时', '效果.时机.发动攻击前'], log);
    spy(w.enemies[0], 'enemy', ['效果.时机.碰撞时', '效果.时机.反弹时'], log);
    const popups0 = w.events('popup').length;
    release(w, { x: 488, y: 288 });
    const planned = LaunchTrajectoryLibrary.ActiveLaunch(w.hero)!;
    expect(planned.playback.contacts[0].kind).toBe('enemy');
    w.world.clock.runUntil(() => w.world.clock.now >= planned.startedAt + planned.playback.contacts[0].time, 5);
    const first = log.slice(0, log.indexOf('enemy 效果.时机.反弹时 1') + 1);
    expect(first).toEqual([
      'hero 效果.时机.碰撞时 1',
      '更新回合战斗统计 反弹 1', '更新轮回战斗统计 反弹 1',
      'hero 效果.时机.反弹时 1',
      'hero 效果.时机.发动攻击前 1',
      'damage 幽冥骑士 → 眼球 30',
      'enemy 效果.时机.碰撞时 1',
      'enemy 效果.时机.反弹时 1',
    ]);
    expect(w.events('popup').slice(popups0).map(p => `${p.popup}:${p.value}`)).toEqual(['charge:15']);
    expect(w.events('time.dilation').length).toBe(1);
    const squash = w.events('actor.squash');
    expect(squash.map(e => e.id)).toEqual([w.enemies[0].id, w.hero.id]);
  });

  it('LM-TV-22: a wall contact bounces without an attack or a mirrored contact, and without hit-stop', () => {
    const log: string[] = [];
    const { w } = setup({ log });
    release(w, { x: 288, y: 0 }); // straight north into the wall
    const planned = LaunchTrajectoryLibrary.ActiveLaunch(w.hero)!;
    expect(planned.playback.contacts[0].kind).toBe('wall');
    w.world.clock.runUntil(() => w.world.clock.now >= planned.startedAt + planned.playback.contacts[0].time, 5);
    expect(log.filter(l => l.startsWith('damage'))).toEqual([]);
    expect(log.filter(l => l === '更新回合战斗统计 反弹 1').length).toBe(1);
    expect(w.events('time.dilation').length).toBe(0);
  });

  it('LM-TV-23/24: the hunter fires on wall contacts while enemies are on the field, never on enemy contacts', () => {
    const ranged: boolean[] = [];
    const log: string[] = [];
    const { w } = setup({ hero: '灵魂猎手', log, attack: r => ranged.push(r) });
    release(w, { x: 288, y: 0 });
    w.runUntilInput(10);
    const planned = LaunchTrajectoryLibrary.PreviewLaunch(w.hero, { x: 288, y: 0 });
    expect(planned).not.toBeNull();
    expect(ranged.length).toBeGreaterThan(0);
    expect(ranged.every(r => r)).toBe(true);
    // enemy contact first: no attack on it (LM-TV-24)
    ranged.length = 0;
    w.hero.K2_SetActorLocation(HERO_AT);
    w.world.mode.当前环节 = '交互场牌';
    const { preview } = release(w, { x: 488, y: 288 });
    expect(preview.legs[0].hit?.actor.kind).toBe('body');
    const planned2 = LaunchTrajectoryLibrary.ActiveLaunch(w.hero)!;
    w.world.clock.runUntil(() => w.world.clock.now >= planned2.startedAt + planned2.playback.contacts[0].time, 5);
    expect(ranged).toEqual([]);
    w.world.mode.敌方场上.length = 0;
    w.runUntilInput(10);
    expect(ranged).toEqual([]); // no enemies on the field: walls do not fire either
  });

  it('旧剑 end to end: a completion makes the next 3 attacks deal +20 (蓄能造成额外伤害), one slot per attack', () => {
    const log: string[] = [];
    const { w, hits } = setup({ equip: [{ row: '旧剑' }], log });
    const card = w.cards[0];
    const slots = w.effect('旧剑', '蓝图_效果_蓄能造成额外伤害') as 蓝图_效果_蓄能攻击时XX;
    card.当前行动力 = 90;
    // the attack pipeline's 造成伤害前 (module damage, a double): dispatch on the attacker's effects, then record
    const sys = w.world.sys as unknown as { damage: { BP_ManeActor: Record<string, unknown>; BP_Actor_Card?: Record<string, unknown> } };
    sys.damage.BP_ManeActor['造成即时伤害'] = (_self: unknown, d: 伤害) => {
      hits.push(d);
      if (d.来自角色 === w.hero) for (const e of [...w.hero.拥有的效果]) if (e && e.HasMatchingGameplayTag('效果.时机.造成伤害前')) { e.伤害数据 = d; e.触发时机 = '效果.时机.造成伤害前'; e.持续中触发('效果.时机.造成伤害前'); }
    };
    sys.damage.BP_Actor_Card = { ...sys.damage.BP_Actor_Card, 造成即时伤害: (_self: unknown, d: 伤害) => { hits.push(d); } };
    const extra = () => hits.filter(h => h.伤害来源 === '装备').map(h => 科学数变普通(h.伤害数值));
    const attack = () => {
      w.hero.当前碰到谁了 = w.enemies[0];
      w.hero.发动攻击(w.hero.拥有的主动能力[0], { ...w.hero.当前命中目标, actor: w.enemies[0], blockingHit: true }, false);
      w.advance(1);
    };
    函数库_工具.有对应标签效果(w.hero, w.hero.拥有的效果, '状态.僵直'); // warm path
    card.添加行动力(false, 1, 1, false, false);
    card.判断行动力('反弹');
    expect(slots.待触发充能值.map(科学数变普通)).toEqual([20, 20, 20]);
    for (let i = 0; i < 4; i++) attack();
    expect(extra()).toEqual([20, 20, 20]);
    expect(slots.待触发充能值).toEqual([]);
  });

  it('a launch leg whose path starts more than 8 uu from the hero fails: next frame 销毁效果, no contact (LM-TV-48)', () => {
    const log: string[] = [];
    const { w } = setup({ log });
    LaunchTrajectoryLibrary.UpdateLaunchPreview(w.hero, { x: 488, y: 288 });
    w.hero.K2_SetActorLocation({ x: HERO_AT.x + 9, y: HERO_AT.y, z: HERO_AT.z });
    expect(LaunchTrajectoryLibrary.CanRelease(w.hero)).toBe(false);
    函数库_工具.使目标执行自身技能(w.hero, 0, w.hero, false);
    w.runUntilInput(2);
    expect(log.filter(l => l.startsWith('更新回合战斗统计 反弹'))).toEqual([]);
    expect(log.some(l => l.startsWith('结束行动 幽冥骑士'))).toBe(true);
  });

  it('LM-TV-43/44: 乱舞 from the recorded collision points', async () => {
    const { movementRangeOf } = await import('../../src/content/bp/Skill/效果/蓝图_效果_可控弹射.ts');
    expect(movementRangeOf([{ x: 0, y: 0, z: 0 }, { x: 300, y: 0, z: 0 }, { x: 300, y: 400, z: 0 }])).toBe(75);
    expect(movementRangeOf([{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }])).toBe(11);
    expect(movementRangeOf([{ x: 5, y: 5, z: 0 }])).toBe(0);
    void sciOf;
  });
});

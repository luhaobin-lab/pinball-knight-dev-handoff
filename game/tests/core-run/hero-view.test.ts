import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条 } from '../../src/core/math/stats.ts';
import { heroView } from '../../src/core/sys/run/hero-view.ts';

function startKnight() {
  const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  expect(game.runUntilInput(10)).toBe('input');
  expect(game.send({ type: 'title.newRun' })).toEqual({ ok: true });
  expect(game.runUntilInput(10)).toBe('input');
  expect(game.view.heroSelect?.picked).toBe('幽冥骑士');
  expect(game.send({ type: 'hero.start' })).toEqual({ ok: true });
  expect(game.runUntilInput(10)).toBe('input');
  return game;
}

describe('live hero view on the real composed game', () => {
  it('the Knight remains available to the HUD and renderer on both map and room screens', () => {
    const game = startKnight();
    const hero = game.world.mode.玩家角色!;
    const mapHero = game.view.hero!;
    expect(game.view.screen).toBe('map');
    expect(mapHero).toMatchObject({ id: hero.id, row: '幽冥骑士', hp: 150, maxHp: 150, stamina: 100, maxStamina: 100 });
    expect(mapHero.position).toEqual(hero.K2_GetActorLocation());
    expect(mapHero.skills.length).toBeGreaterThan(0);
    for (const skill of mapHero.skills) {
      const ability = hero.拥有的主动能力[skill.slot]!;
      expect(skill.row).toBe(ability.能力名);
      expect(skill.cost).toBe(ability.当前消耗);
      expect(skill.usable).toBe(ability.本技能可释放);
    }
    expect(mapHero.stats.弹射距离).toBe(科学数变普通(获取科学映射词条(hero.词条, '弹射距离').输出值));
    const cell = game.legal().find(c => c.type === 'map.enter')!.params!.cell![0] as string;
    expect(game.send({ type: 'map.enter', cell })).toEqual({ ok: true });
    expect(game.runUntilInput(10)).toBe('input');
    expect(game.view.screen).toBe('room');
    expect(game.view.hero!.id).toBe(hero.id);
    expect(game.view.hero!.position).toEqual(hero.K2_GetActorLocation());
    expect(game.view.hero!.maxHp).toBeGreaterThan(0);
    expect(game.view.hero!.maxStamina).toBeGreaterThan(0);
  });

  it('damage, Stamina spending and movement update the next view without changing earlier snapshots', () => {
    const game = startKnight();
    const hero = game.world.mode.玩家角色!;
    const before = game.view.hero!;
    hero.受到即时伤害(make伤害({ 伤害来源: '环境', 伤害类型: '物理', 伤害数值: sci(12), 目标角色: hero }), false, false);
    hero.改变体力(sci(-7));
    hero.K2_SetActorLocation({ x: 64, y: 128, z: hero.高度 });
    const after = game.view.hero!;
    expect(after.hp).toBeLessThan(before.hp);
    expect(after.hp).toBe(科学数变普通(hero.当前生命));
    expect(after.stamina).toBeLessThan(before.stamina);
    expect(after.stamina).toBe(科学数变普通(hero.当前魔力));
    expect(after.armor).toBe(科学数变普通(hero.当前护甲值));
    expect(after.dot).toBe(科学数变普通(hero.剩余持续性伤害));
    expect(after.position).toEqual({ x: 64, y: 128, z: hero.高度 });
    expect(before).toMatchObject({ hp: 150, stamina: 100 });
    expect(before.position).not.toEqual(after.position);
  });

  it('status/cooldown snapshots preserve live state and repeated reads do not draw RNG or mutate the world', () => {
    const game = startKnight();
    const w = game.world;
    const hero = w.mode.玩家角色!;
    hero.获得精神状态('饱腹', false);
    const ability = hero.拥有的主动能力.find(a => w.isValid(a))!;
    ability.创建冷却效果(-1, 2);
    const cooldown = ability.冷却效果!;
    expect(w.isValid(cooldown)).toBe(true);
    const digest = game.digest();
    const first = game.view.hero!;
    expect(first.skills.find(s => s.row === ability.能力名)?.cooldown).toBe(cooldown.剩余回合);
    // 饱腹's displayed name is 充沛 (the live UI_增减益格 text, not the internal row name).
    expect(first.statuses.some(s => s.name === '充沛')).toBe(true);
    for (let i = 0; i < 10; i++) expect(game.view.hero).toEqual(first);
    expect(game.digest()).toBe(digest);
    expect(heroView(w)).toEqual(first);
    expect(game.digest()).toBe(digest);
    // A consumer may retain or edit its detached snapshot; that must never write into the actor.
    const detached = first as { position: { x: number }; stats: Record<string, number> };
    detached.position.x += 1000;
    detached.stats.弹射距离 = -1;
    expect(game.digest()).toBe(digest);
    expect(game.view.hero!.stats.弹射距离).toBeGreaterThan(0);
  });
});

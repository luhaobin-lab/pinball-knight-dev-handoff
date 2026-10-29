import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { scriptedPolicy } from '../../src/bot/policies';
import { botRng } from '../../src/bot/rng';
import type { BotGame } from '../../src/bot/api';
import type { Command } from '../../src/core/api/commands';
import { InputMapper } from '../../src/game/input';
import { Shell } from '../../src/game/loop';
import { 蓝图_能力_给自身加主动 } from '../../src/content/bp/Skill/Ability/蓝图_能力_给自身加主动';
import { 蓝图_效果_举盾 } from '../../src/content/bp/Skill/效果/玩家/蓝图_效果_举盾';
import { makeHitResult } from '../../src/core/bp/structs';
import { 科学数变普通 } from '../../src/core/math/sci';
import type { 结构_技能 } from '../../src/content/demo/types';

function combat() {
  const game = createGame({ seed: 6, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  const policy = scriptedPolicy(), rng = botRng(6, 0);
  for (let step = 0; step < 90; step++) {
    game.runUntilInput();
    if (game.world.mode.场上有敌人 && game.view.phase === '交互场牌' && !game.view.modal && game.legal().some(c => c.type === 'aim.release')) return game;
    const cmd = policy.choose({ game: game as unknown as BotGame, legal: game.legal(), rng, step });
    if (!cmd) break; expect(game.send(cmd as Command).ok).toBe(true);
  }
  throw Error('natural combat unavailable');
}

function grantShield(g: ReturnType<typeof createGame>) {
  const h = g.world.mode.玩家角色!;
  const a = g.world.spawn(蓝图_能力_给自身加主动, a => { a.能力名 = '举盾'; a.拥有者 = h; a.等级 = 1; a.品质 = 1; });
  a.技能配置 = g.world.data.table('CatapultHero/数据表/天赋/数据表_天赋_专属')!.rows['举盾'] as 结构_技能;
  a.初始化(); a.子初始化(); h.添加天赋(a, 1, false, false);
  return a;
}

describe('source knight grant and shield through real skill slot', () => {
  it('learns the actual talent into active1, Digit1 and HUD0 cast it once, pays source cost and respects completion/CD', () => {
    const g = combat(), h = g.world.mode.玩家角色!;
    // Controlled source-grant boundary; G2's natural talent pool remains unchanged until content integration.
    grantShield(g);
    const a = h.拥有的主动能力[1]!;
    expect(a.能力名).toBe('举盾'); expect(a.冷却回合).toBe(2);
    const grant = h.拥有的被动能力.find(a => a instanceof 蓝图_能力_给自身加主动) as 蓝图_能力_给自身加主动;
    expect(grant.创建的主动?.id).not.toBe(a.id);
    expect(h.拥有的主动能力).not.toContain(grant.创建的主动);
    expect(g.legal().find(c => c.type === 'skill.press')?.params?.slot).toEqual([1]);
    const input = new InputMapper(), intent = input.key('Digit1')[0]!;
    expect(intent).toEqual({ kind: 'command', cmd: { type: 'skill.press', slot: 1 } });
    const sends: Command[] = [], shell = Object.create(Shell.prototype) as unknown as { hudAction(target: string): void; send(cmd: Command): boolean };
    shell.send = cmd => { sends.push(cmd); return true; }; shell.hudAction('skill:0');
    expect(sends).toEqual([{ type: 'skill.press', slot: 1 }]);
    const mental = vi.spyOn(h, '精神系统'), armor = 科学数变普通(h.当前护甲值), hp = 科学数变普通(h.当前最大生命), stamina = g.view.hero!.stamina;
    expect(g.send((intent as { cmd: Command }).cmd).ok).toBe(true);
    expect(科学数变普通(h.当前护甲值) - armor).toBeCloseTo(hp * .125);
    expect(g.view.hero!.stamina).toBe(stamina);
    expect(a.冷却效果?.剩余回合).toBe(3); expect(h.释放技能中).toBe(true);
    expect(g.send({ type: 'skill.press', slot: 1 }).ok).toBe(false);
    expect(mental.mock.calls.filter(c => c[2] === '释放技能')).toHaveLength(0);
    g.advance(.89); expect(h.释放技能中).toBe(true);
    g.advance(.02); expect(h.释放技能中).toBe(false);
    expect(mental.mock.calls.filter(c => c[2] === '释放技能')).toEqual([[0, 2, '释放技能', false]]);
    a.释放结束(false); expect(mental.mock.calls.filter(c => c[2] === '释放技能')).toHaveLength(1);
    expect(g.view.hero!.skills.find(s => s.slot === 1)).toMatchObject({ row: '举盾', cooldown: 3, usable: false });
  });

  it('two shield bounces use live armor, while a talent upgrade preserves the owned active identity and cooldown', () => {
    const g = combat(), h = g.world.mode.玩家角色!;
    grantShield(g);
    const a = h.拥有的主动能力[1]!; g.send({ type: 'skill.press', slot: 1 }); g.advance(1);
    const effect = h.拥有的效果.find(e => e instanceof 蓝图_效果_举盾) as 蓝图_效果_举盾;
    const enemy = g.world.mode.敌方场上.find(e => !!e)!;
    const hurt = vi.spyOn(h, '造成即时伤害').mockImplementation(() => {});
    effect.命中数据 = makeHitResult({ actor: enemy, blockingHit: true });
    h.当前护甲值 = { 系数: 18.75, 指数: 0 };
    for (let i = 0; i < 3; i++) effect.持续中触发('效果.时机.反弹时');
    expect(hurt).toHaveBeenCalledTimes(2);
    expect(hurt.mock.calls.map(c => c[0])).toEqual(expect.arrayContaining([expect.objectContaining({ 伤害来源: '主动', 伤害类型: '物理', 伤害数值: { 系数: 18.75, 指数: 0 } })]));
    const grant = h.拥有的被动能力.find(a => a instanceof 蓝图_能力_给自身加主动) as 蓝图_能力_给自身加主动;
    const cd = a.冷却效果; grant.等级 = 2; grant.执行技能(false);
    expect(h.拥有的主动能力[1]).toBe(a); expect(a.等级).toBe(2); expect(a.冷却效果).toBe(cd);
  });

  it('source guards reject out-of-combat slots and interruption never grants completion morale', () => {
    const g = combat(), h = g.world.mode.玩家角色!;
    grantShield(g);
    const mental = vi.spyOn(h, '精神系统');
    expect(g.send({ type: 'skill.press', slot: 0 }).ok).toBe(false);
    expect(g.send({ type: 'skill.press', slot: 1 }).ok).toBe(true);
    h.拥有的主动能力[1]!.释放结束(true); g.advance(1);
    expect(mental.mock.calls.filter(c => c[2] === '释放技能')).toHaveLength(0);
    expect(new InputMapper().key('Numpad4')).toEqual([{ kind: 'command', cmd: { type: 'skill.press', slot: 4 } }]);
  });
});

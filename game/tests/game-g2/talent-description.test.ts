import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import type { ModalView } from '../../src/core/api/view.ts';
import { 开启多选一, 主界面Of } from '../../src/core/sys/talents/choice.ts';
import { FRAME } from '../../src/core/sim/clock.ts';
import { makePolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';
import type { BotGame } from '../../src/bot/api.ts';
import skills from '../../src/content/demo/data/合成数据表_技能.ts';

type Game = ReturnType<typeof createGame>;
type Choice = Extract<ModalView, { kind: 'multiChoice' }>;
const choice = (g: Game): Choice => {
  const m = g.view.modal;
  if (m?.kind !== 'multiChoice') throw Error(`expected choice, got ${m?.kind}`);
  return m;
};
const text = (g: Game, row: string) => choice(g).options.find(o => o.row === row)!;
function start(seed = 1) {
  const g = createGame({ seed, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  for (const cmd of [{ type: 'title.newRun' }, { type: 'hero.start' }] as const) {
    g.runUntilInput(); expect(g.send(cmd).ok).toBe(true);
  }
  g.runUntilInput();
  return g;
}
/** Source widget boundary on the real composed game: choose a documented pool, without replacing rules/RNG. */
function open(g: Game, rows = ['强韧', '敏捷', '体质'], extra = 0) {
  开启多选一(g.world, { 目标或_且: false, 目标标签: [], 排除标签: [], 指定池子: rows,
    不加入回合开始: true, 免费: true, 天赋_事件: false, 选项数量: 3, 可刷新次数: 0,
    额外等级: extra, 来自效果: null, 来自能力: null });
  g.advance(0.2);
  return 主界面Of(g.world).多选一选项;
}
function learn(g: Game, name: keyof typeof skills.rows, level: number) {
  const row = skills.rows[name];
  const a = g.world.spawn<蓝图_能力>(row.能力.能力类!, o => { o.唯一ID = name; o.能力名 = name; o.拥有者 = g.world.mode.玩家角色; });
  a.技能配置 = row; a.等级 = level; a.初始化(); a.子初始化();
  g.world.mode.玩家角色!.添加天赋(a, level, false, false);
  return a;
}

describe('UI_天赋选项 更新描述 / L5533-L38 progression', () => {
  it('the natural seed6 first-room choice contains three rendered passive descriptions with real values', () => {
    const g = createGame({ seed: 6, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    const policy = makePolicy('scripted', 0), rng = botRng(6, 0);
    for (let step = 0; step < 20; step++) {
      g.runUntilInput();
      if (g.view.modal?.kind === 'multiChoice') break;
      const game = g as unknown as BotGame;
      const cmd = policy.choose({ game, legal: game.legal(), rng, step });
      expect(cmd).not.toBeNull();
      expect(game.send(cmd!).ok).toBe(true);
    }
    expect(choice(g).options).toHaveLength(3);
    for (const o of choice(g).options) {
      expect(o.text).not.toMatch(/\{[0-4]\}/);
      expect(o.text).toMatch(/<天赋>[^<]+<\/>/);
    }
    const digest = g.digest(), rngState = g.world.rng.save();
    for (let i = 0; i < 30; i++) { g.view; g.legal(); }
    expect(g.digest()).toBe(digest); expect(g.world.rng.save()).toEqual(rngState);
  });

  it('new passives use the displayed count, not the already rolled grant; the source0.6+0.9 boundaries update text', () => {
    const g = start(1), options = open(g);
    const agility = options.find(o => o.临时名字 === '敏捷')!;
    expect(agility.本次提升等级).toBe(2);
    expect(text(g, '强韧').text).toBe('受到的伤害减少 <天赋>5%</> 。');
    expect(text(g, '敏捷')).toMatchObject({ level: 1, text: '提升 <天赋>25</> 弹射距离。' });
    expect(text(g, '体质').text).toBe('提升 <天赋>10%</> 生命上限。');
    const rng = g.world.rng.save(), ability = agility.技能实例!;
    const source = { level: ability.等级, description: ability.描述, raw: ability.原始描述 };
    g.advance(0.6 - FRAME);
    expect(agility.临时计数等级).toBe(1);
    g.advance(FRAME);
    expect(agility.临时计数等级).toBe(2); // L38 starts the source upgrade animation; text updates after its delay.
    expect(text(g, '敏捷').level).toBe(1);
    g.advance(0.9 - FRAME);
    expect(text(g, '敏捷').level).toBe(1);
    g.advance(FRAME);
    expect(text(g, '敏捷')).toMatchObject({ level: 2, text: '提升 <天赋>50</> 弹射距离。' });
    expect(agility.递进回调).toBeNull();
    expect(g.world.rng.save()).toEqual(rng);
    expect({ level: ability.等级, description: ability.描述, raw: ability.原始描述 }).toEqual(source);
  });

  it('a three-level source roll settles at1.5s then2.4s with equal frame-stepped and event-stepped digests', () => {
    const run = (frames: boolean) => {
      const g = start(42), options = open(g); // Current source RNG: rolls2/1/3; historical seed5 trace remains in integration failure log.
      const constitution = options.find(o => o.临时名字 === '体质')!;
      expect(constitution.本次提升等级).toBe(3);
      const advance = (n: number) => { if (frames) for (let i = 0; i < n; i++) g.advance(FRAME); else g.advance(n * FRAME); };
      advance(89); expect(text(g, '体质').level).toBe(1);
      advance(1); expect(text(g, '体质')).toMatchObject({ level: 2, text: '提升 <天赋>20%</> 生命上限。' });
      advance(53); expect(text(g, '体质').level).toBe(2);
      advance(1); expect(text(g, '体质')).toMatchObject({ level: 3, text: '提升 <天赋>30%</> 生命上限。' });
      return g.digest();
    };
    expect(run(true)).toBe(run(false));
  });

  it('owned upgrade previews show the current-to-preview arrow without editing the owned ability', () => {
    const g = start(1), owned = learn(g, '敏捷', 2);
    const before = { level: owned.等级, description: owned.描述, raw: owned.原始描述, params: structuredClone(owned.参数) };
    const [option] = open(g, ['敏捷'], 1);
    expect(option.有存在相同).toBe(true);
    expect(option.临时计数等级).toBe(2);
    expect(text(g, '敏捷')).toMatchObject({ level: 4, text: '提升 <天赋>50</> → <天赋>100</> 弹射距离。' });
    expect({ level: owned.等级, description: owned.描述, raw: owned.原始描述, params: owned.参数 }).toEqual(before);
    const digest = g.digest(), rng = g.world.rng.save();
    for (let i = 0; i < 50; i++) { choice(g); g.legal(); }
    expect(g.digest()).toBe(digest); expect(g.world.rng.save()).toEqual(rng);
  });

  it('picking before the animated preview completes grants the full source roll and cancels old callbacks', () => {
    const g = start(42), options = open(g); // Current source RNG: rolls2/1/3; historical seed5 trace remains in integration failure log.
    const option = options.find(o => o.临时名字 === '体质')!, ability = option.技能实例!;
    expect(option.本次提升等级).toBe(3);
    g.advance(0.6); // the0.9s callback is pending, while the UI still shows level1
    expect(g.send({ type: 'modal.pick', option: 2 }).ok).toBe(true);
    expect(ability.等级).toBe(3);
    expect(g.world.mode.玩家角色!.拥有的被动能力).toContain(ability);
    expect(option.递进回调).toBeNull();
    g.advance(0.2);
    const next = open(g, ['敏捷']);
    const rng = g.world.rng.save();
    g.advance(3);
    expect(choice(g).options.map(o => o.row)).toEqual(['敏捷']);
    expect(主界面Of(g.world).多选一选项).toBe(next);
    expect(g.world.rng.save()).toEqual(rng);
    expect(option.临时计数等级).toBe(2);
  });

  it('the source active-wrapper description reads its created child and formats0..3 plus empty4', () => {
    const g = start(2), hero = g.world.mode.玩家角色!;
    const child = learn(g, '敏捷', 2);
    // A widget-contract boundary only: the WaveB wrapper's creation gameplay is outside G2.
    const wrapper = g.world.spawn<蓝图_能力 & { 创建的主动: 蓝图_能力 | null }>('CatapultHero/BP/Skill/Ability/蓝图_能力_给自身加主动');
    wrapper.能力名 = '强韧'; wrapper.拥有者 = hero; wrapper.等级 = 2; wrapper.等级上限 = 8;
    wrapper.创建的主动 = child;
    hero.拥有的被动能力.push(wrapper);
    child.原始描述 = { zh: '{0}|{1}|{2}|{3}|{4}', en: '' };
    const params = child.参数.map(p => ({ ...p }));
    child.参数 = params.map((p, i) => ({ ...p, '不预算？': true, '整数？': true, 初始值: i + 1, 提升值: i === 0 ? 1 : 0 }));
    const source = { level: child.等级, raw: child.原始描述, description: child.描述 };
    open(g, ['强韧']);
    expect(text(g, '强韧')).toMatchObject({ level: 3, text: ' <天赋>3</> → <天赋>4</> | <天赋>2</> | <天赋>3</> | <天赋>4</> |' });
    expect({ level: child.等级, raw: child.原始描述, description: child.描述 }).toEqual(source);
    expect(wrapper.等级).toBe(2);
  });

  it('discarding the modal before its0.6s step destroys unpicked options and cancels their display callbacks', () => {
    const g = start(42), options = open(g); // Current source RNG: rolls2/1/3; historical seed5 trace remains in integration failure log.
    const option = options.find(o => o.临时名字 === '体质')!, ability = option.技能实例!;
    expect(option.递进回调).not.toBeNull();
    expect(g.send({ type: 'modal.skip' }).ok).toBe(true);
    expect(option.递进回调).toBeNull();
    expect(g.world.isValid(ability)).toBe(false);
    g.advance(0.2);
    const rng = g.world.rng.save();
    g.advance(3);
    expect(g.view.modal).toBeNull();
    expect(option.临时计数等级).toBe(1);
    expect(g.world.rng.save()).toEqual(rng);
  });
});

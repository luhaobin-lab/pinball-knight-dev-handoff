import { describe, expect, it } from 'vitest';
import type { CommandSpec } from '../../src/core/api/commands.ts';
import type { ModalView } from '../../src/core/api/view.ts';
import { 筛选天赋, type 筛选条件 } from '../../src/core/sys/talents/filter.ts';
import { legal, 主界面Of } from '../../src/core/sys/talents/choice.ts';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { learn, talentWorld, type TalentWorld } from './fixture.ts';
import 合成数据表_技能 from '../../src/content/demo/data/合成数据表_技能.ts';
import { TagSet } from '../../src/core/sim/tags.ts';

const row = (name: string): 蓝图_能力['技能配置'] => 合成数据表_技能.rows[name as keyof typeof 合成数据表_技能.rows];
type UiOpen = { UI_主界面: { 开启多选一(...a: unknown[]): void } };

const 唯一 = '能力.类型.天赋.唯一';
const 首领 = '能力.类型.奖励.复合奖励.首领';
const HERO_EXCL = ['可交互.角色.玩家.元素祭司', '可交互.角色.玩家.幽冥骑士', '可交互.角色.玩家.恶疫旅人', '可交互.角色.玩家.灵魂猎手'];
const LEVEL_UP: 筛选条件 = { 目标或_且: false, 目标标签: [], 排除标签: [唯一, 首领], 排除天赋池: [] };

type MultiChoice = Extract<ModalView, { kind: 'multiChoice' }>;
function modal(t: TalentWorld): MultiChoice {
  const v = t.w.modal.current;
  if (v?.kind !== 'multiChoice') throw new Error(`no multi-choice open (${v?.kind ?? 'none'})`);
  return v;
}
function specs(t: TalentWorld): Record<string, CommandSpec> {
  return Object.fromEntries(legal(t.w).map(s => [s.type, s]));
}
/** Runs the clock until the multi-choice is shown (or `max` seconds). */
function untilModal(t: TalentWorld, max = 10): void {
  t.w.clock.runUntil(() => t.w.modal.current !== null, max);
}

describe('筛选天赋 (MAIN ln 269)', () => {
  it('pool sizes: level-up 60 Knight / 62 Hunter, 初始奖励C 45, boss 8, 唯一 4 per hero', () => {
    for (const [hero, levelUp] of [['幽冥骑士', 60], ['灵魂猎手', 62]] as const) {
      const t = talentWorld({ hero });
      t.w.mode.已获取天赋数 = 30; // 生生不息 needs 前置点数 30
      expect(筛选天赋(t.w, t.hero.天赋池, LEVEL_UP)).toHaveLength(levelUp);
      expect(筛选天赋(t.w, t.hero.天赋池, { ...LEVEL_UP, 排除标签: [...HERO_EXCL, 唯一, 首领] })).toHaveLength(45);
      const boss = 筛选天赋(t.w, t.hero.天赋池, { 目标或_且: false, 目标标签: ['环境.类型.遗迹'], 排除标签: [], 排除天赋池: [] });
      expect(boss.sort()).toEqual(['大型装甲', '掠夺', '新生之力', '暴食', '爆裂火星', '癫狂', '真视', '蓄力击'].sort());
      expect(筛选天赋(t.w, t.hero.天赋池, { 目标或_且: false, 目标标签: [唯一], 排除标签: [首领], 排除天赋池: [] })).toHaveLength(4);
    }
  });

  it('前置点数: 生生不息 needs 30 learned talents (59 at 0)', () => {
    const t = talentWorld();
    expect(筛选天赋(t.w, t.hero.天赋池, LEVEL_UP)).toHaveLength(59);
    expect(筛选天赋(t.w, t.hero.天赋池, LEVEL_UP)).not.toContain('生生不息');
  });

  it('hero tags: the Knight never sees Hunter rows; QUIRK: prerequisites (解锁材料) and Tests rows are not checked', () => {
    const t = talentWorld();
    const pool = 筛选天赋(t.w, t.hero.天赋池, LEVEL_UP);
    expect(pool).toContain('铠甲强化'); // needs 防御姿态 in the codex, offered without it
    expect(pool).toContain('溢疗充能'); // Tests-tagged general row
    expect(pool).toContain('锋芒毕露');
    expect(pool).not.toContain('血铸壁垒'); // Hunter Tests row
    expect(pool).not.toContain('搜刮者'); // 忽略
  });

  it('排除天赋池, 天赋上限, ≤ 5 actives, the level range', () => {
    const t = talentWorld();
    expect(筛选天赋(t.w, t.hero.天赋池, { ...LEVEL_UP, 排除天赋池: ['强韧'] })).not.toContain('强韧');
    const a = learn(t, '强韧', 7); // 天赋上限 8
    expect(筛选天赋(t.w, t.hero.天赋池, LEVEL_UP)).toContain('强韧');
    a.等级 = 8;
    expect(筛选天赋(t.w, t.hero.天赋池, LEVEL_UP)).not.toContain('强韧');
    const actives = 筛选天赋(t.w, t.hero.天赋池, LEVEL_UP).filter(n => ['野蛮冲撞', '幻影斩', '血祭之力', '举盾', '钩锁'].includes(n));
    expect(actives).toHaveLength(5);
    t.hero.拥有的主动能力 = Array.from({ length: 5 }, () => t.w.spawn<蓝图_能力>('CatapultHero/BP/Skill/蓝图_能力'));
    expect(筛选天赋(t.w, t.hero.天赋池, LEVEL_UP).filter(n => actives.includes(n))).toEqual([]);
    t.w.mode.英雄等级 = 0; // outside every 等级层数范围 [1, 999]
    expect(筛选天赋(t.w, t.hero.天赋池, LEVEL_UP)).toEqual([]);
  });

  it('the shuffle draws on the meta domain only and is deterministic per seed', () => {
    const run = (seed: number) => { const t = talentWorld({ seed }); return 筛选天赋(t.w, t.hero.天赋池, LEVEL_UP).join(); };
    expect(run(3)).toBe(run(3));
    expect(run(3)).not.toBe(run(4));
  });
});

describe('the level-up pick (蓝图_效果_升级获取天赋 L3525, UI_主界面 开启多选一)', () => {
  it('TF-TV-08: two pending level-ups resolve one after the other inside the turn start', () => {
    const t = talentWorld();
    const m = t.w.mode;
    m.升级点 = 2;
    m.英雄等级 = 3;
    m.退出回合开始(null); // the game mode's own call (TURN-022 step 7)
    expect(m.升级点).toBe(1);
    expect(t.turnLog).toEqual(['退出回合开始']); // 成功？ → blocked
    untilModal(t);
    const first = modal(t);
    expect(first.source).toBe('levelUp');
    expect(first.options).toHaveLength(3);
    expect(t.回合开始实例).toEqual([t.hero]); // the pick joined the barrier
    expect(t.w.clock.now).toBeCloseTo(0.6 + 0.3 + 1.6 + 0.2, 5);
    t.w.modal.answer({ type: 'modal.pick', option: 0 });
    expect(t.w.modal.current).toBeNull();
    expect(m.已获取天赋数).toBeGreaterThanOrEqual(1);
    t.w.clock.advance(0.25); // the 0.2 s Delay ends on the next frame boundary
    expect(m.升级点).toBe(0); // the hero's 退出回合开始 started pick #2
    expect(t.turnLog.at(-1)).toBe('退出回合开始');
    untilModal(t);
    t.w.modal.answer({ type: 'modal.pick', option: 1 });
    t.w.clock.advance(0.25); // the 0.2 s Delay ends on the next frame boundary
    expect(t.turnLog.at(-1)).toBe('新回合后');
    expect(t.hero.拥有的被动能力.filter(a => a?.是天赋).length).toBeGreaterThanOrEqual(1);
  });

  it('the options are free, 1 refresh for 3 精核, give up closes; the refresh reshuffles and is spent', () => {
    const t = talentWorld();
    t.w.mode.升级点 = 1;
    t.hero.升级玩家();
    untilModal(t);
    const v = modal(t);
    expect(v.reroll).toEqual({ cost: 3, currency: '精核' });
    const oldOptions = 主界面Of(t.w).多选一选项.map(o => o.技能实例!);
    expect(oldOptions).toHaveLength(3);
    expect(specs(t)['modal.pick'].params!.option).toEqual([0, 1, 2]);
    expect(specs(t)['modal.reroll']).toBeDefined();
    t.w.modal.answer({ type: 'modal.reroll' });
    expect(t.w.mode.金币).toBe(7);
    expect(modal(t)).not.toBe(v);
    expect(specs(t)['modal.reroll']).toBeUndefined();
    // UI_天赋选项 L7154 destroys each discarded option. L5533 can independently grant 幸运 (SCM-071).
    const newOptions = 主界面Of(t.w).多选一选项.map(o => o.技能实例!);
    expect(newOptions).toHaveLength(3);
    for (const a of oldOptions) expect(t.w.isValid(a)).toBe(false);
    for (const a of newOptions) {
      expect(t.w.isValid(a)).toBe(true);
      expect(oldOptions).not.toContain(a);
    }
    const luck = t.w.objects().filter(o => o.def.name === '蓝图_能力_获得精神状态') as 蓝图_能力[];
    expect(luck.map(a => [a.能力名, a.拥有者])).toEqual([['幸运', t.hero]]);
    t.w.modal.answer({ type: 'modal.skip' });
    expect(t.w.modal.current).toBeNull();
    expect(t.w.mode.已获取天赋数).toBe(0);
    for (const a of newOptions) expect(t.w.isValid(a)).toBe(false);
    expect(t.w.isValid(luck[0])).toBe(true);
  });

  it('a refresh needs 3 精核', () => {
    const t = talentWorld();
    t.w.mode.金币 = 2;
    t.w.mode.升级点 = 1;
    t.hero.升级玩家();
    untilModal(t);
    expect(specs(t)['modal.reroll']).toBeUndefined();
    t.w.modal.answer({ type: 'modal.reroll' });
    expect(t.w.mode.金币).toBe(2);
  });

  it('英雄等级 − 升级点 == 10 offers only 唯一 talents, without refresh; picking one excludes the other three', () => {
    const t = talentWorld();
    const m = t.w.mode;
    m.英雄等级 = 11; m.升级点 = 1;
    t.hero.升级玩家(); // 升级点 0 → 11 − 0 ≠ 10
    untilModal(t);
    expect(modal(t).source).toBe('levelUp');
    t.w.modal.answer({ type: 'modal.skip' });
    t.w.clock.advance(1);
    const u = talentWorld();
    u.w.mode.英雄等级 = 11; u.w.mode.升级点 = 2;
    u.hero.升级玩家(); // 升级点 1 → 11 − 1 == 10
    untilModal(u);
    const v = modal(u);
    expect(v.source).toBe('unique');
    expect(v.reroll).toBeNull();
    expect(new Set(v.options.map(o => o.row))).toEqual(new Set(['屠戮收割', '百磨之刃', '甲之吐息', '利钢淬血'].filter(n => v.options.some(o => o.row === n))));
    expect(v.options).toHaveLength(3);
    u.w.modal.answer({ type: 'modal.pick', option: 0 });
    const others = ['屠戮收割', '百磨之刃', '甲之吐息', '利钢淬血'].filter(n => n !== v.options[0].row);
    expect(筛选天赋(u.w, u.hero.天赋池, { 目标或_且: false, 目标标签: [唯一], 排除标签: [首领], 排除天赋池: [...others] }).length).toBe(0);
  });

  it('the level gain: 递减强化属性(2, 0.12) from 1, so options show level 1–3 for new talents; a paid pick costs 3 per level', () => {
    const levels = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const t = talentWorld({ seed });
      t.w.mode.升级点 = 1;
      t.hero.升级玩家();
      untilModal(t);
      // UI_天赋选项 first previews1, then0.6s+0.9s per increment reveals the rolled total (L5533/L38).
      const gains = 主界面Of(t.w).多选一选项.map(o => o.本次提升等级);
      t.w.clock.advance(0.6 + Math.max(...gains) * 0.9);
      expect(主界面Of(t.w).多选一选项.map(o => o.临时计数等级)).toEqual(gains);
      // This legacy all-content fixture leaves WaveB active wrappers without their 创建的主动 child.
      // Their source description has no valid target; check displayed levels on initialized passive options.
      for (const [i, o] of modal(t).options.entries()) if (o.text !== '') {
        expect(o.level).toBe(gains[i]); levels.add(o.level);
      }
    }
    expect([...levels].every(l => l >= 1 && l <= 3)).toBe(true);
    expect(levels.has(1)).toBe(true);
    expect(levels.has(2)).toBe(true);
  });
});

describe("filter 'ported' (WAVE_A §3.5)", () => {
  it('offers only rows whose classes are all registered', () => {
    const t = talentWorld({ filter: 'ported', seed: 2 });
    t.w.mode.升级点 = 1;
    t.hero.升级玩家();
    untilModal(t);
    const rows = modal(t).options.map(o => o.row);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(t.w.isPorted(row(r).能力.能力类!)).toBe(true); // 基于当前参数加算属性, 修改全局词条 … (this card)
  });
});

describe('other picks', () => {
  it('the boss pick (首领天赋获取 ln 188): the floor tags, free, no refresh, outside the barrier; closing ends the floor', () => {
    const ended: boolean[] = [];
    const t = talentWorld({ systems: { turn: { 蓝图_动作游戏模式: { 结束当前层: (_m, d) => { ended.push(d); } } } } });
    t.w.mode.当前层配置 = { ...t.w.mode.当前层配置, 标签: ['环境.类型.遗迹'] };
    const e = t.w.spawn('CatapultHero/BP/Skill/效果/玩家/蓝图_效果_首领天赋获取', x => { (x as unknown as { 拥有者: unknown }).拥有者 = t.hero; });
    (e as unknown as { 激活后触发(d: string): void }).激活后触发('');
    untilModal(t);
    const v = modal(t);
    expect(v.source).toBe('boss');
    expect(v.reroll).toBeNull();
    expect(v.options.every(o => ['大型装甲', '掠夺', '新生之力', '暴食', '爆裂火星', '癫狂', '真视', '蓄力击'].includes(o.row))).toBe(true);
    expect(t.回合开始实例).toEqual([]);
    expect(t.w.clock.now).toBeCloseTo(2 + 0.6 + 0.2, 5);
    t.w.modal.answer({ type: 'modal.pick', option: 0 });
    expect(t.w.mode.金币).toBe(10);
    t.w.clock.advance(0.25); // the 0.2 s Delay ends on the next frame boundary
    expect(ended).toEqual([true]);
    (e as unknown as { 持续中触发(tag: string): void }).持续中触发('效果.时机.结束层时');
    expect(e.valid).toBe(false);
  });

  it('初始奖励C (蓝图_奖励_获取天赋): general talents only, at least level 4, free, no refresh, then the floor ends', () => {
    const ended: boolean[] = [];
    const t = talentWorld({ systems: { turn: { 蓝图_动作游戏模式: { 结束当前层: (_m, d) => { ended.push(d); } } } } });
    const r = t.w.spawn<蓝图_能力>('CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取天赋');
    r.技能配置 = row('初始奖励C');
    r.初始化();
    r.执行技能(false);
    untilModal(t);
    const v = modal(t);
    expect(v.source).toBe('initialReward');
    expect(v.reroll).toBeNull();
    expect(v.options.every(o => o.level >= 4)).toBe(true);
    expect(specs(t)['modal.pick'].params!.option).toEqual([0, 1, 2]);
    t.w.modal.answer({ type: 'modal.pick', option: 2 });
    expect(t.w.mode.金币).toBe(10);
    expect(t.w.mode.已获取天赋数).toBeGreaterThanOrEqual(4);
    t.w.clock.advance(0.25); // the 0.2 s Delay ends on the next frame boundary
    expect(ended).toEqual([true]);
    expect(t.回合开始实例).toEqual([]);
  });

  it('the scroll (无字书, 天赋卷轴): owned talents below their cap, 1 refresh, needs one learned talent', () => {
    const t = talentWorld();
    const s = t.w.spawn<蓝图_能力>('CatapultHero/BP/Skill/Ability/道具/蓝图_能力_天赋卷轴');
    s.检查子条件();
    expect(s.子条件通过).toBe(false);
    learn(t, '强韧', 2);
    learn(t, '体质', 1);
    const capped = learn(t, '博学', 8);
    expect(capped.等级).toBe(8);
    s.检查子条件();
    expect(s.子条件通过).toBe(true);
    s.执行技能(false);
    untilModal(t);
    const v = modal(t);
    expect(v.source).toBe('scroll');
    expect(v.options.map(o => o.row).sort()).toEqual(['体质', '强韧']);
    expect(v.reroll).not.toBeNull();
    const before = t.hero.拥有的被动能力.find(a => a?.能力名 === v.options[0].row)!.等级;
    t.w.modal.answer({ type: 'modal.pick', option: 0 });
    expect(t.hero.拥有的被动能力.find(a => a?.能力名 === v.options[0].row)!.等级).toBeGreaterThan(before);
  });

  it('a pick that is not affordable is refused with a head-up and not listed', () => {
    const t = talentWorld();
    t.w.mode.金币 = 0;
    const ui = (t.w.sys.talents as unknown as UiOpen).UI_主界面;
    ui.开启多选一(t.hero, false, new TagSet(), new TagSet([唯一, 首领]), [], true, false, false, 3, 0, 0, null, null);
    untilModal(t);
    expect(specs(t)['modal.pick']).toBeUndefined();
    t.w.modal.answer({ type: 'modal.pick', option: 0 });
    expect(t.w.modal.current).not.toBeNull();
    expect(t.w.mode.已获取天赋数).toBe(0);
  });

  it('an empty pool closes at once with "我没有可提升的天赋了。"', () => {
    const t = talentWorld();
    t.hero.天赋池 = [];
    const ui = (t.w.sys.talents as unknown as UiOpen).UI_主界面;
    ui.开启多选一(t.hero, false, new TagSet(), new TagSet(), [], false, true, false, 3, 1, 0, null, null);
    t.w.clock.advance(0.5);
    expect(t.w.modal.current).toBeNull();
    expect(t.turnLog).toEqual(['加入回合开始', '退出回合开始', '新回合后']);
  });
});


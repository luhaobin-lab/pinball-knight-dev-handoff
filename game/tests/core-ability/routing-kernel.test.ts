/** 添加技能 routing (ABILIT-003, 005), the actor kernel (初始化, 激活角色, stat refresh) and the library helpers. */
import { describe, expect, it } from 'vitest';
import { 函数库_工具, 函数库_技能 } from '../../src/core/bp/index.ts';
import { 获取科学映射词条, 添加科学映射值, 词条映射From } from '../../src/core/math/stats.ts';
import { sci, sciOf, 科学数变普通 } from '../../src/core/math/sci.ts';
import { MakeRandomStream, Array_ShuffleFromStream } from '../../src/core/rng/ue.ts';
import { createWorld, CoreError } from '../../src/core/sim/runtime.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { registry } from '../../src/content/bp/index.ts';
import type { 结构_角色 } from '../../src/content/demo/types.ts';
import { fireLive } from '../../src/core/ability/dispatch.ts';
import type { 蓝图_发射物 } from '../../src/core/ability/projectile.ts';
import { spawnActor, withSystems } from '../fixtures/index.ts';
import { addSkill, calls, fixture, listener, skillRow, 测试能力 } from './helpers.ts';

const DEFAULT = 'CatapultHero/数据表/技能/数据表_技能_默认';
const ENCHANT = 'CatapultHero/数据表/技能/数据表_技能_附魔';
const ENEMIES = 'CatapultHero/数据表/角色/数据表_敌人_普通';

describe('添加技能 (ABILIT-003, 005)', () => {
  it('routes the hero\'s rows: 可控挥击 active, 玩家被动 passive (executed now); 唯一ID and 品质', () => {
    const w = fixture();
    const [active] = w.hero.拥有的主动能力;
    const [passive] = w.hero.拥有的被动能力;
    expect(active!.能力名).toBe('可控挥击');
    expect(active!.唯一ID).toBe('幽冥骑士//1//数据表_技能_默认//可控挥击');
    expect(passive!.能力名).toBe('玩家被动');
    expect(w.hero.拥有的效果.some(e => e?.def.name === '蓝图_效果_玩家被动')).toBe(true);
    expect([active!.品质, active!.OwnedGameplayTags.toArray()]).toEqual([1, w.world.data.table(DEFAULT)!.rows['可控挥击' as never]!['标签' as never]]);
  });

  it('ABILIT-TV25: 品质 = FTrunc(log2(等级)) + 1', () => {
    const w = fixture();
    const q = [1, 2, 3, 4, 8].map(lv => {
      w.hero.添加技能({ DataTable: DEFAULT, RowName: '可控挥击' }, lv, 0);
      return w.hero.拥有的主动能力.at(-1)!.品质;
    });
    expect(q).toEqual([1, 2, 2, 3, 4]);
  });

  it('an enchant row is dormant on an enchant-stone card and a passive anywhere else; a missing row adds nothing', () => {
    const w = fixture();
    const row = { DataTable: ENCHANT, RowName: '治愈附魔_0' };
    const stone = spawnActor(w.world, BP_Actor_Card, 'CatapultHero/数据表/合成数据表_修炼物品', '旧剑', { seed: 9 });
    stone.OwnedGameplayTags.add('可交互.修炼牌.附魔');
    const before = stone.拥有的效果.length;
    stone.添加技能(row, 1, 0);
    const [enchant] = [...stone.拥有的附魔能力.keys()];
    expect(stone.拥有的附魔能力.get(enchant!)).toBe('治愈附魔_0');
    expect(stone.拥有的效果.length).toBe(before);
    const n = w.hero.拥有的被动能力.length;
    w.hero.添加技能(row, 1, 0);
    expect(w.hero.拥有的被动能力.length).toBe(n + 1);
    w.hero.添加技能({ DataTable: DEFAULT, RowName: '没有这行' }, 1, 0);
    expect(w.hero.拥有的被动能力.length + w.hero.拥有的主动能力.length).toBe(n + 2);
  });

  it('a passive with 能力.类型.天赋 is flagged 是天赋 (HasTag, hierarchical)', () => {
    const w = fixture();
    const before = w.hero.拥有的被动能力.length;
    w.hero.添加技能({ DataTable: 'CatapultHero/数据表/天赋/数据表_天赋_新新通用', RowName: '力量' }, 1, 0);
    const t = w.hero.拥有的被动能力[before]!;
    expect(t.类型.has('能力.类型.天赋')).toBe(t.是天赋);
  });
});

describe('actor kernel', () => {
  it('BP_ManeActor.初始化 copies the row, sets 唯一ID = 名字//种子, OwnedGameplayTags = 标签 and the stats', () => {
    const w = fixture({ enemies: ['眼球'] });
    const e = w.enemies[0]!;
    const row = w.world.data.table(ENEMIES)!.rows['眼球' as never] as unknown as 结构_角色;
    expect(e.唯一ID).toBe(`眼球//${e.种子}`);
    expect(e.OwnedGameplayTags.toArray()).toEqual([...row.标签]);
    expect([e.角色类型, e.宽度, e.高度, e.是精英]).toEqual([row.类型, row.属性.宽度, row.属性.高度, false]);
    expect(科学数变普通(e.当前生命)).toBe(科学数变普通(获取科学映射词条(词条映射From(row.科学词条), '生命').输出值));
    expect(e.拥有的主动能力.map(a => a!.能力名)).toEqual(row.固定技能.map(h => h.RowName));
    expect(e.初始化完毕).toBe(true);
  });

  it('初始化 is deterministic per seed: the seeded shuffle picks one 随机普通技能', () => {
    const pick = (seed: number): string[] => {
      const world = createWorld({ content: registry, seed: 3 });
      const base = world.data.table(ENEMIES)!.rows['眼球' as never] as unknown as 结构_角色;
      const rnd = ['眼球弹射', '自愈', '召唤水母脑'].map(RowName => ({ DataTable: DEFAULT, RowName }));
      const e = world.spawn(BP_Actor_Other, a => { a.角色配置 = { ...base, 固定技能: [], 随机普通技能: rnd }; a.名字 = '眼球'; a.种子 = seed; });
      e.初始化(false);
      return e.拥有技能的数据.map(h => h.RowName);
    };
    const expected = (seed: number): string => {
      const a = ['眼球弹射', '自愈', '召唤水母脑'];
      Array_ShuffleFromStream(MakeRandomStream(seed), a);
      return a[0]!;
    };
    for (const s of [0, 1, 90, 12345]) {
      expect(pick(s)).toEqual(pick(s));
      expect(pick(s)).toEqual([expected(s)]);
    }
  });

  it('re-初始化 destroys the old abilities and effects (plain destroy) and adds the row skills again', () => {
    const w = fixture({ enemies: ['眼球'] });
    const e = w.enemies[0]!;
    const old = [...e.拥有的主动能力];
    e.初始化(false);
    expect(old.every(a => !w.world.isValid(a))).toBe(true);
    expect(e.拥有的主动能力.length).toBe(old.length);
  });

  it('BP_Actor_Other.激活角色 re-initialises every ability at the actor\'s level', () => {
    const w = fixture();
    const e = w.world.spawn(BP_Actor_Other, a => {
      a.角色配置 = w.world.data.table(ENEMIES)!.rows['眼球' as never] as unknown as 结构_角色;
      a.名字 = '眼球';
      a.等级 = 3;
    });
    e.激活角色(false);
    expect(e.拥有的主动能力.map(a => a!.等级)).toEqual(e.拥有的主动能力.map(() => 3));
  });

  it('BP_Actor_Card.激活角色: 尺寸 from 小型 / 中型 tags, 可使用 from 最大生命', () => {
    const w = fixture({ equip: [{ row: '旧剑' }, { row: '生命药剂' }] });
    for (const c of w.cards) {
      const t = c.标签;
      expect(c.尺寸).toBe(t.hasExact('可交互.修炼牌.小型') ? 1 : t.hasExact('可交互.修炼牌.中型') ? 2 : 3);
    }
  });

  it('更新最大生命魔力: 最大生命 = 生命 + 生命 × 额外生命%, 当前生命 clamped, percentages', () => {
    const w = fixture();
    const h = w.hero;
    添加科学映射值(h.词条, '额外生命%', '测试', sciOf(5, -1), false);
    h.当前生命 = sci(500);
    h.更新最大生命魔力();
    expect([科学数变普通(h.当前最大生命), 科学数变普通(h.当前生命), h.生命百分比]).toEqual([225, 225, 1]);
  });

  it('属性被修改后 dispatches live, then refreshes the hero; 标签被修改后 dispatches over the hero\'s list', () => {
    const A = listener('A', ['效果.时机.属性被修改后']);
    const T = listener('T', ['效果.时机.物品标签被修改']);
    const w = fixture({ classes: [A, T], equip: [{ row: '旧剑' }] });
    w.hero.拥有的效果.push(w.world.spawn(A, e => { e.拥有者 = w.hero; }), w.world.spawn(T, e => { e.拥有者 = w.hero; }));
    添加科学映射值(w.hero.词条, '生命', '测试', sci(10), false);
    w.hero.属性被修改后();
    w.cards[0]!.标签被修改后();
    expect(calls).toEqual(['A.持续中触发(效果.时机.属性被修改后)', 'T.持续中触发(效果.时机.物品标签被修改)']);
    expect(科学数变普通(w.hero.当前最大生命)).toBe(160);
  });

  it('修正词条数值 copies only the 永久保留 sources', () => {
    const w = fixture();
    const m = 词条映射From({ 基础伤害: { 计算类型: '加算', 来源映射: { 永久保留: { 值: 3, 系数: 3, 指数: 0 }, 别的: { 值: 9, 系数: 9, 指数: 0 } } } });
    w.hero.修正词条数值(m);
    expect([...(w.hero.词条.get('基础伤害')?.来源映射.keys() ?? [])]).toEqual(['', '永久保留']);
  });

  it('BP_Actor_Player.激活角色 sets the hero tags (获取英雄标签)', () => {
    const w = fixture();
    expect(w.hero.本英雄标签).toBe('可交互.角色.玩家.幽冥骑士');
    expect(w.hero.非本英雄标签.toArray()).toEqual(['可交互.角色.玩家.灵魂猎手', '可交互.角色.玩家.恶疫旅人', '可交互.角色.玩家.元素祭司']);
  });
});

describe('library helpers', () => {
  it('选择角色作为目标 / 获取释放的角色 / 是敌人 / 检查阵营 / 获取操控角色', () => {
    const w = fixture({ enemies: ['眼球'], equip: [{ row: '旧剑' }] });
    const [e] = w.enemies, [c] = w.cards;
    函数库_工具.选择角色作为目标(w.hero, e!);
    函数库_工具.选择角色作为目标(w.hero, w.hero);
    expect([e!.当前目标, w.hero.当前目标]).toEqual([w.hero, null]);
    expect(函数库_工具.获取释放的角色(w.hero, c!, w.world.mode).释放的角色).toBe(w.hero);
    expect(函数库_工具.获取释放的角色(w.hero, e!, w.world.mode).释放的角色).toBe(e);
    expect([函数库_工具.是敌人(w.hero, w.hero, e!).是敌人, 函数库_工具.是敌人(w.hero, c!, w.hero).是敌人, 函数库_工具.是敌人(w.hero, e!, e!).是敌人]).toEqual([true, false, false]);
    expect(函数库_工具.检查阵营(w.hero, e!).一个阵营).toBe(false);
    expect(函数库_工具.获取操控角色(w.hero).玩家角色).toBe(w.hero);
  });

  it('存在相同主动 / 被动, 对应类型 / 标签效果数量, 有对应标签效果', () => {
    const w = fixture();
    expect(函数库_工具.存在相同主动(w.hero, w.hero, '可控挥击')).toEqual({ 有存在: true, 对应能力: w.hero.拥有的主动能力[0] });
    expect(函数库_工具.存在相同被动(w.hero, w.hero, '无').有存在).toBe(false);
    const list = w.hero.拥有的效果;
    expect(函数库_工具.对应类型效果数量(w.hero, list, 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_玩家被动').数量).toBe(1);
    expect(函数库_工具.对应标签效果数量(w.hero, list, '效果.时机').数量).toBe(list.length);
    expect(函数库_工具.有对应标签效果(w.hero, list, '状态.僵直').存在).toBe(false);
  });

  it('ABILIT-TV28: 技能条件筛选物品 by 需求位置 over 筛选修炼物品 (bottom → top = c0, c1, c2)', () => {
    let cards: BP_Actor_Card[] = [];
    const w = fixture({
      systems: withSystems({ inventory: { 函数库_工具: { 筛选修炼物品: () => ({ 是否存在: true, 筛选后: cards, 最上方: cards[2]!, 最下方: cards[0]! }) } } }),
    });
    cards = [0, 1, 2].map(i => spawnActor(w.world, BP_Actor_Card, 'CatapultHero/数据表/合成数据表_修炼物品', '旧剑', { seed: 50 + i }));
    const a = addSkill(cards[1]!, 测试能力, skillRow());
    const pick = (pos: string) => {
      a.需求位置 = pos as never;
      return 函数库_技能.技能条件筛选物品(a, w.world.cult, a, -1).筛选后.map(c => cards.indexOf(c as BP_Actor_Card));
    };
    expect(['自身', '上', '下', '所有', '所有其他', '随机'].map(pick)).toEqual([[1], [2], [0], [0, 1, 2], [0, 2], [0, 2]]);
    a.需求唯一 = true;
    a.需求位置 = '所有';
    expect(函数库_技能.技能条件筛选物品(a, w.world.cult, a, -1).筛选后).toEqual([]);
  });

  it('获取效果名, 发射物数, 吸附到网格, 排序整数, 修改目标词条_加减, 计算除余数', () => {
    const w = fixture();
    const a = w.hero.拥有的主动能力[0]!;
    expect(函数库_技能.获取效果名(w.hero, a, 'CatapultHero/BP/Skill/效果/蓝图_效果_冷却').效果名字).toBe(`${a.唯一ID}_蓝图_效果_冷却`);
    expect(函数库_技能.获取效果名(w.hero, null, 'CatapultHero/BP/Skill/效果/蓝图_效果_冷却').效果名字).toBe('空_蓝图_效果_冷却');
    const m = w.world.mode;
    m.发射物上限数.set('剑气', 2);
    函数库_技能.添加发射物数(w.hero, m, w.hero, '剑气', 2);
    expect(函数库_技能.发射物数判断(w.hero, m, w.hero, '剑气', ).超出上限).toBe(true);
    函数库_技能.移除发射物数(w.hero, m, w.hero, '剑气', 1);
    expect(函数库_技能.发射物数判断(w.hero, m, w.hero, '剑气').超出上限).toBe(false);
    expect(函数库_工具.吸附到网格(w.hero, { x: 70, y: -10, z: 5 }, { x: 0, y: 0, z: 0 }, 64)).toEqual({ x: 96, y: -32, z: 0 });
    const arr = [3, 1, 2];
    函数库_工具.排序整数(w.hero, arr, true);
    expect(arr).toEqual([1, 2, 3]);
    函数库_工具.修改目标词条_加减(w.hero, w.hero, '基础伤害', '测试', sci(50), true, sci(0), sci(10));
    expect(科学数变普通(获取科学映射词条(w.hero.词条, '基础伤害').输出值)).toBe(40);
    expect(函数库_工具.计算除余数(w.hero, 3, 4, 5)).toEqual({ 超出阈值: true, 除数: 1, 余数: 2 });
  });

  it('销毁目标和子物体 destroys the actor and its attached effects and abilities', () => {
    const w = fixture({ enemies: ['眼球'] });
    const e = w.enemies[0]!;
    const kids = [...e.拥有的主动能力];
    函数库_工具.销毁目标和子物体(w.hero, e);
    expect([w.world.isValid(e), kids.some(k => w.world.isValid(k))]).toEqual([false, false]);
  });

  it('范围选取点: 数量 × 30 + 1 candidates of two combat draws each, spaced and legal', () => {
    const w = fixture({ systems: withSystems({ map: { 函数库_技能: { 查找地形格: () => ({ 找到了: true }) as never } } }) });
    const s = w.world.rng.combat.state;
    const pts = 函数库_工具.范围选取点(w.hero, { x: 0, y: 0, z: 0 }, 100, 200, 50, 3, false, 0).选到的点;
    expect(pts.length).toBe(3);
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeGreaterThanOrEqual(99.999);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThan(50);
    expect(w.world.rng.combat.state).not.toBe(s);
  });
});

describe('strict mode', () => {
  it('an unported facade call throws; the ability runtime itself runs strict', () => {
    // The missing-function contract is independent of the production AI port.
    const w = createWorld({ content: registry, seed: 1, strict: true, systems: { ai: {} } });
    const hero = w.spawn(BP_Actor_Player);
    expect(() => hero.跳过本回合()).toThrow(CoreError);
    const a = w.spawn(测试能力, x => { x.拥有者 = hero; x.唯一ID = 'x'; });
    a.技能配置 = skillRow({ 冷却回合: 1.0 });
    // 初始化 → 更新技能描述 → 生成能力描述参数 is ported (module text, core-inventory), so 初始化 now runs strict
    expect(() => a.初始化()).not.toThrow();
    a.创建冷却效果(-1, 1);
    expect(a.冷却效果?.剩余回合).toBe(2);
    fireLive(hero.拥有的效果, '效果.时机.新一天时');
  });
});

describe('BP_ManeActor ability helpers', () => {
  it('创建发射物: 触发时机 is set on every listener, 仅限来自自身 fires only the owner\'s own, then the projectile activates', () => {
    const tag = '效果.时机.创建发射物';
    let activated = 0;
    const L = listener('L', [tag]);
    const w = fixture({ classes: [L], systems: withSystems({ projectile: { 蓝图_发射物: { 激活发射物: () => { activated++; } } } }) });
    const mine = addSkill(w.hero, 测试能力, skillRow(), { active: false });
    const other = addSkill(w.hero, 测试能力, skillRow(), { active: false });
    other.拥有者 = null;
    const a = w.world.spawn(L, e => { e.拥有者 = w.hero; e.来自技能 = mine; });
    const b = w.world.spawn(L, e => { e.拥有者 = w.hero; e.来自技能 = other; });
    w.hero.拥有的效果.push(a, b);
    const p = w.world.spawn<蓝图_发射物>('CatapultHero/BP/Skill/蓝图_发射物');
    w.hero.创建发射物(p, 3, true);
    expect(calls).toEqual([`L.持续中触发(${tag})`]);
    expect([a.触发次数, b.触发次数, b.触发时机, activated, w.hero.当前发射物, p.游戏模式]).toEqual([3, 1, tag, 1, p, w.world.mode]);
    calls.length = 0;
    w.hero.创建发射物组(2, false);
    expect(calls).toEqual([]);
  });

  it('目标减少随机技能冷却 draws one combat Array_Random over the actives', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow({ 冷却回合: 3.0 }));
    w.hero.拥有的主动能力.splice(0, w.hero.拥有的主动能力.length, a);
    函数库_工具.使目标执行指定技能(a, a, w.hero, false);
    函数库_技能.目标减少随机技能冷却(w.hero, w.hero, 2);
    expect(a.冷却效果!.剩余回合).toBe(2);
  });

  it('判断原始标签并修改 adds and removes the 副条件[0] 前置标签 key on a card and fires 标签被修改后', () => {
    const T = listener('T', ['效果.时机.物品标签被修改']);
    const w = fixture({ classes: [T] });
    w.hero.拥有的效果.push(w.world.spawn(T, e => { e.拥有者 = w.hero; }));
    const card = spawnActor(w.world, BP_Actor_Card, 'CatapultHero/数据表/合成数据表_修炼物品', '旧剑', { seed: 5 });
    const sub = { ...skillRow().主条件, 前置标签: { '可交互.修炼牌.火系': 1 } };
    const a = addSkill(card, 测试能力, skillRow({ 副条件: [sub] }), { active: false });
    函数库_技能.判断原始标签并修改(a, card, a, true, false);
    expect(card.OwnedGameplayTags.hasExact('可交互.修炼牌.火系')).toBe(true);
    函数库_技能.判断原始标签并修改(a, card, a, false, false);
    expect(card.OwnedGameplayTags.hasExact('可交互.修炼牌.火系')).toBe(false);
    expect(calls.filter(c => c.startsWith('T.')).length).toBe(2);
  });

  it('打断技能(true) ends the action (module turn) and interrupts the current cast', () => {
    const ended: unknown[] = [];
    const w = fixture({ systems: withSystems({ turn: { BP_ManeActor: { 结束行动: (_s, x, d) => { ended.push([x, d]); } } } }) });
    const a = addSkill(w.hero, 测试能力, skillRow());
    w.hero.当前能力 = a;
    a.本技能激活中 = true;
    w.hero.打断技能(true);
    expect(ended).toEqual([[null, '']]);
    expect([a.本技能激活中, w.hero.当前能力]).toEqual([false, null]);
  });
});

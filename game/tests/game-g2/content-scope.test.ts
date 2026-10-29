import { describe, expect, it } from 'vitest';
import { registry, createRegistry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import { G2_SCOPE } from '../../src/core/sim/stage-scope.ts';
import { mapPage } from '../../src/core/sys/map/index.ts';
import { 选择地图格 } from '../../src/core/sys/map/page.ts';
import { 数据表_地图格, 数据表_敌人_普通, 数据表_天赋_新新通用, 数据表_天赋_专属, 数据表_天赋_boss专属 } from '../../src/content/demo/index.ts';
import { MakeRandomStream } from '../../src/core/rng/ue.ts';
import { TagSet } from '../../src/core/sim/tags.ts';
import { 筛选天赋 } from '../../src/core/sys/talents/filter.ts';
import { 开启多选一 } from '../../src/core/sys/talents/choice.ts';
import { fakeEnv } from '../core-map/fake-env.ts';

function realMap(filter: 'ported' | 'all', seed = 1) {
  const game = createGame({ seed, content: registry, filter, debug: { skipPrologue: true } });
  for (const command of [{ type: 'title.newRun' }, { type: 'hero.start' }] as const) {
    expect(game.runUntilInput()).toBe('input');
    expect(game.send(command).ok).toBe(true);
  }
  expect(game.runUntilInput()).toBe('input');
  return game;
}

/** Audit real composed map generation; this deliberately does not claim to play the combat rooms. */
function mapOffers(filter: 'ported' | 'all', seed: number) {
  const game = realMap(filter, seed);
  const w = game.world, m = w.mode;
  const seen = new Map<number, ReturnType<typeof mapPage>['地图格数组'][number]>();
  const remember = () => { for (const tile of mapPage(w).地图格数组) seen.set(tile.创建序号, tile); };
  remember();
  for (let floor = 1; floor <= 10; floor++) {
    m.当前关卡层数 = floor; m.当前总层数 = floor;
    w.sys.map.UI_关卡地图页面!.向下探索!(m);
    remember();
  }
  return { game, tiles: [...seen.values()] };
}

describe('ordinary source admission (2026-10-27 recovery; historical G2 receipt retained)', () => {
  it('uses real registry filtering for the five reviewed ordinary combat variants and floor-12 boss', () => {
    const variants = new Set<number>();
    const tiles = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const result = mapOffers('ported', seed);
      for (const t of result.tiles) {
        expect(G2_SCOPE.tiles as readonly string[]).toContain(t.地图格名);
        tiles.add(t.地图格名);
        if (['简单战斗', '普通战斗'].includes(t.地图格名)) {
          expect(G2_SCOPE.combatVariants as readonly number[]).toContain(t.层配置序号);
          variants.add(t.层配置序号);
        }
      }
      const boss = result.tiles.find(t => t.地图格层数 === 12 && t.地图格名 === '首领战斗')!;
      expect(boss).toBeDefined();
      expect(boss.层配置序号).toBe(0);
      expect(boss.层配置?.敌人池[0].内容[0].数据表行.RowName).toBe('守门人');
      expect(result.tiles.filter(t => t.地图格层数 === 1).map(t => t.奖励).sort()).toEqual(['初始奖励A', '初始奖励B', '初始奖励C']);
    }
    expect([...variants].sort()).toEqual([0, 1, 2, 3, 4]);
    // This map-generation fixture keeps full HP/stamina and no craft materials. Source restore/craft conditions
    // may therefore suppress those rooms; registration/admission is checked independently below.
    for (const required of ['空','营地','第一层','宝箱房','属性房','探索房','简单战斗','普通战斗','首领战斗','抉择房','精英战斗','传奇房']) expect(tiles.has(required), `Missing source map type ${required}`).toBe(true);
  });

  it('all mode retains Demo shop/elite tiles and later combat variants instead of inheriting the stage restriction', () => {
    const names = new Set<string>(), variants = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      for (const t of mapOffers('all', seed).tiles) {
        names.add(t.地图格名);
        if (['简单战斗', '普通战斗'].includes(t.地图格名)) variants.add(t.层配置序号);
      }
    }
    expect(names.has('抉择房')).toBe(true);
    expect(names.has('精英战斗')).toBe(true);
    expect([...variants].some(i => i > 1)).toBe(true);
  });

  it('admits only the reviewed seven source boss skills in recovery and keeps other stage exclusions', () => {
    const original = 数据表_敌人_普通.rows.守门人.固定技能.map(h => h.RowName);
    expect(original).toHaveLength(7);
    for (const filter of ['ported', 'all'] as const) {
      const w = createWorld({ content: registry, seed: 1, filter });
      const boss = w.mode.生成角色(数据表_敌人_普通.asset, '守门人', { x: 0, y: 0, z: 0 }, 'None', 1, false).卡牌实例!;
      expect(boss.固定技能.map(h => h.RowName)).toEqual(original);
      if (filter === 'ported') {
        expect(boss.拥有的主动能力.map(s => s?.能力名)).toEqual(original.filter(name => name !== '首领_守门人'));
        expect(w.isRowPorted(数据表_敌人_普通.asset, '守门人')).toBe(true);
        expect(w.counters.report().stubs).toEqual({});
      } else {
        // The original gate required stubs because the boss was not implemented. The restored batch must now
        // instantiate the source skill pool without fallbacks; this does not certify natural full boss parity.
        expect(w.isRowPorted(数据表_敌人_普通.asset, '守门人')).toBe(true);
        expect(w.counters.report().stubs).toEqual({});
        expect(boss.拥有的主动能力.map(s => s?.能力名)).toEqual(original.filter(name => name !== '首领_守门人'));
      }
    }
    expect(数据表_敌人_普通.rows.守门人.固定技能.map(h => h.RowName)).toEqual(original);
  });

  it('checks required enemy fixed-skill classes, and refuses a selected missing G2 room instead of reusing the previous layer', () => {
    const missing = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_肉弹战车';
    expect(registry.get(missing)).toBeDefined();
    const content = createRegistry(registry.paths().filter(p => p !== missing).map(p => registry.get(p)!));
    const w = createWorld({ content, seed: 1, filter: 'ported' });
    expect(w.isRowPorted(数据表_敌人_普通.asset, '守门人')).toBe(false);
    expect(w.isRowPorted(数据表_地图格.asset, '抉择房')).toBe(true); // Reviewed merchant has no dependency on removed boss skill.
    const game = realMap('ported');
    const page = mapPage(game.world);
    const t = page.地图格数组.find(x => x.地图格名 === '第一层')!;
    const prior = game.world.mode.当前层配置;
    t.层配置 = null;
    expect(() => 选择地图格({ ...fakeEnv({ seed: 1 }), filter: 'ported', mode: game.world.mode }, page, t)).toThrow(/G2 required room.*previous-room fallback/);
    expect(game.world.mode.当前层配置).toBe(prior);
  });
});

const EXPECTED_ITEMS = ['旧剑', '旧盾', '旧匕首', '旧项链', '旧盔甲', '旧鞋', '生命药剂', '体力药剂', '魔力药剂', '鲜血', '无字书', '空瓶', '空附魔石', '未知种子', '精矿'];
const RECOVERED_ITEMS = ['底力面具', '投手之握', '淬毒利刃', '巨人盾斧', '浴火长袍', '聚气果', '粘稠体液', '寻宝锄', '月光蕨', '克隆触手', '追风短剑', '分身短弓'];
const RESTORED_PRODUCER_ITEMS = ['旋风杖', '雷云精灵', '黑洞法杖', '风火权杖', '蕴育石像', '超载十字架', '眼球杖', '瘟疫花', '血契战盾', '血舞斗篷', '晶核盾', '晶核剑', '凝血毒剂', '花冠', '固甲石', '幻影轻弩', '旧法杖', '旧手套', '增生触手', '活脑', '死灵布'];
// The 11 aura rows are resolved from 数据表_天赋_新新通用, not from arbitrary rows sharing the same class.
const EXPECTED_TALENTS = ['博学', '力量', '强韧', '体质', '敏捷', '上肢力量', '下肢力量', '人形军械', '上肢耐力', '下肢耐力', '生命成长', '治愈专精', '轻装上阵', '暗藏杀机', '锋芒毕露', '厚实表皮', '真视', '掠夺'];
const RECOVERED_KNIGHT_TALENTS = ['野蛮冲撞', '幻影斩', '血祭之力', '举盾', '钩锁', '蓄力击'];

describe('source-complete ordinary item and talent admission', () => {
  it('restores all172 reviewed item roots while retaining source row filtering', () => {
    for (const filter of ['ported', 'all'] as const) {
      const w = realMap(filter).world;
      w.mode.当前总层数 = 99; // Scope audit beyond every unlock, not a simulated run outcome.
      const rows = w.cult.筛选物品生成(false, new TagSet(), new TagSet(), 1, -2, MakeRandomStream(1), true, false, 'None').筛选后物品;
      if (filter === 'ported') {expect(rows).toHaveLength(172);expect(rows).toEqual(expect.arrayContaining([...EXPECTED_ITEMS,...RECOVERED_ITEMS,...RESTORED_PRODUCER_ITEMS,'袖剑','祝福之灵','破损的神像','汲取拳套','速效药剂','雷神匕首']));}
      else {
        expect(rows.length).toBeGreaterThan(100);
        expect(rows).toEqual(expect.arrayContaining([...EXPECTED_ITEMS, '袖剑', '祝福之灵', '破损的神像']));
      }
    }
  });

  it('restores reviewed talent roots under the original hero/level/prerequisite filters', () => {
    for (const filter of ['ported', 'all'] as const) {
      const w = realMap(filter).world;
      w.mode.英雄等级 = 20; w.mode.已获取天赋数 = 99;
      const pool = [数据表_天赋_新新通用, 数据表_天赋_专属, 数据表_天赋_boss专属].flatMap(t => Object.keys(t.rows));
      const rows = 筛选天赋(w, pool, { 目标或_且: false, 目标标签: [], 排除标签: [], 排除天赋池: [] });
      if (filter === 'ported') {expect(rows).toHaveLength(72);expect(rows).toEqual(expect.arrayContaining([...EXPECTED_TALENTS,...RECOVERED_KNIGHT_TALENTS,'武器大师','防御姿态','大型装甲','新生之力','癫狂']));expect(rows).not.toContain('弹跳连射');expect(rows).not.toContain('恶臭长裤');}
      else expect(rows).toEqual(expect.arrayContaining([...EXPECTED_TALENTS, '武器大师', '防御姿态', '幻影斩']));
    }
    const w = createWorld({ content: registry, filter: 'ported' });
    for (const name of EXPECTED_TALENTS) {
      const table = name === '真视' || name === '掠夺' ? 数据表_天赋_boss专属 : 数据表_天赋_新新通用;
      expect(w.isRowPorted(table.asset, name), `Required G2 talent class missing: ${name}`).toBe(true);
    }
  });

  it('also gates explicit talent pools; all mode keeps them, and events are not treated as talents', () => {
    for (const filter of ['ported', 'all'] as const) for (const event of [false, true]) {
      const g = realMap(filter), w = g.world;
      开启多选一(w, { 目标或_且: false, 目标标签: [], 排除标签: [], 指定池子: ['真视', '掠夺', '大型装甲'], 不加入回合开始: true, 免费: true, 天赋_事件: event, 选项数量: 3, 可刷新次数: 0, 额外等级: 0, 来自效果: null, 来自能力: null });
      w.clock.advance(0.25);
      const modal = w.modal.current;
      expect(modal?.kind).toBe('multiChoice');
      if (modal?.kind === 'multiChoice') expect(modal.options.map(o => o.row).sort()).toEqual(['大型装甲', '掠夺', '真视']);
    }
  });

  it('reports missing required item/talent implementations instead of silently shrinking the approved scope', () => {
    const missing = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_蓄能造成额外伤害';
    expect(registry.get(missing)).toBeDefined();
    const content = createRegistry(registry.paths().filter(p => p !== missing).map(p => registry.get(p)!));
    const w = createWorld({ content, filter: 'ported' });
    expect(() => w.cult.筛选物品生成(false, new TagSet(), new TagSet(), 1, -2, MakeRandomStream(1), true, false, 'None')).toThrow(/G2 required item/);
    const ready = realMap('ported').world;
    expect(() => 筛选天赋(ready, ['力量'], { 目标或_且: false, 目标标签: [], 排除标签: [], 排除天赋池: [], 已移植: () => false })).toThrow(/G2 required talent 力量/);
  });
});

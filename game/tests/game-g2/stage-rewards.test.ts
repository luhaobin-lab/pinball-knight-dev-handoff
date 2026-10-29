import { describe, expect, it } from 'vitest';
import { createRegistry, registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { 数据表_技能_奖励, 合成数据表_修炼物品 } from '../../src/content/demo/index.ts';
import { TagSet } from '../../src/core/sim/tags.ts';
import { G2_SCOPE } from '../../src/core/sim/stage-scope.ts';
import { G2_DECLARED_REWARD_STUBS } from '../../src/core/sys/rewards/box.ts';
import type { 蓝图_奖励_复合奖励 } from '../../src/content/bp/Skill/Ability/奖励/蓝图_奖励_复合奖励.ts';

function game(filter: 'ported' | 'all', seed = 7) {
  const g = createGame({ seed, content: registry, filter, debug: { skipPrologue: true } });
  g.runUntilInput(); // Source loading owns input before any deliberately isolated reward modal is opened.
  return g;
}

function fill(g: ReturnType<typeof game>, names: string[]): void {
  const cult = g.world.cult;
  cult.切换物品盒子(false, true, names.length, 0, null);
  cult.刷新生成牌(false, true, false, 1, names.length, false, new TagSet(), new TagSet(), true, false, names, [], new Map());
}

describe('source-complete explicit reward admission (supersedes thin G2 projection)', () => {
  it('keeps declared items and item-only exceptions; all mode preserves the exact input list and order', () => {
    const names = ['纳气石锤', '旧剑', '黄金头盔', '精矿', '破损的神像', '旧盾'];
    const original = [...names];
    for (const filter of ['ported', 'all'] as const) {
      const g = game(filter);
      fill(g, names);
      const expected = names; // These reviewed source rows are now admitted in ordinary mode, preserving order.
      expect(g.world.cult.筛选后物品).toEqual(expected);
      expect(g.world.cult.未拾取牌.map(c => c!.名字)).toEqual(expected);
      expect(G2_DECLARED_REWARD_STUBS).toEqual([]); // Both former exceptions now require their real implementation.
    }
    expect(names).toEqual(original);
  });

  it('does not redraw an all-excluded explicit list, advance RNG, or turn it into a generic offer; close still works', () => {
    const g = game('ported');
    const before = g.world.rng.save();
    const excluded=['幽焰龙头','重生傀儡之臂']; // Imported later-chapter drops outside the Demo172 roots.
    for(const name of excluded)expect(合成数据表_修炼物品.rows[name as keyof typeof 合成数据表_修炼物品.rows]).toBeDefined();
    fill(g, excluded);
    expect(g.world.cult.筛选后物品).toEqual([]);
    expect(g.world.cult.未拾取牌).toEqual([]);
    expect(g.world.rng.save()).toEqual(before);
    expect(g.view.modal).toMatchObject({ kind: 'loot', cells: [] });
    expect(g.legal().map(s => s.type)).toEqual(['loot.close']);
    expect(g.send({ type: 'loot.close' })).toEqual({ ok: true });
    expect(g.view.modal).toBeNull();
  });

  it('applies the same declaration to real mid-run and boss compound rewards, preserving their weighted draw list', () => {
    const ordinary = new Set<string>(G2_SCOPE.items);
    for (const floor of [6, 12]) for (const filter of ['ported', 'all'] as const) {
      const g = game(filter, 7);
      g.runUntilInput(); g.send({ type: 'title.newRun' });
      g.runUntilInput(); g.send({ type: 'hero.start' }); g.runUntilInput();
      const w = g.world, m = w.mode;
      m.当前总层数 = floor; m.当前关卡层数 = floor;
      const a = w.spawn<蓝图_奖励_复合奖励>('CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_复合奖励', x => {
        x.游戏模式 = m; x.拥有者 = m.玩家角色;
        x.参数 = 数据表_技能_奖励.rows.复合奖励.参数.map(p => ({ ...p }));
        x.等级 = 1;
      });
      // A fixed source pool makes the stage projection observable without changing its weight or replacing a draw.
      const layer = { ...m.当前层配置, 预览图标: floor === 12 ? 'CatapultHero/敌人地图缩略_Sprite_5' : null,
        指定数据筛选: [{ 权重: 100, 数据表行: { DataTable: 'CatapultHero/数据表/合成数据表_修炼物品', RowName: '纳气石锤' } }], 通用数据筛选: [] };
      m.当前层配置 = layer; a.奖励配置(layer, 7);
      a.执行技能(false); g.advance(1.1);
      expect(a.指定名组).toEqual(floor === 12 ? ['纳气石锤', '破损的神像'] : ['纳气石锤']);
      const actual = w.cult.未拾取牌.map(c => c!.名字);
      if (filter === 'ported') {
        expect(actual).toEqual(a.指定名组);
        expect(actual.every(n => ordinary.has(n) || G2_DECLARED_REWARD_STUBS.includes(n))).toBe(true);
      } else expect(actual).toEqual(a.指定名组);
      expect(layer.指定数据筛选[0]!.权重).toBe(100);
    }
  });

  it('reports a missing declared explicit item implementation instead of silently removing it', () => {
    const missing = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_蓄能造成额外伤害';
    const content = createRegistry(registry.paths().filter(p => p !== missing).map(p => registry.get(p)!));
    const g = createGame({ seed: 7, content, filter: 'ported', debug: { skipPrologue: true } });
    expect(() => fill(g, ['旧剑'])).toThrow(/G2 required explicit item/);
  });
});

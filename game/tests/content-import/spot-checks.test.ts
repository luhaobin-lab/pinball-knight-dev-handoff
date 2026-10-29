import { describe, expect, it } from 'vitest';
import * as demo from '../../src/content/demo/index.ts';
import {
  baseAttribute,
  demoEnums,
  findRow,
  hasRow,
  resolveRowHandle,
  row,
  rowNames,
  合成数据表_修炼物品,
  合成数据表_卡牌,
  合成数据表_技能,
  数据表_修炼物品_通用,
  数据表_技能_修炼物品,
  数据表_技能_默认,
  数据表_敌人_普通,
  数据表_玩家,
  数据表_道具_通用,
  曲线表,
} from '../../src/content/demo/index.ts';

// Expected values are read off D:/TAPTAPGAME_ref/dump (REPORT.md "Spot checks" and the raw rows), not off the import.

describe('REPORT.md spot checks', () => {
  const 旧剑 = 数据表_修炼物品_通用.rows.旧剑;

  it('旧剑 (Old Sword) charges 15 行动力 per bounce', () => {
    expect(旧剑.属性.行动力).toBe(15);
  });

  it('旧剑: the next 3 attacks deal +20 damage (造成普伤, 参数 = 1 × 基础伤害 and 3)', () => {
    expect(旧剑.固定技能[0]).toEqual({ DataTable: 数据表_技能_修炼物品.asset, RowName: '造成普伤' });
    const skill = row(数据表_技能_修炼物品, '造成普伤');
    expect(skill.描述.zh).toBe('下{1}次攻击额外造成{0}伤害。');
    expect(skill.参数[0]).toMatchObject({ 初始值: 1, 词条: '基础伤害' });
    expect(skill.参数[1]?.初始值).toBe(3);
    expect(baseAttribute(旧剑.科学词条, '基础伤害')).toEqual({ 值: 20, 系数: 2, 指数: 1 });
  });

  it('生命药剂_新手关 (tutorial Health Potion) heals 20; the regular 生命药剂 has 治愈 0', () => {
    const potion = 数据表_修炼物品_通用.rows.生命药剂_新手关;
    expect(baseAttribute(potion.科学词条, '治愈')).toEqual({ 值: 20, 系数: 2, 指数: 1 });
    const use = resolveRowHandle(potion.固定技能[0]!, [数据表_技能_修炼物品]);
    expect(potion.固定技能[0]?.RowName).toBe('使用恢复生命');
    expect(use?.描述).toEqual({ zh: '<强调>治愈</>{0}。', en: '<强调>Heal</> {0}.' });
    expect(use?.参数[0]).toMatchObject({ 初始值: 1, 词条: '治愈' });
    expect(baseAttribute(数据表_修炼物品_通用.rows.生命药剂.科学词条, '治愈')?.值).toBe(0);
  });

  it('自愈 (enemy skill Regeneration) has an 8-turn cooldown and costs 0', () => {
    const skill = 数据表_技能_默认.rows.自愈;
    expect(skill.冷却回合).toBe(8);
    expect(skill.额外描述[0]).toEqual({ zh: '再生', en: 'Regeneration' });
    expect(skill.参数[0]).toMatchObject({ 初始值: 1, 词条: '治愈' });
    expect(skill.消耗).toBe(0);
    expect(skill.单次级别上限).toBe(2);
  });

  it('眼球 (Eyeball Bug) exists, uses 自愈 and heals 25', () => {
    expect(hasRow(数据表_敌人_普通, '眼球')).toBe(true);
    const eye = 数据表_敌人_普通.rows.眼球;
    expect(eye.描述[0]).toEqual({ zh: '眼球虫', en: 'Eyeball Bug' });
    expect(eye.类型).toBe('深渊');
    expect(eye.固定技能.map(h => h.RowName)).toEqual(['眼球弹射', '自愈']);
    expect(resolveRowHandle(eye.固定技能[1]!, [数据表_技能_默认])).toBe(数据表_技能_默认.rows.自愈);
    expect(baseAttribute(eye.科学词条, '治愈')).toEqual({ 值: 25, 系数: 2.5, 指数: 1 });
    expect(baseAttribute(eye.科学词条, '生命')?.值).toBe(30);
  });
});

describe('the four heroes', () => {
  const heroes = {
    幽冥骑士: { name: ['幽冥骑士', 'Spectral Knight'], 基础伤害: 30, 生命: 150, 最大疲劳: 4, 固定技能: ['可控挥击', '玩家被动'] },
    灵魂猎手: { name: ['灵魂猎手', 'Soul Hunter'], 基础伤害: 20, 生命: 60, 最大疲劳: 5, 固定技能: ['可控反蹬箭', '玩家被动'] },
    恶疫旅人: { name: null, 基础伤害: 10, 生命: 150, 最大疲劳: 5, 固定技能: ['挥击', '玩家被动'] },
    元素祭司: { name: null, 基础伤害: 10, 生命: 150, 最大疲劳: 5, 固定技能: ['挥击', '玩家被动'] },
  } as const;

  for (const [key, want] of Object.entries(heroes)) {
    it(`${key} has its base stats`, () => {
      const hero = row(数据表_玩家, key);
      expect(hero.类型).toBe('玩家');
      expect(hero.标签).toContain(`可交互.角色.玩家.${key}`);
      if (want.name) expect(hero.描述[0]).toEqual({ zh: want.name[0], en: want.name[1] });
      expect(hero.属性).toMatchObject({ 行动力: 10, 速度: 3000, 高度: 56, 宽度: 56, 最大疲劳: want.最大疲劳 });
      const stat = (name: string) => baseAttribute(hero.科学词条, name)?.值;
      expect(stat('基础伤害')).toBe(want.基础伤害);
      expect(stat('生命')).toBe(want.生命);
      expect(stat('最大生命')).toBe(want.生命);
      expect(stat('魔力')).toBe(100);
      expect(stat('最大魔力')).toBe(100);
      expect(stat('暴击伤害%')).toBe(2);
      expect(stat('弹射距离')).toBe(500);
      // 值 keeps the Demo's binary rounding: 科学数变普通 computes 1.1 × 10^2 = 110.00000000000001 in doubles.
      expect(baseAttribute(hero.科学词条, '攻击距离')).toEqual({ 值: 110.00000000000001, 系数: 1.1, 指数: 2 });
      expect(baseAttribute(hero.科学词条, '格挡减伤%')).toEqual({ 值: 0.15000000000000002, 系数: 1.5, 指数: -1 });
      expect(hero.固定技能.map(h => h.RowName)).toEqual(want.固定技能);
      for (const handle of hero.固定技能) expect(resolveRowHandle(handle, [数据表_技能_默认])).toBeDefined();
    });
  }

  it('the Demo hides 恶疫旅人 and 元素祭司 behind the 忽略 tag', () => {
    expect(数据表_玩家.rows.恶疫旅人.标签).toContain('忽略');
    expect(数据表_玩家.rows.幽冥骑士.标签).not.toContain('忽略');
  });
});

describe('import rules', () => {
  it('drops the rows the dump marks as tests', () => {
    expect(findRow(数据表_玩家, '测试')).toBeUndefined();
    expect(rowNames(数据表_敌人_普通).filter(k => k.includes('测试'))).toEqual([]);
    expect(rowNames(合成数据表_修炼物品)).toHaveLength(202 - 2);
    expect(rowNames(合成数据表_技能)).toHaveLength(586);
  });

  it('keeps row order and resolves composite tables like UCompositeDataTable', () => {
    expect(rowNames(数据表_玩家)).toEqual(['默认', '商人', '灵魂', '神像', '幽冥骑士', '灵魂猎手', '恶疫旅人', '元素祭司']);
    // 宝箱 is in 数据表_道具_通用 and in the later parent 数据表_敌人_普通: the later row wins, the earlier position stays.
    expect(合成数据表_卡牌.rows.宝箱).toBe(数据表_敌人_普通.rows.宝箱);
    expect(rowNames(合成数据表_卡牌).indexOf('宝箱')).toBe(rowNames(数据表_道具_通用).indexOf('宝箱'));
    expect(合成数据表_卡牌.flags.宝箱).toBe(数据表_敌人_普通.flags.宝箱);
    expect(合成数据表_技能.rows.恢复生命).toBe(数据表_技能_修炼物品.rows.恢复生命);
  });

  it('resolves row handles only into the tables it is given', () => {
    const handle = 数据表_敌人_普通.rows.眼球.固定技能[1]!;
    expect(resolveRowHandle(handle, [数据表_技能_修炼物品])).toBeUndefined();
    expect(resolveRowHandle({ DataTable: null, RowName: 'None' }, [数据表_技能_默认])).toBeUndefined();
    expect(() => row(数据表_技能_默认, '测试')).toThrow(/has no row "测试"/);
  });

  it('turns references into asset paths and enums into display names', () => {
    expect(数据表_技能_默认.rows.自愈.能力.能力类).toBe('CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_治愈_强固');
    expect(数据表_修炼物品_通用.rows.旧剑.科学词条.基础伤害?.计算类型).toBe('加算');
    const 乘算 = demoEnums.枚举_词条映射类行.values.find(v => v.display === '乘算');
    expect(乘算).toEqual({ name: 'NewEnumerator1', value: 1, display: '乘算' });
  });

  it('exports live tables only (过期 tables stay in data/)', () => {
    expect(Object.keys(demo)).not.toContain('数据表_天赋_英雄');
    expect(Object.keys(demo)).toContain('数据表_天赋_新新通用');
    expect(数据表_玩家.flags.默认).toContain('references deprecated table 数据表_天赋_英雄');
  });

  it('serves the curve tables', () => {
    expect(rowNames(曲线表)).toContain('敌人属性成长');
    expect(曲线表.rows.经验值所需曲线.Keys.length).toBeGreaterThan(0);
    expect(曲线表.rows.闪避曲线.PostInfinityExtrap).toBe('RCCE_Constant');
  });
});

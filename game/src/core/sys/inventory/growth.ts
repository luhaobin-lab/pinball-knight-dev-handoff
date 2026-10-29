/**
 * Item stat growth: BP_Actor_Card.处理词条 / 成长词条 (L621–L700, draft core-math CORE-M-061/062) and the size and
 * price rules of the card actor (激活角色 UG L9569, 更新价格 L547). Pure functions over a 词条映射.
 */
import 数据表_词条_物品 from '../../../content/demo/data/数据表_词条_物品.ts';
import { findRow } from '../../../content/demo/index.ts';
import { Divide_IntInt, FTrunc, MapRangeClamped } from '../../math/kismet.ts';
import { sciOf, 科学数乘除, 科学数变普通 } from '../../math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, 科学映射原始值, type 词条映射 } from '../../math/stats.ts';

/**
 * 成长词条(词条名, 自定区间？, 词条区间) (L674–L761). 自定区间 maps 等级 from [1, 装备最高等级] onto the range; otherwise
 * the data value (`角色配置.科学词条`, aggregated) × 等级. Both overwrite the "" source.
 */
export function 成长词条(词条: 词条映射, 配置词条: 词条映射, 等级: number, 装备最高等级: number, 词条名: string, 自定区间: boolean, 区间: { readonly Min: number; readonly Max: number }): void {
  if (自定区间) {
    const v = MapRangeClamped(等级 + 0, 1, 装备最高等级, Math.fround(区间.Min), Math.fround(区间.Max));
    添加科学映射值(词条, 词条名, '', sciOf(v, 0), false);
    return;
  }
  const base = 获取科学映射词条(配置词条, 词条名).输出值;
  添加科学映射值(词条, 词条名, '', 科学数乘除(sciOf(等级, 0), base, false), false);
}

/**
 * 处理词条() (L621–L750): every stat of the card grows unless the catalogue 数据表_词条_物品 has it with `成长？` false.
 * A stat absent from the catalogue grows by 等级 (label L642).
 */
export function 处理词条(词条: 词条映射, 配置词条: 词条映射, 等级: number, 装备最高等级: number): void {
  for (const name of [...词条.keys()]) {
    const row = findRow(数据表_词条_物品, name);
    if (!row) 成长词条(词条, 配置词条, 等级, 装备最高等级, name, false, { Min: 0, Max: 1 });
    else if (row['成长？']) 成长词条(词条, 配置词条, 等级, 装备最高等级, name, row['自定区间？'], row.词条数值区间);
  }
}

/** 激活角色 (UG L9569): 小型 → 1, 中型 → 2, anything else → 3. */
export function 尺寸From标签(tags: readonly string[]): 1 | 2 | 3 {
  if (tags.includes('可交互.修炼牌.小型')) return 1;
  if (tags.includes('可交互.修炼牌.中型')) return 2;
  return 3;
}

/**
 * 更新价格(强制半价？) (L547–L572): 原始价格 = FTrunc(尺寸 × 价格 × 等级 × (1 − 购买折扣)); the current price is the full price
 * only for an unbought card outside the warehouse (`!强制半价 ∧ 在未拾取牌 ∧ !在仓库`), else 原始价格 / 2; plus FTrunc(溢价)
 * (raw value with 永久保留 and enchantments).
 */
export function 计算价格(词条: 词条映射, 尺寸: number, 等级: number, 购买折扣: number, 全价: boolean): { 原始价格: number; 当前价格: number } {
  const 价格 = 科学数变普通(科学映射原始值(词条, '价格', false));
  const 原始价格 = FTrunc(尺寸 * 价格 * 等级 * (1.0 - 购买折扣));
  const 溢价 = FTrunc(科学数变普通(科学映射原始值(词条, '溢价', true)));
  return { 原始价格, 当前价格: (全价 ? 原始价格 : Divide_IntInt(原始价格, 2)) + 溢价 };
}

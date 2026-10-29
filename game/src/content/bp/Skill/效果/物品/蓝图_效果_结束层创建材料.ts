/** Source L15/L987/L1542: pay EACH eligible floor before incrementing mass; threshold emits p2 material drops, then resets only permanent mass. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { sciOf, 科学数比较 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, type 词条映射 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_结束层创建材料 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_结束层创建材料';
  词条名 = '元素伤害%'; 计数 = 0; 来自牌: BP_Actor_Card | null = null; 词条修正: 词条映射 = new Map();
  override 激活后触发(_Debug: string): void { const card = this.来自技能?.拥有者; if (card instanceof BP_Actor_Card) { this.来自牌 = card; 添加科学映射值(card.词条, '质量', '', sciOf(0, 0), false); } }
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者; if (时机 !== '效果.时机.结束层时' || !s || !owner) return;
    const p = (i: number) => 函数库_技能.获取技能参数(this, s, i, false, '').参数值;
    if (this.world.mode.金币 < Math.trunc(p(1))) return;
    this.world.mode.增加金币_收入(false, false, Math.imul(Math.trunc(p(1)), -1), null);
    添加科学映射值(owner.词条, '质量', '永久保留', sciOf(1, 0), true);
    if (!科学数比较(获取科学映射词条(owner.词条, '质量').输出值, '>=', sciOf(p(0), 0))) return;
    for (let i = 0; i <= Math.trunc(p(2)) - 1; i++) this.world.mode.添加材料掉落(owner);
    添加科学映射值(owner.词条, '质量', '永久保留', sciOf(0, 0), false);
  }
}

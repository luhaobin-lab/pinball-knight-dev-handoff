/** Source L15/L938: reset mass then snapshot source card; next-tick clone passes empty enchants despite recording them. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { sciOf, 科学数比较 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, 复制词条映射, type 词条映射 } from '../../../../../core/math/stats.ts';
import type { 结构_存档_能力 } from '../../../../demo/types.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_结束层后复制 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_结束层后复制';
  词条名 = '元素伤害%'; 计数 = 0; 来自牌: BP_Actor_Card | null = null; 品质 = 0; 获取轮次 = 0; 附魔存档: 结构_存档_能力[] = []; 词条修正: 词条映射 = new Map();
  override 激活后触发(_Debug: string): void { const card = this.来自技能?.拥有者; if (card instanceof BP_Actor_Card) { this.来自牌 = card; 添加科学映射值(card.词条, '质量', '', sciOf(0, 0), false); } }
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, card = this.来自牌; if (时机 !== '效果.时机.结束层时' || !s?.拥有者 || !card) return;
    添加科学映射值(card.词条, '质量', '永久保留', sciOf(1, 0), true);
    if (!科学数比较(获取科学映射词条(card.词条, '质量').输出值, '>=', sciOf(函数库_技能.获取技能参数(this, s, 0, false, '').参数值, 0))) return;
    添加科学映射值(s.拥有者.词条, '质量', '永久保留', sciOf(0, 0), false);
    this.获取轮次 = card.获取轮次; this.品质 = card.品质; this.附魔存档 = [...card.附魔存档]; this.词条修正 = 复制词条映射(card.词条);
    this.nextTick('L938', () => { this.world.cult.创建牌到侧栏(s.拥有者?.名字 ?? '', this.品质, null, [], this.获取轮次, this.词条修正); s.更新技能描述(false, 0); });
  }
}

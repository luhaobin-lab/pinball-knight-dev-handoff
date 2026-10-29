/** Source L143/L466: overwrite skill-key stat with hero当前护甲值, without parameter scaling or 属性被修改后. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_伤害等于总护甲 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_伤害等于总护甲';
  词条名 = '闪避%'; 累计次数 = 0; 来自牌: BP_Actor_Card | null = null;
  override 激活后触发(_Debug: string): void {
    const s = this.来自技能, h = this.world.mode.玩家角色; if (!s?.拥有者 || !h) return;
    添加科学映射值(s.拥有者.词条, 函数库_技能.获取技能参数(this, s, 0, false, '').词条, s.唯一ID + '', h.当前护甲值, false);
    s.拥有者.更新外观数据();
  }
  override 持续中触发(_时机: Tag): void { this.激活后触发(''); }
}

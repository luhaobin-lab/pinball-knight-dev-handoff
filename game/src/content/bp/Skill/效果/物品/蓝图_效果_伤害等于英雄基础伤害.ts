/** Source L79/L542: hero current基础伤害 overwrites item skill source; no cleanup or stat callback. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 获取科学映射词条, 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_伤害等于英雄基础伤害 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_伤害等于英雄基础伤害';
  词条名 = '闪避%'; 累计次数 = 0; 来自牌: BP_Actor_Card | null = null;
  override 激活后触发(_Debug: string): void {
    const s = this.来自技能, h = this.world.mode.玩家角色; if (!s?.拥有者 || !h) return;
    添加科学映射值(s.拥有者.词条, 函数库_技能.获取技能参数(this, s, 0, false, '').词条, s.唯一ID + '', 获取科学映射词条(h.词条, '基础伤害').输出值, false);
    s.拥有者.更新外观数据();
  }
  override 持续中触发(_时机: Tag): void { this.激活后触发(''); }
}

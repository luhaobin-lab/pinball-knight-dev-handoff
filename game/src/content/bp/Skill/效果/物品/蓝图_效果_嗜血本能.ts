/** Source L725: accumulate DoT trigger count*p0, cap written hero source atp1; uncapped counter resets on floor end/destroy. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_嗜血本能 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_嗜血本能';
  词条名 = '元素伤害%'; 计数 = 0; 目标牌: (BP_Actor_Card | null)[] = []; 来自牌: BP_Actor_Card | null = null; 累计值 = 0;
  override 销毁前触发(): void {
    this.累计值 = 0; const s = this.来自技能, h = this.world.mode.玩家角色; if (!s || !h) return;
    移除科学映射值(h.词条, 函数库_技能.获取技能参数(this, s, 0, false, '').词条, s.唯一ID + '');
  }
  override 持续中触发(时机: Tag): void {
    if (时机 === '效果.时机.结束层时') { this.销毁前触发(); return; }
    const s = this.来自技能, h = this.world.mode.玩家角色;
    if (时机 !== '效果.时机.造成伤害后' || !s || !h || !this.world.mode.持续伤害类型.includes(this.伤害数据.伤害类型)) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    this.累计值 += this.伤害数据.触发次数 * p.参数值;
    添加科学映射值(h.词条, p.词条, s.唯一ID + '', sciOf(Math.min(this.累计值, 函数库_技能.获取技能参数(this, s, 1, false, '').参数值), 0), false);
  }
}

/** Source L841/L960/L15: floor-cached items infuse on contacting an actor carrying p1's DoT; multiplier is source combo only. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_碰撞XX敌人时灌注 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_碰撞XX敌人时灌注';
  词条名 = '元素伤害%'; 计数 = 0; 筛选后: (BP_Actor_Card | null)[] = [];
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, source = s?.拥有者; if (!s || !source) return;
    if (时机 === '效果.时机.新一层时') { this.筛选后 = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, -1).筛选后; return; }
    const target = this.命中数据.actor;
    if (时机 !== '效果.时机.碰撞时' || !(target instanceof BP_ManeActor)) return;
    if (!函数库_技能.查询持续伤害(this, target, 函数库_技能.获取技能参数(this, s, 1, false, '').词条).存在) return;
    for (let i = 0; i < this.筛选后.length; i++) {
      const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
      this.筛选后[i]?.添加行动力(true, Math.trunc(p.参数值), Math.trunc(科学数变普通(获取科学映射词条(source.词条, '连击').输出值)), true, false);
    }
  }
}

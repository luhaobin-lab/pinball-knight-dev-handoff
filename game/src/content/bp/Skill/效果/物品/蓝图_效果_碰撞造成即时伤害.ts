/** Source L26/L50: no-delay charged collision, equipment physical damage from the item at impact point. */
import { 蓝图_效果_蓄能碰撞XX时XX } from '../蓝图_效果_蓄能碰撞XX时XX.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import type { 科学数 } from '../../../../../core/math/sci.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_碰撞造成即时伤害 extends 蓝图_效果_蓄能碰撞XX时XX {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_碰撞造成即时伤害';
  override 激活后触发(Debug: string): void { super.激活后触发(Debug); this.无延迟连击 = true; }
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const s = this.来自技能, source = s?.拥有者, hit = this.命中数据; if (!s || !source || !(hit.actor instanceof BP_ManeActor)) return;
    source.造成即时伤害(make伤害({ 伤害来源: '装备', 伤害类型: '物理', 伤害数值: 结算数值, 所需回合: 3, 触发次数,
      击中点位置: hit.impactPoint, 击中点法线: hit.impactNormal, 来自技能: s, 来自角色: source, 目标角色: hit.actor }), false, false);
  }
}

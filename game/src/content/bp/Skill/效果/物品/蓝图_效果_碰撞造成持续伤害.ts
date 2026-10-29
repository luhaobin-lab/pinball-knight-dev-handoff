/** Source L26/L1279: no-delay collision; p2 chooses the mode's bleed/poison/burn array. */
import { 蓝图_效果_蓄能碰撞XX时XX } from '../蓝图_效果_蓄能碰撞XX时XX.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import type { 科学数 } from '../../../../../core/math/sci.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_碰撞造成持续伤害 extends 蓝图_效果_蓄能碰撞XX时XX {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_碰撞造成持续伤害';
  override 激活后触发(Debug: string): void { super.激活后触发(Debug); this.无延迟连击 = true; }
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const s = this.来自技能, source = s?.拥有者, hit = this.命中数据; if (!s || !source || !(hit.actor instanceof BP_ManeActor)) return;
    const key = 函数库_技能.获取技能参数(this, s, 2, false, '').词条;
    const type = this.world.mode.持续伤害类型[['流血', '剧毒', '燃烧'].indexOf(key)] ?? '物理';
    source.造成持续伤害(make伤害({ 伤害来源: '装备', 伤害类型: type, 伤害数值: 结算数值, 所需回合: 3, 触发次数,
      击中点位置: hit.impactPoint, 击中点法线: hit.impactNormal, 来自技能: s, 来自角色: source, 目标角色: hit.actor }), false, false);
  }
}

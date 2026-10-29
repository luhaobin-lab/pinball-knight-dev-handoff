/** Source L10: valid incoming skill, critical NON-DoT only. The extra bleed preserves original packet caster and cannot recursively trigger itself. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_重伤 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_重伤';
  override 持续中触发(_t: Tag): void {
    const d = this.伤害数据, s = this.来自技能, o = this.拥有者; if (!s || !o || !this.world.isValid(d.来自技能) || !d.是暴击 || this.world.mode.持续伤害类型.includes(d.伤害类型)) return;
    o.造成持续伤害(make伤害({ 伤害来源: '被动', 伤害类型: '流血', 伤害数值: 科学数乘除(sciOf(函数库_技能.获取技能参数(this, s, 0, false, '').参数值, 0), d.伤害数值, false), 所需回合: 3, 触发次数: d.触发次数,
      击中点位置: d.击中点位置, 击中点法线: d.击中点法线, 来自技能: s, 来自角色: d.来自角色, 目标角色: d.目标角色 }), true, true);
    // Source attached PaperFlipbook at the packet hit position; shell offset attachment is still a presentation gap.
    if (d.目标角色) this.fx.vfx('CatapultHero/粒子/粒子_Blood_02', d.目标角色, { attach: true });
  }
  ReceiveDestroyed(): void {}
}

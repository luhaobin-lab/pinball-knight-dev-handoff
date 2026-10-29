/** Source L77/L503/L1227: saved pre-hit damage split over p0 bounces, self-origin prevents recursive deferral. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_延时护符加成 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_延时护符加成';
  每次伤害 = sciOf(0, 0); 计数 = 0;
  override 激活后触发(_Debug: string): void {
    this.计数 = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值;
    this.每次伤害 = 科学数乘除(this.伤害数据.伤害数值, sciOf(this.计数, 0), true);
  }
  override 持续中触发(时机: Tag): void {
    const owner = this.拥有者; if (!owner) return;
    if (时机 === '效果.时机.结束层时') { this.销毁效果(); return; }
    if (时机 !== '效果.时机.反弹时') return;
    owner.受到即时伤害(make伤害({ ...this.伤害数据, 不变速: true, 是暴击: false, 是弱点: false,
      伤害数值: this.每次伤害, 所需回合: 3, 触发次数: 1, 击中点位置: owner.K2_GetActorLocation(),
      击中点法线: { x: 1, y: 0, z: 0 }, 来自角色: owner, 目标角色: owner }), true, false);
    this.计数 -= 1; if (this.计数 <= 0) this.销毁效果();
  }
}

/** Source L15: bleed-after packet gives hero percent armour times damage count, item owner remains caster. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_血铸壁垒 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_血铸壁垒';
  已触发 = false;
  override 持续中触发(_t: Tag): void { const o = this.拥有者, s = this.来自技能; if (this.伤害数据.伤害类型 !== '流血' || !o || !s) return; o.更新运动数据(); this.world.mode.玩家角色?.获得治疗(make治疗({ 生命护甲: true, 治疗百分比: sciOf(函数库_技能.获取技能参数(this, s, 0, false, '').参数值, 0), 触发次数: this.伤害数据.触发次数, 来自技能: s, 释放者: o }), true, false); }
}

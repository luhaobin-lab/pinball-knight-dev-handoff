/** Source L20: only while an actual enemy exists, percentage armour with the mode's round trigger count. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_临阵磨枪 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_临阵磨枪';
  词条名 = '元素伤害%'; 计数 = 1;
  override 持续中触发(_t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o || !this.world.mode.判断场上内容().有敌人) return;
    o.获得治疗(make治疗({ 生命护甲: true, 治疗百分比: sciOf(函数库_技能.获取技能参数(this, s, 0, false, '').参数值, 0),
      触发次数: this.world.mode.回合开始触发数, 来自技能: s, 释放者: o, 特效位置: { ...o.当前位置, x: o.当前位置.x + o.高度 } }), true, false);
  }
}

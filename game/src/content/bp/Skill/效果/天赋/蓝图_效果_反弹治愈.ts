/** Source L1188/L10: initial count0 means first rebound heals; the counter carries across floors. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_反弹治愈 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_反弹治愈';
  计数 = 0;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (t !== '效果.时机.反弹时' || !s || !o) return;
    this.计数 = (this.计数 - 1) | 0; if (this.计数 > 0) return;
    this.计数 = Math.trunc(函数库_技能.获取技能参数(this, s, 0, false, '').参数值);
    const p = 函数库_技能.获取技能参数(this, s, 1, false, ''), pos = o.K2_GetActorLocation();
    o.获得治疗(make治疗({ 治疗整数: sciOf(p.整数 ? p.参数值 : 0, 0), 治疗百分比: sciOf(p.整数 ? 0 : p.参数值, 0),
      触发次数: 1, 来自技能: s, 释放者: o, 特效位置: { ...pos, x: pos.x + o.高度 } }), true, false);
  }
}

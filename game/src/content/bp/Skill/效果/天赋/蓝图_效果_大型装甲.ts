/** Source L15/L565: count raw item tags each event; flat armour uses current maximum HP, only with enemies. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_大型装甲 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_大型装甲';
  计数 = 0;
  override 持续中触发(_t: Tag): void {
    this.计数 = 0; const s = this.来自技能, o = this.拥有者; if (!s || !o) return;
    const list = this.world.cult.已装备牌; for (let i = 0; i < list.length; i++) if (list[i]?.标签.has('可交互.修炼牌.大型')) this.计数++;
    if (!this.world.mode.场上有敌人 || this.计数 < 函数库_技能.获取技能参数(this, s, 0, false, '').参数值) return;
    o.获得治疗(make治疗({ 生命护甲: true, 治疗整数: 科学数乘除(o.当前最大生命, sciOf(函数库_技能.获取技能参数(this, s, 1, false, '').参数值, 0), false),
      触发次数: 1, 来自技能: s, 释放者: o, 特效位置: { ...o.当前位置, x: o.当前位置.x + o.高度 } }), true, false);
  }
}

/** Item lifesteal L20 (distinct from enemy吸血): source-item damage only, excludes DoT; heals hero, not a heal-stat event. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_吸血 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_吸血';
  来源名字 = '元素伤害%'; 叠加值 = 0; 计数 = 0;
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能, h = this.world.mode.玩家角色;
    if (!s || !h || s.拥有者 !== this.伤害数据.来自角色 || this.world.mode.持续伤害类型.includes(this.伤害数据.伤害类型)) return;
    const p = h.K2_GetActorLocation();
    h.获得治疗(make治疗({ 治疗整数: 科学数乘除(this.伤害数据.伤害数值, sciOf(函数库_技能.获取技能参数(this, s, 0, false, '').参数值, 0), false),
      触发次数: 1, 特效位置: { x: p.x + h.高度, y: p.y, z: p.z }, 来自技能: s, 释放者: h,
    }), false, false);
  }
}

/** Source L90: ALL target tags or empty; flat heal multiplied by the event count, hero is caster. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_有XX物品会心恢复生命 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_有XX物品会心恢复生命';
  角度抖动 = 0;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, h = this.world.mode.玩家角色; if (t !== '效果.时机.有物品会心时' || !s || !h) return;
    if (s.目标标签.size && !this.world.cult.当前触发会心的牌?.OwnedGameplayTags.hasAll(s.目标标签.toArray())) return;
    h.获得治疗(make治疗({ 治疗整数: sciOf(函数库_技能.获取技能参数(this, s, 0, false, '').参数值, 0), 触发次数: this.触发次数, 来自技能: s, 释放者: h, 特效位置: { ...h.当前位置, x: h.当前位置.x + h.高度 } }), true, false);
  }
}

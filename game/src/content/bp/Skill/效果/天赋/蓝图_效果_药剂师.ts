/** Source L20: source name生命药剂 only, extra percentage heal once; the potion is caster. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_药剂师 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_药剂师';
  词条名 = '元素伤害%';
  override 持续中触发(_t: Tag): void { const c = this.world.cult.当前使用的牌, s = this.来自技能; if (c?.名字 !== '生命药剂' || !s) return; this.world.mode.玩家角色?.获得治疗(make治疗({ 治疗百分比: sciOf(函数库_技能.获取技能参数(this, s, 0, false, '').参数值, 0), 触发次数: 1, 来自技能: s, 释放者: c }), true, false); }
}

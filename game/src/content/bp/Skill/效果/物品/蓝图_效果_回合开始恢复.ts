/** Source L20/L206: kill mission+new day; heal skill owner's current target with round-trigger count*combo. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { sciOf, 科学数乘除, 科学数变普通, 科学数零 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_回合开始恢复 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_回合开始恢复';
  词条名 = '元素伤害%'; 蓄能计数 = 0; 蓄能完毕 = false;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者, mission = this.world.mode.当前任务实例 as 蓝图_能力 | null;
    if (时机 !== '效果.时机.新一天时' || !s || !owner?.当前目标 || !mission?.类型.has('能力.类型.任务.杀敌')) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, ''), fixed = p.整数 || p.词条 !== '';
    owner.当前目标.获得治疗(make治疗({ 生命护甲: p.词条 === '护甲',
      治疗整数: fixed ? p.词条 === '' ? sciOf(p.参数值, 0) : 科学数乘除(获取科学映射词条(owner.词条, p.词条).输出值, sciOf(p.参数值, 0), false) : 科学数零,
      治疗百分比: fixed ? 科学数零 : sciOf(p.参数值, 0),
      触发次数: FTrunc(this.world.mode.回合开始触发数 * 科学数变普通(获取科学映射词条(owner.词条, '连击').输出值)),
      来自技能: s, 释放者: owner,
    }), true, false);
  }
}

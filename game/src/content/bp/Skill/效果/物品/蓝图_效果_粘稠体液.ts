/** Source L61/L387: mental-state child; kill-mission turn heals owner with integer/percent p0 times stacks and round trigger count. */
import { 蓝图_效果_精神状态 } from '../玩家/精神状态/蓝图_效果_精神状态.ts';
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_粘稠体液 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_粘稠体液';
  回复值 = 5; 参数值 = 0; 整数 = false;
  override 激活后触发(Debug: string): void { super.激活后触发(Debug); const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, ''); this.整数 = p.整数; this.参数值 = p.参数值; }
  override 销毁前触发(): void { super.销毁前触发(); this.fx.ui({ op: 'update', widget: 'effect.deactivate', data: { id: this.id } }); }
  override 持续中触发(时机: Tag): void {
    const task = this.world.mode.当前任务实例, owner = this.拥有者;
    if (时机 !== '效果.时机.新一天时' || !(task instanceof 蓝图_能力) || !task.类型.has('能力.类型.任务.杀敌') || !owner) return;
    owner.更新运动数据(); const n = this.参数值 * this.叠加层数;
    owner.获得治疗(make治疗({ 治疗整数: sciOf(this.整数 ? n : 0, 0), 治疗百分比: sciOf(this.整数 ? 0 : n, 0),
      触发次数: this.world.mode.回合开始触发数, 来自技能: this.来自技能, 释放者: owner }), true, false);
    this.fx.vfx('CatapultHero/粒子/粒子_自愈_02', owner, { attach: true });
  }
}

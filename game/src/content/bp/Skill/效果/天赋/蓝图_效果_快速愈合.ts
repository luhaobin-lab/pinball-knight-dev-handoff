/** Source L479/L10/L652: one PRD roll; failure adds packet trigger count, success heals the full packet once. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_快速愈合 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_快速愈合';
  词条名 = '格挡%'; 累计次数 = 0; 触发计数 = 1;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (t !== '效果.时机.受到伤害后' || !s || !o) return;
    if (!函数库_工具.PRD概率判断(this, 函数库_技能.获取技能参数(this, s, 0, false, '').参数值, this.触发计数).触发) { this.触发计数 = (this.触发计数 + this.伤害数据.触发次数) | 0; return; }
    this.触发计数 = 1; o.更新运动数据(); o.获得治疗(make治疗({ 治疗整数: this.伤害数据.伤害数值, 触发次数: 1, 来自技能: s, 释放者: o }), true, false);
  }
}

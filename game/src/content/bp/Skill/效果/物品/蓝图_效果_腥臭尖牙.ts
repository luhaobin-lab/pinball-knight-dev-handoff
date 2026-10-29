/** Source L1393/L61/L457: one scalar PRD per packet trigger; any success sets the ENTIRE original DoT packet duration to -1. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_腥臭尖牙 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_腥臭尖牙';
  来源名字 = '元素伤害%'; 待触发持续性伤害 = 0; 触发计数 = 1; 会心次数统计 = 0;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能;
    if (时机 !== '效果.时机.造成伤害前' || !s || s.拥有者 !== this.伤害数据.来自角色 || !this.world.mode.持续伤害类型.includes(this.伤害数据.伤害类型)) return;
    this.会心次数统计 = 0;
    for (let i = 0; i <= this.伤害数据.触发次数 - 1; i++) {
      const p = 函数库_技能.获取技能参数(this, s, 0, false, '').参数值;
      if (函数库_工具.PRD概率判断(this, p, this.触发计数).触发) { this.触发计数 = 1; this.会心次数统计++; }
      else this.触发计数 = (this.触发计数 + 1) | 0;
    }
    if (this.会心次数统计 > 0 && this.拥有者) this.拥有者.当前造伤数据 = { ...this.伤害数据, 所需回合: -1, 断开骨骼名: 'None' };
  }
}

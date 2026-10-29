/** Source L3207/L3402/L389: poison after-hit count, post-remainder re-evaluation, one named vulnerability stack per qualifying event. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import { 蓝图_效果_易伤 } from '../蓝图_效果_易伤.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_淬毒利刃 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_淬毒利刃';
  来源名字 = '元素伤害%'; 叠加值 = 0; 计数 = 1; 触发值 = 0; 累计值 = 0;
  override 激活后触发(_Debug: string): void { this.触发值 = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值; }
  override 持续中触发(时机: Tag): void {
    if (时机 !== '效果.时机.受到伤害后' || this.伤害数据.伤害类型 !== '中毒') return;
    const q = () => 函数库_工具.计算除余数(this, this.累计值, this.伤害数据.触发次数, this.触发值);
    this.累计值 = q().余数; if (!q().超出阈值) return;
    const owner = this.拥有者, s = this.来自技能, caster = this.释放者;
    if (!owner || !this.world.isValid(owner) || owner.死掉了 || !s) return;
    const cls = 蓝图_效果_易伤.path;
    const cfg = make效果配置({ 效果类: cls, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: true, 检查效果名: true, 叠加上限: 1000 });
    const r = applyEffect(this, { cfg, owner, 释放者: caster, 来自技能: s, 效果名: 函数库_技能.获取效果名(this, s, cls).效果名字, classOf: caster ?? owner });
    r.effect?.激活效果('');
  }
}

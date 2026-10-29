/** Source L2908/L38/L2509: remove own source backpack then equipment; count debuff effects, then overwrite selected equipped stats. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_狂暴 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_狂暴';
  目标牌: (BP_Actor_Card | null)[] = []; 数量 = 0;
  override 激活后触发(_d: string): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o) return;
    const p = () => 函数库_技能.获取技能参数(this, s, 0, false, '');
    for (const list of [this.world.cult.背包里牌, this.world.cult.已装备牌]) for (let i = 0; i < list.length; i++) { const c = list[i]; if (c && 移除科学映射值(c.词条, p().词条, s.唯一ID)) c.更新外观数据(); }
    this.数量 = 函数库_工具.对应标签效果数量(this, o.拥有的效果, '效果.类型.减益').数量;
    if (!(this.数量 > 0 && this.world.mode.场上有敌人)) return;
    this.目标牌 = []; this.目标牌 = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, -1).筛选后;
    for (let i = 0; i < this.目标牌.length; i++) { const c = this.目标牌[i]; if (c) { const a = p(); 添加科学映射值(c.词条, a.词条, s.唯一ID, sciOf(a.参数值 * this.数量, 0), false); } }
  }
  override 持续中触发(_t: Tag): void { this.激活后触发(''); }
}

/** Source L83 checks enum value2 (poison), despite this class's historical bleed name. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_流血击杀修改自身属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_流血击杀修改自身属性';
  充能计数 = 0;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者;
    if (时机 !== '效果.时机.有敌人死亡' || !s || !owner || this.world.mode.当前死亡角色?.当前受伤数据.伤害类型 !== '中毒') return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    添加科学映射值(owner.词条, p.词条, '永久保留', sciOf(p.参数值, 0), true); owner.更新最大生命魔力(); owner.更新外观数据();
  }
}

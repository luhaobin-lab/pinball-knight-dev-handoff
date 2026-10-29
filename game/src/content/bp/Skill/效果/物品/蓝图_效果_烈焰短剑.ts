/** Source L22788/L15/L136/L8407: charged collision emits three staggered explosion points; literal0 makes the alternate cross-pattern dead. */
import { 蓝图_效果_蓄能碰撞XX时XX } from '../蓝图_效果_蓄能碰撞XX时XX.ts';
import { 蓝图_效果_爆炸 } from '../蓝图_效果_爆炸.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害, make效果配置 } from '../../../../../core/bp/structs.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { 科学数 } from '../../../../../core/math/sci.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_烈焰短剑 extends 蓝图_效果_蓄能碰撞XX时XX {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_烈焰短剑';
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const s = this.来自技能, source = s?.拥有者, owner = this.拥有者; if (!s || !source || !owner) return;
    source.更新运动数据();
    const points = 函数库_工具.范围选取点(this, this.命中数据.impactPoint, 32, 144, 48, 3, false, 16).选到的点;
    const cfg = make效果配置({ 效果类: 蓝图_效果_爆炸.path, 持续时间: 2, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 100 });
    for (let i = 0; i < points.length; i++) {
      if (!this.world.isValid(owner)) continue; // Source's dead-owner check is disabled.
      const r = applyEffect(this, { cfg, owner, 释放者: source, 来自技能: s,
        效果名: 函数库_技能.获取效果名(this, s, cfg.效果类).效果名字, classOf: source });
      if (r.refreshed || !(r.effect instanceof 蓝图_效果_爆炸)) continue;
      r.effect.伤害数据 = make伤害({ 伤害来源: '装备', 伤害类型: '爆炸', 不变速: false,
        伤害数值: 结算数值, 所需回合: 3, 触发次数, 击中点位置: this.命中数据.impactPoint, 击中点法线: this.命中数据.normal,
        来自技能: s, 来自角色: source, 来自发射物: null, 目标角色: null });
      r.effect.爆炸位置 = points[i]; r.effect.序号 = i; r.effect.触发次数 = 触发次数;
      source.附加效果前(r.effect); r.effect.激活效果(''); source.附加效果后(r.effect);
    }
  }
}

/** Source L605: sequential enemy for initial combo indices, but eagerly consumes Array_Random every iteration. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { Array_Random } from '../../../../../core/rng/ue.ts';
import { sciOf, 科学数变普通, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_疫病虫巢 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_疫病虫巢';
  充能计数 = 0; 命中位置: Vec3 = { x: 0, y: 0, z: 0 }; NewVar_0: BP_ManeActor | null = null;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, source = s?.拥有者, owner = this.拥有者; if (时机 !== '效果.时机.自身完成充能' || !s || !source || !owner) return;
    const at = owner.K2_GetActorLocation(); this.fx.vfx('CatapultHero/粒子/粒子_虫群A', { ...at, z: at.z + 10 });
    for (let i = 0; i <= Math.trunc(科学数变普通(获取科学映射词条(source.词条, '连击').输出值) - 1); i++) {
      const list = this.world.mode.敌方场上; if (!list.length) continue;
      const random = list[Array_Random(this.world.rng.combat, list)]; this.NewVar_0 = (i < list.length ? list[i] : random) ?? null;
      const target = this.NewVar_0; if (!target?.HasMatchingGameplayTag('可交互.角色.AI.仇恨')) continue;
      target.更新运动数据(); this.命中位置 = 函数库_工具.扩散命中中心(this, target, { x: 0, y: 0, z: 0 }, .65, { x: 0, y: 0, z: 0 });
      const p = 函数库_技能.获取技能参数(this, s, 0, false, ''), origin = owner.K2_GetActorLocation();
      const value = 科学数乘除(科学数乘除(获取科学映射词条(source.词条, p.词条).输出值, sciOf(p.参数值, 0), false), sciOf(this.触发次数, 0), false);
      target.受到持续伤害(make伤害({ 伤害来源: '装备', 伤害类型: '中毒', 伤害数值: value, 所需回合: 3, 触发次数: 1,
        击中点位置: this.命中位置, 击中点法线: { x: origin.x - this.命中位置.x, y: origin.y - this.命中位置.y, z: origin.z - this.命中位置.z },
        来自技能: s, 来自角色: source, 目标角色: target }), true);
      this.fx.vfx('CatapultHero/粒子/粒子_虫群B', target, { attach: true });
    }
  }
}

/** Source L2594/L440: any weapon completion emits split+1 capped tornadoes, damage/count set after deferred construction. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除, 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { 蓝图_发射物_旋风01 } from '../../发射物/蓝图_发射物_旋风01.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_旋风杖 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_旋风杖';
  角度抖动 = 0;
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能, source = s?.拥有者, owner = this.拥有者;
    if (!s || !source || !owner || !this.world.cult.当前完成充能的牌?.HasMatchingGameplayTag('可交互.修炼牌.武器')) return;
    owner.更新运动数据(); source.创建发射物组(this.触发次数, false);
    const n = Math.trunc(科学数变普通(获取科学映射词条(source.词条, '投射分裂').输出值) + 1);
    const points = 函数库_技能.获取目标范围空地(this, 24, 0, n, owner, true, false, 0);
    for (let i = 0; i < points.查询到的位置.length; i++) {
      if (函数库_技能.发射物数判断(this, this.world.mode, source, '旋风01').超出上限) continue;
      函数库_技能.添加发射物数(this, this.world.mode, source, '旋风01', 1);
      const at = points.查询到的位置[i];
      const shot = this.world.spawn(蓝图_发射物_旋风01, x => {
        x.来自角色 = source; x.来自技能 = s; x.持续时长 = 1.5;
        x.ActorRotation = { Pitch: 0, Yaw: Math.fround(points.位置对应角度[i] ?? 0), Roll: 0 };
      }, { x: at.x, y: at.y, z: 5 });
      const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
      shot.伤害数值 = 科学数乘除(获取科学映射词条(source.词条, p.词条).输出值, sciOf(p.参数值, 0), false);
      shot.触发次数 = Math.trunc(this.触发次数 * 科学数变普通(获取科学映射词条(source.词条, '连击').输出值));
      source.创建发射物(shot, Math.trunc(this.触发次数 * 科学数变普通(获取科学映射词条(source.词条, '连击').输出值)), false);
    }
  }
}

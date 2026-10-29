/** Source 毒气: actual base projectile sweep, exact source damage channel/position and stop presentation. */
import { 蓝图_发射物 } from '../../../../core/ability/projectile.ts';
import { make伤害 } from '../../../../core/bp/structs.ts';
import type { AssetPath, Rotator } from '../../../../core/sim/types.ts';
export class 蓝图_发射物_毒气 extends 蓝图_发射物 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/发射物/蓝图_发射物_毒气';
  ActorRotation: Rotator = { Pitch: 0, Yaw: 0, Roll: 0 };
  override 激活前触发(): void {
    this.最大穿透次数 = -1;
    this.停止特效 = 'CatapultHero/粒子/粒子_Hit_大肠喷射'; this.停止音效 = 'CatapultHero/声音/音效_基础_大烟尘';
    
  }
  override 触发发射物敌方效果(): void {
    const s = this.来自技能, owner = s?.拥有者, target = this.当前命中角色; if (!s || !owner || !target) return;
    if (!target.HasMatchingGameplayTag('可交互.角色.AI.仇恨')) return;
    owner.造成持续伤害(make伤害({ 伤害来源: '投射物', 伤害类型: '中毒', 不变速: true,
      伤害数值: this.伤害数值, 所需回合: 3, 触发次数: this.触发次数,
      击中点位置: this.Sweep_Result.impactPoint, 击中点法线: this.Sweep_Result.impactNormal, 来自技能: s, 来自角色: owner, 来自发射物: this, 目标角色: target }), true, false);
    
  }
}


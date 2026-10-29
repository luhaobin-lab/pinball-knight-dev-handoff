/** Source 灼热射线: actual base projectile sweep, exact source damage channel/position and stop presentation. */
import { 蓝图_发射物 } from '../../../../core/ability/projectile.ts';
import { make伤害 } from '../../../../core/bp/structs.ts';
import type { AssetPath, Rotator } from '../../../../core/sim/types.ts';
export class 蓝图_发射物_灼热射线 extends 蓝图_发射物 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/发射物/蓝图_发射物_灼热射线';
  ActorRotation: Rotator = { Pitch: 0, Yaw: 0, Roll: 0 };
  override 激活前触发(): void {
    this.fx.sound('CatapultHero/声音/WHOOSH_Air_Blade_RR2_mono', this.K2_GetActorLocation(), { volume: 1.3, pitch: 1 });
    this.停止特效 = 'CatapultHero/粒子/粒子_Hit_火焰'; this.停止音效 = null;
    
  }
  override 触发发射物敌方效果(): void {
    const s = this.来自技能, owner = s?.拥有者, target = this.当前命中角色; if (!s || !owner || !target) return;
    
    owner.造成持续伤害(make伤害({ 伤害来源: '投射物', 伤害类型: '燃烧', 不变速: false,
      伤害数值: this.伤害数值, 所需回合: 3, 触发次数: this.触发次数,
      击中点位置: this.Sweep_Result.location, 击中点法线: this.Sweep_Result.normal, 来自技能: s, 来自角色: owner, 来自发射物: this, 目标角色: target }), false, false);
    
  }
}


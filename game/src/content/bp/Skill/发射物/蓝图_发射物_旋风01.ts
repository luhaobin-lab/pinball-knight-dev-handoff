/** Source L58/L300/L1885: unlimited piercing, passive physical damage, source tornado count released on stop. */
import { 蓝图_发射物 } from '../../../../core/ability/projectile.ts';
import { 函数库_技能 } from '../../../../core/bp/index.ts';
import { make伤害 } from '../../../../core/bp/structs.ts';
import { sciOf, 科学数加减, 科学数乘除 } from '../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../core/math/stats.ts';
import type { AssetPath, Rotator } from '../../../../core/sim/types.ts';
export class 蓝图_发射物_旋风01 extends 蓝图_发射物 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/发射物/蓝图_发射物_旋风01';
  ActorRotation: Rotator = { Pitch: 0, Yaw: 0, Roll: 0 };
  override 激活前触发(): void {
    this.最大穿透次数 = -1;
    this.fx.vfx('CatapultHero/粒子/粒子_旋风01_A', this, { attach: true });
    this.fx.sound('CatapultHero/声音/WHOOSH_Air_Blade_RR2_mono', this.K2_GetActorLocation(), { volume: 1.3, pitch: 1 });
    this.停止特效 = 'CatapultHero/粒子/粒子_旋风01_C'; this.停止音效 = 'CatapultHero/声音/音效_风消散';
    this.delay('L58', .3, () => this.fx.vfx('CatapultHero/粒子/粒子_旋风01_B', this, { attach: true }));
  }
  override 触发发射物敌方效果(): void {
    const s = this.来自技能, source = s?.拥有者; if (!s || !source) return;
    const mul = 科学数加减(获取科学映射词条(source.词条, '旋风伤害%').输出值, sciOf(1, 0), false);
    source.造成即时伤害(make伤害({ 伤害来源: '被动', 伤害类型: '物理', 不变速: true,
      伤害数值: 科学数乘除(this.伤害数值, mul, false), 所需回合: 3, 触发次数: this.触发次数,
      击中点位置: this.Sweep_Result.location, 击中点法线: this.Sweep_Result.normal,
      来自技能: s, 来自角色: source, 来自发射物: this, 目标角色: this.当前命中角色 }), false, false);
    this.fx.vfx('CatapultHero/粒子/粒子_Hit_气刃', this.Sweep_Result.location);
    this.fx.sound('CatapultHero/声音/音效_基础_砍中肉', this.Sweep_Result.location, { volume: 1, pitch: 1.5 });
  }
  override 发射物停下(): void {
    函数库_技能.移除发射物数(this, this.游戏模式, this.来自角色, '旋风01', 1);
    this.fx.ui({ op: 'update', widget: 'projectile.trail', data: { id: this.id, hidden: true, soundSpeed: 1, soundVolume: 0 } });
  }
}

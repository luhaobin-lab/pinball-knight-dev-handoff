/** Source arrow L25035/L27641: physical/bleed, poison/explosion point sequence, shock chain; base owns flight/expiry. */
import { 蓝图_发射物 } from '../../../../core/ability/projectile.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../core/bp/index.ts';
import { make伤害, make效果配置 } from '../../../../core/bp/structs.ts';
import type { AssetPath, Rotator } from '../../../../core/sim/types.ts';
import { applyEffect } from '../效果/蓝图_效果_可控弹射.ts';
import { 蓝图_效果_爆炸 } from '../效果/蓝图_效果_爆炸.ts';
import { 蓝图_效果_闪电链 } from '../效果/蓝图_效果_闪电链.ts';

export class 蓝图_发射物_箭矢 extends 蓝图_发射物 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/发射物/蓝图_发射物_箭矢';
  /** Source spawn transform yaw, consumed by the existing ProjectileMovement adapter. */
  ActorRotation: Rotator = { Pitch: 0, Yaw: 0, Roll: 0 };

  override 激活前触发(): void {
    const hero = this.world.mode.玩家角色;
    if (this.来自技能?.拥有者 === hero && hero) this.最大穿透次数 = hero.投射穿透;
    this.范围检查 = false;
    this.fx.sound('CatapultHero/声音/音效_基础_飞箭', this.K2_GetActorLocation(), { volume: 1.3, pitch: 1 });
    this.停止特效 = 'CatapultHero/粒子/粒子_Hit_01'; this.停止音效 = null;
  }

  override 触发发射物敌方效果(): void {
    const skill = this.来自技能, from = skill?.拥有者, target = this.当前命中角色;
    if (!skill || !from || !target) return;
    const hit = this.Sweep_Result;
    const direct = make伤害({ 伤害来源: '投射物', 伤害类型: this.伤害类型, 不变速: true, 伤害数值: this.伤害数值,
      所需回合: 3, 触发次数: this.触发次数, 击中点位置: hit.location, 击中点法线: hit.normal,
      来自技能: skill, 来自角色: from, 来自发射物: this, 目标角色: target });
    if (this.伤害类型 === '物理') from.造成即时伤害(direct, false, false); // L26903
    else if (this.伤害类型 === '流血') from.造成持续伤害(direct, false, false); // L26181
    else if (this.伤害类型 === '中毒' || this.伤害类型 === '爆炸') {
      // L19996 always selects literal0. The alternate144cross-ring branch is unreachable source code.
      from.更新运动数据();
      const points = 函数库_工具.范围选取点(this, hit.location, 32, 144, 48, 3, false, 16).选到的点;
      const cfg = make效果配置({ 效果类: 蓝图_效果_爆炸.path, 持续时间: 2, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 100 });
      for (let i = 0; i < points.length; i++) {
        if (!this.world.isValid(target)) continue;
        const name = 函数库_技能.获取效果名(this, skill, cfg.效果类).效果名字;
        const { effect, refreshed } = applyEffect(this, { cfg, owner: target, 释放者: from, 来自技能: skill, 效果名: name, classOf: from });
        if (refreshed || !(effect instanceof 蓝图_效果_爆炸)) continue;
        effect.伤害数据 = make伤害({ ...direct, 不变速: false, 击中点位置: { x: 0, y: 0, z: 0 }, 击中点法线: { x: 0, y: 0, z: 0 }, 目标角色: null });
        effect.爆炸位置 = points[i]!; effect.序号 = i; effect.触发次数 = this.触发次数;
        from.附加效果前(effect); effect.激活效果(''); from.附加效果后(effect);
      }
    } else if (this.伤害类型 === '电击') {
      // L25261/L23387: chain belongs to the source, with the projectile as its optional origin actor.
      if (!this.world.isValid(from)) return;
      const cfg = make效果配置({ 效果类: 蓝图_效果_闪电链.path, 持续时间: 1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 99 });
      const name = 函数库_技能.获取效果名(this, skill, cfg.效果类).效果名字;
      const { effect, refreshed } = applyEffect(this, { cfg, owner: from, 释放者: from, 来自技能: skill, 效果名: name, classOf: from });
      if (refreshed || !(effect instanceof 蓝图_效果_闪电链)) return;
      effect.非角色释放者 = this; effect.伤害数据 = make伤害({ ...direct, 伤害来源: '装备' }); effect.跳跃次数 = 1;
      effect.激活效果('');
      this.fx.vfx('CatapultHero/粒子/粒子_Hit_气刃', hit.location);
      return; // Shock does not take L1556's flesh sound.
    } else return; // Source switch has no 燃烧/剑气/抓钩 branch.
    this.fx.sound('CatapultHero/声音/音效_基础_砍中肉', hit.location, { volume: 1, pitch: 1.5 });
    this.fx.vfx('CatapultHero/粒子/粒子_Hit_气刃', hit.location);
  }
}

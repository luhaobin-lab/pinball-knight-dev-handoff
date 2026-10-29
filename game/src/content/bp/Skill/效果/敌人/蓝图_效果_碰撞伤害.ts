/**
 * 蓝图_效果_碰撞伤害 — contact damage: on 碰撞时 the owner hits the actor it touched with its 基础伤害, once per 受伤
 * lifetime of the victim (draft damage-crit-weakspot DAMAGE-090…093).
 * Demo: CatapultHero/BP/Skill/效果/敌人/蓝图_效果_碰撞伤害 (dump/blueprints-pseudo/…/效果/敌人/蓝图_效果_碰撞伤害.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.创建时, 碰撞时, 新一天时. Batch: core-damage.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_碰撞伤害 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_碰撞伤害';
  计数 = 0;

  // L10 / L15: empty overrides.
  override 激活后触发(_Debug: string): void {}
  override 销毁前触发(): void {}

  // L20 → L89
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 !== '效果.时机.碰撞时') return;
    const o = this.拥有者;
    const t = o?.当前碰到谁了;
    if (!o || !(t instanceof BP_ManeActor)) return;
    if (!(!t.受伤中 && t.角色类型 !== o.角色类型)) return;
    const h = this.命中数据;
    o.造成即时伤害(make伤害({
      伤害来源: '攻击', 伤害类型: '物理', 不变速: false, 是暴击: false, 是弱点: false,
      伤害数值: 获取科学映射词条(o.词条, '基础伤害').输出值, 所需回合: 3, 触发次数: 1,
      击中点位置: h.impactPoint, 击中点法线: h.impactNormal, 断开骨骼名: 'None',
      来自技能: this.来自技能, 来自角色: o, 来自发射物: null, 目标角色: t,
    }), false, false);
  }
}

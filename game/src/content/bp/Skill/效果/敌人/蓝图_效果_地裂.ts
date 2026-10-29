/** ENEMY--085, F-FISS L96/L272/L3941: rounds >1 emit rings 0..parameter0 in source order. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../../core/sim/types.ts';
import { attachEliteEffect } from './蓝图_效果_偏转力场.ts';
import { 蓝图_效果_地裂伤害 } from './蓝图_效果_地裂伤害.ts';

export class 蓝图_效果_地裂 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_地裂';
  创建的地形: (蓝图_效果 | null)[] = []; // source variable is never populated
  选取到的格子: Vec3[] = [];
  计数 = 0;
  override 激活后触发(_Debug: string): void { this.销毁延迟 = 0.6; }
  override ReceiveTick(_dt: number): void {}
  override 销毁前触发(): void {}
  override 持续中触发(tag: Tag): void {
    const owner = this.拥有者;
    if (tag === '效果.时机.死亡前') { this.fx.ui({ op: 'update', widget: '精英地裂', data: { actor: owner?.id, active: false } }); return; }
    if (tag !== '效果.时机.新一天时' || this.world.mode.当前层回合 <= 1 || !owner) return;
    函数库_工具.选择角色作为目标(this, owner);
    owner.更新运动数据();
    for (let ring = 0; ring <= Math.trunc(函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值); ring++) {
      this.选取到的格子 = 函数库_技能.选取范围地形格_十字环(this, this.world.mode, owner.当前位置, ring, false).选取到的格子;
      for (const at of this.选取到的格子) {
        attachEliteEffect(this, owner, make效果配置({ 效果类: 蓝图_效果_地裂伤害.path, 持续时间: -1, 持续回合: -1, 唯一: false, 叠加上限: 1 }), e => {
          e.K2_DetachFromActor(); e.K2_SetActorLocation(at);
          const fissure = e as 蓝图_效果_地裂伤害;
          fissure.序号 = ring;
          fissure.伤害数值 = 科学数乘除(获取科学映射词条(owner.词条, '基础伤害').输出值, sciOf(函数库_技能.获取技能参数(this, this.来自技能, 1, false, '').参数值, 0), false);
        });
      }
    }
  }
}

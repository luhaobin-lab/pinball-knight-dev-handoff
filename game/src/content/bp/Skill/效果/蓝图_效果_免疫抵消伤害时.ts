/**
 * 蓝图_效果_免疫抵消伤害时: spawned by 免疫处理 when an immune actor is hit; shows the "免疫" popup and destroys itself
 * (COMBAT-047).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_免疫抵消伤害时 (dump/blueprints-pseudo/…/蓝图_效果_免疫抵消伤害时.txt).
 * Parent: 蓝图_效果. CDO tags: manifest. Batch: core-status-rating.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 函数库_工具 } from '../../../../core/bp/index.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';

/** strings.json 32F06C4443C54836875356BD8A033804 (#175): 免疫 / Immunity. */
const 免疫 = '免疫';

export class 蓝图_效果_免疫抵消伤害时 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_免疫抵消伤害时';

  // L25
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    函数库_工具.更新目标和自身运动数据(this, owner);
    owner.被击特效A = null;
    // 创建伤害提示("免疫", {当前受伤数据, 是弱点 false, 触发次数 1, 断开骨骼名 '免疫'}, None, false, 思源黑体): no target
    // actor, so the popup sits at the hit point.
    const d = owner.当前受伤数据;
    this.fx.popup({ popup: 'text', value: 免疫, target: null, at: { ...d.击中点位置 }, damageType: d.伤害类型 });
    this.销毁效果(); // L10
  }

  // L1111 → L1116
  override 销毁前触发(): void {}

  // L1116
  override 持续中触发(_触发时机: Tag): void {}
}

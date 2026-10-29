/**
 * 蓝图_能力_挥击 — the launch skill of 可控挥击 (幽冥骑士) and 可控反蹬箭 (灵魂猎手): applies 效果配置[0]
 * (蓝图_效果_可控反弹时交互) and then 效果配置[1] (蓝图_效果_可控弹射) to its owner; castable only while preview circles
 * are displayed.
 * Demo: CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_挥击 (执行技能 L4524 → L10/L57/L222/L2264; 被选中 L4752;
 * 检查子条件 L4803; 释放结束 L5021 is a parent call); turn-flow TURN-043/044, launch-movement §9.1. Parent: 蓝图_能力.
 * Batch: core-launch-sys.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { BP_Actor_Player } from '../../../../../core/sim/player.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { applyEffect, launchNative } from '../../效果/蓝图_效果_可控弹射.ts';

export class 蓝图_能力_挥击 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_挥击';
  格挡率: number = 0;

  // L4524
  override 执行技能(_是读档: boolean): void {
    const owner = this.拥有者;
    函数库_工具.更新目标和自身运动数据(this, owner);
    if (!owner || !this.world.isValid(owner) || owner.死掉了) return; // L10
    // L57 / L222: 效果配置[0], then 效果配置[1]; an existing unique instance is re-activated.
    for (const i of [0, 1]) {
      if (i === 1 && (!this.world.isValid(owner) || owner.死掉了)) return; // L222 → L2264 checks
      const cfg = this.效果配置[i];
      if (!cfg) return;
      const name = 函数库_技能.获取效果名(this, this, cfg.效果类).效果名字;
      const { effect } = applyEffect(this, { cfg, owner, 释放者: owner, 来自技能: this, 效果名: name, classOf: owner });
      if (!effect) return; // "效果生成失败"
      effect.激活效果('');
    }
  }

  // L4752
  override 被选中(): void {
    函数库_工具.选择角色作为目标(this, this.拥有者);
  }

  // L4803: 子条件通过？ = the hero shows at least one preview circle
  override 检查子条件(): void {
    const owner = this.拥有者;
    if (!(owner instanceof BP_Actor_Player)) return;
    this.子条件通过 = launchNative(this).DisplayedCircleCount(owner) > 0;
  }
}

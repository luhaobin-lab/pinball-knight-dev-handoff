/**
 * 蓝图_能力_精核矿 — Essencite ore: 子触发 gives RandomIntegerInRange(参数0, 参数1) 精核 (2–4) with the pickup hint, then
 * 释放结束 and ends the hero's action.
 * Demo: CatapultHero/BP/Skill/Ability/道具/蓝图_能力_精核矿 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/道具/蓝图_能力_精核矿.txt)
 * Parent: 蓝图_能力_点击交互. CDO tags (manifest): none.
 * Rows: 数据表_技能_道具:精核矿.
 * Batch: core-rewards.
 */
import type { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { RandomIntegerInRange } from '../../../../../core/rng/ue.ts';
import type { AssetPath } from '../../../../demo/types.ts';
import { 蓝图_能力_点击交互 } from './蓝图_能力_点击交互.ts';

export class 蓝图_能力_精核矿 extends 蓝图_能力_点击交互 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_精核矿';
  添加的实例: 蓝图_效果 | null = null;
  获取数量: number = 0;

  // L10
  override 子触发(): void {
    const mode = this.world.mode;
    const max = FTrunc(函数库_技能.获取技能参数(this, this, 1, false, '').参数值);
    const min = FTrunc(函数库_技能.获取技能参数(this, this, 0, false, '').参数值);
    this.获取数量 = RandomIntegerInRange(this.world.rng.meta, min, max); // CORE-M-129 #62: meta
    mode.增加金币_收入(false, true, this.获取数量, mode.玩家角色);
    const p = mode.玩家角色?.K2_GetActorLocation();
    if (p) this.fx.vfx('CatapultHero/粒子/粒子_货币拾取', { x: p.x, y: p.y, z: p.z + 14 });
    this.释放结束(false);
    mode.玩家角色?.结束行动(null, '');
  }
}

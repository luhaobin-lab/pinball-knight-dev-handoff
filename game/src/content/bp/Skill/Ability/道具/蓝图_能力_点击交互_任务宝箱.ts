/**
 * 蓝图_能力_点击交互_任务宝箱 — the task chest / altar: 子触发 completes the room task (当前任务实例.未完成 = false) and ends the
 * hero's action on the next tick; 子初始化 lights the candles when 参数1 = 1 (presentation).
 * Demo: CatapultHero/BP/Skill/Ability/道具/蓝图_能力_点击交互_任务宝箱 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/道具/蓝图_能力_点击交互_任务宝箱.txt)
 * Parent: 蓝图_能力_点击交互. CDO tags (manifest): none.
 * Rows: 数据表_技能_道具:交互任务宝箱, 数据表_技能_道具:交互任务祭坛.
 * Batch: core-rewards.
 */
import { 蓝图_能力_点击交互 } from './蓝图_能力_点击交互.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_能力_点击交互_任务宝箱 extends 蓝图_能力_点击交互 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_点击交互_任务宝箱';

  // L85
  override 子触发(): void {
    const mode = this.world.mode;
    const task = mode.当前任务实例 as (typeof mode.当前任务实例 & { 未完成?: boolean }) | null;
    if (task) task.未完成 = false;
    this.nextTick('L85', () => mode.玩家角色?.结束行动(null, '')); // L15
  }

  // L190: 粒子_环境_蜡烛光 active when 参数1 = 1 (presentation only).
  override 子初始化(): void {}
}

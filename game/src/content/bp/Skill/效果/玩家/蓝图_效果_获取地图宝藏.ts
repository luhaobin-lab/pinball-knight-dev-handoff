/**
 * 蓝图_效果_获取地图宝藏 — the room reward after the task (the loot after Victory): on activation it locks interaction,
 * skips the reward animation for every reward except 获取属性 / 无 / 复合奖励, marks the current map tile cleared and runs
 * its reward ability (被选中, 执行技能), then destroys itself (销毁延迟 1 s).
 * Demo: CatapultHero/BP/Skill/效果/玩家/蓝图_效果_获取地图宝藏 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/玩家/蓝图_效果_获取地图宝藏.txt)
 * Parent: 蓝图_效果. CDO tags: see classes.ts.
 * Batch: core-rewards.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { currentMapTile } from '../../../../../core/sim/map-tile.ts';
import type { Tag } from '../../../../../core/sim/types.ts';
import type { AssetPath } from '../../../../demo/types.ts';

const ANIMATED = ['能力.类型.奖励.获取属性', '能力.类型.奖励.无', '能力.类型.奖励.复合奖励'];

export class 蓝图_效果_获取地图宝藏 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_获取地图宝藏';
  是天赋: boolean = true;
  跳过动画: boolean = false;

  // L1354
  override 激活后触发(_Debug: string): void {
    this.销毁延迟 = 1.0;
    const w = this.world;
    const ctrl = w.mode.玩家控制器;
    if (ctrl) ctrl.玩家可与环境交互 = false; // L678
    const reward = currentMapTile(w)?.奖励技能实例;
    this.跳过动画 = !(reward?.类型.hasAny(ANIMATED) ?? false);
    if (this.跳过动画) { // L372
      this.跳过动画事件(false);
      return;
    }
    // L406: the fanfare; the reward timeline (时间轴) only moves the particles and the pickup sphere.
    this.fx.sound('CatapultHero/声音/Tribal_Win_2');
    if (ctrl) ctrl.玩家可与环境交互 = true; // L476
    this.领取(true);
  }

  /** 跳过动画(无UI提示) (L2785 → L2725 → L2407). Named 跳过动画 in the Demo; the bool field takes that name here. */
  跳过动画事件(_无UI提示: boolean): void {
    const ctrl = this.world.mode.玩家控制器;
    if (ctrl) ctrl.玩家可与环境交互 = true;
    this.领取(false);
  }

  /** L476 / L2407: mark the tile cleared, run the reward ability (with the 奖励提示 banner when animated, L10), destroy. */
  private 领取(banner: boolean): void {
    const tile = currentMapTile(this.world);
    if (!tile) return;
    tile.已清理 = true;
    const reward = tile.奖励技能实例;
    if (reward && this.world.isValid(reward)) {
      if (banner) this.fx.ui({ op: 'open', widget: 'UI_奖励提示', data: { 类型: 0 } });
      reward.被选中();
      reward.执行技能(false);
    }
    this.销毁效果(); // L357 / L2710
  }

  // L1028
  override 持续中触发(_触发时机: Tag): void {}

  // L1033
  override 销毁前触发(): void {}

  // L1052: the pickup sphere's overlap with an item AI (可交互.角色.AI.物品.玩家) → 交互到不可拾取物品; the scan sphere
  // grows with the timeline, which this port does not run (the reward is taken at once).
}

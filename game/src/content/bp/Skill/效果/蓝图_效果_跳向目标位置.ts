/**
 * 蓝图_效果_跳向目标位置 — the owner jumps to its 目标位置 with the BP mover (移到目标地点: 卡牌平面位移曲线, 高度曲线,
 * 移动速度 800, 高度 200), immune and without collision while airborne; on 结束移动后 it lands, releases the turn-start
 * barrier of its skill and ends. Parent of the wave-B 飞跃重击 and 腾跃 (launch-movement §5.11, ENEMIE-054).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_跳向目标位置 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/蓝图_效果_跳向目标位置.txt)
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.创建时, 效果.时机.结束移动后.
 * Rows: none.
 * Batch: core-physics.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { Tag } from '../../../../core/sim/types.ts';
import type { AssetPath } from '../../../demo/types.ts';

export class 蓝图_效果_跳向目标位置 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_跳向目标位置';
  移动速度: number = 800;
  高度曲线: string = '卡牌高度位移曲线';
  高度: number = 200;

  // Hooks of the subclasses.
  结束跳跃(): void {}
  开始跳跃(): void {}

  // L91
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者;
    if (!owner) return;
    owner.OwnedGameplayTags.add('状态.免疫');
    owner.关闭碰撞();
    this.销毁延迟 = 1.0;
    // The trail 粒子_轨迹 attached to the capsule at (0, 0, 3 − 高度), width 高度 − 10.
    this.fx.vfx('CatapultHero/粒子/粒子_轨迹', owner, { attach: true });
    this.开始跳跃();
    owner.移到目标地点('卡牌平面位移曲线', this.高度曲线, this.移动速度, this.高度);
  }

  // L762: Delay 0.75, then the trail deactivates (presentation: it ends with the effect).
  override 销毁前触发(): void {
    this.delay('L762', 0.75, () => {});
  }

  // L817
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 !== '效果.时机.结束移动后') return;
    // L886
    const owner = this.拥有者;
    owner?.开启碰撞();
    this.结束跳跃();
    this.游戏模式?.退出回合开始(this.来自技能);
    owner?.OwnedGameplayTags.remove('状态.免疫');
    this.销毁效果();
  }
}

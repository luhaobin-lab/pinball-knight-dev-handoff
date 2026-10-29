/**
 * 蓝图_效果_物品被使用 — a used prop: plays its 道具使用 sequence, and 1 s later hides the prop, turns its collision off,
 * moves it to the deck position (牌库坐标) and destroys the effect. Only BP_Actor_Other owners play it.
 * Demo: CatapultHero/BP/Skill/效果/道具/蓝图_效果_物品被使用 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/道具/蓝图_效果_物品被使用.txt)
 * Parent: 蓝图_效果. CDO tags: see classes.ts.
 * Batch: core-rewards.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { SetActorHiddenInGame } from '../../../../../core/sim/engine.ts';
import { BP_Actor_Other } from '../../../../../core/sim/other.ts';
import type { Tag } from '../../../../../core/sim/types.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_效果_物品被使用 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/道具/蓝图_效果_物品被使用';

  // L601 → L426 (dynamic material, presentation) → L292
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者;
    if (!(owner instanceof BP_Actor_Other)) return;
    this.fx.ui({ op: 'update', widget: '道具使用', data: { actor: owner.id, play: true } }); // 道具使用.PlaySequence
    this.delay('L237', 1.0, () => { // the ubergraph head
      this.fx.ui({ op: 'update', widget: '道具使用', data: { actor: owner.id, play: false } }); // StopSequence
      SetActorHiddenInGame(owner, true);
      owner.关闭碰撞();
      owner.K2_SetActorLocation(this.world.mode.牌库坐标);
      this.销毁效果();
    });
  }

  // L599
  override 持续中触发(_触发时机: Tag): void {}

  // L600
  override 销毁前触发(): void {}
}

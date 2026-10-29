/**
 * 蓝图_效果_残影 — an afterimage of its owner's flipbook that dissolves along its timeline (消散 = track × 20), then
 * destroys itself. Presentation only: the core plays the timeline for its lifetime.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_残影 (L210 → L173, L10, L717 → L702). Parent: 蓝图_效果.
 * CDO tags (manifest): 效果.时机.创建时. Batch: core-launch-sys.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { HasAnimationSnapshot,AnimationSnapshot,HasSpriteFacing } from '../../../../core/sim/presentation-state.ts';

export class 蓝图_效果_残影 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_残影';
  ug_afterimage:{createdAt:number;dissolve:number;animation?:AnimationSnapshot;facing:1|-1;ownerHeight:number}|null=null;

  override 激活后触发(_Debug: string): void {
    const sprite = this.拥有者?.精灵片;
    const owner=this.拥有者,latest=(owner as typeof owner & HasAnimationSnapshot)?.ug_animation;
    // Expired override is not the current source flipbook. The full AnimBP fallback remains a stated gap.
    const animation=latest&&(latest.loop||this.world.clock.now-latest.startedAt<latest.seconds)?latest:undefined;
    // L210 copies the flipbook, then reads THIS component's playback position (new component=0), not the owner's.
    this.ug_afterimage={createdAt:this.world.clock.now,dissolve:0,animation:animation?{...animation}:undefined,facing:(owner as typeof owner&HasSpriteFacing)?.ug_spriteScaleX??1,ownerHeight:owner?.高度??0};
    if (sprite) this.fx.flipbook(this, sprite, { loop: false });
    this.timeline('时间轴', 'Play', { update:(_t,tracks)=>{if(this.ug_afterimage)this.ug_afterimage.dissolve=Math.fround((Object.values(tracks)[0]??0)*20);},finished: () => this.销毁效果() });
  }

  override 持续中触发(_触发时机: string): void {}
}

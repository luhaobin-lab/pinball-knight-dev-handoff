/**
 * 蓝图_效果_弱点 — a weak-spot marker at 45° + 90° × 弱点角度 around a BP_Actor_Other, removed at 行动结束后 or 死亡前.
 * Dormant in the Demo (no caller of 生成弱点, DAMAGE-140…146): ported as written, no damage bonus.
 * Demo: CatapultHero/BP/Skill/效果/敌人/蓝图_效果_弱点 (dump/blueprints-pseudo/…/效果/敌人/蓝图_效果_弱点.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.行动结束后, 效果.时机.新一天时, 效果.时机.死亡前. Batch: core-damage.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { BP_Actor_Other } from '../../../../../core/sim/other.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_弱点 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_弱点';
  弱点角度 = 0;
  As_BP_Actor_Other: BP_Actor_Other | null = null;

  // L318
  override 激活后触发(_Debug: string): void {
    const o = this.拥有者;
    if (!(o instanceof BP_Actor_Other)) return;
    this.As_BP_Actor_Other = o;
    const a = (Math.fround(this.弱点角度 * 90 + 45) * Math.PI) / 180;
    const p = this.K2_GetActorLocation();
    this.K2_SetActorLocation({ x: p.x + Math.cos(a) * o.高度, y: p.y + Math.sin(a) * o.高度, z: p.z });
    this.fx.ui({ op: 'open', widget: 'UI_弱点提示', data: { owner: o.id, at: this.K2_GetActorLocation() } }); // 激活弱点提示
  }

  // L25
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 !== '效果.时机.行动结束后' && 触发时机 !== '效果.时机.死亡前') return;
    this.fx.ui({ op: 'close', widget: 'UI_弱点提示', data: { effect: this.id } }); // 侧栏UI hidden
    this.销毁效果(); // L162 / L211 → L10
  }

  // L250
  override 销毁前触发(): void {
    if (this.As_BP_Actor_Other) this.As_BP_Actor_Other.弱点角度.length = 0;
  }
}

/**
 * 蓝图_效果_受伤 — the hurt reaction attached by every successful hit: 受伤中？ gate, hit sound, damage popup, the
 * owner's death check and the camera shake (draft damage-crit-weakspot DAMAGE-060/061/092).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_受伤 (dump/blueprints-pseudo/…/效果/蓝图_效果_受伤.txt).
 * Parent: 蓝图_效果. CDO tags: none. Batch: core-damage.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 科学数变普通 } from '../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';

export class 蓝图_效果_受伤 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_受伤';

  // L2403
  override 激活后触发(_Debug: string): void {
    const o = this.拥有者;
    if (!o) return;
    o.受伤中 = true;
    // L1848: the hit sound is the skill's 音效[0].
    const s = this.world.isValid(this.来自技能) ? this.来自技能.音效[0] ?? null : null;
    if (s) this.fx.sound(s, o.K2_GetActorLocation(), { volume: 1, pitch: 1 });
    // L2236 → L183. SPEC-GAP: the Demo merges popups per (victim, skill) in 回合伤害来源映射 through 提示简化处理
    // (a widget map the declarations do not carry, cleared by the presentation-only 清理提示映射); every hit emits its
    // popup here and the shell may merge them by target and source.
    const d = o.当前受伤数据;
    const marker = d.断开骨骼名 !== 'None' ? d.断开骨骼名 : null;
    this.fx.popup({
      popup: 'damage', value: 科学数变普通(o.当前受伤数值), target: o.id, at: d.击中点位置, crit: d.是暴击, weak: d.是弱点,
      damageType: marker ?? (d.伤害来源 !== '减益' && ['中毒', '流血', '燃烧'].includes(d.伤害类型) ? `持续:${d.伤害类型}` : d.伤害类型),
    });
    // L1391
    o.检查死亡(false, false);
    if (d.伤害来源 === '攻击' || d.伤害来源 === '投射物') {
      // 摄像机晃动_零点二 at the camera centre, outer radius 750 on crits, else 550 (DAMAGE-060).
      this.fx.shake(d.是暴击 ? '摄像机晃动_零点二:750' : '摄像机晃动_零点二:550');
    }
  }

  // L2446
  override 销毁前触发(): void {
    if (this.拥有者) this.拥有者.受伤中 = false;
  }

  // L2484: no reaction. The timelines 暴击时间扭曲 / 普通时间扭曲 are never started (DAMAGE-062): not ported.
  override 持续中触发(_触发时机: Tag): void {}
}

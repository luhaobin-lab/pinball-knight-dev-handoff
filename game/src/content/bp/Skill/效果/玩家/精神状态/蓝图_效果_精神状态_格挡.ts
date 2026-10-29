/**
 * 蓝图_效果_精神状态_格挡 — the Block mirror: activation sets 拥有者.格挡层计数 = 叠加层数; each 格挡后 removes one
 * stack whatever was consumed; at 0 (with a valid cell) or at floor end it is destroyed, which zeroes the counter
 * (combat-statuses COMBAT-030…037). Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_格挡 (L10…L4742).
 * Parent: 蓝图_效果_精神状态. CDO tags (manifest): 新一天时, 格挡后, 结束层时. Batch: core-stamina.
 */
import { 函数库_科学数 } from '../../../../../../core/bp/index.ts';
import { 科学数Power, 科学数加减, 科学数变普通 } from '../../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../../core/sim/types.ts';
import { 蓝图_效果_精神状态 } from './蓝图_效果_精神状态.ts';

/** KismetTextLibrary.AsPercent_Float(v, …, max 1 fractional digit), v as a float. */
function asPercent(v: number): string {
  const r = Math.round(Math.fround(v) * 100 * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}%`;
}

export class 蓝图_效果_精神状态_格挡 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_格挡';
  闪避_格挡 = true; // 闪避/格挡

  /** L4359 → L2298 → L2216. */
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    this.拥有者!.格挡层计数 = this.叠加层数;
    if (this.对应增减益格) this.刷新格挡格();
  }

  /** L4432. */
  override 持续中触发(触发时机: Tag): void {
    super.持续中触发(触发时机);
    if (触发时机 === '效果.时机.格挡后') {
      // L4586 → L2168: one stack per 格挡后; without a valid cell nothing else happens (COMBAT-033).
      this.叠加层数 = this.叠加层数 - 1;
      if (!this.对应增减益格) return;
      if (this.叠加层数 > 0) this.刷新格挡格(); // L10
      else this.销毁效果(); // L2153
      return;
    }
    if (触发时机 === '效果.时机.结束层时') this.销毁效果(); // L2153
  }

  /** L4687. */
  override 销毁前触发(): void {
    super.销毁前触发();
    this.拥有者!.格挡层计数 = 0;
  }

  /** L10 / L2298: name 格挡, tooltip COMBAT-035, icon SkillIcon3_Sprite_6. */
  private 刷新格挡格(): void {
    const cell = this.对应增减益格!;
    const owner = this.拥有者!;
    const 上限 = 科学数变普通(函数库_科学数.获取科学映射词条(this, owner.词条, '格挡层上限').输出值);
    const 减伤 = 函数库_科学数.获取科学映射词条(this, owner.词条, '格挡减伤%').输出值;
    const 当前 = 1 - 科学数变普通(科学数Power(科学数加减({ 系数: 1, 指数: 0 }, 减伤, true), owner.格挡层计数));
    const text = `每层格挡减少<天赋>${asPercent(科学数变普通(减伤))}</>受到的伤害，受到伤害时移除一层格挡。\r\n最多叠加<天赋>${Math.round(上限)}</>层，当前减少<天赋>${asPercent(当前)}</>。`;
    cell.名字 = { zh: '格挡', en: '格挡' };
    cell.内容 = { zh: text, en: text };
    cell.图标 = 'CatapultHero/精灵片/技能/SkillIcon3_Sprite_6';
    this.更新增减益格();
  }
}

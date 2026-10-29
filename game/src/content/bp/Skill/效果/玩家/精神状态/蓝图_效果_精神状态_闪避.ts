/**
 * 蓝图_效果_精神状态_闪避 — the Dodge mirror: activation sets 拥有者.闪避层计数 = 叠加层数; each 闪避后 removes one stack;
 * at 0 (with a valid cell) or at floor end it is destroyed, which zeroes the counter (combat-statuses COMBAT-038…).
 * Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_闪避 (pseudo L10…L2741).
 * Parent: 蓝图_效果_精神状态. CDO tags (manifest): 新一天时, 闪避后, 结束层时. Batch: core-stamina.
 */
import { 函数库_科学数 } from '../../../../../../core/bp/index.ts';
import { 科学数变普通 } from '../../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../../core/sim/types.ts';
import { 蓝图_效果_精神状态 } from './蓝图_效果_精神状态.ts';

export class 蓝图_效果_精神状态_闪避 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_闪避';
  闪避_格挡 = false; // 闪避/格挡

  /** L1218. */
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    this.拥有者!.闪避层计数 = this.叠加层数;
    if (this.对应增减益格) this.刷新闪避格();
  }

  /** L2431. */
  override 持续中触发(触发时机: Tag): void {
    super.持续中触发(触发时机);
    if (触发时机 === '效果.时机.闪避后') {
      // L2585 → L10: one stack per 闪避后; without a valid cell nothing else happens.
      this.叠加层数 = this.叠加层数 - 1;
      if (!this.对应增减益格) return;
      if (this.叠加层数 > 0) this.刷新闪避格();
      else this.销毁效果(); // L1203
      return;
    }
    if (触发时机 === '效果.时机.结束层时') this.销毁效果(); // L1203
  }

  /** L2686. */
  override 销毁前触发(): void {
    super.销毁前触发();
    this.拥有者!.闪避层计数 = 0;
  }

  /** Name 闪避, content {0} = 叠加层数, {1} = 闪避层上限, icon SkillIcon3_Sprite_16. */
  private 刷新闪避格(): void {
    const cell = this.对应增减益格!;
    const 上限 = 科学数变普通(函数库_科学数.获取科学映射词条(this, this.拥有者!.词条, '闪避层上限').输出值);
    const text = `闪避下<天赋>${this.叠加层数}</>次伤害，使受到的伤害减少<天赋>90%</>。\r\n最多叠加<天赋>${上限}</>层。`;
    cell.名字 = { zh: '闪避', en: '闪避' };
    cell.内容 = { zh: text, en: text };
    cell.图标 = 'CatapultHero/精灵片/技能/SkillIcon3_Sprite_16';
    this.更新增减益格();
  }
}

/**
 * 蓝图_效果_精神状态_光阴 — Flowstate: after a skill in slot ≥ 1 it cancels that many cooldown turns (SCM-120…123,
 * ABILIT-038); ends at floor end; never saved. Granted by structs (骄傲, 充能获得光阴, 回流, 怒火精炼, 黄金头盔).
 * Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_光阴 (pseudo L10…L2256).
 * Parent: 蓝图_效果_精神状态. CDO tags (manifest): 新一天时, 闪避后, 结束层时, 释放技能后. Batch: core-stamina.
 */
import { 函数库_技能 } from '../../../../../../core/bp/index.ts';
import type { AssetPath, Tag } from '../../../../../../core/sim/types.ts';
import { 蓝图_效果_精神状态 } from './蓝图_效果_精神状态.ts';

export class 蓝图_效果_精神状态_光阴 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_光阴';
  闪避_格挡 = false; // 闪避/格挡

  /** L1470 → L10. */
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    this.刷新心流格();
  }

  /** L1494. 新一天时 and 闪避后 have no handler. */
  override 持续中触发(触发时机: Tag): void {
    super.持续中触发(触发时机);
    if (触发时机 === '效果.时机.结束层时') {
      this.销毁效果(); // L2007
      return;
    }
    if (触发时机 !== '效果.时机.释放技能后') return;
    // L1652: only skills after slot 0 (the launch skill).
    const owner = this.拥有者!;
    const 能力 = owner.当前能力;
    if (!(owner.拥有的主动能力.indexOf(能力) > 0)) return;
    // A cast skill without 冷却效果 reads None.剩余回合 = 0 (SCM-TV-40).
    const 剩余 = 能力?.冷却效果?.剩余回合 ?? 0;
    if (this.叠加层数 <= 剩余) {
      函数库_技能.技能减少冷却(this, 能力, this.叠加层数);
      this.销毁效果(); // L2007 (inside the live 释放技能后 walk: the next entry is skipped, §2 (a))
      return;
    }
    // L2022
    this.叠加层数 = this.叠加层数 - 剩余;
    能力?.冷却效果?.销毁效果();
    this.刷新心流格(); // L740
  }

  /** L10 / L740: name 心流, content #340, icon SkillIcon3_Sprite_26. */
  private 刷新心流格(): void {
    const cell = this.对应增减益格;
    if (!cell) return;
    cell.名字 = { zh: '心流', en: '心流' };
    cell.内容 = {
      zh: `心流会自动抵消技能释放后产生的冷却回合。\r\n当前有<天赋>${this.叠加层数}</>层心流。`,
      en: `心流会自动抵消技能释放后产生的冷却回合。\r\n当前有<天赋>${this.叠加层数}</>层心流。`,
    };
    cell.图标 = 'CatapultHero/精灵片/技能/SkillIcon3_Sprite_26';
    this.更新增减益格();
  }
}

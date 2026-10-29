/**
 * 蓝图_效果_精神状态_疼痛 — Pain: 额外生命% −0.1 per stack (overwrite) while present; up to 5 stacks, 10 turns. Granted by
 * the hero passive on a hit of 30 % of max HP or more (SCM-102/103).
 * Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_疼痛 (pseudo L10…L1771).
 * Parent: 蓝图_效果_精神状态. CDO tags (manifest): 新一天时, 效果.类型.减益.结算. Batch: core-stamina.
 */
import { 函数库_技能, 函数库_科学数 } from '../../../../../../core/bp/index.ts';
import type { AssetPath, Tag } from '../../../../../../core/sim/types.ts';
import { 蓝图_效果_精神状态 } from './蓝图_效果_精神状态.ts';

/** KismetTextLibrary.AsPercent_Float(v, HalfToEven, …, max 1 fractional digit), v as a float. */
function asPercent(v: number): string {
  const x = Math.fround(v) * 100;
  const r = Math.round(x * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}%`;
}

export class 蓝图_效果_精神状态_疼痛 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_疼痛';
  上一次叠加值 = 0;

  /** L889 → L10 → L94. */
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    this.world.mode.玩家角色?.精神系统(-5, 5, '疼痛状态', false);
    const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '');
    函数库_科学数.添加科学映射值(this, this.拥有者!.词条, p.词条, `${this.来自技能?.唯一ID ?? ''}`, { 系数: this.叠加层数 * p.参数值, 指数: 0 }, false);
    this.拥有者!.属性被修改后(); // L10: max HP = Σ生命 × (1 + Σ额外生命%), current HP clamped (CORE-M-060)
    // L94: the cell text {0} = AsPercent(|stacks × p0|).
    const cell = this.对应增减益格;
    if (cell) {
      const pct = asPercent(Math.abs(this.叠加层数 * 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值));
      cell.内容 = { zh: cell.内容.zh.replaceAll('{0}', pct), en: cell.内容.en.replaceAll('{0}', pct) };
      this.更新增减益格();
    }
  }

  /** L1391. */
  override 持续中触发(触发时机: Tag): void {
    super.持续中触发(触发时机);
    this.world.mode.玩家角色?.精神系统(-1, 1, '疼痛状态', false);
  }

  /** L1495 → L800: remove the source, then 更新最大生命魔力 (the max returns; current HP is not refilled). */
  override 销毁前触发(): void {
    super.销毁前触发();
    const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '');
    if (函数库_科学数.移除科学映射值(this, this.拥有者!.词条, p.词条, `${this.来自技能?.唯一ID ?? ''}`)) this.拥有者!.更新最大生命魔力();
  }
}

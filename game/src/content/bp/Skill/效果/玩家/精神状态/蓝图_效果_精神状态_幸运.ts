/**
 * 蓝图_效果_精神状态_幸运 — Luck: 全局词条 品质提升修正% = n and, each turn start, RandRange(n / 2, n) Essencite, with
 * n = FTrunc(stacks × (Σ幸运增益% + 1)) (SCM-104). Up to 3 stacks, 5 turns.
 * Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_幸运 (pseudo L10…L2727).
 * Parent: 蓝图_效果_精神状态. CDO tags (manifest): 新一天时. Batch: core-stamina.
 */
import { 函数库_科学数 } from '../../../../../../core/bp/index.ts';
import { Divide_IntInt, FTrunc } from '../../../../../../core/math/kismet.ts';
import { 科学数变普通 } from '../../../../../../core/math/sci.ts';
import { RandomIntegerInRange } from '../../../../../../core/rng/ue.ts';
import type { AssetPath, Tag } from '../../../../../../core/sim/types.ts';
import { 蓝图_效果_精神状态 } from './蓝图_效果_精神状态.ts';

export class 蓝图_效果_精神状态_幸运 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_幸运';

  private n(): number {
    const g = 函数库_科学数.获取科学映射词条(this, this.world.mode.全局词条, '幸运增益%').输出值;
    return FTrunc(this.叠加层数 * (科学数变普通(g) + 1));
  }

  /** L10: the cell text {0} = "<天赋>0</>", {1} = "<天赋>n</>" (set without 更新增减益格); then the quality source. */
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    const n = this.n();
    const desc = this.来自技能?.原始描述 ?? { zh: '', en: '' };
    const fmt = (s: string): string => s.replaceAll('{0}', '<天赋>0</>').replaceAll('{1}', `<天赋>${n}</>`);
    if (this.对应增减益格) this.对应增减益格.内容 = { zh: fmt(desc.zh), en: fmt(desc.en) };
    函数库_科学数.添加科学映射值(this, this.world.mode.全局词条, '品质提升修正%', this.来自技能?.唯一ID ?? '', { 系数: this.n(), 指数: 0 }, false);
    this.world.mode.玩家角色?.精神系统(0, 3, '幸运状态', true);
  }

  /** L2043: one `combat` draw RandRange(n / 2, n) of Essencite (增加金币/收入 with 金币/收入 = false). */
  override 持续中触发(触发时机: Tag): void {
    super.持续中触发(触发时机);
    const n = this.n();
    const r = RandomIntegerInRange(this.world.rng.combat, Divide_IntInt(n, 2), n);
    this.world.mode.增加金币_收入(false, true, r, this.world.mode.玩家角色);
  }

  /** L2591. */
  override 销毁前触发(): void {
    super.销毁前触发();
    函数库_科学数.移除科学映射值(this, this.world.mode.全局词条, '品质提升修正%', this.来自技能?.唯一ID ?? '');
  }
}

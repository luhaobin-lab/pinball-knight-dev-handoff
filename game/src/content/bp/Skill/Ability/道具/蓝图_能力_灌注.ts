/**
 * 蓝图_能力_灌注 — Infuse (魔力药剂 使用灌注目标): every item 技能条件筛选物品 selects (one random item when 需求位置 is
 * 随机) gets 添加行动力(true, trunc(p0), trunc(owner 连击), true, false); the ability ends 0.5 s later.
 * Demo: CatapultHero/BP/Skill/Ability/道具/蓝图_能力_灌注 (执行技能 L1297 → L15 / L601, L534); draft
 * charge-infuse-echocast CHARGE-054 (p0 = 0 + 50 × 等级: Infuse 50 / 100 / 200 / 400). Parent: 蓝图_能力.
 * Batch: core-launch-sys.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { Array_Random } from '../../../../../core/rng/ue.ts';

export class 蓝图_能力_灌注 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_灌注';
  治疗百分比: number = 0.1;
  目标牌: (BP_Actor_Card | null)[] = [];
  NewVar_0: BP_Actor_Card | null = null;

  // L1297
  override 执行技能(_是读档: boolean): void {
    this.目标牌 = 函数库_技能.技能条件筛选物品(this, this.world.cult, this, -1).筛选后;
    // Pure nodes are evaluated per use (连击 and p0 are read again for every target).
    const echo = (): number => FTrunc(科学数变普通(获取科学映射词条(this.拥有者!.词条, '连击').输出值));
    const p0 = (): number => FTrunc(函数库_技能.获取技能参数(this, this, 0, false, '').参数值);
    if (this.需求位置 === '随机') {
      // L15. SPEC-GAP: Array_Random domain (CORE-M-129 item use) taken as combat.
      const i = Array_Random(this.world.rng.combat, this.目标牌);
      this.NewVar_0 = i >= 0 ? this.目标牌[i] ?? null : null;
      this.NewVar_0?.添加行动力(true, p0(), echo(), true, false);
    } else {
      // L601: live index loop
      for (let i = 0; i < this.目标牌.length; i++) this.目标牌[i]?.添加行动力(true, p0(), echo(), true, false);
    }
    // L534: Delay 0.5 → 释放结束(false)
    this.delay('L534', 0.5, () => this.释放结束(false));
  }

  // L1296 / L1412 / L1413
  override 检查子条件(): void {}
  override 子初始化(): void {}
  override 被选中(): void {}
}

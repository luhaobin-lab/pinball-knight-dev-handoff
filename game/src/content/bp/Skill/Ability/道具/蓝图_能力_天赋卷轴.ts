/**
 * 蓝图_能力_天赋卷轴: the 无字书 scroll. Usable once a talent has been learned; it offers 3 of the hero's own talents
 * that are below their level cap (free, 1 refresh, outside the turn-start barrier, 参数 [0] − 1 extra levels).
 * Demo: CatapultHero/BP/Skill/Ability/道具/蓝图_能力_天赋卷轴 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/道具/蓝图_能力_天赋卷轴.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: see classes.ts.
 * Batch: core-talents.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { Array_Shuffle } from '../../../../../core/rng/ue.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath } from '../../../../demo/types.ts';
import { 主界面 } from '../../效果/玩家/蓝图_效果_升级获取天赋.ts';

export class 蓝图_能力_天赋卷轴 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_天赋卷轴';
  已触发: boolean = false; // 已触发？

  /**
   * L1241: (unless 已触发？) the owned talents below 等级上限, shuffled on the meta domain (CORE-M-129 #59), offered.
   * SPEC-GAP: the Demo builds the list in UI_主界面.筛选后天赋池 and passes that same array as 指定池子; the port builds
   * it locally (开启多选一 copies 指定池子 into 筛选后天赋池 either way).
   */
  override 执行技能(_是读档: boolean): void {
    if (this.已触发) return;
    const hero = this.world.mode.玩家角色;
    const pool: string[] = [];
    for (const a of hero?.拥有的被动能力 ?? []) {
      if (a && a.是天赋 && a.等级 < a.等级上限 && !pool.includes(a.能力名)) pool.push(a.能力名); // L15
    }
    Array_Shuffle(this.world.rng.meta, pool); // L769
    // QUIRK (L769): with nothing to level, the empty 指定池子 makes 开启多选一 filter the whole talent pool with no tags.
    const 额外等级 = FTrunc(函数库_技能.获取技能参数(this, this, 0, false, '').参数值 - 1);
    主界面(this).开启多选一(this, false, new TagSet(), new TagSet(), pool, true, true, false, 3, 1, 额外等级, null, null);
    this.释放结束(false);
  }

  /** L1346 */
  override 被选中(): void {
    函数库_工具.选择角色作为目标(this, this.拥有者);
    this.已触发 = false;
  }

  /** L1404: needs at least one learned talent. */
  override 检查子条件(): void {
    this.子条件通过 = this.world.mode.已获取天赋数 > 0;
  }

  override 子初始化(): void {
    // L1480: nothing
  }
}

/** Source L10/L656: preserves the repeated remainder reads and999 cap sentinel; no per-round reset exists. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc, 计算除余数 } from '../../../../../core/math/kismet.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_会心时灌注自己 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_会心时灌注自己';
  特效: unknown = null; 角度抖动 = 0; 计数 = 0;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能; if (时机 !== '效果.时机.自身会心时' || !s) return;
    const limit = () => 函数库_技能.获取技能参数(this, s, 2, false, '').参数值;
    if (!(this.计数 < limit())) return;
    this.计数 = 计算除余数(this.计数, this.触发次数, limit()).余数;
    if (计算除余数(this.计数, this.触发次数, limit()).超出阈值) this.计数 = 999;
    const value = FTrunc(函数库_技能.获取技能参数(this, s, 1, false, '').参数值);
    const check = 计算除余数(this.计数, this.触发次数, limit());
    const target = s.类型.has('能力.类型.天赋') ? this.拥有者 : s.拥有者;
    target?.添加行动力(true, value, check.超出阈值 ? FTrunc(this.触发次数 - check.余数) : this.触发次数, true, false);
  }
}

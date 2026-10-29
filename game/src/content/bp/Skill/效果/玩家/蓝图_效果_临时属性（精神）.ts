/**
 * 蓝图_效果_临时属性（精神） — a "next combat" item stat: 词条[p0.词条][唯一ID] = {p0, 0} while present (overwrite, not
 * × stacks); removed at floor end in 杀敌 missions (持续回合 −2). Users: 节肢, 结晶碎片, 厚重石块, 迷幻中枢 (SCM-085).
 * Demo: CatapultHero/BP/Skill/效果/玩家/蓝图_效果_临时属性（精神） (pseudo L10…L803).
 * Parent: 蓝图_效果_精神状态. CDO: 临时？ = true; tags (manifest) 创建时, 结束层时. Batch: core-stamina.
 */
import type { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_科学数 } from '../../../../../core/bp/index.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
import { 蓝图_效果_精神状态 } from './精神状态/蓝图_效果_精神状态.ts';

export class 蓝图_效果_临时属性_精神 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_临时属性（精神）';
  override 临时 = true; // CDO override of 临时？
  上一次叠加值 = 0;
  拥有的效果: (蓝图_效果 | null)[] = [];

  /** L417; 属性被修改后 sits behind a constant-false branch. */
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '');
    函数库_科学数.添加科学映射值(this, this.拥有者!.词条, p.词条, `${this.来自技能?.唯一ID ?? ''}`, { 系数: p.参数值, 指数: 0 }, false);
  }

  /** L798 → L10 → L323: remove the source, then 更新最大生命魔力. */
  override 销毁前触发(): void {
    super.销毁前触发();
    const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '');
    if (函数库_科学数.移除科学映射值(this, this.拥有者!.词条, p.词条, `${this.来自技能?.唯一ID ?? ''}`)) this.拥有者!.更新最大生命魔力();
  }
}

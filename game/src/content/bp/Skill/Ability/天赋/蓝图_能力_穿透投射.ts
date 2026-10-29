/** Source L10/L66/L447: permanent hero penetration and named damage overwrite. The original has no release-finished call. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_能力_穿透投射 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_穿透投射';
  override 被选中(): void { 函数库_工具.选择角色作为目标(this, this.拥有者); }
  override 检查子条件(): void {}
  override 子初始化(): void {}
  override 执行技能(_loaded: boolean): void { const h = this.world.mode.玩家角色; if (!h) return; h.投射穿透 = -1; 添加科学映射值(h.词条, '额外伤害%', this.能力名, sciOf(函数库_技能.获取技能参数(this, this, 0, false, '').参数值, 0), false); }
}

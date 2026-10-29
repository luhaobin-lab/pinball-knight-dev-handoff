/** Source L427/L1328: ALL source target tags, accumulating count capped at p1; no refresh callbacks; floor removes source. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_有XX物品会心增加减伤 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_有XX物品会心增加减伤';
  累计计数 = 0;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, h = this.world.mode.玩家角色; if (!s || !h) return;
    const p = () => 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (t === '效果.时机.结束层时') { this.累计计数 = 0; 移除科学映射值(h.词条, p().词条, s.唯一ID); }
    else if (t === '效果.时机.有物品会心时') {
      if (s.目标标签.size && !this.world.cult.当前触发会心的牌?.OwnedGameplayTags.hasAll(s.目标标签.toArray())) return;
      this.累计计数 = (this.累计计数 + this.触发次数) | 0;
      const param = p(); 添加科学映射值(h.词条, param.词条, s.唯一ID, sciOf(Math.min(this.累计计数 * param.参数值, 函数库_技能.获取技能参数(this, s, 1, false, '').参数值), 0), false);
    }
  }
}

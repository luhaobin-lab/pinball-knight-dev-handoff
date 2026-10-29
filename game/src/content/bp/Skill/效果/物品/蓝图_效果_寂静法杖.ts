/** Source L805/L10: capped combo-scaled hero stat; no attribute refresh, and reset only at floor end. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除, 科学数加减, 比较科学数_纯正 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_寂静法杖 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_寂静法杖';
  词条名 = '元素伤害%'; 蓄能计数 = 0; 蓄能完毕 = false; 值 = sciOf(0, 0);
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者, hero = this.world.mode.玩家角色; if (!s || !owner || !hero) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (时机 === '效果.时机.自身完成充能') {
      const cap = 函数库_技能.获取技能参数(this, s, 1, false, '').参数值;
      const delta = 科学数乘除(科学数乘除(获取科学映射词条(owner.词条, '连击').输出值, sciOf(this.触发次数, 0), false), sciOf(p.参数值, 0), false);
      this.值 = 比较科学数_纯正(科学数加减(delta, this.值, false), sciOf(cap, 0), true);
      添加科学映射值(hero.词条, p.词条, s.唯一ID, this.值, false);
    } else if (时机 === '效果.时机.结束层时') {
      this.值 = sciOf(0, 0); 移除科学映射值(hero.词条, p.词条, s.唯一ID);
    }
  }
}

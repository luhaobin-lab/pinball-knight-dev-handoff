/** Source L281/L1316: map KEY presence (not positive remainder) sets/removes p0 on live enemies each day. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_根据持续修改敌人属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_根据持续修改敌人属性';
  已触发 = false; 流血数 = 0;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能; if (t !== '效果.时机.新一天时' || !s) return;
    const list = this.world.mode.敌方场上;
    for (let i = 0; i < list.length; i++) { const e = list[i]; if (!e) continue;
      const key = this.world.mode.持续伤害类型[['流血', '剧毒', '燃烧'].indexOf(函数库_技能.获取技能参数(this, s, 1, false, '').词条)], p = 函数库_技能.获取技能参数(this, s, 0, false, '');
      if (e.总持续伤害映射.has(key)) 添加科学映射值(e.词条, p.词条, s.唯一ID, sciOf(p.参数值, 0), false); else 移除科学映射值(e.词条, p.词条, s.唯一ID);
    }
  }
}

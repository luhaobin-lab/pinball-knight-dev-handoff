/** Source L1995/L980/L15: clear only the source card, then buff selected neighbours when exactly one matching equipped card. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_如果唯一 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_如果唯一';
  词条名 = '闪避%'; 累计次数 = 0; 来自牌: BP_Actor_Card | null = null; 附加目标: (BP_ManeActor | null)[] = [];
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者;
    if (时机 !== '效果.时机.物品发生变更' || !s) return;
    const chosen = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', false, s.目标标签, false, new TagSet(), -1).筛选后;
    if (!(owner instanceof BP_Actor_Card)) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (移除科学映射值(owner.词条, p.词条, s.唯一ID)) owner.更新外观数据();
    if (chosen.length !== 1 || !this.world.cult.已装备牌.includes(owner)) return;
    owner.获取相邻牌(false, { x: 0, y: 0, z: 0 }, new TagSet(), false);
    switch (s.需求位置) {
      case '无': this.附加目标 = [owner]; break;
      case '上相邻': this.附加目标 = [owner.上方牌]; break;
      case '下相邻': this.附加目标 = [owner.下方牌]; break;
      case '相邻': this.附加目标 = [...owner.相邻牌]; break;
      default: return;
    }
    for (let i = 0; i < this.附加目标.length; i++) {
      const target = this.附加目标[i]; if (!target || !this.world.isValid(target)) continue;
      const param = 函数库_技能.获取技能参数(this, s, 0, false, '');
      添加科学映射值(target.词条, param.词条, s.唯一ID, sciOf(param.参数值, 0), false); target.更新外观数据();
    }
  }
}

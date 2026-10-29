/** Source L152/L259: empty/all hero tag gate; permanent flat p0; refresh maxima without 属性被修改后. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_分解修改玩家属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_分解修改玩家属性';
  词条名 = '元素伤害%'; 所有牌: (BP_Actor_Card | null)[] = [];
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, h = this.world.mode.玩家角色;
    if (时机 !== '效果.时机.分解后' || !s || !h || !h.OwnedGameplayTags.hasAll(s.目标标签.toArray())) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    添加科学映射值(h.词条, p.词条, '永久保留', sciOf(p.参数值, 0), true); h.更新最大生命魔力();
  }
}

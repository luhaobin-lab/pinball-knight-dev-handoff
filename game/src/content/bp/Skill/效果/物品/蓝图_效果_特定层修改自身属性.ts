/** Source L1129/L211: completed mission and matching reward type, capped permanent source, price then appearance refresh. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { currentMapTile } from '../../../../../core/sim/map-tile.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_特定层修改自身属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_特定层修改自身属性';
  词条名 = '元素伤害%';
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者, task = this.world.mode.当前任务实例;
    if (!s || !owner || (task as { 未完成?: boolean } | null)?.未完成) return;
    const reward = currentMapTile(this.world)?.奖励技能实例;
    if (!reward?.类型.hasAny(s.目标标签.toArray())) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, ''), cap = 函数库_技能.获取技能参数(this, s, 1, false, '').参数值;
    const old = owner.词条.get(p.词条)?.来源映射.get('永久保留') ?? sciOf(0, 0);
    添加科学映射值(owner.词条, p.词条, '永久保留', sciOf(Math.min(p.参数值 + 科学数变普通(old), cap), 0), false);
    if (owner instanceof BP_Actor_Card) owner.更新价格(false); owner.更新外观数据();
  }
}

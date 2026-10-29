/** Source L15/L78: completed mission, source map-row ANY tags, inclusive meta draw0..trunc(p0). */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { RandomIntegerInRange } from '../../../../../core/rng/ue.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { BP_Mission } from '../../Ability/Mission/BP_Mission.ts';
import type { 结构_地图格 } from '../../../../demo/types.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_特定层获得精核 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_特定层获得精核';
  词条名 = '元素伤害%';
  override 持续中触发(_t: Tag): void {
    const s = this.来自技能, m = this.world.mode, mission = m.当前任务实例 as BP_Mission | null; if (!s || !mission || mission.未完成) return;
    const handle = m.当前层地图格配置表, row = (handle.DataTable ? this.world.data.table(handle.DataTable)?.rows[handle.RowName] : undefined) as 结构_地图格 | undefined;
    if (!row || !new TagSet(row.标签).hasAny(s.目标标签.toArray())) return;
    m.增加金币_收入(false, true, RandomIntegerInRange(this.world.rng.meta, 0, Math.trunc(函数库_技能.获取技能参数(this, s, 0, false, '').参数值)), null);
  }
}

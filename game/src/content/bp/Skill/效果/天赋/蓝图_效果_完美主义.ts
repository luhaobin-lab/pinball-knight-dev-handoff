/** Source L15/L611: float GetDistanceTo and a LIVE pickup-array loop, not a snapshot. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 蓝图_货币 } from '../可拾取物/蓝图_货币.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_完美主义 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_完美主义';
  override 持续中触发(_t: Tag): void {
    const s = this.来自技能, hero = this.world.mode.玩家角色; if (!s || !hero) return;
    const list = this.world.mode.场上可拾取物;
    for (let i = 0; i < list.length; i++) {
      const c = list[i]; if (!(c instanceof 蓝图_货币)) continue;
      const a = c.K2_GetActorLocation(), b = hero.K2_GetActorLocation();
      if (Math.fround(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)) <= 函数库_技能.获取技能参数(this, s, 0, false, '').参数值) c.被拾取();
    }
  }
}

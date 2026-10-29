/** Source L79/L352: hostile rebound adds a layer on the first block effect, then calls the existing block handler. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { 蓝图_效果_精神状态_格挡 } from '../玩家/精神状态/蓝图_效果_精神状态_格挡.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_屠戮收割 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_屠戮收割';
  角度抖动 = 0;
  override 持续中触发(t: Tag): void {
    const o = this.拥有者, hit = o?.当前碰到谁了;
    if (t !== '效果.时机.反弹时' || !o || !(hit instanceof BP_ManeActor) || !hit.OwnedGameplayTags.has('可交互.角色.AI.仇恨')) return;
    const r = 函数库_工具.对应类型效果数量(this, o.拥有的效果, 蓝图_效果_精神状态_格挡.path), e = r.实例组[0];
    if (r.数量 > 0 && e) { e.叠加层数 = (e.叠加层数 + 1) | 0; o.格挡处理(); }
  }
}

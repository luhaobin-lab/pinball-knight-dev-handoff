/** Source L159/L10: flat heal once per block event, not blocked-stack count. Empty source Tick/Destroyed override parent. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_医疗格挡 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_医疗格挡';
  碰撞计数: BpObject[] = []; 已触发 = false;
  override ReceiveTick(_dt: number): void {}
  ReceiveDestroyed(): void {}
  override 持续中触发(_t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o) return; o.更新运动数据();
    o.获得治疗(make治疗({ 治疗整数: sciOf(函数库_技能.获取技能参数(this, s, 0, false, '').参数值, 0),
      触发次数: 1, 来自技能: s, 释放者: o, 特效位置: { ...o.当前位置, x: o.当前位置.x + o.高度 } }), true, false);
    // Source SpawnSystemAttached has a null attachment, not the owner. Preserve its zero-location cue.
    this.fx.vfx('CatapultHero/粒子/粒子_自愈_02', { x: 0, y: 0, z: 0 }, { attach: true });
  }
}

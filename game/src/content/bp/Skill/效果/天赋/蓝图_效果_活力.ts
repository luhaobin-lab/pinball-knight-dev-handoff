/** Source L10/L282/L241: cache p0 mode/value; per-round healing uses stacks * round trigger count; destruction stops SCS cue. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_活力 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_活力';
  回复值 = 5; 参数值 = 0; 整数 = false; 粒子激活 = true;
  override 激活后触发(_d: string): void { const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, ''); this.整数 = p.整数; this.参数值 = p.参数值; }
  override 销毁前触发(): void { this.粒子激活 = false; }
  override 持续中触发(_t: Tag): void {
    const o = this.拥有者, s = this.来自技能; if (!o || !s) return; o.更新运动数据(); const n = this.参数值 * this.叠加层数;
    o.获得治疗(make治疗({ 治疗整数: sciOf(this.整数 ? n : 0, 0), 治疗百分比: sciOf(this.整数 ? 0 : n, 0), 触发次数: this.world.mode.回合开始触发数,
      来自技能: s, 释放者: o, 特效位置: { ...o.当前位置, x: o.当前位置.x + o.高度 } }), true, false);
    // SPEC-GAP: the shell cue API does not carry source attached offset (0,0,-height+5) or SCS deactivate.
    this.fx.vfx('CatapultHero/粒子/粒子_自愈_02', o, { attach: true });
  }
}

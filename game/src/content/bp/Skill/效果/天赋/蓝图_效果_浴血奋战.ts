/** Source L99/L1899/L2058: enemy-gated rebound countdown, self hit BEFORE original-stat growth, floor removes source. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_浴血奋战 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_浴血奋战';
  词条名 = '元素伤害%'; 计数 = 0;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o) return;
    const p = (n: number) => 函数库_技能.获取技能参数(this, s, n, false, '');
    if (t === '效果.时机.新一层时') this.计数 = Math.trunc(p(1).参数值);
    else if (t === '效果.时机.结束层时') { if (移除科学映射值(o.词条, p(0).词条, s.唯一ID)) o.更新外观数据(); }
    else if (t === '效果.时机.反弹时' && this.world.mode.场上有敌人) {
      this.计数 = (this.计数 - 1) | 0; if (this.计数 > 0) return; this.计数 = Math.trunc(p(1).参数值);
      o.受到即时伤害(make伤害({ 伤害来源: '被动', 伤害类型: '物理', 伤害数值: sciOf(p(2).参数值, 0), 所需回合: 3, 触发次数: 1,
        击中点位置: o.K2_GetActorLocation(), 击中点法线: { x: 1, y: 0, z: 0 }, 来自技能: s, 来自角色: o, 目标角色: o }), true, false);
      const param = p(0); 添加科学映射值(o.词条, param.词条, s.唯一ID, sciOf(科学数变普通(科学映射原始值(o.词条, param.词条, true)) * param.参数值, 0), true); o.属性被修改后();
    }
  }
}

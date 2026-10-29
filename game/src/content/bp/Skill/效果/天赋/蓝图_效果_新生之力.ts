/** Source L2503/L2156/L2629: one death-before stat overwrite per combat floor, NOT a synthetic revive; cleanup first tests owner's source. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_新生之力 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_新生之力';
  词条名 = '伤害%'; 计数 = 0; 触发次数_0 = 0; 触发上限 = 1;
  override 激活后触发(_d: string): void { this.触发上限 = 1; this.触发次数_0 = 0; }
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o) return; const p = () => 函数库_技能.获取技能参数(this, s, 0, false, ''), list = this.world.cult.已装备牌;
    if (t === '效果.时机.新战斗层时') this.触发次数_0 = 0;
    else if (t === '效果.时机.死亡前' && this.触发次数_0 < this.触发上限) {
      this.触发次数_0++; const param = p(); 添加科学映射值(o.词条, param.词条, s.唯一ID, sciOf(param.参数值, 0), false); o.更新外观数据();
      for (let i = 0; i < list.length; i++) { const c = list[i]; if (!c) continue; const a = p(); 添加科学映射值(c.词条, a.词条, s.唯一ID, sciOf(a.参数值, 0), false); c.更新外观数据(); }
    } else if (t === '效果.时机.结束层时' && 移除科学映射值(o.词条, p().词条, s.唯一ID)) {
      o.更新外观数据(); for (let i = 0; i < list.length; i++) { const c = list[i]; if (c && 移除科学映射值(c.词条, p().词条, s.唯一ID)) c.更新外观数据(); }
    }
  }
}

/** Source L1841/L2290/L2753/L99: increase consumption/max stamina, then missing-stamina steps overwrite hero and reverse-order equipment stats. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数加减, 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 科学映射原始值, 添加科学映射值 } from '../../../../../core/math/stats.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_癫狂 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_癫狂';
  词条名 = '元素伤害%'; 计数 = 1;
  override 激活后触发(_d: string): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o) return; const p = () => 函数库_技能.获取技能参数(this, s, 0, false, '').参数值;
    添加科学映射值(o.词条, '消耗减免%', s.唯一ID, sciOf(-p(), 0), false);
    添加科学映射值(o.词条, '最大魔力', s.唯一ID, sciOf(科学数变普通(科学映射原始值(o.词条, '魔力', true)) * p(), 0), false); o.属性被修改后();
  }
  override 持续中触发(_t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o) return;
    const amount = () => { const p = 函数库_技能.获取技能参数(this, s, 1, false, ''); return { key: p.词条, value: sciOf(FTrunc(科学数变普通(科学数加减(o.当前最大魔力, o.当前魔力, true)) / 函数库_技能.获取技能参数(this, s, 2, false, '').参数值) * p.参数值, 0) }; };
    const a = amount(); 添加科学映射值(o.词条, a.key, s.唯一ID, a.value, false);
    const list = this.world.cult.已装备牌; for (let i = list.length - 1; i >= 0; i--) { const c = list[i]; if (!c) continue; const p = amount(); 添加科学映射值(c.词条, p.key, s.唯一ID, p.value, false); }
  }
}

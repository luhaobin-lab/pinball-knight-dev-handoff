/** Source L10/L385/L1681: initial base quality-stat zero; before damage with armour grants coins, accumulates permanent quality, then auto-dismantles. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除, 科学数变普通, 科学数比较 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_损失护甲获得精矿 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_损失护甲获得精矿';
  当前获得 = 0; 来自牌: BP_Actor_Card | null = null;
  override 激活后触发(_d: string): void { const c = this.来自技能?.拥有者; if (c instanceof BP_Actor_Card) { this.来自牌 = c; 添加科学映射值(c.词条, '质量', '', sciOf(0, 0), false); } }
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, c = s?.拥有者, hero = this.world.mode.玩家角色; if (t !== '效果.时机.受到伤害前' || !s || !c || !hero || !科学数比较(hero.当前护甲值, '>', sciOf(0, 0))) return;
    const p0 = () => 函数库_技能.获取技能参数(this, s, 0, false, '').参数值;
    this.world.mode.增加金币_收入(false, true, Math.trunc(p0()), hero);
    添加科学映射值(c.词条, '质量', '永久保留', sciOf(p0(), 0), true);
    const p1 = 函数库_技能.获取技能参数(this, s, 1, false, ''), threshold = 科学数变普通(科学数乘除(sciOf(p1.参数值, 0), 获取科学映射词条(c.词条, p1.词条).输出值, false));
    if (!(科学数变普通(获取科学映射词条(c.词条, '质量').输出值) < threshold)) this.world.cult.分解牌(this.来自牌, false, false);
  }
}

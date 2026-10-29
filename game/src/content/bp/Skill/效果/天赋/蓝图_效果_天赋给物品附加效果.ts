/** Source L47/L858/L3326: ANY target/exclusion tag filter over equipment, not general positional selector; refresh reactivates first child. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_天赋给物品附加效果 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_天赋给物品附加效果';
  词条名 = '元素伤害%'; 计数 = 0; 来自牌: BP_Actor_Card | null = null; 筛选后: (BP_Actor_Card | null)[] = [];
  override 激活后触发(_d: string): void { if (this.world.mode.当前层有敌人) this.attach(); }
  override 持续中触发(t: Tag): void {
    if (t === '效果.时机.新战斗层时') this.attach();
    else if (t === '效果.时机.结束层时') {
      const s = this.来自技能, cfg = s?.子效果配置[0]; if (!s || !cfg) return;
      for (let i = 0; i < this.筛选后.length; i++) {
        const c = this.筛选后[i]; if (!c || !this.world.isValid(c)) continue;
        const same = 函数库_工具.存在同名效果(this, c.拥有的效果, 函数库_技能.获取效果名(this, s, cfg.效果类).效果名字);
        if (same.存在相同被动) { same.存在的效果?.销毁效果(); c.更新外观数据(); }
      }
    }
  }
  private attach(): void {
    const s = this.来自技能, source = s?.拥有者; if (!s || !source) return;
    this.筛选后 = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', false, s.目标标签, false, s.排斥标签, -1).筛选后;
    for (let i = 0; i < this.筛选后.length; i++) {
      const c = this.筛选后[i], cfg = s.子效果配置[0]; if (!c || !cfg || !this.world.isValid(c) || c.死掉了) continue;
      const r = applyEffect(this, { cfg, owner: c, 释放者: source, 来自技能: s, 效果名: 函数库_技能.获取效果名(this, s, cfg.效果类).效果名字, classOf: source }); r.effect?.激活效果('');
    }
  }
}

/** Source L3807/L3955/L3097: battle-start selected cards, reactivate refreshed child, floor end removes one same-name child per cached target. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_物品给物品附加效果 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_物品给物品附加效果';
  词条名 = '元素伤害%'; 计数 = 0; 来自牌: BP_Actor_Card | null = null; 筛选后: (BP_Actor_Card | null)[] = [];
  override 激活后触发(_Debug: string): void {
    const owner = this.来自技能?.拥有者; if (!(owner instanceof BP_Actor_Card)) return;
    this.来自牌 = owner; if (this.world.mode.当前层有敌人) this.attachChildren();
  }
  override 持续中触发(时机: Tag): void {
    if (时机 === '效果.时机.新战斗层时') this.attachChildren();
    else if (时机 === '效果.时机.结束层时') {
      const s = this.来自技能, cfg = s?.子效果配置[0]; if (!s || !cfg) return;
      for (let i = 0; i < this.筛选后.length; i++) {
        const target = this.筛选后[i]; if (!target || !this.world.isValid(target)) continue;
        const name = 函数库_技能.获取效果名(this, s, cfg.效果类).效果名字;
        const same = 函数库_工具.存在同名效果(this, target.拥有的效果, name);
        if (same.存在相同被动) { same.存在的效果?.销毁效果(); target.更新外观数据(); }
      }
    }
  }
  private attachChildren(): void {
    const s = this.来自技能, source = s?.拥有者; if (!s || !source) return;
    this.筛选后 = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, -1).筛选后;
    for (let i = 0; i < this.筛选后.length; i++) {
      const target = this.筛选后[i], cfg = s.子效果配置[0];
      if (!cfg || !target || !this.world.isValid(target) || target.死掉了) continue;
      const r = applyEffect(this, { cfg, owner: target, 释放者: source, 来自技能: s,
        效果名: 函数库_技能.获取效果名(this, s, cfg.效果类).效果名字, classOf: source });
      r.effect?.激活效果(''); // unlike the hero/enemy producers, source explicitly reactivates the refreshed instance
    }
  }
}

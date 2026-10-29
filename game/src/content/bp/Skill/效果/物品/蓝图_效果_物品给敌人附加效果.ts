/** Source L15/L175/L804: equipped-item gate, live enemy order, and no reactivation after uniqueness refresh. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_物品给敌人附加效果 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_物品给敌人附加效果';
  装备词条名 = '生命'; 当前百分比 = 0; 在顶层 = false; 拥有的效果: 蓝图_效果[] = [];
  判断是否在顶层(): { Output_Get: boolean } {
    const list = this.world.cult.修炼物品格_已装备?.拥有的物品 ?? [];
    this.在顶层 = this.来自技能?.拥有者 === list[list.length - 1]; return { Output_Get: this.在顶层 };
  }
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能, source = s?.拥有者;
    if (!s || !source || !this.world.mode.已装备.includes(source)) return;
    const list = this.world.mode.敌方场上;
    for (let i = 0; i < list.length; i++) {
      const owner = list[i], cfg = s.子效果配置[0];
      if (!cfg || !owner || !this.world.isValid(owner) || owner.死掉了) continue;
      const r = applyEffect(this, { cfg, owner, 释放者: source, 来自技能: s,
        效果名: 函数库_技能.获取效果名(this, s, cfg.效果类).效果名字, classOf: source });
      if (r.effect && !r.refreshed) r.effect.激活效果('');
    }
  }
}

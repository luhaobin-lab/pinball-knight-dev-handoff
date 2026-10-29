/** Source L15/L692: remove matching skill+child-class from a hero-effect snapshot, then reapply only if the item is equipped. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_物品给英雄附加效果 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_物品给英雄附加效果';
  装备词条名 = '生命'; 当前百分比 = 0; 在顶层 = false; 拥有的效果: (蓝图_效果 | null)[] = [];
  判断是否在顶层(): { Output_Get: boolean } {
    const list = this.world.cult.修炼物品格_已装备?.拥有的物品 ?? [];
    this.在顶层 = this.来自技能?.拥有者 === list[list.length - 1]; return { Output_Get: this.在顶层 };
  }
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能, hero = this.world.mode.玩家角色, source = s?.拥有者, cfg = s?.子效果配置[0];
    if (!s || !source || !cfg || !hero) return;
    this.拥有的效果 = [...hero.拥有的效果];
    for (let i = 0; i < this.拥有的效果.length; i++) {
      const e = this.拥有的效果[i];
      if (e && this.world.isValid(e) && e.来自技能 === s && e.def.path === cfg.效果类) e.销毁效果();
    }
    if (!this.world.mode.已装备.includes(source) || !this.world.isValid(hero) || hero.死掉了) return;
    const r = applyEffect(this, { cfg, owner: hero, 释放者: source, 来自技能: s,
      效果名: 函数库_技能.获取效果名(this, s, cfg.效果类).效果名字, classOf: source });
    if (r.effect && !r.refreshed) r.effect.激活效果('');
  }
}

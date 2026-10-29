/** Source L11381/L11552: kill-mission name gate, new day, trunc(trunc(p0)*roundTriggers*combo), unique mental stacks. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
export class 蓝图_效果_回合开始格挡闪避 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_回合开始格挡闪避';
  词条名 = '元素伤害%'; 蓄能计数 = 0; 蓄能完毕 = false;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, hero = this.world.mode.玩家角色, task = this.world.mode.当前任务实例 as 蓝图_能力 | null;
    if (时机 !== '效果.时机.新一天时' || task?.能力名 !== '消灭所有敌人' || !s?.拥有者 || !hero || !hero.valid || hero.死掉了) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, ''), block = p.词条 === '每格挡层';
    const n = FTrunc(FTrunc(p.参数值) * this.world.mode.回合开始触发数 * 科学数变普通(获取科学映射词条(s.拥有者.词条, '连击').输出值));
    const cap = 获取科学映射词条(hero.词条, block ? '格挡层上限' : '闪避层上限');
    const cfg = make效果配置({ 效果类: `CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_${block ? '格挡' : '闪避'}`,
      持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: n, 唯一: true, 检查效果名: false, 叠加上限: cap.found ? FTrunc(科学数变普通(cap.输出值)) : 99 });
    const name = 函数库_技能.获取效果名(this, s, cfg.效果类).效果名字;
    const { effect } = applyEffect(this, { cfg, owner: hero, 释放者: s.拥有者, 来自技能: s, 效果名: name, classOf: s.拥有者 });
    effect?.激活效果('');
  }
}

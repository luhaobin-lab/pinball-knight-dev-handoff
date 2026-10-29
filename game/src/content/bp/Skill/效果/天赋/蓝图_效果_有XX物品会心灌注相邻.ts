/** Source L3032/L15/L2709/L2179: crit grants adjacent cooldown stat (no action-point grant); source p0 key is read, literal加速冷却% written. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_有XX物品会心灌注相邻 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_有XX物品会心灌注相邻';
  角度抖动 = 0; 筛选后: (BP_Actor_Card | null)[] = []; 计数 = 0;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能; if (!s) return; const equip = this.world.cult.已装备牌;
    if (t === '效果.时机.新战斗层时') { for (let i = 0; i < equip.length; i++) equip[i]?.获取相邻牌(false, { x: 0, y: 0, z: 0 }, new TagSet(['可交互.修炼牌.有充能']), false); }
    else if (t === '效果.时机.新一天时') this.计数 = 0;
    else if (t === '效果.时机.结束层时') { for (let i = 0; i < equip.length; i++) { const c = equip[i]; if (c) 移除科学映射值(c.词条, 函数库_技能.获取技能参数(this, s, 0, false, '').词条, s.唯一ID); } }
    else if (t === '效果.时机.有物品会心时') {
      const c = this.world.cult.当前触发会心的牌; if (!(c instanceof BP_Actor_Card) || s.目标标签.size && !c.OwnedGameplayTags.hasAll(s.目标标签.toArray())) return;
      for (let i = 0; i < c.相邻牌.length; i++) { const target = c.相邻牌[i]; if (!target) continue;
        const p = 函数库_技能.获取技能参数(this, s, 0, false, ''), old = target.词条.get(p.词条)?.来源映射.get(s.唯一ID)?.系数 ?? 0;
        添加科学映射值(target.词条, '加速冷却%', s.唯一ID, sciOf(Math.min(old + p.参数值, 函数库_技能.获取技能参数(this, s, 2, false, '').参数值), 0), false);
      }
    }
  }
}

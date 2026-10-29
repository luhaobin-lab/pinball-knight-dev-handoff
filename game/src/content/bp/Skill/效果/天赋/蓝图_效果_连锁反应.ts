/** Source L1213/L1606/L2444: cached small AND chargeable, large completion shuffle before counter,999 cap; no reset event exists. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { Array_Shuffle } from '../../../../../core/rng/ue.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_连锁反应 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_连锁反应';
  词条名 = '元素伤害%'; 计数 = 0; 目标牌: (BP_Actor_Card | null)[] = []; 来自牌: BP_Actor_Card | null = null;
  private select(): void { this.目标牌 = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', true, new TagSet(['可交互.修炼牌.小型', '可交互.修炼牌.有充能']), false, new TagSet(), -1).筛选后; }
  override 激活后触发(_d: string): void { const c = this.来自技能?.拥有者; if (c instanceof BP_Actor_Card) this.来自牌 = c; if (this.world.mode.当前层有敌人) this.select(); }
  override 持续中触发(t: Tag): void {
    if (t === '效果.时机.新战斗层时') { this.select(); return; } const s = this.来自技能; if (t !== '效果.时机.有物品完成充能' || !s || !(this.计数 < 10) || !this.目标牌.length || !this.world.cult.当前完成充能的牌?.OwnedGameplayTags.has('可交互.修炼牌.大型')) return;
    Array_Shuffle(this.world.rng.combat, this.目标牌); const p = (n: number) => 函数库_技能.获取技能参数(this, s, n, false, '').参数值;
    const q = () => 函数库_工具.计算除余数(this, this.计数, this.触发次数, p(2)); this.计数 = q().余数; if (q().超出阈值) this.计数 = 999;
    if (!(Math.trunc(this.触发次数 - q().余数) > 0)) return;
    for (let i = 0; i < Math.min(this.目标牌.length, Math.trunc(p(0))); i++) { const r = q(); this.目标牌[i]?.添加行动力(true, Math.trunc(p(1)), r.超出阈值 ? Math.trunc(this.触发次数 - r.余数) : this.触发次数, true, false); }
  }
}

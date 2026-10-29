/** Source L66/L778: remove this skill's added tag from backpack then equipment, then select subcondition0 if source item remains equipped. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_光环修改标签 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_光环修改标签';
  词条名 = '元素伤害%'; 计数 = 0; 目标牌: (BP_Actor_Card | null)[] = []; 来自牌: BP_Actor_Card | null = null;
  override 激活后触发(_d: string): void { const c = this.来自技能?.拥有者; if (c instanceof BP_Actor_Card) this.来自牌 = c; }
  判断原始标签(target: BP_ManeActor | null, add: boolean): void {
    const key = Object.keys(this.来自技能?.副条件[0]?.前置标签 ?? {})[0] ?? ''; if (!target || !key || target.角色配置.标签.some(t => t === key || t.startsWith(key + '.'))) return;
    if (add) { target.OwnedGameplayTags.add(key); target.标签被修改后(); }
    else if (target.OwnedGameplayTags.hasExact(key)) { target.OwnedGameplayTags.remove(key); target.标签被修改后(); }
  }
  override 持续中触发(_t: Tag): void {
    const s = this.来自技能; if (!s) return;
    for (const list of [this.world.cult.背包里牌, this.world.cult.已装备牌]) for (let i = 0; i < list.length; i++) 函数库_技能.判断原始标签并修改(this, list[i], s, false, false);
    if (!this.来自牌 || !this.world.cult.已装备牌.includes(this.来自牌)) return;
    this.目标牌 = []; this.目标牌 = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, 0).筛选后;
    for (let i = 0; i < this.目标牌.length; i++) { const c = this.目标牌[i]; if (c && this.world.isValid(c)) 函数库_技能.判断原始标签并修改(this, c, s, true, false); }
  }
}

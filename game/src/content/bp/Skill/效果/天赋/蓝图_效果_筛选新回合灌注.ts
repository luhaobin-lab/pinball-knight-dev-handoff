/** Source L600/L855/L15: cache general selector at combat floor; kill mission daily infusion with both mode and event counts. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import type { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_筛选新回合灌注 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_筛选新回合灌注';
  筛选后: (BP_Actor_Card | null)[] = [];
  private select(): void { if (this.来自技能) this.筛选后 = 函数库_技能.技能条件筛选物品(this, this.world.cult, this.来自技能, -1).筛选后; }
  override 激活后触发(_d: string): void { if (this.world.mode.当前层有敌人) this.select(); }
  override 持续中触发(t: Tag): void {
    if (t === '效果.时机.新战斗层时') { this.select(); return; }
    const s = this.来自技能, mission = this.world.mode.当前任务实例 as 蓝图_能力 | null; if (t !== '效果.时机.新一天时' || !s || !mission?.类型.has('能力.类型.任务.杀敌')) return;
    for (let i = 0; i < this.筛选后.length; i++) this.筛选后[i]?.添加行动力(true, Math.trunc(函数库_技能.获取技能参数(this, s, 0, false, '').参数值), Math.imul(this.world.mode.回合开始触发数, this.触发次数), true, false);
  }
}

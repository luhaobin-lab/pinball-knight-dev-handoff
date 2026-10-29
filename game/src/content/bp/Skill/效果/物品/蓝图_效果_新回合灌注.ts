/** Source L632/L15: reselect every new combat turn, truncate parameter, multiply only round and effect trigger counts. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_新回合灌注 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_新回合灌注';
  装备词条名 = '生命'; 当前百分比 = 0; 在顶层 = false;
  目标牌: (BP_Actor_Card | null)[] = [];
  判断是否在顶层(): { Output_Get: boolean } {
    const list = this.world.cult.修炼物品格_已装备?.拥有的物品 ?? [];
    this.在顶层 = this.来自技能?.拥有者 === list[list.length - 1];
    return { Output_Get: this.在顶层 };
  }
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能;
    const mission = this.world.mode.当前任务实例;
    if (时机 !== '效果.时机.新一天时' || !s || !(mission instanceof 蓝图_能力) || mission.能力名 !== '消灭所有敌人') return;
    this.目标牌 = [];
    this.目标牌 = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, -1).筛选后;
    for (let i = 0; i < this.目标牌.length; i++) {
      const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
      this.目标牌[i]?.添加行动力(true, Math.trunc(p.参数值), Math.imul(this.world.mode.回合开始触发数, this.触发次数), true, false);
    }
  }
}

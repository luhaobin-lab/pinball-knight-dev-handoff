/**
 * Doubles of other modules for core-inventory's flow tests (WAVE_A §1.4): only what the inventory flows call through
 * the facade, reduced to the documented effect. They are replaced by the real modules once wa/ability lands.
 */
import { 参数From, 获取技能参数 } from '../../src/core/ability/params.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import type { 治疗 } from '../../src/core/bp/structs.ts';
import { 词条映射From } from '../../src/core/math/stats.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';

export interface Calls {
  heals: { on: BP_ManeActor; heal: 治疗 }[];
  sideBar: { 名字: string; 品质: number; cell: number | null }[];
  deaths: BP_ManeActor[];
  gold: number[];
}

export function doubles(calls: Calls): Partial<Systems> {
  return {
    kernel: {
      // BP_ManeActor.初始化 (row tags and stats) + the card part of 激活角色 (UG L9569: 尺寸, 可使用, 升级此牌).
      BP_Actor_Card: {
        激活角色(self) {
          for (const t of self.角色配置.标签) self.OwnedGameplayTags.add(t);
          self.词条 = 词条映射From(self.角色配置.科学词条);
          const tags = self.角色配置.标签;
          self.尺寸 = tags.includes('可交互.修炼牌.小型') ? 1 : tags.includes('可交互.修炼牌.中型') ? 2 : 3;
          self.升级此牌(true, false);
        },
      },
      函数库_工具: { 销毁目标和子物体(ctx, 目标) { if (目标) ctx.world.destroy(目标); } },
    },
    ability: {
      函数库_技能: {
        获取技能参数(_ctx, 技能实例, 序号, 上一级差值) {
          if (!技能实例) return { 整数: false, 乘算: false, 参数值: 0, 词条: '' };
          return 获取技能参数({ 参数: 技能实例.参数.map(参数From), 等级: 技能实例.等级, 品质: 技能实例.品质, 上一次等级: 技能实例.上一次等级 }, 序号, 上一级差值);
        },
        获取效果名(_ctx, _skill, cls) { return { 效果名字: cls?.split('/').pop() ?? '' }; },
      },
      函数库_工具: { 附加效果前处理() { return { 不需附加新效果: false, 效果实例: null }; } },
    },
    damage: {
      BP_ManeActor: { 获得治疗(self, heal) { calls.heals.push({ on: self, heal }); } },
      BP_Actor_Card: { 检查死亡(self) { calls.deaths.push(self); } },
    },
    rewards: {
      蓝图_动作游戏模式: { 增加金币_收入(self, _收入, _提示, v) { self.金币 += v; calls.gold.push(v); } },
      修炼系统: {
        筛选物品生成() { return { 筛选后物品: [] }; },
        创建牌到侧栏(_self, 名字, 品质, cell) { calls.sideBar.push({ 名字, 品质, cell: (cell as { 序号?: number } | null)?.序号 ?? null }); return { 卡牌实例: null }; },
      },
    },
  };
}

export const newCalls = (): Calls => ({ heals: [], sideBar: [], deaths: [], gold: [] });

/**
 * Corruption (SCM-030…035, SCM-053): 蓝图_动作游戏模式.增加腐化. `当前腐化 ∈ [0, 最大腐化 = 100]`; the first fill gives
 * +30 Stamina and spawns 蓝图_效果_终级抉择 (it sets `腐化满过？` and offers 终结抉择 2.6 s later); a fill after that kills.
 * Demo: BP/Actor/蓝图_动作游戏模式.txt ln 990–1152 (L1215, L1529, L1602, L2114, L2451, L5259).
 */
import { 函数库_工具, 函数库_技能 } from '../../bp/index.ts';
import { make效果配置 } from '../../bp/structs.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { FClamp, FTrunc } from '../../math/kismet.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BpObject } from '../../sim/object.ts';
import type { AssetPath } from '../../sim/types.ts';

export const 终级抉择Path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_终级抉择';

/** SCM-031. Returns (满了？, 触发死亡？); both stay false on the early exits of L1602/L2114 (they jump to L5259). */
export function 增加腐化(self: 蓝图_动作游戏模式, 腐化值: number, 有提示: boolean, 修改来源: BpObject | null): { 满了: boolean; 触发死亡: boolean } {
  // L0 – L1215: the popup shows the requested value, not the clamped change (SCM-031 step 1, colour #C456AD).
  if (self.world.isValid(修改来源) && 有提示 && 腐化值 + self.当前腐化 > 0) {
    self.fx.popup({ popup: 'corruption', value: `${腐化值 > 0 ? '+' : ''}${FTrunc(腐化值)}腐化`, target: 修改来源.id, at: null });
  }
  // L1215
  self.当前腐化 = FClamp(腐化值 + self.当前腐化, 0, self.最大腐化);
  if (!(self.当前腐化 >= self.最大腐化)) return { 满了: false, 触发死亡: false }; // → L1529 with 当前腐化 < 最大腐化
  const hero = self.玩家角色!;
  if (hero.腐化满过) {
    hero.自杀 = true;
    hero.检查死亡(true, true);
    return { 满了: true, 触发死亡: true };
  }
  // L1602: +{30, 0} un-normalized, not scaled, no popup (SCM-034); a normal 增加体力后 dispatch.
  hero.改变体力({ 系数: 30, 指数: 0 });
  const cfg = make效果配置({ 效果类: 终级抉择Path, 持续时间: -1, 触发间隔: 1, 持续回合: -2, 叠加层数: 1, 唯一: true, 检查效果名: false, 叠加上限: 1 });
  const 空技能 = null;
  const { 效果名字 } = 函数库_技能.获取效果名(self, 空技能, cfg.效果类);
  if (!self.world.isValid(self.玩家角色) || self.玩家角色.死掉了) return { 满了: false, 触发死亡: false };
  // L2114
  if (函数库_工具.附加效果前处理(self, cfg, self.玩家角色, 效果名字).不需附加新效果) return { 满了: false, 触发死亡: false };
  // L2451: deferred spawn of the effect on the hero.
  const target = self.玩家角色;
  const e = self.world.spawn<蓝图_效果>(终级抉择Path, x => {
    x.拥有者 = target;
    x.释放者 = target;
    x.来自技能 = 空技能;
    x.持续时长 = cfg.持续时间;
    x.触发间隔 = cfg.触发间隔;
    x.持续回合 = cfg.持续回合;
    x.叠加层数 = cfg.叠加层数;
    x.临时 = false;
  });
  if (!self.world.isValid(e)) return { 满了: false, 触发死亡: false }; // L5179 "效果生成失败"
  e.效果名字 = 效果名字;
  // The 装上/卸下 tags need the hero to be BP_Actor_Equip / BP_Actor_Card, and 能力.类型.天赋 a valid 空技能: neither holds.
  if (!target.拥有的效果.includes(e)) target.拥有的效果.push(e); // L4760 AddUnique
  e.K2_AttachToActor(target);
  e.激活效果('');
  // L1529
  return { 满了: self.当前腐化 >= self.最大腐化, 触发死亡: false };
}

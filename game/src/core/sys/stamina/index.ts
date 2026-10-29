/**
 * Module `stamina` (WAVE_A Appendix W2, card core-stamina; spec stamina-corruption-mental): Stamina (改变体力,
 * 修改体力点, 疲劳结算), Corruption (增加腐化 with the first-fill 终级抉择), the mental-state grant (获得精神状态) and the
 * empty morale stub (精神系统). The hero passive and the mental-state classes live in src/content/bp (batch
 * core-stamina). The snapshot helpers are for the save card (SCM-010/036).
 */
import type { Systems } from '../../bp/systems.ts';
import { 增加腐化 } from './corruption.ts';
import { 获得精神状态, 精神系统 } from './mental.ts';
import { 修改体力点, 改变体力, 疲劳结算 } from './stamina.ts';

export { 恢复英雄百分比, 记录英雄百分比 } from './snapshot.ts';

export const stamina: Systems['stamina'] = {
  BP_ManeActor: { 疲劳结算, 改变体力 },
  BP_Actor_Player: { 精神系统, 获得精神状态 },
  蓝图_动作游戏模式: { 增加腐化 },
  函数库_工具: { 修改体力点 },
};

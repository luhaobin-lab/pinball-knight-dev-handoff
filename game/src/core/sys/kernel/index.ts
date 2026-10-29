/**
 * Module `kernel` (WAVE_A Appendix W2, card core-ability): actor initialisation and activation per class, the stat
 * refresh, collision flags, ticks, and the kernel half of 函数库_工具 / 函数库_技能 (pure math through src/core/math).
 */
import type { Systems } from '../../bp/systems.ts';
import { cardFns, controllerFns, junctionFns, maneFns, otherFns, playerFns } from './actor.ts';
import { 函数库_工具, 函数库_技能 } from './lib.ts';

export const kernel: Systems['kernel'] = {
  BP_ManeActor: maneFns,
  BP_Actor_Player: playerFns,
  BP_Actor_Other: otherFns,
  BP_Actor_Card: cardFns,
  蓝图_主角色控制器: controllerFns,
  蓝图_通用路口: junctionFns,
  函数库_工具,
  函数库_技能,
};

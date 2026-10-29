/**
 * Module `ability` (WAVE_A Appendix W2, card core-ability): 蓝图_效果 and 蓝图_能力 behaviour, BP_ManeActor's skill
 * routing and effect hooks, and the ability half of 函数库_工具 / 函数库_技能 (ability-framework ABILIT-001…082).
 */
import type { Systems } from '../../bp/systems.ts';
import { abilityFns } from './ability.ts';
import { actorFns, presentationFns } from './actor.ts';
import { effectFns } from './effect.ts';
import { 函数库_工具, 函数库_技能 } from './lib.ts';
import { previewTerrain, terrainView, updateSkillIndicatorTarget } from './terrain-view.ts';
import {afterimageView}from'./afterimage-view.ts';
import {effectView}from'./effect-view.ts';

export const ability: Systems['ability'] & { previewTerrain: typeof previewTerrain; updateSkillIndicatorTarget: typeof updateSkillIndicatorTarget } = {
  previewTerrain, updateSkillIndicatorTarget,
  view: world => ({ terrain: terrainView(world),afterimages:afterimageView(world),fieldEffects:effectView(world) }),
  蓝图_效果: effectFns,
  蓝图_能力: abilityFns,
  BP_ManeActor: actorFns,
  函数库_工具,
  函数库_技能,
  ...presentationFns,
};

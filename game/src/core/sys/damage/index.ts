/**
 * Module `damage` (WAVE_A A13, Appendix W2): the damage and healing pipeline, death, kills and the combat log.
 * Rules: draft damage-crit-weakspot (DAMAGE-001…161) and combat-statuses (§B–§M, DoT core); pseudo
 * dump/blueprints-pseudo/CatapultHero/BP/Actor/{BP_ManeActor,BP_Actor_Other,BP_Actor_Player,BP_Actor_Card}.txt,
 * 函数库/{函数库_技能,函数库_战斗日志}.txt. Other modules are reached only through the facade.
 */
import type { Systems } from '../../bp/systems.ts';
import { 对周围敌人造成伤害, 通过地形造成伤害 } from './area.ts';
import { card检查死亡, other角色死亡, player角色死亡, 可死亡检查, 杀死敌人时, 检查死亡, 生成弱点, 终结目标, 角色死亡 } from './death.ts';
import { 函数库判断目标可合并持续伤害, 受到持续伤害, 持续伤害生效, 查询持续伤害, 移除减益效果, 移除剩余持续伤害, 结算持续伤害, 更新剩余持续伤害, 计算持续伤害详情 } from './dot.ts';
import { 获得治疗 } from './heal.ts';
import { 免疫处理, 受到即时伤害, 失去生命_护甲, 格挡处理, 闪避处理 } from './incoming.ts';
import { 日志__获取能力名, 日志__获取角色名, 日志__输出, 清空日志数据, 输出受伤日志 } from './log.ts';
import { card造成即时伤害, card造成持续伤害, 伤害加成, 会心判断, 会心触发, 计算基础伤害倍率, 计算暴击伤害, 造成即时伤害, 造成持续伤害 } from './outgoing.ts';

export const damage: Systems['damage'] = {
  BP_ManeActor: {
    会心触发, 清空日志数据, 输出受伤日志, 伤害加成, 计算基础伤害倍率, 移除剩余持续伤害, 会心判断, 移除减益效果, 杀死敌人时,
    失去生命_护甲, 持续伤害生效, 更新剩余持续伤害, 受到持续伤害, 结算持续伤害, 造成持续伤害, 免疫处理, 可死亡检查, 获得治疗,
    受到即时伤害, 造成即时伤害, 终结目标, 格挡处理, 闪避处理, 角色死亡, 检查死亡,
  },
  BP_Actor_Player: { 计算持续伤害详情, 角色死亡: player角色死亡 },
  BP_Actor_Other: { 角色死亡: other角色死亡, 生成弱点 },
  BP_Actor_Card: { 造成持续伤害: card造成持续伤害, 造成即时伤害: card造成即时伤害, 检查死亡: card检查死亡 },
  蓝图_能力: { 通过地形造成伤害 },
  函数库_工具: { 计算暴击伤害 },
  函数库_技能: { 对周围敌人造成伤害, 查询持续伤害, 判断目标可合并持续伤害: 函数库判断目标可合并持续伤害 },
  函数库_战斗日志: { 日志__获取能力名, 日志__获取角色名, 日志__输出 },
};

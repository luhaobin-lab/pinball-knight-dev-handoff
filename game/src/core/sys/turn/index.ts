/**
 * Module `turn` (WAVE_A A12 core-turn; Appendix W2): the turn machine, missions, field and interactions, per the
 * verified spec turn-flow (TURN-001…113). The Demo functions of `TurnFns` (src/core/bp/systems.ts), plus `commands`,
 * `legal` and `view` (phase, inputOpen, field).
 */
import type { Systems } from '../../bp/systems.ts';
import type { World } from '../../sim/world.ts';
import type { 蓝图_通用路口 } from '../../sim/junction.ts';
import {
  被复活_重置, 被揭示, 交互到不可拾取物品, 交互到敌人_友军, 交互到有敌人角色, 交互角色, 进行交互, 根据操作执行技能, 玩家交互,
  玩家交互_路口, 玩家交互_牌, 召唤角色到场上, commands, legal, view, activeSlotReady,
} from './input.ts';
import {
  打断当前动画, 房间完毕触发时机, 加入回合开始, 加入行动结束, 结束行动, 结束行动_牌, 进入战斗状态, 判断行动力, 判断行动力_牌,
  等待玩家操作, 退出回合开始, 退出战斗状态, 新回合触发时机, 新回合后, 新回合前, 添加行动力, 执行AI行动, 增长行动度,
} from './loop.ts';
import { 创建任务, 激活任务, 结束层时机, 结束当前层, 物品挑战成功时, 英雄退战重置属性, openPanel } from './mission.ts';
import {
  抽取卡牌到场上_碰撞, 抽取特定类型卡牌到场上_碰撞, 重建房间, 重置牌库和墓地, 创建角色, 从牌库抽出, 从场上移出_碰撞, 根据数组长度延迟,
  判断场上内容, 清理房间, 生成角色, 添加到墓地, 添加到牌库, 添加到延迟销毁, 添加到战场, 添加道具到牌库, 新一层, 新一层触发时机, 有角色死亡时,
} from './room.ts';

/** The 接口_工具 events BP_ManeActor and 蓝图_通用路口 implement as empty (MA L4055…L4065, JCT L3356…L3368). */
const none = (): void => {};
/** Automatic source junctions finish their finite opening timeline without a player choice. Old shop goods can
 * remain clickable meanwhile; those clicks must not starve that callback in event-jump simulation. */
export function waitsForAutomaticExit(w:World):boolean {
  if(w.mode.当前环节!=='选择路口'||w.modal.current||!w.cult.制造页关闭了||!w.cult.材料页关闭了||!w.cult.仓库页关闭了)return false;
  if((w.sys.tutorial as {visibleTip?(w:World):unknown}).visibleTip?.(w))return false;
  return w.mode.环境交互物.some(o=>w.isValid(o)&&o.def.path==='CatapultHero/BP/环境/蓝图_通用路口'&&(o as 蓝图_通用路口).直接交互&&(o as 蓝图_通用路口).未点击);
}

export const turn: Systems['turn'] & { activeSlotReady: typeof activeSlotReady;waitsForAutomaticExit:typeof waitsForAutomaticExit } = {
  waitsForAutomaticExit,
  activeSlotReady,
  UI_战斗结束统计页: { 激活战斗统计页面: (ctx, success, complete) => openPanel(ctx.world.mode, success, complete) },
  BP_ManeActor: {
    加入行动结束, 结束行动, 被揭示, 判断行动力, 添加行动力, 打断当前动画, 被复活_重置, 玩家交互,
    新一天时: none, AI行动前: none, 回合开始前: none, 结束层时: none,
  },
  BP_Actor_Card: { 判断行动力: 判断行动力_牌, 结束行动: 结束行动_牌, 玩家交互: 玩家交互_牌 },
  蓝图_动作游戏模式: {
    添加到延迟销毁, 创建任务, 加入回合开始, 退出回合开始, 激活任务, 增长行动度, 物品挑战成功时, 结束层时机, 重置牌库和墓地,
    英雄退战重置属性, 添加道具到牌库, 清理房间, 有角色死亡时, 结束当前层, 添加到墓地, 判断场上内容, 根据数组长度延迟, 添加到战场,
    从场上移出_碰撞, 抽取特定类型卡牌到场上_碰撞, 抽取卡牌到场上_碰撞, 退出战斗状态, 进入战斗状态, 等待玩家操作, 新一层触发时机,
    新回合触发时机, 从牌库抽出, 添加到牌库, 生成角色, 新一层, 执行AI行动, 新回合前, 新回合后, 房间完毕触发时机, 创建角色, 重建房间,
  },
  蓝图_主角色控制器: { 根据操作执行技能, 交互到有敌人角色, 交互到不可拾取物品, 交互到敌人_友军, 交互角色, 进行交互 },
  蓝图_通用路口: { 新一天时: none, 被复活_重置: none, AI行动前: none, 回合开始前: none, 结束层时: none, 玩家交互: 玩家交互_路口 },
  函数库_技能: { 召唤角色到场上 },
  commands,
  legal,
  view,
};

export { 重置房间, panelOpen, panelState } from './mission.ts';

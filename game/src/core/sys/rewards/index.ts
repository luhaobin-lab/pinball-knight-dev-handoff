/**
 * Module `rewards` (WAVE_A Appendix W2, card core-rewards): room rewards, the item box, drops and currencies.
 * The functions are the Demo's (Appendix B "rewards" minus 交互到商品 → shop; legacy equipment drops 添加装备掉落,
 * 筛选可掉落装备, 添加锻造格, 生成随机装备, 非酋保护机制 and the 掉落物 helpers are dead in the Demo and stay unported).
 * Interface events 盒子关闭后 / 刷新盒子 / 奖励配置 are no-ops on BP_ManeActor and 蓝图_通用路口 (BP_ManeActor L4056–L4061,
 * 蓝图_通用路口 L3358–L3363); 打开掉落盒 is an empty function (蓝图_主角色控制器 ln 327).
 */
import type { Systems } from '../../bp/systems.ts';
import { lootLegal, 全拿未拾取牌, 切换物品盒子, 创建牌到侧栏, 刷新生成牌, 清除未拾取牌, 筛选物品生成 } from './box.ts';
import { 创建奖励, 合并权重掉落池, 增加金币_收入, 添加材料掉落, 掉落货币, 获取层数品质, 触发掉落, 近期X次掉落是否有X, 近期X次是否出现X奖励 } from './drops.ts';

const noop = (): void => {};

export const rewards: Systems['rewards'] = {
  BP_ManeActor: { 掉落货币, 触发掉落, 盒子关闭后: noop, 刷新盒子: noop, 奖励配置: noop },
  蓝图_动作游戏模式: { 创建奖励, 增加金币_收入, 近期X次掉落是否有X, 近期X次是否出现X奖励, 添加材料掉落 },
  修炼系统: { 清除未拾取牌, 全拿未拾取牌, 创建牌到侧栏, 筛选物品生成, 刷新生成牌, 切换物品盒子 },
  蓝图_主角色控制器: { 打开掉落盒: noop },
  蓝图_通用路口: { 盒子关闭后: noop, 刷新盒子: noop, 奖励配置: noop },
  函数库_工具: { 获取层数品质, 合并权重掉落池 },
  legal: lootLegal,
};

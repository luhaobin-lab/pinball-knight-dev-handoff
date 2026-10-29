/**
 * Level-ups and learned talents: BP_Actor_Player.升级玩家 (PL ln 490–664, TURN-034), BP_ManeActor.添加天赋
 * (MA ln 4169–4290, ABILIT-010) and BP_Actor_Player.移除天赋 (PL L23304 → L7431, L2079–L3270).
 */
import type { 蓝图_能力 } from '../../ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../bp/index.ts';
import { make效果配置 } from '../../bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../math/sci.ts';
import { 添加科学映射值, 科学映射原始值 } from '../../math/stats.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import { Array_AddUnique, Array_RemoveItem } from '../../sim/engine.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';
import type { AssetPath, Tag } from '../../sim/types.ts';
import { tutorialTip } from '../../sim/tutorial.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 主界面Of } from './choice.ts';

export const 升级获取天赋: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_升级获取天赋';
const 玩家升级前: Tag = '效果.时机.玩家升级前';

/**
 * 升级玩家 (TURN-034): with a mission running, no pick pending, 升级点 > 0 and phase 回合开始: spend one point, +50 % of
 * the base 生命 (source 升级), fire 玩家升级前, attach 蓝图_效果_升级获取天赋 (it opens the talent pick).
 */
export function 升级玩家(self: BP_Actor_Player): { 成功: boolean; 升级中: boolean } {
  const world = self.world;
  const mode = world.mode;
  const task = mode.当前任务实例;
  if (!world.isValid(task)) return { 成功: false, 升级中: false }; // L1616
  const 存在升级特效 = 函数库_工具.对应类型效果数量(self, self.拥有的效果, 升级获取天赋).数量;
  const 未完成 = (task as unknown as { 未完成?: boolean }).未完成 === true; // BP_Mission.未完成？
  if (!(存在升级特效 < 1 && mode.升级点 > 0 && mode.当前环节 === '回合开始' && 未完成)) {
    return { 成功: false, 升级中: 存在升级特效 > 0 }; // L1643
  }
  mode.升级点 = mode.升级点 - 1;
  const gain = 科学数乘除(科学映射原始值(self.词条, '生命', false), sciOf(0.5, 0), false);
  添加科学映射值(self.词条, '生命', '升级', gain, true);
  self.更新最大生命魔力();
  // L983: live loop over 拥有的效果
  for (let i = 0; i < self.拥有的效果.length; i++) {
    const e = self.拥有的效果[i];
    if (!world.isValid(e) || !e.HasMatchingGameplayTag(玩家升级前)) continue;
    e.触发时机 = 玩家升级前;
    e.持续中触发(玩家升级前);
  }
  // L1712: 结构_效果 { 升级获取天赋, 持续 −1, 间隔 1, 回合 −1, 层 1, 唯一, 不检查名, 上限 1 }
  const cfg = make效果配置({ 效果类: 升级获取天赋, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: true, 检查效果名: false, 叠加上限: 1 });
  const 效果名 = 函数库_技能.获取效果名(self, self.空技能, 升级获取天赋).效果名字;
  if (!world.isValid(self) || self.死掉了) return { 成功: false, 升级中: 存在升级特效 > 0 }; // L2090
  const pre = 函数库_工具.附加效果前处理(self, cfg, self, 效果名);
  if (pre.不需附加新效果) return { 成功: false, 升级中: 存在升级特效 > 0 };
  const e = world.spawn<蓝图_效果>(升级获取天赋, x => { // L2488
    x.拥有者 = self;
    x.释放者 = self;
    x.来自技能 = self.空技能;
    x.持续时长 = cfg.持续时间;
    x.触发间隔 = cfg.触发间隔;
    x.持续回合 = cfg.持续回合;
    x.叠加层数 = cfg.叠加层数;
    x.临时 = false;
  });
  e.效果名字 = 效果名;
  // The Equip / Card branch (装上 / 卸下 tags) never applies to the hero; L5321:
  if (world.isValid(self.空技能) && self.空技能.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋');
  Array_AddUnique(self.拥有的效果, e); // L4773
  e.K2_AttachToActor(self);
  e.激活效果('');
  // UI_新手提示.激活新手提示(6): the tutorial tip (wave B sys-tutorial); presentation only here.
  tutorialTip(world,6);
  mode.更新回合战斗统计('玩家升级', sciOf(100, 0), 100, 1, '不衰减', '');
  return { 成功: true, 升级中: 存在升级特效 > 0 };
}

/**
 * 添加天赋 (ABILIT-010): exclusions into 排除天赋池, +增加等级 talents learned, then either level the owned instance up
 * (初始化, 子初始化, 执行技能 again) or register the new one as a passive talent; the talent's tags count into 天赋标签.
 */
export function 添加天赋(self: BP_ManeActor, 天赋实例: 蓝图_能力 | null, 增加等级: number, 存在相同: boolean, 是读档: boolean): void {
  if (!天赋实例) return;
  const world = self.world;
  const mode = world.mode;
  const ui = 主界面Of(world);
  Array_RemoveItem(天赋实例.排斥技能, 天赋实例.能力名);
  for (let i = 0; i < 天赋实例.排斥技能.length; i++) Array_AddUnique(ui.排除天赋池, 天赋实例.排斥技能[i]); // L155
  mode.已获取天赋数 = 增加等级 + mode.已获取天赋数; // L514
  if (存在相同) {
    天赋实例.上一次等级 = 天赋实例.等级;
    天赋实例.等级 = 天赋实例.等级 + 增加等级;
    天赋实例.初始化();
    天赋实例.子初始化();
    天赋实例.执行技能(是读档);
  } else {
    天赋实例.是天赋 = true; // L1495
    Array_AddUnique(self.拥有的被动能力, 天赋实例);
    天赋实例.K2_AttachToActor(self);
    天赋实例.执行技能(是读档);
  }
  // L950: every tag of the talent's 类型 counts 增加等级 more (Map_Find of a missing key is 0)
  for (const t of 天赋实例.类型.toArray()) self.天赋标签.set(t, (self.天赋标签.get(t) ?? 0) + 增加等级);
  if (是读档) return; // L1783
  const hero = mode.玩家角色;
  hero?.保存英雄信息();
  hero?.精神系统(0, 5, '习得天赋', true);
  // UI_奖励提示 "习得天赋：\"{0}({1})\"" with 额外描述[0] and the new level
  self.fx.ui({ op: 'open', widget: 'UI_奖励提示', data: { 名字: 天赋实例.额外描述[0]?.zh ?? 天赋实例.能力名, 等级: 天赋实例.等级 } });
}

/** 移除天赋: forget the talent save, destroy talent passives and talent-tagged effects, reset the talent fields. */
export function 移除天赋(self: BP_Actor_Player): void {
  const world = self.world;
  self.天赋存档.length = 0;
  self.临时被动能力数组 = [...self.拥有的被动能力]; // L23304 (Blueprint arrays copy on assignment)
  for (let i = 0; i < self.临时被动能力数组.length; i++) { // L2469
    const a = self.临时被动能力数组[i];
    if (!a?.是天赋) continue;
    Array_RemoveItem(self.拥有的被动能力, a);
    函数库_工具.销毁目标和子物体(self, a);
  }
  self.临时拥有效果数组 = [...self.拥有的效果]; // L2612
  for (let i = 0; i < self.临时拥有效果数组.length; i++) {
    const e = self.临时拥有效果数组[i];
    if (!world.isValid(e) || !e.HasMatchingGameplayTag('能力.类型.天赋')) continue;
    Array_RemoveItem(self.拥有的效果, e);
    函数库_工具.销毁目标和子物体(self, e);
  }
  // L3270
  self.投射分裂数 = 1;
  self.投射穿透 = 1;
  self.钩锁伤害加成 = 1.0;
  self.剑气护体 = true;
  self.毒气距离 = 1.0;
  self.十字爆炸范围 = 3;
}

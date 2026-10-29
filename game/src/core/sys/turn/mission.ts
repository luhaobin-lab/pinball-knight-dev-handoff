/**
 * Missions, win and lose, the Victory/Failure panel, floor end and room reset (turn-flow §4.10–§4.11, TURN-079…102).
 * Demo: 蓝图_动作游戏模式 (mission check L7541, 创建任务, 激活任务, 结束当前层, 结束层时机, 英雄退战重置属性, 物品挑战成功时,
 * the reset path L28452…), UI_战斗结束统计页 (激活战斗统计页面, 继续, 重新挑战, 关闭战斗统计页: logic only).
 */
import type { 结构_任务条, 结构_技能 } from '../../../content/demo/types.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BpObject } from '../../sim/object.ts';
import type { World } from '../../sim/world.ts';
import { tutorialTip } from '../../sim/tutorial.ts';
import type { AssetPath } from '../../sim/types.ts';
import type { ModalAnswer } from '../../api/commands.ts';
import { 函数库_工具, 函数库_技能, 函数库_科学数 } from '../../bp/index.ts';
import type { ModalView } from '../../api/view.ts';
import { make效果配置 } from '../../bp/structs.ts';
import { UI_冒险结束统计页 } from '../../bp/widgets.ts';
import { inTutorial, rewardHas } from './room.ts';
import { addUnique, fireLive, frame, mission, print, removeItem, valid, type Mission } from './util.ts';

const 轮回宝藏_PATH: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_获取轮回宝藏';

/** TURN-080: the mission check L7541, run at every 新回合后. Every branch ends at L7635 等待玩家操作 except the first. */
export function missionCheck(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const m = mission(w);
  if (!m) return print(w, '没有房间任务'); // TURN-GAP-14: no 等待玩家操作
  const kill = m.类型.has('能力.类型.任务.杀敌');
  if (m.完成过了) {
    self.结束当前层(true);
  } else if (m.失败了 || self.玩家角色?.死掉了) {
    if (kill) openPanel(self, false, false); else m.失败任务();
  } else if (m.未完成) {
    self.预测AI行动();
  } else {
    const run = valid(w, self.当前轮回任务) ? (self.当前轮回任务 as Mission) : null;
    if (!run) return print(w, '没有轮回任务');
    if (run.未完成 || run.完成过了 || self.无尽模式) {
      if (kill) openPanel(self, true, false); else m.完成任务();
    } else {
      run.完成任务();
      const hero = self.玩家角色;
      if (valid(w, hero) && !hero.死掉了) attachEffect(self, 轮回宝藏_PATH, self.空技能, true);
      openPanel(self, true, true);
    }
  }
  self.等待玩家操作(); // L7635
}

/**
 * The Demo's attach pattern (GM L8871…L11517, BP_Mission L1543…): 附加效果前处理, then (when a new effect is needed) a
 * deferred spawn with 拥有者/释放者/来自技能 and the config, 效果名字, AddUnique to the owner's effects, attach, 激活效果.
 * The mission check skips 激活效果 when no new effect is needed (L8871 → L8806).
 */
function attachEffect(self: 蓝图_动作游戏模式, cls: AssetPath, from: 蓝图_能力 | null, unique: boolean): void {
  const w = self.world;
  const hero = self.玩家角色;
  if (!hero) return;
  const cfg = make效果配置({ 效果类: cls, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: unique, 检查效果名: false, 叠加上限: 1 });
  const name = 函数库_技能.获取效果名(self, from, cls).效果名字;
  if (函数库_工具.附加效果前处理(self, cfg, hero, name).不需附加新效果) return;
  const e = w.spawn<蓝图_效果>(cls, o => {
    o.拥有者 = hero; o.释放者 = hero; o.来自技能 = from;
    o.持续时长 = cfg.持续时间; o.触发间隔 = cfg.触发间隔; o.持续回合 = cfg.持续回合; o.叠加层数 = cfg.叠加层数; o.临时 = false;
  });
  if (!valid(w, e)) return print(w, '效果生成失败');
  e.效果名字 = name;
  if (valid(w, from) && from.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋');
  addUnique(hero.拥有的效果, e);
  e.K2_AttachToActor(hero);
  e.激活效果('');
}

/** 创建任务 (GM ln 289): the mission row from 任务需求 by 权重选取 on 全局种子, spawned with 能力名, 拥有者 = hero. */
export function 创建任务(self: 蓝图_动作游戏模式, 任务条结构: 结构_任务条): { 实例: BpObject | null } {
  const w = self.world;
  const { 权重数组, 数据表数组 } = 函数库_工具.拆分权重数据表(self, [...任务条结构.任务需求]);
  const pick = 函数库_工具.权重选取(self, 权重数组, w.rng.全局种子).选中的序号;
  const h = 数据表数组[pick];
  const row = h?.DataTable ? (w.data.table(h.DataTable)?.rows as Record<string, 结构_技能> | undefined)?.[h.RowName] : undefined;
  if (!h || !row) { print(w, '没有找到数据'); return { 实例: null }; }
  const cls = row.能力.能力类;
  if (!cls) { print(w, '任务创建失败'); return { 实例: null }; }
  const a = w.spawn<蓝图_能力>(cls, o => {
    o.唯一ID = '0'; o.能力名 = h.RowName; o.拥有者 = self.玩家角色; o.等级 = 1; o.品质 = 1; o.种子 = 0;
  });
  a.技能配置 = row;
  a.等级 = Math.min(任务条结构.任务等级, row.单次级别上限);
  a.初始化();
  a.子初始化();
  if (!('完成任务' in a)) { print(w, '任务创建失败'); return { 实例: null }; } // Cast<BP_Mission_C>
  self.当前任务实例 = a;
  (a as unknown as { 任务条结构: 结构_任务条 }).任务条结构 = 任务条结构;
  return { 实例: a };
}

/** 激活任务 (GM ln 544): a run task first removes the hero's effects from older run tasks; then 执行技能. */
export function 激活任务(self: 蓝图_动作游戏模式, 任务实例: BpObject | null, 是读档: boolean): void {
  const w = self.world;
  if (!valid(w, 任务实例)) return;
  const m = 任务实例 as Mission;
  const hero = self.玩家角色;
  if (m.类型.has('能力.类型.任务.轮回') && hero) {
    for (const e of [...hero.拥有的效果]) { // 临时效果数组 (copy)
      if (!valid(w, e)) continue;
      if (!valid(w, e.来自技能)) { print(w, 'Hello'); continue; }
      if (!e.来自技能.类型.has('能力.类型.任务.轮回')) continue;
      removeItem(hero.拥有的效果, e);
      函数库_工具.销毁目标和子物体(self, e);
    }
  }
  m.执行技能(是读档);
}

// ---------------------------------------------------------------------------------------------------------------
// UI_战斗结束统计页: the Victory/Failure panel (TURN-084…085, TURN-096). Panel layout lines are ui-pages'.

/** TURN-084 激活战斗统计页面(任务成功？, 完成冒险？). All five steps run synchronously. */
export function openPanel(self: 蓝图_动作游戏模式, 任务成功: boolean, 完成冒险: boolean): void {
  const w = self.world;
  const f = frame(self);
  if (f.panel) return print(w, 'Hello'); // already shown (visibility 4)
  self.当前环节 = '战斗统计'; // L3297
  self.fx.sound('CatapultHero/音效/音效_战斗统计_鼓');
  self.delay('L3454', 1.0, () => self.fx.bgm('探索')); // BGM状态(2) // SPEC-GAP: BGM index 2 read as 探索
  // TURN-GAP-04: 完成冒险？ is stored, not read by the widget.
  self.更新轮回战斗统计(任务成功 ? '挑战成功' : '挑战失败', 1);
  if (任务成功 && rewardHas(self, '能力.类型.奖励.复合奖励.首领')) self.更新轮回战斗统计('击败首领', 1);
  const hero = self.玩家角色;
  const canRetry = !(任务成功 || (hero?.腐化满过 ?? false) || inTutorial(self));
  f.panel = { 任务成功, 完成冒险, canRetry };
  hero?.打断技能(true); // TURN-053 (a): a hidden hero action end
  hero?.关闭碰撞();
  if (self.玩家控制器) self.玩家控制器.玩家可与环境交互 = false;
  // The stats list (hero, then each equipped card) and the second Delay 1.0 → opacity 1 are presentation.
  w.modal.open(
    { kind: 'panel', result: 任务成功 ? 'victory' : 'failure', lines: panelLines(self), canRetry,
      characters: panelCharacters(self), backpackClosed: w.cult.背包关闭了 },
    answer => panelAnswer(self, answer),
  );
  tutorialTip(w,14);
}

/** The panel's stats lines: the hero's 战斗数据统计, then each equipped card's (labels are the stat names). */
function panelLines(self: 蓝图_动作游戏模式): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const add = (o: { 战斗数据统计: Map<string, { 系数: number; 指数: number }> } | null): void => {
    if (!o) return;
    for (const [k, v] of o.战斗数据统计) out.push({ label: k, value: String(v.系数 * 10 ** v.指数) });
  };
  add(self.玩家角色);
  for (const c of self.world.cult.已装备牌) add(c);
  return out;
}

/** UIF 创建统计并设置位置: one row per nonempty actor map; UI_角色战斗统计 L134 reads four positive keys. */
function panelCharacters(self: 蓝图_动作游戏模式): NonNullable<Extract<ModalView, { kind: 'panel' }>['characters']> {
  const rows: NonNullable<Extract<ModalView, { kind: 'panel' }>['characters']>[number][] = [];
  for (const actor of [self.玩家角色, ...self.world.cult.已装备牌]) {
    if (!actor || actor.战斗数据统计.size === 0) continue;
    const stats: Partial<Record<'charge' | 'damage' | 'heal' | 'armor', string>> = {};
    for (const [name, key] of [['完成充能', 'charge'], ['造成伤害', 'damage'], ['治愈生命', 'heal'], ['生成护甲', 'armor']] as const) {
      const value = actor.战斗数据统计.get(name);
      if (value && value.系数 > 0) stats[key] = 函数库_科学数.科学数字缩写(self, value, 0).ReturnValue.zh;
    }
    rows.push({ id: actor.id, kind: actor === self.玩家角色 ? 'hero' : 'item', position: actor.K2_GetActorLocation(), width: actor.宽度, stats });
  }
  return rows;
}

function panelAnswer(self: 蓝图_动作游戏模式, answer: ModalAnswer): void {
  const f = frame(self);
  if (!f.panel) return;
  if (answer.type === 'panel.continue') return panelContinue(self);
  if (answer.type === 'panel.retry' && f.panel.canRetry) return panelRetry(self);
}

/** TURN-085 继续 (UIF L1299). */
function panelContinue(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const f = frame(self);
  const p = f.panel;
  if (!p) return;
  const hero = self.玩家角色;
  w.modal.close();
  if (hero?.死掉了 || ((hero?.腐化满过 ?? false) && !p.任务成功)) {
    // Loading page, Delay 0.5, then the run-end screen; 关闭战斗统计页 then sets 18 (E-11).
    self.delay('L1604', 0.5, () => {
      self.当前环节 = '死亡结算'; // UI_冒险结束统计页 sets 13 synchronously (and saves it)
      runEndPage(self);
      closePanel(self);
    });
    return;
  }
  const m = mission(w);
  if (p.任务成功) m?.完成任务(); else m?.失败任务();
  closePanel(self); // the fade-out animations are presentation
}

/** 重新挑战 (UIF L2054): the room reset (TURN-095). */
function panelRetry(self: 蓝图_动作游戏模式): void {
  self.world.modal.close();
  frame(self).panel = null;
  // UIF L2054 reloads the level from EMS, including a fresh hero; rebuilding around the dead hero is not retry.
  const run = self.world.sys.run as { 重新挑战?(world: World): void };
  if (run.重新挑战) run.重新挑战(self.world);
  else self.world.unported('UI_战斗结束统计页.重新挑战');
}

/** TURN-096 关闭战斗统计页 (UIF L3122 → L2318 → L1963). */
function closePanel(self: 蓝图_动作游戏模式): void {
  self.当前环节 = '物品盒子';
  if (self.玩家控制器) self.玩家控制器.玩家可与环境交互 = true;
  self.英雄退战重置属性();
  self.delay('L1999', 1.0, () => { frame(self).panel = null; }); // then hide the panel
}

/** UI_冒险结束统计页.激活冒险统计页面(false): the run-end screen (core-run), through the widget facade (WAVE_A §1.4). */
export function runEndPage(self: 蓝图_动作游戏模式): void {
  UI_冒险结束统计页.激活冒险统计页面(self, false);
}

/** True while the Victory/Failure panel is up. */
export const panelOpen = (self: 蓝图_动作游戏模式): boolean => frame(self).panel !== null;
export const panelState = (self: 蓝图_动作游戏模式) => frame(self).panel;

// ---------------------------------------------------------------------------------------------------------------

/** TURN-097 (GM ln 1490). */
export function 英雄退战重置属性(self: 蓝图_动作游戏模式): void {
  for (const c of [...self.world.cult.已装备牌, ...self.world.cult.背包里牌]) {
    if (!c) continue;
    c.当前行动力 = 0;
    c.战斗数据统计.clear();
  }
  if (self.玩家角色) self.玩家角色.当前护甲值 = { 系数: 0, 指数: 0 };
}

/** TURN-098 结束当前层 (GM ln 3330). */
export function 结束当前层(self: 蓝图_动作游戏模式, 直接交互路口: boolean): void {
  if (self.当前环节 === '选择地图') return print(self.world, '结束当前层: 当前环节 = 选择地图');
  self.当前环节 = '选择路口';
  // hide the boss frame: presentation
  self.创建路口(直接交互路口);
}

/** TURN-100 结束层时机 (GM ln 771). */
export function 结束层时机(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const tag = '效果.时机.结束层时';
  const 已触发效果: (蓝图_效果 | null)[] = [];
  const kill = mission(w)?.类型.has('能力.类型.任务.杀敌') ?? false;
  const hero = self.玩家角色;
  if (hero) {
    for (const e of [...hero.拥有的效果]) { // 临时效果 (copy)
      if (!valid(w, e) || !e.HasMatchingGameplayTag(tag)) continue;
      e.触发时机 = tag;
      e.持续中触发(tag);
      addUnique(已触发效果, e);
      if (valid(w, e) && e.持续回合 === -2 && kill) e.销毁效果();
    }
  }
  for (const card of [...w.cult.背包里牌, ...w.cult.已装备牌]) { // 临时物品整合 (copy), each over a copy
    if (!card) continue;
    for (const e of [...card.拥有的效果]) {
      if (!valid(w, e) || !e.HasMatchingGameplayTag(tag)) continue;
      e.触发时机 = tag;
      if (已触发效果.includes(e)) continue;
      e.持续中触发(tag);
    }
  }
  for (let i = 0; i < self.墓地.length; i++) { // live outer L2550, copy inner
    const g = self.墓地[i];
    if (!g) continue;
    for (const e of [...g.拥有的效果]) {
      if (!valid(w, e) || !e.HasMatchingGameplayTag(tag)) continue;
      e.触发时机 = tag;
      e.持续中触发(tag);
    }
  }
  self.怪物自定义属性映射.clear();
  self.清理提示映射();
  if (!kill) return;
  for (const c of self.延迟销毁牌) 函数库_工具.销毁目标和子物体(self, c);
  self.延迟销毁牌.length = 0;
}

/** 物品挑战成功时 (GM ln 698): 挑战成功时 on the hero's effects, then on every backpack card's (all live). */
export function 物品挑战成功时(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const tag = '效果.时机.挑战成功时';
  if (self.玩家角色) fireLive(w, self.玩家角色.拥有的效果, tag);
  const bag = w.cult.背包里牌;
  for (let i = 0; i < bag.length; i++) { const c = bag[i]; if (c) fireLive(w, c.拥有的效果, tag); }
}

/**
 * TURN-095 room reset (the dialog's 重置房间 or the panel's 重新挑战). The Demo reloads the level from the save with
 * 重置房间？ = true. SPEC-GAP: there is no level reload in the port; the hero is not restored to the floor-start save
 * (core-run save v0 owns that). The reload branch runs from step 2: a cleared cell or phases 14 / 9 stop.
 */
export function 重置房间(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const m = mission(w);
  if (self.读档环节 === '进入营地' || self.读档环节 === '选择地图' || m?.完成过了) return;
  const hero = self.玩家角色;
  self.delay('L28452', 1.0, () => {
    self.重建房间();
    const full = hero?.腐化满过 ?? false;
    self.fx.log({ rich: full ? '<强调>{执行者}</>死掉了。（<腐化>腐化超出上限</>）' : '<强调>{执行者}</>重置了房间。（<腐化>+10腐化</>）' });
    self.delay('L5544', 1.0, () => {
      if (!hero) return;
      if (hero.腐化满过) { hero.自杀 = true; hero.检查死亡(true, true); return; }
      self.增加腐化(self.测试模式 ? 0 : 10, true, hero);
    });
  });
}

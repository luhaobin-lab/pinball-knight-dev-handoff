/**
 * Floor entry, room build and teardown, decks and field (turn-flow §4.1, TURN-001…014, TURN-076, TURN-102).
 * Demo: 蓝图_动作游戏模式 (ubergraph L14367 新一层, L14593, @171, L255 room build, L2242 field fill, L26079 创建角色, and
 * the functions 清理房间, 生成角色, 添加到牌库, 从牌库抽出, 添加到战场, 从场上移出（碰撞）, 添加到墓地, 抽取特定类型卡牌到场上（碰撞）,
 * 抽取卡牌到场上（碰撞）, 新一层触发时机, 判断场上内容, 有角色死亡时, 重置牌库和墓地, 添加道具到牌库).
 */
import type { AssetPath } from '../../../content/demo/types.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BP_Actor_Other } from '../../sim/other.ts';
import type { 蓝图_动画结算 } from '../../sim/settlement.ts';
import type { BpObject } from '../../sim/object.ts';
import type { Tag, Vec3 } from '../../sim/types.ts';
import type { 结构_角色 } from '../../../content/demo/types.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { GridSnap_Float } from '../../math/kismet.ts';
import { currentMapTile } from '../../sim/map-tile.ts';
import { Array_Shuffle, RandomFloatInRange } from '../../rng/ue.ts';
import { addUnique, fireLive, frame, isAlly, isBoss, isHostile, mission, print, removeItem, setHidden, valid, vecEq } from './util.ts';

const OTHER_PATH: AssetPath = 'CatapultHero/BP/Actor/BP_Actor_Other';
const SETTLEMENT_PATH: AssetPath = 'CatapultHero/BP/动画/蓝图_动画结算';
const JUNCTION_PATH: AssetPath = 'CatapultHero/BP/环境/蓝图_通用路口';
const 迷茫_PATH: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_迷​茫';
const NO_SPAWN: Vec3 = { x: -1, y: -1, z: -1 };

/** TURN-001: the map cell calls 新一层 (ubergraph L14367). */
export function 新一层(self: 蓝图_动作游戏模式): void {
  self.当前总层数 += 1;
  self.当前关卡层数 += 1;
  self.房间任务重读过 = false;
  self.房间重建失败次数 = 0;
  // ARCHITECTURE §4.13: the `level` domain is reseeded at floor creation.
  self.world.rng.enterFloor(self.当前总层数);
  enterRoom(self);
}

/** 重建房间 (ubergraph L27293) jumps to L14593 without the counters (TURN-001, TURN-004). */
export function 重建房间(self: 蓝图_动作游戏模式): void {
  enterRoom(self);
}

/** L14593 (TURN-002) → Delay 0.55 → @171 (TURN-003). */
function enterRoom(self: 蓝图_动作游戏模式): void {
  const host=self as 蓝图_动作游戏模式&{ug_roomEntryGeneration?:number};const generation=(host.ug_roomEntryGeneration??0)+1;host.ug_roomEntryGeneration=generation;
  self.world.cult.切换地图页(true, false);
  self.当前环节 = self.当前层地图格配置表.RowName === '营地' ? '进入营地' : '创建房间';
  self.玩家角色?.保存英雄信息();
  self.delay(`L14848:${generation}`, 0.55, () => {
    // The port keeps its mode object across source room/level cleanup. Retire callbacks from the previous room.
    if(host.ug_roomEntryGeneration!==generation)return;
    // @171 Sequence: (1) close the main-menu UI and the cultivation page (presentation), (2) L255, (3) L2242.
    self.world.cult.切换修炼页显示(false);
    buildRoom(self);
    fillField(self);
  });
}

/** L255: room build (TURN-004, TURN-005). */
function buildRoom(self: 蓝图_动作游戏模式): void {
  self.清理房间();
  const ok = self.创建地块().成功;
  self.房间创建成功 = ok;
  if (!ok) return buildFailed(self);
  self.房间任务重读过 = false;
  self.房间重建失败次数 = 0;
  self.设置房间背景();
  const row = self.当前层地图格配置表.RowName;
  switch (row) {
    case '测试': case '宝箱房': case '恢复点': case '天赋房': case '属性房': case '探索房': case '抉择房':
    case '新手关01': case '新手关03': case '新手关05': case '新手关06':
      return nonCombatRoom(self); // L2424
    case '营地': return campRoom(self); // L3507
    case '第一层': // L4339
      self.摆放玩家(self.玩家出生点);
      self.world.cult.切换修炼背包(false);
      self.创建角色();
      return;
    case '锻造房': return forgeRoom(self); // L4414
    default: return combatRoom(self); // L1348 (传奇房 and every combat cell)
  }
}

/** L1348: combat cells (TURN-005 first row). */
function combatRoom(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  // ARCHITECTURE §4.13: `combat` / `loot` are reseeded at each combat start (the room build of a combat cell).
  w.rng.enterCombat(w.rng.combatIndex + 1);
  w.cult.切换修炼背包(true);
  self.摆放玩家(self.玩家出生点);
  self.创建角色();
  const 迷茫 = self.玩家角色 ? 函数库_工具.存在同类效果(self, self.玩家角色.拥有的效果, 迷茫_PATH).存在相同被动 : false;
  setHidden(w, self.迷雾图, !(迷茫 || self.当前层地图格配置表.RowName === '传奇房'));
  // CORE-M-129 row 33 (UG L5405/L5406): the two deck shuffles draw on `meta`.
  Array_Shuffle(w.rng.meta, self.己方牌库);
  Array_Shuffle(w.rng.meta, self.敌方牌库);
  self.fx.bgm('战斗'); // BGM状态(3)
}

/** L2424: no shuffle; fog shown except in 宝箱房 / 属性房 / 抉择房 / 恢复点 and the tutorial; the shop reward spawns the shop. */
function nonCombatRoom(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const row = self.当前层地图格配置表.RowName;
  setHidden(w, self.迷雾图, ['宝箱房', '属性房', '抉择房', '恢复点'].includes(row) || inTutorial(self));
  if (rewardHas(self, '能力.类型.奖励.是商店')) {
    self.路口创建点 = { x: -160, y: 390, z: -1 };
    self.摆放玩家({ x: -120, y: -156, z: 0 });
    w.cult.切换修炼背包(false);
    const p=self.当前房间中心,s=w.spawn<BpObject&{激活商店():void}>('CatapultHero/BP/环境/商店/蓝图_商店',undefined,{x:p.x+100,y:p.y+380,z:p.z});
    s.激活商店();self.商店=s;
    return;
  }
  self.摆放玩家(self.玩家出生点); // L3432
  w.cult.切换修炼背包(false);
  self.创建角色();
}

/** L3507: the camp (phase 14). SPEC-GAP TURN-GAP-15: the camp page itself is wave B sys-camp-meta; its Delay 0.5 → 等待玩家操作 is kept. */
function campRoom(self: 蓝图_动作游戏模式): void {
  self.当前环节 = '进入营地';
  self.摆放玩家({ x: -1000, y: 0, z: 0 });
  setHidden(self.world, self.迷雾图, true);
  self.world.cult.切换屏蔽(true, false, 2);
  self.world.cult.切换修炼页显示(true);
  self.world.cult.切换修炼背包(false);
  self.delay('L4095', 0.5, () => self.等待玩家操作());
}

/** L4414: 锻造房 spawns its junction at once (wave B content; kept for completeness). */
function forgeRoom(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  self.摆放玩家(self.玩家出生点);
  w.cult.切换修炼背包(false);
  const at = { x: self.当前房间中心.x - 12, y: 0, z: 0 };
  const j = w.spawn(JUNCTION_PATH, (o: BpObject) => { (o as unknown as { 地图格配置: unknown }).地图格配置 = { DataTable: null, RowName: 'None' }; }, at);
  addUnique(self.环境交互物, j);
  (j as unknown as { 激活路口(b: boolean): void }).激活路口(false);
}

/** L1772: build failure (TURN-004). */
function buildFailed(self: 蓝图_动作游戏模式): void {
  if (self.房间任务配置失败) {
    if (self.当前层地图格配置表.RowName === '营地') return print(self.world, '营地任务行缺失或创建失败，已停止自动重建房间');
    // L5195: re-read the save once, then rebuild; a second failure returns to the camp.
    // SPEC-GAP: the save re-read (重置地图页 + 当前所在格 from the save) is core-run's; the port rebuilds directly.
    if (self.房间任务重读过) { print(self.world, '房间任务行缺失或创建失败：重读当前存档后仍未恢复，已停止自动重建房间'); return self.返回营地(); }
    self.房间任务重读过 = true;
    return self.重建房间();
  }
  self.房间重建失败次数 += 1; // L1964
  if (self.房间重建失败次数 <= 3) return self.重建房间();
  print(self.world, '房间生成连续失败，已停止自动重建房间');
  self.返回营地();
}

/** L2242: field fill (TURN-007). */
function fillField(self: 蓝图_动作游戏模式): void {
  if (!self.房间创建成功) return;
  self.抽取特定类型卡牌到场上_碰撞(self.中立牌库, self.中立场上, 99, 999);
  // 关闭加载页, 切换地图页转场: presentation.
  self.新一层触发时机();
  self.抽取卡牌到场上_碰撞(10);
}

/** TURN-008. Both loops index the live hero effect list (TURN-029: GM 新一层触发时机 L51/L953). */
export function 新一层触发时机(self: 蓝图_动作游戏模式): void {
  const hero = self.玩家角色;
  if (!valid(self.world, hero)) return;
  fireLive(self.world, hero.拥有的效果, '效果.时机.新一层时');
  if (mission(self.world)?.能力名 === '消灭所有敌人') fireLive(self.world, hero.拥有的效果, '效果.时机.新战斗层时');
}

/** TURN-006: ubergraph L26079 → L25110. */
export function 创建角色(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  self.场上最多敌人数量 = self.当前层配置.场上最多敌人;
  for (let p = 0; p < self.当前层配置.敌人池.length; p++) { // live loop L26161
    const pool = self.当前层配置.敌人池[p];
    const { 权重数组, 数据表数组 } = 函数库_工具.拆分权重数据表(self, [...pool.内容]);
    const 成长率 = self.获取当前层成长率(-1, 0).OutXY;
    for (let k = 0; k <= pool.数量 - 1; k++) {
      // The weighted pick on 全局种子 is drawn even when the gate then fails (TURN-006).
      const pick = 函数库_工具.权重选取(self, 权重数组, w.rng.全局种子).选中的序号;
      if (!函数库_工具.传统概率判断(self, self.当前层配置.敌人池[p].概率).触发) continue;
      const elite = self.精英化敌人();
      const handle = 数据表数组[pick];
      const card = self.生成角色(handle?.DataTable ?? null, handle?.RowName ?? 'None', { x: 0, y: 0, z: 0 }, '忽略', 成长率, elite).卡牌实例;
      if (!valid(w, card)) { print(w, '创建牌库卡牌失败//生成房间'); continue; }
      card.关闭碰撞();
      self.添加到牌库(card);
    }
  }
  self.当前层敌人总数 = self.敌方牌库.length; // L26533
  self.当前层有敌人 = true;
  if (valid(w, self.当前任务实例)) self.激活任务(self.当前任务实例, false);
}

/** 生成角色 (GM fn ln 4954): a BP_Actor_Other from a table row, collision off, activated, hidden. */
export function 生成角色(self: 蓝图_动作游戏模式, DataTable: AssetPath | null, 名字: string, 位置: Vec3, 忽略: Tag, 成长率: number, 是精英: boolean): { 卡牌实例: BP_Actor_Other | null } {
  const w = self.world;
  self.临时名字 = 名字;
  const row = DataTable ? (w.data.table(DataTable)?.rows as Record<string, 结构_角色> | undefined)?.[名字] : undefined;
  if (!row) { print(w, '找不到卡牌名字/选到空地图格'); return { 卡牌实例: null }; }
  if (忽略 !== '' && 忽略 !== 'None' && row.标签.includes(忽略)) return { 卡牌实例: null };
  const card = w.spawn<BP_Actor_Other>(OTHER_PATH, o => {
    o.角色配置 = row;
    o.成长率 = 成长率;
    o.名字 = 名字;
    o.显示名 = row.描述[0] ?? { zh: '', en: '' };
    o.是精英 = 是精英;
  });
  frame(self).tableOf.set(card, DataTable as string);
  card.所在格子 = null;
  card.关闭碰撞();
  card.K2_SetActorLocation(位置);
  card.激活角色(false);
  setHidden(w, card, true);
  return { 卡牌实例: card };
}

/** 添加到牌库 (GM ln 4868). */
export function 添加到牌库(self: 蓝图_动作游戏模式, 卡牌: BP_ManeActor | null): void {
  if (!卡牌) return;
  self.当前层精英数量 += 卡牌.是精英 ? 1 : 0;
  卡牌.关闭碰撞();
  卡牌.setTickEnabled(false);
  setHidden(self.world, 卡牌, true);
  卡牌.OwnedGameplayTags.remove('可交互.角色.AI.商品');
  addUnique(self.所有牌库, 卡牌);
  卡牌.目标位置 = { ...self.牌库坐标 };
  if (isHostile(卡牌)) addUnique(self.敌方牌库, 卡牌);
  else if (isAlly(卡牌)) addUnique(self.己方牌库, 卡牌);
  else addUnique(self.中立牌库, 卡牌);
}

/** 从牌库抽出 (GM ln 4843): revives a dead card, removes it from the decks. */
export function 从牌库抽出(self: 蓝图_动作游戏模式, 卡牌: BP_ManeActor | null): void {
  self.当前抽到牌 = 卡牌;
  if (!卡牌) return;
  if (卡牌.死掉了) 卡牌.被复活_重置();
  removeItem(self.所有牌库, 卡牌);
  if (isHostile(卡牌)) removeItem(self.敌方牌库, 卡牌);
  else if (isAlly(卡牌)) removeItem(self.己方牌库, 卡牌);
  else removeItem(self.中立牌库, 卡牌);
}

/** 添加到战场 (GM ln 3742). Insertion order is draw order (TURN-GAP-06). */
export function 添加到战场(self: 蓝图_动作游戏模式, 卡牌: BP_ManeActor | null): void {
  if (!卡牌) return;
  if (卡牌.HasMatchingGameplayTag('可交互.角色.AI.物品')) 卡牌.被揭示();
  addUnique(self.场上所有, 卡牌);
  if (self.当前房间实例) addUnique(self.当前房间实例.拥有的角色, 卡牌);
  if (isHostile(卡牌)) addUnique(self.敌方场上, 卡牌);
  else if (isAlly(卡牌)) addUnique(self.友方场上, 卡牌);
  else addUnique(self.中立场上, 卡牌);
}

/** 从场上移出（碰撞） (GM ln 3768): the only removal from the field lists (TURN-102). */
export function 从场上移出_碰撞(self: 蓝图_动作游戏模式, 卡牌: BP_ManeActor | null): void {
  removeItem(self.场上所有, 卡牌);
  removeItem(self.敌方场上, 卡牌);
  removeItem(self.友方场上, 卡牌);
  removeItem(self.中立场上, 卡牌);
}

export function 添加到墓地(self: 蓝图_动作游戏模式, 卡牌: BP_ManeActor | null): void { addUnique(self.墓地, 卡牌); }
export function 添加到延迟销毁(self: 蓝图_动作游戏模式, 卡牌: BP_ManeActor | null): void { addUnique(self.延迟销毁牌, 卡牌); }

/** TURN-010 (GM fn ln 3779). Draws on `level` (CORE-M-129 row 31). */
export function 抽取特定类型卡牌到场上_碰撞(self: 蓝图_动作游戏模式, 抽取库: (BP_ManeActor | null)[], 场上库: (BP_ManeActor | null)[], 场上最多数量: number, 抽取数: number): void {
  const w = self.world;
  const 临时抽取库 = [...抽取库];
  self.临时牌库数量 = 抽取库.length;
  self.临时场上数量 = 场上库.length;
  const m = Math.min(场上最多数量 - self.临时场上数量, 抽取数);
  if (!(self.临时牌库数量 > 0 && m > 0)) return;
  const 最终抽取数 = self.临时牌库数量 > m ? m : self.临时牌库数量;
  let 临时位置组: Vec3[] = [];
  // L673: re-sampled until k points exist. SPEC-GAP: capped at 64 tries (an unported or failing sampler would loop
  // forever in the port); the missing points then fall back to the room centre.
  for (let tries = 0; 临时位置组.length < 最终抽取数 && tries < 64; tries++) {
    临时位置组 = 函数库_工具.范围选取点(self, self.当前房间中心, 128, 1000, 128, 最终抽取数, true, 128).选到的点;
  }
  while (临时位置组.length < 最终抽取数) 临时位置组.push({ ...self.当前房间中心 });
  for (let i = 0; i <= 最终抽取数 - 1; i++) {
    self.从牌库抽出(临时抽取库[i] ?? null);
    const card = self.当前抽到牌;
    if (!card) continue;
    const spawnAt = !vecEq(card.出生点, NO_SPAWN)
      ? { x: self.当前房间中心.x + card.出生点.x, y: self.当前房间中心.y + card.出生点.y, z: self.当前房间中心.z + card.出生点.z }
      : 临时位置组[i];
    self.临时出生坐标 = spawnAt;
    card.K2_SetActorLocation({ x: spawnAt.x, y: spawnAt.y, z: card.高度 });
    card.开启碰撞();
    card.setTickEnabled(true);
    if (isHostile(card)) {
      card.当前目标 = self.玩家角色;
      const 斗志 = card.是精英 ? (isBoss(card) ? -20 : -10) : -5;
      self.玩家角色?.精神系统(0, 斗志, '遭遇敌人', false);
    }
    card.更新角色数据();
    self.添加到战场(card);
    // TURN-011: the U draw is consumed for every drawn card.
    const u = RandomFloatInRange(w.rng.level, 100 - card.行动力, card.行动力);
    card.当前行动力 = card.行动力 > 0 ? (isBoss(card) ? 100 : GridSnap_Float(u, 1)) : 0;
    const noAnim = !card.精灵动画序列[3]; // IsValid(精灵动画序列[3])
    setHidden(w, card, !(isBoss(card) || noAnim));
    const delay = RandomFloatInRange(w.rng.level, 0, 0.4);
    const s = w.spawn<蓝图_动画结算>(SETTLEMENT_PATH, o => {
      o.延迟 = isBoss(card) || noAnim ? 0 : delay;
      o.动画对象 = card;
      o.子动画结算 = [];
      o.结算类型 = '到战斗';
    });
    addUnique(self.出场动画结算数组, s);
  }
}

/** TURN-009 (GM fn ln 3890). */
export function 抽取卡牌到场上_碰撞(self: 蓝图_动作游戏模式, 抽取数: number): void {
  self.抽取特定类型卡牌到场上_碰撞(self.己方牌库, self.友方场上, self.场上最多友方数量, 抽取数);
  self.抽取特定类型卡牌到场上_碰撞(self.敌方牌库, self.敌方场上, self.场上最多敌人数量, 抽取数);
  const c = self.world.spawn<蓝图_动画结算>(SETTLEMENT_PATH, o => {
    o.延迟 = 0;
    o.子动画结算 = [...self.出场动画结算数组]; // SetArrayPropertyByName copies the array
    o.结算类型 = '无';
  });
  addUnique(self.模式动画结算数组, c);
  self.开始动画结算();
}

/** TURN-076: the cached field flags (GM ln 3464). */
export function 判断场上内容(self: 蓝图_动作游戏模式): { 有敌人: boolean; 有采集: boolean } {
  const w = self.world;
  let 场上 = false;
  let 采集 = false;
  for (let i = 0; i < self.场上所有.length; i++) {
    const a = self.场上所有[i];
    if (!valid(w, a) || a.死掉了) continue;
    if (isHostile(a)) 场上 = true;
    if (a.HasMatchingGameplayTag('可交互.角色.AI.物品.采集')) 采集 = true;
  }
  self.场上有敌人 = 场上;
  self.牌库有敌人 = self.敌方牌库.length > 0;
  self.当前层有敌人 = self.场上有敌人 || self.牌库有敌人;
  return { 有敌人: self.当前层有敌人, 有采集: 采集 };
}

/** TURN-074 (GM ln 3237): 有敌人死亡 on the hero (live index, AddUnique re-reads the slot), then on the cards, then 杀死敌人时. */
export function 有角色死亡时(self: 蓝图_动作游戏模式, 死亡角色: BP_ManeActor | null): void {
  const w = self.world;
  self.当前死亡角色 = 死亡角色;
  if (!死亡角色 || !self.当前死亡角色?.HasMatchingGameplayTag('可交互.角色.AI.仇恨')) return;
  const tag = '效果.时机.有敌人死亡';
  const 已触发效果2: (蓝图_效果 | null)[] = [];
  const hero = self.玩家角色;
  if (hero) {
    for (let i = 0; i < hero.拥有的效果.length; i++) {
      const e = hero.拥有的效果[i];
      if (!valid(w, e) || !e.HasMatchingGameplayTag(tag)) continue;
      e.触发时机 = tag;
      e.持续中触发(tag);
      addUnique(已触发效果2, hero.拥有的效果[i] ?? null); // QUIRK (L236): re-reads the slot after a self-destroy
    }
  }
  const 整合 = [...w.cult.背包里牌, ...w.cult.已装备牌];
  for (let c = 0; c < 整合.length; c++) {
    const card = 整合[c];
    if (!card) continue;
    for (let i = 0; i < card.拥有的效果.length; i++) {
      const e = card.拥有的效果[i];
      if (!valid(w, e) || !e.HasMatchingGameplayTag(tag)) continue;
      e.触发时机 = tag;
      if (已触发效果2.includes(e)) continue;
      e.持续中触发(tag);
    }
  }
  const killer = 死亡角色.当前受伤数据.来自角色 as BP_ManeActor | null;
  if (valid(w, killer)) killer.杀死敌人时(self.当前死亡角色);
}

/** TURN-102 (GM ln 2938). */
export function 清理房间(self: 蓝图_动作游戏模式): void {
  const host=self as 蓝图_动作游戏模式&{ug_roomEntryGeneration?:number};host.ug_roomEntryGeneration=(host.ug_roomEntryGeneration??0)+1;
  const w = self.world;
  self.已有路口 = false;
  self.有逃跑敌人 = false;
  self.场上有敌人 = false;
  self.回廊累计数 = 0;
  self.当前层敌人总数 = 0;
  self.当前层回合 = 0;
  self.当前层精英数量 = 0;
  for (const r of [...self.已创建普通房间, ...self.已创建特殊房间]) if (valid(w, r)) 函数库_工具.销毁目标和子物体(self, r);
  for (const g of self.墓地) if (valid(w, g)) destroyActor(self, g);
  for (const a of [...self.场上所有]) {
    if (!valid(w, a)) continue;
    if (isAlly(a)) { self.添加到牌库(a); continue; } // allies go back to their deck, hidden
    destroyActor(self, a);
  }
  for (const a of self.敌方牌库) if (valid(w, a)) destroyActor(self, a);
  for (const o of [...self.环境交互物, ...self.场上可拾取物]) if (valid(w, o)) w.destroy(o);
  if (valid(w, self.商店)) 函数库_工具.销毁目标和子物体(self,self.商店); // Source 清理房间 L2832 includes attached merchant and shelves.
  self.回合开始实例.length = 0;
  self.场上所有.length = 0;
  self.友方场上.length = 0;
  self.敌方场上.length = 0;
  self.敌方牌库.length = 0;
  self.敌人出生点数组.length = 0;
  self.场上可拾取物.length = 0;
  self.可行动角色.length = 0;
  self.环境交互物.length = 0;
  self.墓地.length = 0;
  self.掉落盒数组.length = 0;
  self.已创建普通房间.length = 0;
  self.已创建特殊房间.length = 0;
  // QUIRK (GM ln 3053–3069): 中立场上, 中立牌库 and 己方牌库 are never cleared; destroyed neutrals stay as stale entries (TF-TV-39).
}

/** Destroys an actor and its effects (清理房间 step 3). */
function destroyActor(self: 蓝图_动作游戏模式, a: BP_ManeActor): void {
  for (const e of [...a.拥有的效果]) if (valid(self.world, e)) self.world.destroy(e);
  函数库_工具.销毁目标和子物体(self, a);
}

/** 重置牌库和墓地 (GM ln 1222): every graveyard card back to its deck. SPEC-GAP: read from the function name; no live caller in wave A. */
export function 重置牌库和墓地(self: 蓝图_动作游戏模式): void {
  for (const g of [...self.墓地]) if (valid(self.world, g)) self.添加到牌库(g);
  self.墓地.length = 0;
}

/** 添加道具到牌库 (GM ln 2272): 生成角色 from 数据表_道具_通用, then 添加到牌库. */
export function 添加道具到牌库(self: 蓝图_动作游戏模式, 名字: string): void {
  const card = self.生成角色('CatapultHero/数据表/角色/数据表_道具_通用', 名字, { x: 0, y: 0, z: 0 }, '忽略', 0, false).卡牌实例;
  if (valid(self.world, card)) self.添加到牌库(card);
}

/** 根据数组长度延迟 (GM ln 3665): 基础延迟 + len × 每长度延迟. */
export function 根据数组长度延迟(_self: 蓝图_动作游戏模式, TargetArray: (蓝图_动画结算 | null)[], 每长度延迟: number, 基础延迟: number): number {
  return 基础延迟 + TargetArray.length * 每长度延迟;
}

/** The selected cell's reward ability has the tag (GM ln 5444/6069: 当前所在格.奖励技能实例.类型). */
export function rewardHas(self: 蓝图_动作游戏模式, tag: Tag): boolean {
  const r = currentMapTile(self.world)?.奖励技能实例;
  return valid(self.world, r) && r.类型.has(tag);
}

/** 新手关中？ (EMS save flag). SPEC-GAP: the save flag is core-run's; the port reads the tutorial cell rows. */
export function inTutorial(self: 蓝图_动作游戏模式): boolean {
  return self.当前层地图格配置表.RowName.startsWith('新手关');
}

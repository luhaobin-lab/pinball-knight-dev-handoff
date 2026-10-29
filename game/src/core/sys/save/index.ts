/**
 * Module `save` (WAVE_A Appendix W2, card core-run): save v0. The EMS custom save object (ems.ts), the boot load
 * chain of the game mode (AsyncLoadActors 1 → 2, or the missing-save path that creates one), the hero snapshot
 * `BP_Actor_Player.保存英雄信息` (phases 8 / 9), and `saveBlob` (createGame's `save()`).
 * Demo: dump/blueprints-pseudo/CatapultHero/BP/Actor/蓝图_动作游戏模式.txt (GM L17560, L27346–L30281),
 * BP/Actor/BP_Actor_Player.txt (L22967, L7123), BP/存档/EMS_基础存档.txt.
 */
import type { SaveBlob } from '../../api/types.ts';
import type { SaveFns, Systems } from '../../bp/systems.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';
import type { RngSave } from '../../rng/domains.ts';
import type { World } from '../../sim/world.ts';
import { emsBlob, fromJson, GetCustomSave, toJson, type EMS_基础存档 } from './ems.ts';
import{inventorySnapshot,loadInventoryActors,readInventory,cardLoaded,cardPreSave}from'./inventory.ts';
import { heroSaveFns } from './hero.ts';

export { EMS_基础存档, GetCustomSave } from './ems.ts';

/** The game mode's SaveGame variables (dump/blueprints/…/蓝图_动作游戏模式.json, flag SaveGame), port names. */
const MODE_SAVED = [
  '当前关卡名', '本轮通过关卡', '当前总层数', '当前关卡层数', '当前层回合', '金币', '当前地图格标签队列', '地图格历史', '收入',
  '总回合数', '通过关卡数', '当前经验', '最大经验', '当前腐化', '最大腐化', '英雄等级', '全局词条', '本轮种子', '材料包',
  '材料仓库', '轮回战斗统计', '已获取天赋数', '精英几率累加', '品质非酋保护', '精英化概率', '当前关卡最高层数', '当前轮回最高关卡数',
  '当前轮回任务条', '游戏层数上限', '英雄生命百分比保存', '英雄魔力百分比保存', '英雄解锁进度', '当前英雄角色名', '当前英雄天赋名',
  '无尽模式', '开启地刺', '传奇房触发计数', '当前关卡任务条',
] as const satisfies readonly (keyof 蓝图_动作游戏模式)[];
// SPEC-GAP: 全局种子 (a SaveGame variable) is the RNG domain `全局种子`; it is saved with the domains below.

/** BP_ManeActor + BP_Actor_Player SaveGame variables (the hero's actor save), port names. */
const HERO_SAVED = [
  '死掉了', '角色配置', '品质', '等级', '成长率', '生命百分比', '词条', '唯一ID', '名字', '显示名', '锻造词条', '是精英', '弹力点', '种子',
  '暴击保护计数', '当前是暴击', '天赋存档', '主动能力存档', '持续伤害存档', '腐化满过', '斗志神智', '精神状态', '精神存档',
] as const;
// SPEC-GAP: the actor's 标签 container is runtime state of the kernel (OwnedGameplayTags); it is rebuilt by 激活角色.

/** The map page's own save (core-map: 保存地图页 + 保存关卡页), through the `map` facade. */
interface MapSaveAccess { 地图存档?(world: World): unknown }

function snapshot(world: World): Record<string, unknown> {
  world.mode.玩家角色?.ActorPreSave();
  const m = world.mode as unknown as Record<string, unknown>;
  const mode: Record<string, unknown> = {};
  for (const k of MODE_SAVED) mode[k] = toJson(m[k]);
  const hero: Record<string, unknown> = {};
  const p = world.mode.玩家角色 as unknown as Record<string, unknown> | null;
  if (p) for (const k of HERO_SAVED) if (k in p) hero[k] = toJson(p[k]);
  const map = (world.sys.map as unknown as MapSaveAccess).地图存档?.(world);
  const inventory=inventorySnapshot(world);
  return { mode, hero, rng: toJson(world.rng.save()), map: map === undefined ? null : toJson(map),inventory };
}

/** EMS AsyncLoadActors: the snapshot back onto the game mode, the hero and the RNG domains. */
function applySnapshot(world: World, snap: Record<string, unknown>): void {
  const m = world.mode as unknown as Record<string, unknown>;
  const mode = (snap.mode ?? {}) as Record<string, unknown>;
  for (const k of MODE_SAVED) if (Object.hasOwn(mode, k)) m[k] = fromJson(mode[k]);
  const hero = (snap.hero ?? {}) as Record<string, unknown>;
  const p = world.mode.玩家角色 as unknown as Record<string, unknown> | null;
  if (p) for (const k of HERO_SAVED) if (Object.hasOwn(hero, k)) p[k] = fromJson(hero[k]);
  if (snap.rng) world.rng.load(fromJson(snap.rng) as RngSave);
}

/** The map page save of the last snapshot (core-map reads it when it rebuilds the map page on load). */
export function 地图存档快照(world: World): unknown {
  return GetCustomSave(world).actorSnapshot?.map ?? null;
}

/** `EMSFunctionLibrary.SaveCustom` + the last actor snapshot: createGame's `save()` hook. */
export function saveBlob(world: World): SaveBlob {
  return emsBlob(GetCustomSave(world));
}

/** EMSAsyncSaveGame.AsyncSaveActors(3): the snapshot is taken now; completion fires on the next frame. */
function asyncSaveActors(self: 蓝图_动作游戏模式, node: string, completed: () => void): void {
  GetCustomSave(self.world).actorSnapshot = snapshot(self.world);
  self.fx.ui({op:'update',widget:'save.persist'});
  self.nextTick(node, completed);
}

// ---- 蓝图_动作游戏模式: the boot load chain (GM L17560 → L27346 / L27591) ----

/** AsyncLoadActors(1) completed (L27346). The port's save exists only when createGame got one: else L27591. */
function OnCompleted_CA39(self: 蓝图_动作游戏模式): void {
  const s = GetCustomSave(self.world);
  if (!s.loadedFromSave) {
    self.OnFailed_CA3908B4440EBB3BF905F9BD2B9266E2();
    return;
  }
  if (s.actorSnapshot) applySnapshot(self.world, s.actorSnapshot);
  self.重置牌库和墓地();
  loadInventoryActors(self.world,s.actorSnapshot?.inventory);
  // AsyncLoadActors(2): the second pass (cards, map objects) completes on the next frame.
  self.nextTick('L27346', () => self.OnCompleted_9BE53CAA445F3336195F1B83297A6F54());
}

/** L27591: "存档损坏/不存在" → AsyncSaveActors(3) → L29965. */
function OnFailed_CA39(self: 蓝图_动作游戏模式): void {
  asyncSaveActors(self, 'L27591', () => self.OnCompleted_34E7C23C499B82D419E32CA44B21C8E1());
}

/** L29965: 初始化天赋解锁, then the previous version's slot (none in the port: SPEC-GAP, no slots on disk) → 返回营地. */
function OnCompleted_34E7(self: 蓝图_动作游戏模式): void {
  self.初始化天赋解锁();
  self.返回营地();
}

interface RunResume { 继续冒险?(world: World): void; 激活警告页?(world: World, type: 0 | 2): void }

/**
 * L27905: the loaded save decides. 新手关中 or a camp / death phase → 返回营地 (L27982). Otherwise (map or a room):
 * 重置房间？ → 继续冒险 (L28466); else the resume prompt, warning type 2 (L29825). QUIRK (L28111): the map phase 选择地图
 * also gets the prompt (the switch sends it to L28452).
 */
function OnCompleted_9BE5(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const s = GetCustomSave(w);
  const run = w.sys.run as unknown as RunResume;
  if (s.新手关中) {
    s.重置房间 = false;
    self.返回营地();
    self.修炼系统?.读档物品();
    return;
  }
  self.读档环节 = s.当前环节;
  if (self.读档环节 === '进入营地' || self.读档环节 === '死亡结算') {
    s.重置房间 = false;
    self.返回营地();
    self.修炼系统?.读档物品();
    return;
  }
  if (self.测试模式 || s.重置房间) {
    run.继续冒险?.(w);
    return;
  }
  run.激活警告页?.(w, 2);
}

// ---- BP_Actor_Player ----

/**
 * 保存英雄信息 (L22967): the save's 当前环节, SaveCustom; at phases 9 / 8 also the hero's HP / Stamina shares and the actor
 * snapshot (AsyncSaveActors(3), L7123).
 */
function 保存英雄信息(self: BP_Actor_Player): void {
  const w = self.world;
  const mode = w.mode;
  const s = GetCustomSave(w);
  s.当前环节 = mode.当前环节;
  if (mode.当前环节 !== '选择地图' && mode.当前环节 !== '创建房间') {mode.fx.ui({op:'update',widget:'save.persist'});return;}
  mode.英雄生命百分比保存 = self.生命百分比;
  mode.英雄魔力百分比保存 = self.魔力百分比;
  s.actorSnapshot = snapshot(w);
  mode.fx.ui({op:'update',widget:'save.persist'});
}

const noop = (): void => {};

const fns: SaveFns = {
  BP_Actor_Card:{ActorLoaded:cardLoaded,ActorPreSave:cardPreSave},
  蓝图_动作游戏模式: {
    OnCompleted_CA3908B4440EBB3BF905F9BD2B9266E2: OnCompleted_CA39,
    OnFailed_CA3908B4440EBB3BF905F9BD2B9266E2: OnFailed_CA39,
    OnCompleted_9BE53CAA445F3336195F1B83297A6F54: OnCompleted_9BE5,
    OnFailed_9BE53CAA445F3336195F1B83297A6F54: noop, // L29959
    OnCompleted_34E7C23C499B82D419E32CA44B21C8E1: OnCompleted_34E7,
    OnFailed_34E7C23C499B82D419E32CA44B21C8E1: noop, // L32798
    // The camp save (AsyncSaveActors at L3507) completes into SaveCustom (L27340 → L27308): the blob is always current.
    OnCompleted_3E83B1C948F8B25875D9488F8E423950: noop,
    OnFailed_3E83B1C948F8B25875D9488F8E423950: noop, // L27345
    OnCompleted_EBE4741E45B5EA48D61C5BB0903AD41B: noop, // L25001: 关闭加载页 (presentation) and a print
    OnFailed_EBE4741E45B5EA48D61C5BB0903AD41B: noop, // L27292
    ActorSaved: noop, ActorPreSave: noop, ActorPreLoad: noop, ActorLoaded: noop, // L27336–L27339: empty events
  },
  BP_Actor_Player: {
    ...heroSaveFns,
    保存英雄信息,
    OnCompleted_C81C75324F27A87D9007C3A3B27424A6: noop, // L7353: a print
    OnFailed_C81C75324F27A87D9007C3A3B27424A6: noop, // L7430
  },
  修炼系统: {
    读档物品: readInventory,
  },
};

/** What the run and meta modules call through `world.sys.save`. */
export interface SaveUi {
  GetCustomSave(world: World): EMS_基础存档;
  saveBlob(world: World): SaveBlob;
  地图存档快照(world: World): unknown;
  /** BP_ManeActor-level helper for tests: the hero snapshot without the phase gate. */
  snapshotNow(world: World): void;
}

export const save: Systems['save'] & SaveUi = {
  ...fns,
  GetCustomSave,
  saveBlob,
  地图存档快照,
  snapshotNow: world => { GetCustomSave(world).actorSnapshot = snapshot(world); },
};


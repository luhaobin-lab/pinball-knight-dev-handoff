/**
 * EMS_基础存档 (dump/blueprints-pseudo/CatapultHero/BP/存档/EMS_基础存档.txt): the Demo's EasyMultiSave custom save,
 * the one object every `GetCustomSave(EMS_基础存档_C)` returns. Here it is a world object (so it is part of the digest),
 * created on first use from the createGame save blob, and written back by `saveBlob`.
 *
 * Save v0 (WAVE_A A21): meta fields + run fields of this object, plus the actor snapshot taken by
 * `BP_Actor_Player.保存英雄信息` at phases 8 / 9 (the game mode's and the hero's SaveGame variables, the RNG domains,
 * the map page), as versioned JSON.
 */
import type { 结构_分数, 结构_存档_仓库物品, 结构_存档_地图格, 枚举_环节 } from '../../../content/demo/types.ts';
import type { SaveBlob } from '../../api/types.ts';
import { BpObject } from '../../sim/object.ts';
import type { AssetPath } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';

export const SAVE_VERSION = 0;

export class EMS_基础存档 extends BpObject {
  static override readonly path: AssetPath = 'CatapultHero/BP/存档/EMS_基础存档';
  地图格层数: number = -1;
  地图格数量累计: number = 0;
  关卡地图切换: number = 0;
  当前关卡数: number = -1;
  地图格存档数组: 结构_存档_地图格[] = [];
  当前关卡选项: string[] = [];
  关卡进度: Map<string, number> = new Map();
  新手关中: boolean = false; // 新手关中？
  新手关过: boolean = false; // 新手关过？
  被选择头像序号: number = 0;
  被选择天赋序号: number = 0;
  已解锁英雄: string[] = ['幽冥骑士', '灵魂猎手'];
  已触发新手提示: string[] = [];
  已解锁关卡: string[] = ['营地', '遗迹', '矿洞', '实验室', '龙穴', '武器库'];
  已解锁配方: string[] = [];
  已解锁机制: string[] = [];
  音效量: number = 1;
  音乐量: number = 1;
  窗口设置: string = 'r.SetRes 1280x720w';
  语言设置: string = '无';
  潜能点配置: Map<string, number> = new Map();
  主线任务: Map<string, boolean> = new Map([['序幕', false], ['开启大门', false], ['荣耀与寄生', false], ['往日回忆', false], ['凝视深渊', false]]);
  当前轮回任务进度: Map<string, number> = new Map();
  探索等级进度: Map<string, 结构_分数> = new Map();
  已选进阶级别: number = -1;
  最高进阶级别: number = -1;
  解锁进阶级别: number = -1;
  当前环节: 枚举_环节 = '进入营地';
  仓库牌数据: 结构_存档_仓库物品[] = [];
  已解锁天赋: string[] = [];
  当前所在格坐标: { X: number; Y: number } = { X: 0, Y: 0 };
  轮回次数: number = -1;
  鼠标窗口锁定: boolean = false;
  重置房间: boolean = false; // 重置房间？
  /** The actor snapshot (EMS SaveActors) of the last 保存英雄信息 at phase 8 / 9; null before the first one. */
  actorSnapshot: Record<string, unknown> | null = null;
  /** True when the createGame options carried a save (EMS AsyncLoadActors succeeds). */
  loadedFromSave: boolean = false;
}

/** Meta fields (PROTOTYPE_SCOPE §2) plus the settings and progression fields the Demo keeps across runs. */
export const META_FIELDS = [
  '探索等级进度', '已解锁配方', '已解锁机制', '已解锁天赋', '主线任务', '新手关过', '已触发新手提示', '被选择头像序号',
  '被选择天赋序号', '已解锁英雄', '已解锁关卡', '音效量', '音乐量', '窗口设置', '语言设置', '潜能点配置', '已选进阶级别',
  '最高进阶级别', '解锁进阶级别', '仓库牌数据', '轮回次数', '鼠标窗口锁定',
] as const satisfies readonly (keyof EMS_基础存档)[];

/** Run fields (PROTOTYPE_SCOPE §2) plus the map-page bookkeeping saved with them. */
export const RUN_FIELDS = [
  '地图格存档数组', '当前关卡选项', '关卡地图切换', '新手关中', '重置房间', '当前环节', '地图格层数', '地图格数量累计',
  '当前关卡数', '关卡进度', '当前轮回任务进度', '当前所在格坐标',
] as const satisfies readonly (keyof EMS_基础存档)[];

/** Save keys use the Demo spelling (with ？) so a blob reads like the Demo's save. */
const DEMO_KEY: Partial<Record<string, string>> = { 新手关中: '新手关中？', 新手关过: '新手关过？', 重置房间: '重置房间？' };
const keyOf = (f: string): string => DEMO_KEY[f] ?? f;

/** JSON-safe copy: Maps become { $map: [[k, v]…] }, objects and arrays are deep-copied. */
export function toJson(v: unknown): unknown {
  if (v instanceof Map) return { $map: [...v.entries()].map(([k, x]) => [toJson(k), toJson(x)]) };
  if (Array.isArray(v)) return v.map(toJson);
  if (v && typeof v === 'object') {
    if (v instanceof BpObject) return null; // object references are not saved (EMS saves actors separately)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toJson(x)]));
  }
  return v;
}

export function fromJson(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(fromJson);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.$map)) return new Map((o.$map as [unknown, unknown][]).map(([k, x]) => [fromJson(k), fromJson(x)]));
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, fromJson(x)]));
  }
  return v;
}

const instances = new WeakMap<World, EMS_基础存档>();

/** What the run / meta / save modules read from the createGame options (core-sim's SimWorld carries them). */
interface WithOptions { readonly options?: { readonly save?: SaveBlob; readonly debug?: { readonly skipPrologue?: boolean } } }

/**
 * `EMSFunctionLibrary.GetCustomSave(EMS_基础存档_C)`: the save object, created on first use and loaded from the
 * createGame save blob (EMS loads the custom save from disk on first access). `debug.skipPrologue` sets 新手关过？.
 */
export function GetCustomSave(world: World): EMS_基础存档 {
  let s = instances.get(world);
  if (s && s.valid) return s;
  s = world.spawn(EMS_基础存档);
  instances.set(world, s);
  const o = (world as World & WithOptions).options;
  const blob = o?.save;
  if (blob && blob.version === SAVE_VERSION) {
    const rec = s as unknown as Record<string, unknown>;
    for (const f of META_FIELDS) if (Object.hasOwn(blob.meta, keyOf(f))) rec[f] = fromJson(blob.meta[keyOf(f)]);
    if (blob.run) {
      for (const f of RUN_FIELDS) if (Object.hasOwn(blob.run, keyOf(f))) rec[f] = fromJson(blob.run[keyOf(f)]);
      const snap = blob.run.actorSnapshot;
      s.actorSnapshot = snap && typeof snap === 'object' ? (JSON.parse(JSON.stringify(snap)) as Record<string, unknown>) : null;
    }
    s.loadedFromSave = true;
  }
  if (o?.debug?.skipPrologue) s.新手关过 = true;
  return s;
}

/** The SaveBlob of the current save object (EMS SaveCustom + the last actor snapshot). */
export function emsBlob(s: EMS_基础存档): SaveBlob {
  const rec = s as unknown as Record<string, unknown>;
  const meta: Record<string, unknown> = {};
  for (const f of META_FIELDS) meta[keyOf(f)] = toJson(rec[f]);
  const run: Record<string, unknown> = {};
  for (const f of RUN_FIELDS) run[keyOf(f)] = toJson(rec[f]);
  run.actorSnapshot = s.actorSnapshot ? JSON.parse(JSON.stringify(s.actorSnapshot)) : null;
  return { version: SAVE_VERSION, meta, run };
}

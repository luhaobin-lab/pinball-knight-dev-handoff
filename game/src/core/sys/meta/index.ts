/**
 * Module `meta` (WAVE_A Appendix W2, card core-run): run score → exploration level (UI_冒险结束统计页 L2016–L4638),
 * hero unlocks (UI_英雄头像 L2641 / L1669) and BP_ManeActor.判断解锁. The building-state functions of the game mode
 * and the achievement grid are camp buildings (out of scope, PROTOTYPE_SCOPE §10.7) and stay unported.
 * Demo: dump/blueprints-pseudo/CatapultHero/BP/UI/UI_冒险结束统计页.txt (END), UI_英雄头像.txt (AVA),
 * BP/Actor/BP_ManeActor.txt.
 */
import { findRow, rowNames, 数据表_玩家 } from '../../../content/demo/index.ts';
import type { 结构_分数 } from '../../../content/demo/types.ts';
import type { GameDebugOptions } from '../../api/types.ts';
import { structOf } from '../../bp/structs.ts';
import type { MetaFns, Systems } from '../../bp/systems.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { World } from '../../sim/world.ts';

/** The save object through the `save` facade (EMS_基础存档; core-run's own module). */
interface SaveAccess { GetCustomSave(world: World): { readonly 探索等级进度: Map<string, 结构_分数> } }
const GetCustomSave = (world: World) => (world.sys.save as unknown as SaveAccess).GetCustomSave(world);

/** UI_冒险结束统计页.轮回得分统计 (CDO), in the widget's map order. */
export const 轮回得分统计: readonly (readonly [string, number])[] = [
  ['反弹', 1], ['获得SSS', 20], ['获取物品', 5], ['分解物品', 5], ['英雄升级', 30], ['获取天赋', 10], ['进行附魔', 5],
  ['挑战成功', 50], ['击败首领', 50], ['探险失败', -100], ['完成探险', 1000], ['接受指引', 500], ['自我放弃', -100],
];

export interface ScoreLine { readonly 统计名: string; readonly 每次分数: number; readonly 发生次数: number }

export interface ExplorationResult {
  /** The UI_冒险统计词条 lines: every category that occurred (count > 0), in 轮回得分统计 order. */
  readonly lines: readonly ScoreLine[];
  readonly 本次增加分数: number;
  readonly 本次增加等级: number;
  readonly 更新前分数: 结构_分数;
  /** The value written to 探索等级进度['总值']. */
  readonly 更新后分数: 结构_分数;
}

/**
 * END L2016–L4638: the run's points (Σ 每次分数 × 发生次数 over the categories with count > 0), then the level loop:
 * from level n the next needs 每级所需分·(n+1); this run's leftover points carry over; the stored progress is max(…, 0).
 * QUIRK (L4057): a level-up subtracts the need from this run's points only and zeroes 临时分数, so the progress the save
 * already had toward the current level is lost (500 + 2582 from level 2 → level 3 with 1082, not 1582).
 * QUIRK (L4057): the loop never checks 最高解锁等级 (35); the cap is only stored. A missing '总值' entry reads the struct
 * default (Map_Find), 500 points per level.
 */
export function 结算探索等级(before: 结构_分数 | undefined, 统计: ReadonlyMap<string, number>): ExplorationResult {
  const 更新前分数 = before ?? structOf('结构_分数');
  const lines: ScoreLine[] = [];
  let 本次增加分数 = 0;
  for (const [统计名, 每次分数] of 轮回得分统计) {
    const n = 统计.get(统计名) ?? 0;
    if (!(n > 0)) continue;
    本次增加分数 += 每次分数 * n;
    lines.push({ 统计名, 每次分数, 发生次数: n });
  }
  let 临时分数 = 更新前分数.当前解锁分;
  let 未消耗分数 = 本次增加分数;
  let 本次增加等级 = 0;
  // A non-positive 每级所需分 would never stop the Demo's loop either; it cannot come from the Demo's data.
  while (更新前分数.每级所需分 > 0 && 未消耗分数 + 临时分数 >= 更新前分数.每级所需分 * (更新前分数.当前解锁等级 + 本次增加等级 + 1)) {
    未消耗分数 -= 更新前分数.每级所需分 * (更新前分数.当前解锁等级 + 本次增加等级 + 1);
    临时分数 = 0;
    本次增加等级 += 1;
  }
  const 更新后分数: 结构_分数 = {
    当前解锁分: Math.max(未消耗分数 + 临时分数, 0),
    每级所需分: 500,
    当前解锁等级: 更新前分数.当前解锁等级 + 本次增加等级,
    最高解锁等级: 35,
  };
  return { lines, 本次增加分数, 本次增加等级, 更新前分数, 更新后分数 };
}

/** 探索等级进度['总值'] of the save (the struct default when absent, as Map_Find). */
export function 探索等级(world: World): 结构_分数 {
  return GetCustomSave(world).探索等级进度.get('总值') ?? structOf('结构_分数');
}

/** The heroes UI_英雄选择页 lists (L1475): rows of 数据表_玩家 without 忽略 (the 测试 row only in 测试模式). */
export function 可选英雄(world: World): string[] {
  const out: string[] = [];
  for (const name of rowNames(数据表_玩家)) {
    const r = findRow(数据表_玩家, name);
    if (!r) continue;
    const test = (name as string) === '测试' && world.mode.测试模式;
    if (test || !r.标签.includes('忽略')) out.push(name);
  }
  return out;
}

/** UI_英雄头像.更新头像信息 (AVA L2641 → L1669): unlocked when 探索等级进度['总值'].当前解锁等级 ≥ 解锁.积分等级. */
export function 英雄已解锁(world: World, hero: string): boolean {
  const r = findRow(数据表_玩家, hero);
  if (!r) return false;
  if ((world as World & { options?: { debug?: GameDebugOptions } }).options?.debug?.unlockAllHeroes) return true;
  return 探索等级(world).当前解锁等级 >= r.解锁.积分等级;
}

/** BP_ManeActor.判断解锁 (ln 4892): 已解锁？ = 当前总层数 ≥ 解锁.层数. */
function 判断解锁(self: BP_ManeActor): void {
  self.已解锁 = self.world.mode.当前总层数 >= self.解锁.层数;
}

const fns: MetaFns = {
  BP_ManeActor: { 判断解锁 },
};

/** What the run module calls through `world.sys.meta` (the UI functions the facade does not declare). */
export interface MetaUi {
  结算探索等级: typeof 结算探索等级;
  探索等级: typeof 探索等级;
  可选英雄: typeof 可选英雄;
  英雄已解锁: typeof 英雄已解锁;
}

export const meta: Systems['meta'] & MetaUi = { ...fns, 结算探索等级, 探索等级, 可选英雄, 英雄已解锁 };

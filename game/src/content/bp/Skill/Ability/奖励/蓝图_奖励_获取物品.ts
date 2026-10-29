/**
 * 蓝图_奖励_获取物品 — the item offer (UI_物品盒子): opens the box with parameters 4 (0 = can give up), 3 (take limit),
 * 2 (refreshes), fills it through 刷新生成牌 (count 递减强化属性(参数0, 0.2), paid unless 参数1 = 0, random quality unless
 * 参数7 ≠ 0, quality clamp(生成品质, 参数5, 单次级别上限), all heroes = literal true, ln 266) and attaches an enchant to each
 * card with chance 参数6. Closing the box ends the floor unless the task is still open and 特殊处理 set 不结束层, or the
 * map is shown (phase 9).
 * Demo: CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取物品 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取物品.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_技能_奖励:初始奖励B, 获取物品_* (32 rows), 终结选项_3 (see classes.ts).
 * Batch: core-rewards.
 */
import type { World } from '../../../../../core/sim/world.ts';
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { 传统概率判断, 递减强化属性 } from '../../../../../core/math/prob.ts';
import type { 词条映射 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_奖励_获取物品 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取物品';
  指定名组: string[] = [];
  Array: string[] = [];
  Gameplay_Tags: string[] = [];
  触发计数: number = 1;
  词条修正: 词条映射 = new Map();
  数量: number = 1;
  生成品质: number = 1;
  不结束层: boolean = false;

  private p(i: number): number {
    return 函数库_技能.获取技能参数(this, this, i, false, '').参数值;
  }

  // L420
  override 执行技能(_是读档: boolean): void {
    const cult = this.world.cult;
    cult.切换物品盒子(false, this.p(4) === 0, FTrunc(this.p(3)), FTrunc(this.p(2)), this);
    this.刷新盒子();
  }

  // L865: 解锁材料 names are added (Map_Find value + 1 times each), then the box is filled (L1226).
  刷新盒子(): void {
    const w = this.world;
    for (const [name, n] of Object.entries(this.条件.解锁材料)) for (let i = 0; i <= n; i++) this.指定名组.push(name); // L1055/L217
    // SPEC-GAP: the 递减强化属性 facade drops its ref output; the core/math function is called with the meta domain (CORE-M-108).
    this.数量 = 递减强化属性(FTrunc(this.p(0)), 0.2, this.数量, w.rng.meta);
    const 随机品质 = this.p(7) === 0;
    const 品质 = Math.min(Math.max(this.生成品质, FTrunc(this.p(5))), this.单次级别上限);
    const 免费 = this.p(1) === 0;
    // QUIRK (ln 266): the count passed is FTrunc(参数0) (not 数量) and 全职业 is the literal true.
    w.cult.刷新生成牌(false, 免费, 随机品质, 品质, FTrunc(this.p(0)), this.目标或_且, this.目标标签, this.排斥标签, true, false, this.指定名组, [], this.词条修正);
    const run = (w.sys.save as { GetCustomSave(world: World): { 轮回次数: number } }).GetCustomSave(w).轮回次数;
    for (let i = 0; i < w.cult.未拾取牌.length; i++) { // L2153 (live length)
      if (!传统概率判断(this.p(6), w.rng.meta)) continue;
      w.cult.未拾取牌[i]?.添加附魔([], 0, true, false, run); // enchant module (stub in wave A)
    }
  }

  // L2854
  盒子关闭后(): void {
    const mode = this.world.mode;
    const task = mode.当前任务实例 as (typeof mode.当前任务实例 & { 未完成?: boolean }) | null;
    if (!this.world.isValid(task)) return;
    if ((task.未完成 === true && this.不结束层) || mode.当前环节 === '选择地图') return;
    mode.结束当前层(true); // L3103
  }

  // L3146
  特殊处理(): void {
    this.不结束层 = true;
  }

  // L2852
  override 被选中(): void {}

  // L2853
  override 检查子条件(): void {}
}

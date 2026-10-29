/**
 * 蓝图_能力_点击交互_打开盒子 — a crate that opens the item box: parameters 4 (0 = can give up), 3 (take limit), 2 (refreshes);
 * the count is 递减强化属性(参数0, 0.3) from 0, paid unless 参数1 = 0, all heroes when 参数8 = 1, every card enchanted when
 * 参数6 = 1. Closing the box starts combat and ends the hero's action.
 * Demo: CatapultHero/BP/Skill/Ability/道具/蓝图_能力_点击交互_打开盒子 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/道具/蓝图_能力_点击交互_打开盒子.txt)
 * Parent: 蓝图_能力_点击交互. CDO tags (manifest): none.
 * Rows: 数据表_技能_道具:点击交互_武器, 数据表_技能_道具:点击交互_非武器, 数据表_技能_道具:点击交互_废品, 数据表_技能_道具:点击交互_附魔.
 * Batch: core-rewards.
 */
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import type { World } from '../../../../../core/sim/world.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { 递减强化属性 } from '../../../../../core/math/prob.ts';
import type { AssetPath } from '../../../../demo/types.ts';
import { 蓝图_能力_点击交互 } from './蓝图_能力_点击交互.ts';

export class 蓝图_能力_点击交互_打开盒子 extends 蓝图_能力_点击交互 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_点击交互_打开盒子';
  生成品质: number = 1;

  private p(i: number): number {
    return 函数库_技能.获取技能参数(this, this, i, false, '').参数值;
  }

  // L1987
  override 子触发(): void {
    this.world.cult.切换物品盒子(false, this.p(4) === 0, FTrunc(this.p(3)), FTrunc(this.p(2)), this);
    this.刷新盒子();
  }

  // L2632 → L2432
  override 刷新盒子(): void {
    const w = this.world;
    this.生成数量 = 0;
    for (const [name, n] of Object.entries(this.条件.解锁材料)) for (let i = 0; i <= n; i++) this.指定名组.push(name); // L493
    // L1065. SPEC-GAP: the 递减强化属性 facade drops its ref output; core/math with the meta domain (CORE-M-108).
    this.生成数量 = 递减强化属性(FTrunc(this.p(0)), 0.3, this.生成数量, w.rng.meta);
    w.cult.刷新生成牌(false, this.p(1) === 0, true, this.生成品质, this.生成数量, this.目标或_且, this.目标标签, this.排斥标签, this.p(8) === 1, false, this.指定名组, [], this.词条修正);
    if (this.p(6) !== 1) return;
    const run = (w.sys.save as { GetCustomSave(world: World): { 轮回次数: number } }).GetCustomSave(w).轮回次数;
    for (let i = 0; i < w.cult.未拾取牌.length; i++) w.cult.未拾取牌[i]?.添加附魔([], 0, true, false, run); // L310 (live length)
  }

  // L2637
  override 盒子关闭后(): void {
    const mode = this.world.mode;
    mode.进入战斗状态();
    mode.玩家角色?.结束行动(null, '');
  }
}

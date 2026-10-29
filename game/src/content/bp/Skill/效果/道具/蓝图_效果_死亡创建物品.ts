/**
 * 蓝图_效果_死亡创建物品 — when its card dies (效果.时机.死亡前), create 参数[2] items in the card's cell: a random key of
 * the skill's 条件.解锁材料 (e.g. 生成空瓶 → 空瓶), or a random item of 筛选物品生成 when that map is empty.
 * Demo: CatapultHero/BP/Skill/效果/道具/蓝图_效果_死亡创建物品 (dump/blueprints-pseudo/…/效果/道具/蓝图_效果_死亡创建物品.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.结束层时, 创建时, 死亡前. Rows: 生成空瓶, 生成空附魔石, 绷带B,
 * 死亡创建侧栏物品. Batch: core-inventory.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { Array_Random, MakeRandomStream } from '../../../../../core/rng/ue.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_死亡创建物品 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/道具/蓝图_效果_死亡创建物品';
  词条名 = '元素伤害%';
  计数 = 0;
  来自牌: BP_Actor_Card | null = null;
  词条修正存档 = new Map<string, number>();

  // L1246
  override 激活后触发(_Debug: string): void {
    const owner = this.来自技能?.拥有者;
    if (owner instanceof BP_Actor_Card) this.来自牌 = owner;
  }

  // L1363
  override 销毁前触发(): void {}

  // L1364
  override 持续中触发(触发时机: string): void {
    if (触发时机 !== '效果.时机.死亡前') return;
    const w = this.world;
    const skill = this.来自技能;
    if (!skill || w.mode.当前死亡角色 !== skill.拥有者) return;
    const owner = skill.拥有者!;
    const stream = MakeRandomStream(w.mode.本轮种子 + w.mode.当前总层数);
    const 品质 = owner.HasMatchingGameplayTag('可交互.修炼牌') ? owner.品质 : skill.等级;
    const { 筛选后物品 } = w.cult.筛选物品生成(skill.目标或_且, skill.目标标签, skill.排斥标签, 品质, 99, stream, true, false, 'None');
    const keys = Object.keys(skill.条件.解锁材料);
    const card = this.来自牌;
    // L865 → L15, 参数[2] times
    for (let i = 0; i <= FTrunc(函数库_技能.获取技能参数(this, skill, 2, false, '').参数值) - 1; i++) {
      const pool = keys.length === 0 ? 筛选后物品 : keys;
      const pick = pool[Array_Random(w.rng.meta, pool)] ?? 'None';
      const cell = card?.所在格子组?.格子实例数组[card.所在起始格序号] ?? null;
      // SPEC-GAP: 获取轮次 is the save's 轮回次数 (EMS_基础存档); the dying card's 获取轮次 stands in (same run).
      w.cult.创建牌到侧栏(pick, 品质, cell, card?.附魔存档 ?? [], card?.获取轮次 ?? -1, card?.词条 ?? new Map());
    }
    // L1091
    this.计数 = FTrunc(函数库_技能.获取技能参数(this, skill, 0, false, '').参数值);
  }
}

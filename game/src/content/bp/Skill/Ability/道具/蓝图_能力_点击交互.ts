/**
 * 蓝图_能力_点击交互 — the base of clickable props (chests, altars, crates, ore): 被选中 blocks interaction for 吟唱 seconds
 * (蓝图_效果_玩家不可交互 on the hero), 检查子条件 checks reach (distance ≤ 7 × owner 高度 + target 高度, or 技能距离 −1),
 * 执行技能 runs the subclass's 子触发 and 释放结束.
 * Demo: CatapultHero/BP/Skill/Ability/道具/蓝图_能力_点击交互 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/道具/蓝图_能力_点击交互.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: none.
 * Batch: core-rewards.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import type { 词条映射 } from '../../../../../core/math/stats.ts';
import { Array_AddUnique } from '../../../../../core/sim/engine.ts';
import type { AssetPath } from '../../../../demo/types.ts';

const 玩家不可交互 = 'CatapultHero/BP/Skill/效果/蓝图_效果_玩家不可交互';
const CARD_CLASSES = ['CatapultHero/BP/Actor/BP_Actor_Card', 'CatapultHero/BP/Actor/BP_Actor_Equip'];

export class 蓝图_能力_点击交互 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_点击交互';
  生成数量: number = 0;
  词条修正: 词条映射 = new Map();
  指定名组: string[] = [];

  /** The subclass hook (empty in the base). */
  子触发(): void {}

  // Interface events (接口_工具) the base answers with nothing (L3440–L3515); subclasses override some.
  盒子关闭后(): void {}
  刷新盒子(): void {}

  // L3520
  override 执行技能(_是读档: boolean): void {
    this.子触发();
    this.释放结束(false);
  }

  // L3550
  override 被选中(): void {
    const w = this.world;
    const hero = w.mode.玩家角色;
    const cfg = make效果配置({ 效果类: 玩家不可交互, 持续时间: this.吟唱, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: true, 检查效果名: false, 叠加上限: 1 });
    const { 效果名字 } = 函数库_技能.获取效果名(this, this, cfg.效果类);
    if (!w.isValid(hero) || hero.死掉了) return; // L10
    const pre = 函数库_工具.附加效果前处理(this, cfg, hero, 效果名字);
    if (pre.不需附加新效果) return; // L79
    const e = w.spawn<NonNullable<typeof pre.效果实例>>(玩家不可交互, x => { // L438
      x.拥有者 = hero; x.释放者 = this.拥有者; x.来自技能 = this;
      x.持续时长 = cfg.持续时间; x.触发间隔 = cfg.触发间隔; x.持续回合 = cfg.持续回合; x.叠加层数 = cfg.叠加层数; x.临时 = false;
    });
    e.效果名字 = 效果名字;
    // QUIRK (L2761): the card check reads the prop's class (self.拥有者), not the hero's.
    if (CARD_CLASSES.includes(this.拥有者?.def.path ?? '')) {
      e.OwnedGameplayTags.add('效果.时机.装上');
      e.OwnedGameplayTags.add('效果.时机.卸下');
    } else if (this.是天赋) {
      e.OwnedGameplayTags.add('能力.类型.天赋'); // L3157
    }
    Array_AddUnique(hero.拥有的效果, e);
    e.K2_AttachToActor(hero);
    e.激活效果('');
  }

  // L3979
  override 检查子条件(): void {
    const owner = this.拥有者;
    函数库_工具.选择角色作为目标(this, owner);
    函数库_工具.更新目标和自身运动数据(this, owner);
    const reach = (owner?.高度 ?? 0) * 7 + (owner?.当前目标?.高度 ?? 0);
    this.子条件通过 = (owner?.与目标距离 ?? 0) <= reach || this.技能距离 === -1;
    if (!this.子条件通过) this.fx.headUp(this, { ns: 'literal', key: '太远了，我需要靠近一点。' }); // L3312
  }
}

/**
 * 蓝图_效果_交互物被动 — the passive of interactable props (chests, crates, ore): when the prop is bounced into (反弹时) by
 * the hero or a hostile actor it plays 蓝图_效果_可控反弹动画 (1 s) on the prop with the hit normal flipped; on 死亡前 it stops
 * its particles.
 * Demo: CatapultHero/BP/Skill/效果/道具/蓝图_效果_交互物被动 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/道具/蓝图_效果_交互物被动.txt)
 * Parent: 蓝图_效果. CDO tags: see classes.ts.
 * Batch: core-rewards.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { Array_AddUnique } from '../../../../../core/sim/engine.ts';
import type { Tag } from '../../../../../core/sim/types.ts';
import type { AssetPath } from '../../../../demo/types.ts';

const 可控反弹动画 = 'CatapultHero/BP/Skill/效果/蓝图_效果_可控反弹动画';
const CARD_CLASSES = ['CatapultHero/BP/Actor/BP_Actor_Card', 'CatapultHero/BP/Actor/BP_Actor_Equip'];

export class 蓝图_效果_交互物被动 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/道具/蓝图_效果_交互物被动';
  词条名: string = '基础伤害';
  增加值: number = 0;

  // L4747
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 === '效果.时机.反弹时') this.反弹动画();
    else if (触发时机 === '效果.时机.死亡前') this.销毁前触发(); // L4706
  }

  // L10
  private 反弹动画(): void {
    const w = this.world;
    const other = this.命中数据.actor;
    const bouncer = other !== null && w.isValid(other) && other.OwnedGameplayTags.hasAny(['可交互.角色.玩家', '可交互.角色.AI.仇恨']);
    if (!bouncer) return; // L455
    const owner = this.拥有者;
    const cfg = make效果配置({ 效果类: 可控反弹动画, 持续时间: 1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: true, 检查效果名: false, 叠加上限: 1 });
    const { 效果名字 } = 函数库_技能.获取效果名(this, this.来自技能, cfg.效果类);
    if (!owner || !w.isValid(owner) || owner.死掉了) return;
    const pre = 函数库_工具.附加效果前处理(this, cfg, owner, 效果名字); // L884
    let e = pre.效果实例;
    if (!pre.不需附加新效果) { // L1884
      const spawned = w.spawn<蓝图_效果>(可控反弹动画, x => {
        x.拥有者 = owner; x.释放者 = owner; x.来自技能 = this.来自技能;
        x.持续时长 = cfg.持续时间; x.触发间隔 = cfg.触发间隔; x.持续回合 = cfg.持续回合; x.叠加层数 = cfg.叠加层数; x.临时 = false;
      });
      spawned.效果名字 = 效果名字;
      if (CARD_CLASSES.includes(owner.def.path)) {
        spawned.OwnedGameplayTags.add('效果.时机.装上');
        spawned.OwnedGameplayTags.add('效果.时机.卸下');
      } else if (this.来自技能 && w.isValid(this.来自技能) && this.来自技能.是天赋) {
        spawned.OwnedGameplayTags.add('能力.类型.天赋'); // L4359
      }
      Array_AddUnique(owner.拥有的效果, spawned);
      spawned.K2_AttachToActor(owner);
      e = spawned;
    }
    if (!e) return;
    // L1216: the same hit with the impact normal negated.
    const n = this.命中数据.impactNormal;
    e.命中数据 = { ...this.命中数据, impactNormal: { x: -n.x, y: -n.y, z: -n.z } };
    e.激活效果('');
  }

  // L4596: the particle spawn range follows the owner's 高度 (presentation).
  override 激活后触发(_Debug: string): void {}

  // L4706: Niagara.Deactivate (presentation).
  override 销毁前触发(): void {}
}

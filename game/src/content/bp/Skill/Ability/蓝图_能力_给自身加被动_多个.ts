/**
 * 蓝图_能力_给自身加被动_多个: the generic passive for every 效果配置 entry (8 rows of 天赋_专属, ability-framework
 * ABILIT-069); the 创建时 gate applies per effect.
 * Demo: CatapultHero/BP/Skill/Ability/蓝图_能力_给自身加被动_多个 (dump/blueprints-pseudo/…/Skill/Ability/蓝图_能力_给自身加被动_多个.txt).
 * Parent: 蓝图_能力. CDO tags: none. Batch: core-ability.
 */
import { 蓝图_能力 } from '../../../../core/ability/ability.ts';
import type { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../core/bp/index.ts';
import type { 效果配置 } from '../../../../core/bp/structs.ts';
import type { BP_ManeActor } from '../../../../core/sim/actor.ts';

export class 蓝图_能力_给自身加被动_多个 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/蓝图_能力_给自身加被动_多个';
  添加的实例: 蓝图_效果 | null = null;

  // L2869 → L2818 → L2663: the loop re-reads 效果配置's length; L2806 释放结束 after the loop.
  override 执行技能(_是读档: boolean): void {
    for (let i = 0; i < this.效果配置.length; i++) {
      // L2421
      const cfg = this.效果配置[i]!;
      const name = 函数库_技能.获取效果名(this, this, cfg.效果类).效果名字;
      const owner = this.拥有者;
      if (!owner || !this.world.isValid(owner)) continue;
      // L15: a dead owner skips this entry.
      if (owner.死掉了) continue;
      const merge = 函数库_工具.附加效果前处理(this, cfg, owner, name);
      if (merge.不需附加新效果) {
        merge.效果实例?.激活效果('');
        continue;
      }
      // L315
      const e = spawnPassiveEffect(this, cfg, owner, name);
      if (!e) continue; // L2204 "效果生成失败"
      this.添加的实例 = e;
      if (e.HasMatchingGameplayTag('效果.时机.创建时')) this.添加的实例.激活效果(this.能力名);
    }
    this.释放结束(false);
  }

  // L2874
  override 被选中(): void {
    函数库_工具.选择角色作为目标(this, this.拥有者);
  }

  // L2921 / L2922: empty overrides.
  override 检查子条件(): void {}
  override 子初始化(): void {}
}

/** The generic spawn (ABILIT-039, 040), written inline in the blueprint (L1045…L2441 / L315…L1731). */
const EQUIP = 'CatapultHero/BP/Actor/BP_Actor_Equip';
const CARD = 'CatapultHero/BP/Actor/BP_Actor_Card';

/** Deferred spawn of cfg.效果类 on `owner` with the four struct fields, its name and the tag additions; null on failure. */
function spawnPassiveEffect(self: 蓝图_能力, cfg: 效果配置, owner: BP_ManeActor, name: string): 蓝图_效果 | null {
  if (!cfg.效果类) return null;
  const e = self.world.spawn<蓝图_效果>(cfg.效果类, x => {
    x.拥有者 = owner;
    x.释放者 = owner;
    x.来自技能 = self;
    x.持续时长 = cfg.持续时间;
    x.触发间隔 = cfg.触发间隔;
    x.持续回合 = cfg.持续回合;
    x.叠加层数 = cfg.叠加层数;
    x.临时 = false;
  });
  if (!self.world.isValid(e)) return null;
  e.效果名字 = name;
  // ABILIT-040: the caster's exact class decides (装上 / 卸下 for item cards), else a talent's effect gets 能力.类型.天赋.
  const cls = owner.def.path;
  if ((cls === EQUIP || cls === CARD) && !e.临时) {
    e.OwnedGameplayTags.add('效果.时机.装上');
    e.OwnedGameplayTags.add('效果.时机.卸下');
  } else if (self.world.isValid(self) && self.是天赋) {
    e.OwnedGameplayTags.add('能力.类型.天赋');
  }
  // L2441 / L1731
  if (!owner.拥有的效果.includes(e)) owner.拥有的效果.push(e);
  e.K2_AttachToActor(owner);
  return e;
}

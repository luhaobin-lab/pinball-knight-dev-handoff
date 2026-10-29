/**
 * 蓝图_能力_弹射: the enemy launch (眼球弹射, 大肠弹射, 肉弹战车; ENEMY--053). 被选中 picks a random free spot among 5
 * around the owner as 目标位置 and shows the fixed-direction arrow; 执行技能 hides it and applies 效果配置[0] (蓝图_效果_弹射 or
 * 蓝图_效果_肉弹战车) then 效果配置[1] (蓝图_效果_反弹时攻击) to the owner; 检查子条件 = not moving.
 * Demo: CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_弹射 (dump/blueprints-pseudo/…/Ability/敌人/蓝图_能力_弹射.txt).
 * Parent: 蓝图_能力. Batch: core-ai.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置, type 效果配置 } from '../../../../../core/bp/structs.ts';
import { Array_Random } from '../../../../../core/rng/ue.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
import type { 结构_地形选取配置 } from '../../../../../content/demo/types.ts';

const NO_TERRAIN: 结构_地形选取配置 = { 选取方式: '选取范围地形格（矩形）', 避开角色: false, 起点: [], 起始范围: 0, 结束范围: 0, '开启预览框?': false, 格子类: { 效果类: null, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, '唯一？': false, '检查效果名？': false, 叠加上限: 1 } };

export class 蓝图_能力_弹射 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_弹射';

  // L4342
  override 执行技能(_是读档: boolean): void {
    const owner = this.拥有者;
    owner?.切换指示箭头(false, '固定方向', 60.0, [], [], NO_TERRAIN, null);
    const cfg0 = this.效果配置[0] ?? make效果配置();
    const name0 = 函数库_技能.获取效果名(this, this, cfg0.效果类).效果名字;
    if (!owner || !this.world.isValid(owner)) return;
    if (owner.死掉了) return; // L10
    if (!this.apply(owner, cfg0, name0)) return; // L57…L1609
    const cfg1 = this.效果配置[1] ?? make效果配置(); // Array_Get out of range: the struct default (效果类 None)
    const name1 = 函数库_技能.获取效果名(this, this, cfg1.效果类).效果名字;
    if (!this.world.isValid(owner)) return;
    if (owner.死掉了) return;
    this.apply(owner, cfg1, name1); // L2302…L3854
  }

  // L4665 (ENEMY--053/054): 5 candidate spots 高度 + 10 uu away; QUIRK: none free → Array_Random gives the zero vector.
  override 被选中(): void {
    const owner = this.拥有者;
    if (!owner) return;
    const { 查询到的位置 } = 函数库_技能.获取目标范围空地(this, owner.高度, 10.0, 5, owner, false, false, 0);
    owner.当前目标 = null;
    const i = Array_Random(this.world.rng.combat, 查询到的位置);
    owner.目标位置 = i < 0 ? { x: 0, y: 0, z: 0 } : { ...查询到的位置[i] };
    owner.切换指示箭头(true, '固定方向', 60.0, [], [], NO_TERRAIN, null);
  }

  // L5079
  override 检查子条件(): void {
    this.子条件通过 = !this.拥有者?.移动中;
  }

  /**
   * The inlined "attach 效果配置[i] to the owner" sequence (L57/L213/L1609): 附加效果前处理 (an existing instance ends the
   * skill: goto L5149), deferred spawn with 拥有者 / 释放者 / 来自技能 and the struct's timing, the equip/talent tags, AddUnique
   * to 拥有的效果, attach, 激活效果. False when the sequence ended the skill.
   */
  private apply(owner: BP_ManeActor, cfg: 效果配置, name: string): boolean {
    const pre = 函数库_工具.附加效果前处理(this, cfg, owner, name);
    if (pre.不需附加新效果) return false;
    if (!cfg.效果类) return false; // 效果生成失败 (L2081)
    const eff = this.world.spawn<蓝图_效果>(cfg.效果类, e => {
      e.拥有者 = owner; e.释放者 = owner; e.来自技能 = this;
      e.持续时长 = cfg.持续时间; e.触发间隔 = cfg.触发间隔; e.持续回合 = cfg.持续回合; e.叠加层数 = cfg.叠加层数; e.临时 = false;
    }, owner.K2_GetActorLocation()); // spawned at the origin, then attached KeepRelative: it sits on the owner
    if (!this.world.isValid(eff)) return false;
    eff.效果名字 = name;
    const cls = owner.def.name;
    if ((cls === 'BP_Actor_Equip' || cls === 'BP_Actor_Card') && !eff.临时) {
      eff.OwnedGameplayTags.add('效果.时机.装上');
      eff.OwnedGameplayTags.add('效果.时机.卸下');
    } else if (this.是天赋) {
      eff.OwnedGameplayTags.add('能力.类型.天赋'); // L2166
    }
    if (!owner.拥有的效果.includes(eff)) owner.拥有的效果.push(eff);
    eff.K2_AttachToActor(owner);
    eff.激活效果('');
    return true;
  }
}

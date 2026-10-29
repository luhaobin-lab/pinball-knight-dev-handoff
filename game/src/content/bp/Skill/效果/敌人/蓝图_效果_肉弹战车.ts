/**
 * 蓝图_效果_肉弹战车: the charging launch (肉弹战车 of 眼球包 / 守门人 …; ENEMY--056). 发动肉弹: 状态.不可阻挡, an impulse of
 * 1000 × 冲击力 along 目标方向, the unique 蓝图_效果_碰撞伤害; 0.5 s later a gate opens and the effect ends when the owner
 * stops (< 5 uu/s) or dies: 退出攻击状态, the collision damage destroyed, motion and facing updated, 不可阻挡 removed,
 * 释放结束, 结束行动. On 效果.时机.创建时 the owner attacks (发动攻击).
 * Demo: CatapultHero/BP/Skill/效果/敌人/蓝图_效果_肉弹战车 (dump/blueprints-pseudo/…/效果/敌人/蓝图_效果_肉弹战车.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.创建时. Batch: core-ai.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { makeHitResult, make效果配置 } from '../../../../../core/bp/structs.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../../core/sim/types.ts';

const TRAIL: AssetPath = 'CatapultHero/粒子/粒子_轨迹';
const COLLISION_DAMAGE: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_碰撞伤害';

/** Vector_Normal2D(v, 0.0001). */
function normal2D(v: Vec3): Vec3 {
  const sq = v.x * v.x + v.y * v.y;
  if (sq === 1) return { x: v.x, y: v.y, z: 0 };
  if (sq < 0.0001) return { x: 0, y: 0, z: 0 };
  const k = 1 / Math.sqrt(sq);
  return { x: v.x * k, y: v.y * k, z: 0 };
}

export class 蓝图_效果_肉弹战车 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_肉弹战车';
  范围内死掉数 = 0;
  死掉的角色: (BP_ManeActor | null)[] = [];
  效果实例: 蓝图_效果 | null = null;
  /** UG Gate (start closed): opened by 检测停止 0.5 s after activation. */
  ug_gateOpen = false;
  /** UG DoOnce of the dead-owner path (L1045). */
  ug_deadOnce = false;

  // L4221
  override 激活后触发(_Debug: string): void {
    this.发动肉弹();
    const owner = this.拥有者;
    if (!owner) return;
    owner.移动中 = true;
    this.fx.vfx(TRAIL, owner, { attach: true, scale: owner.高度 - 10.0 });
    this.setTickEnabled(true);
    this.delay('L4221', 0.5, () => this.检测停止());
  }

  /** L5679 → L958: open the gate. */
  检测停止(): void {
    this.ug_gateOpen = true;
  }

  /** L5685 → L4934 */
  发动肉弹(): void {
    const owner = this.拥有者;
    const skill = this.来自技能;
    if (!owner) return;
    owner.OwnedGameplayTags.add('状态.不可阻挡');
    const d = normal2D(owner.目标方向);
    const k = 1000 * (skill?.冲击力 ?? 0);
    函数库_技能.根据体重添加冲击(this, owner, { x: d.x * k, y: d.y * k, z: d.z * k });
    const cfg = make效果配置({ 效果类: COLLISION_DAMAGE, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: true, 检查效果名: false, 叠加上限: 1 });
    const name = 函数库_技能.获取效果名(this, skill, cfg.效果类).效果名字;
    if (!this.world.isValid(owner)) return; // L4890
    if (owner.死掉了) return; // L1055
    if (函数库_工具.附加效果前处理(this, cfg, owner, name).不需附加新效果) return; // QUIRK: an existing instance is not re-activated
    const eff = this.world.spawn<蓝图_效果>(COLLISION_DAMAGE, e => { // L1431
      e.拥有者 = owner; e.释放者 = owner; e.来自技能 = skill;
      e.持续时长 = cfg.持续时间; e.触发间隔 = cfg.触发间隔; e.持续回合 = cfg.持续回合; e.叠加层数 = cfg.叠加层数; e.临时 = false;
    }, owner.K2_GetActorLocation());
    if (!this.world.isValid(eff)) return; // L4140 效果生成失败
    eff.效果名字 = name;
    const cls = owner.def.name;
    if ((cls === 'BP_Actor_Equip' || cls === 'BP_Actor_Card') && !eff.临时) {
      eff.OwnedGameplayTags.add('效果.时机.装上');
      eff.OwnedGameplayTags.add('效果.时机.卸下');
    } else if (this.world.isValid(skill) && skill.是天赋) { // L3988
      eff.OwnedGameplayTags.add('能力.类型.天赋');
    }
    if (!owner.拥有的效果.includes(eff)) owner.拥有的效果.push(eff); // L3740
    eff.K2_AttachToActor(owner);
    this.效果实例 = eff;
    this.效果实例.激活效果(''); // L301
  }

  // L4757 → L30
  override 销毁前触发(): void {
    const owner = this.拥有者;
    if (!owner) return;
    owner.退出攻击状态();
    this.效果实例?.销毁效果();
    owner.更新运动数据();
    owner.更新朝向();
    owner.OwnedGameplayTags.remove('状态.不可阻挡');
    this.来自技能?.释放结束(false);
    owner.结束行动(null, '');
  }

  // L4798 (效果.时机.创建时)
  override 持续中触发(_触发时机: Tag): void {
    const owner = this.拥有者;
    if (!owner) return;
    owner.发动攻击(this.来自技能, makeHitResult(), false);
    owner.更新朝向();
  }

  // L5619
  override ReceiveTick(DeltaSeconds: number): void {
    super.ReceiveTick(DeltaSeconds);
    const owner = this.拥有者;
    if (!owner) return;
    if (owner.死掉了) { // L1045 DoOnce
      if (this.ug_deadOnce) return;
      this.ug_deadOnce = true;
      this.销毁效果();
      return;
    }
    if (!this.ug_gateOpen) return; // L948 → L376
    if (owner.当前物理速度 < 5.0 || owner.死掉了) {
      this.销毁效果();
      this.ug_gateOpen = false; // L352
    }
    // L555: the re-launch branch of 蓝图_效果_弹射 is empty here (checks only).
  }

  /** ReceiveDestroyed (L5684): nothing. */
  ReceiveDestroyed(): void {}
}

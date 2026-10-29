/**
 * 蓝图_效果_弹射: an enemy's physics launch (ENEMY--055). On activation an impulse of 1500 × 冲击力 toward 目标位置 (through
 * the physics module), 移动中 on, an optional trail; 0.2 s later a gate opens and every tick: below 1000 uu/s an unstoppable,
 * living, untired owner is re-launched along its last bounce direction (1000 × 冲击力); otherwise below 5 uu/s the effect
 * ends: 不可阻挡 removed, motion data and facing updated, 释放结束, 结束行动.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_弹射 (dump/blueprints-pseudo/…/效果/蓝图_效果_弹射.txt). Parent: 蓝图_效果.
 * CDO tags (manifest): 效果.时机.新一天时. Batch: core-ai.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../core/bp/index.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../core/sim/types.ts';

const TRAIL: AssetPath = 'CatapultHero/粒子/粒子_轨迹';

/** Vector_Normal2D(v, 0.0001): (x, y, 0) normalised, zero below the tolerance. */
function normal2D(v: Vec3): Vec3 {
  const sq = v.x * v.x + v.y * v.y;
  if (sq === 1) return { x: v.x, y: v.y, z: 0 };
  if (sq < 0.0001) return { x: 0, y: 0, z: 0 };
  const k = 1 / Math.sqrt(sq);
  return { x: v.x * k, y: v.y * k, z: 0 };
}

export class 蓝图_效果_弹射 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_弹射';
  计算初始速 = true;
  已完结 = false;
  /** The trail particle component (轨迹), active or not. */
  轨迹 = false;
  /** UG Gate (start closed): opened by 检测停止 0.2 s after activation, closed when the effect ends. */
  ug_gateOpen = false;

  private strength(): number {
    return this.world.isValid(this.来自技能) ? this.来自技能.冲击力 : 100;
  }

  // L469
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者;
    if (!owner) return;
    owner.当前碰撞位置 = { ...owner.当前位置 };
    owner.更新朝向();
    const d = normal2D({ x: owner.目标位置.x - owner.当前位置.x, y: owner.目标位置.y - owner.当前位置.y, z: owner.目标位置.z - owner.当前位置.z });
    const k = 1500.0 * this.strength();
    函数库_技能.根据体重添加冲击(this, owner, { x: d.x * k, y: d.y * k, z: d.z * k });
    owner.移动中 = true;
    if (函数库_技能.获取技能参数(this, this.来自技能, 1, false, '').参数值 === 1.0) {
      this.fx.vfx(TRAIL, owner, { attach: true, scale: owner.高度 - 10.0 }); // 轨迹宽度 = 高度 − 10
      this.轨迹 = true;
    }
    this.setTickEnabled(true);
    this.delay('L1694', 0.2, () => this.检测停止());
  }

  /** L2891 → L354: open the gate. */
  检测停止(): void {
    this.ug_gateOpen = true;
  }

  // L1749
  override 销毁前触发(): void {
    this.已完结 = true;
    const owner = this.拥有者;
    owner?.OwnedGameplayTags.remove('状态.不可阻挡');
    this.轨迹 = false; // L306 → L193: Deactivate (presentation: the shell ends the attached trail with the effect)
    if (!owner) return;
    owner.更新运动数据(); // L229
    owner.更新朝向();
    if (this.world.isValid(this.来自技能)) this.来自技能.释放结束(false); // L115 → L30
    owner.结束行动(null, ''); // L67
  }

  // L1843
  override 持续中触发(_触发时机: Tag): void {}

  // L1859
  override ReceiveTick(DeltaSeconds: number): void {
    super.ReceiveTick(DeltaSeconds);
    const owner = this.拥有者;
    if (!this.ug_gateOpen || !owner) return; // L1888
    if (!(owner.当前物理速度 < 1000.0)) return;
    if (owner.HasMatchingGameplayTag('状态.不可阻挡') && !owner.死掉了 && owner.疲劳 < owner.最大疲劳) {
      const last = owner.反弹角度历史[owner.反弹角度历史.length - 1] ?? { x: 0, y: 0, z: 0 };
      const k = 1000.0 * this.strength();
      函数库_技能.根据体重添加冲击(this, owner, { x: last.x * k, y: last.y * k, z: last.z * k });
      return;
    }
    if (!(owner.当前物理速度 < 5.0)) return; // L2816
    this.销毁效果(); // L1844
    this.ug_gateOpen = false; // L447
  }

  /** ReceiveDestroyed (L2896): destroyed without 销毁效果 still finishes the launch. */
  ReceiveDestroyed(): void {
    if (!this.已完结) this.销毁前触发();
  }
}

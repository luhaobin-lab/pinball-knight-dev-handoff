/** 飞跃重击.txt L2795/L1783/L15: height300/speed1500; P1 radius, impulse50000 and P0×stat physical hit. */
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Player } from '../../../../../core/sim/player.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { AssetPath, HitResult, Vec3 } from '../../../../../core/sim/types.ts';
import type { World } from '../../../../../core/sim/world.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { 蓝图_效果_跳向目标位置 } from '../蓝图_效果_跳向目标位置.ts';

export class 蓝图_效果_飞跃重击 extends 蓝图_效果_跳向目标位置 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_飞跃重击';
  球体半径 = 0;
  override 激活后触发(_debug: string): void {
    this.高度 = 300; this.移动速度 = 1500; this.高度曲线 = '飞跃重击';
    this.球体半径 = Math.fround((this.来自技能?.拥有者?.高度 ?? 0) * 1.4);
    const owner = this.拥有者;
    if (owner) {
      const at = owner.K2_GetActorLocation();
      (this.world.sys.physics as { moveEffectOverlaps(w: World, actor: BP_ManeActor, from: Vec3, to: Vec3): void }).moveEffectOverlaps(this.world, owner, at, at);
    }
    super.激活后触发('');
  }
  override 开始跳跃(): void {}
  override 结束跳跃(): void {
    const skill = this.来自技能, owner = skill?.拥有者; if (!skill || !owner) return;
    const at = owner.目标位置;
    this.fx.shake('摄像机晃动_零点六', at);
    this.fx.vfx('CatapultHero/粒子/粒子_Hit_冲击波', at, { scale: 5 });
    const radius = 函数库_技能.获取技能参数(this, skill, 1, false, '').参数值;
    this.fx.ui({ op: 'update', widget: '冲击波尺寸', data: { effect: this.id, size: Math.fround(radius * 2) } });
    this.fx.vfx('CatapultHero/粒子/粒子_Hit_Dust_03', at); this.fx.sound('音效_肉弹战车', at);
    const hits = 函数库_工具.以目标为中心释放冲击(this, null, Math.fround(radius), 50000, false, 2, [owner], true, at);
    for (let i = 0; i < hits.命中数据.length; i++) {
      const p = 函数库_技能.获取技能参数(this, skill, 0, false, '');
      const amount = 科学数乘除(获取科学映射词条(owner.词条, p.词条).输出值, sciOf(p.参数值), false);
      const hit = hits.命中数据[i]!;
      owner.造成即时伤害(make伤害({ 伤害来源: '主动', 伤害类型: '物理', 不变速: false, 是暴击: false, 是弱点: false, 伤害数值: amount, 所需回合: 3, 触发次数: 1, 击中点位置: hit.impactPoint, 击中点法线: hit.impactNormal, 来自技能: skill, 来自角色: owner, 目标角色: hits.命中角色[i] ?? null }), false, false);
    }
    skill.释放结束(false);
  }
  BndEvt__蓝图_效果_飞跃重击_Sphere_K2Node_ComponentBoundEvent_0_ComponentBeginOverlapSignature__DelegateSignature(_a: unknown, other: BpObject | null, _c: unknown, _i: number, _s: boolean, _hit: HitResult): void {
    if (!(other instanceof BP_Actor_Player)) return;
    other.开启碰撞();
    const d = this.来自技能?.拥有者?.速度方向 ?? { x: 0, y: 0, z: 0 };
    函数库_技能.根据体重添加冲击(this, other, { x: d.x * 10000, y: d.y * 10000, z: d.z * 10000 });
  }
}

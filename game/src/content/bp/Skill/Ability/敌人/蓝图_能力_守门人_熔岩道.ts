/** 熔岩道.txt L5562/L6213/L104: source row squares along the predicted target, 3-wide then 5-wide in phase 2. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import type { AssetPath } from '../../../../demo/types.ts';
import type { 蓝图_效果_地形管理组 } from '../../效果/物品/蓝图_效果_地形管理组.ts';
import { attachSourceEffect, terrainGroupConfig } from '../../../../../core/ability/apply.ts';

export class 蓝图_能力_守门人_熔岩道 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_守门人_熔岩道';
  执行效果(): void {}
  override 被选中(): void {
    const owner = this.拥有者; if (!owner) return;
    函数库_工具.选择角色作为目标(this, owner); owner.更新运动数据(); owner.更新朝向();
    const phase2 = owner.HasMatchingGameplayTag('状态.二阶段');
    const anim = this.技能动画[phase2 ? 1 : 0]; if (anim) this.playAnim(owner, anim, {});
    this.delay('L6213', phase2 ? 0.3 : 0.8, () => this.prepare());
  }
  private prepare(): void {
    const owner = this.拥有者, hero = this.游戏模式?.玩家角色; if (!owner || !hero) return;
    const points: { X: number; Y: number; Z: number }[] = [];
    this.地形选取 = { ...this.地形选取, 起点: points };
    const p = owner.K2_GetActorLocation(), q = hero.K2_GetActorLocation();
    const origin = { x: p.x - 64, y: p.y - 28, z: p.z };
    const dx = q.x - origin.x, dy = q.y - origin.y, dz = q.z - origin.z;
    const len = Math.hypot(dx, dy), nx = len * len > 1 ? dx / len : 0, ny = len * len > 1 ? dy / len : 0;
    for (let i = 0; i <= Math.trunc(Math.hypot(dx, dy, dz) / 192) + 1; i++) {
      const at = { X: origin.x + nx * (192 * i + 64), Y: origin.y + ny * (192 * i + 64), Z: origin.z };
      if (!points.some(v => v.X === at.X && v.Y === at.Y && v.Z === at.Z)) points.push(at);
    }
    const group = attachSourceEffect<蓝图_效果_地形管理组>(this, owner, this, terrainGroupConfig());
    if (!group) return;
    const radius = owner.HasMatchingGameplayTag('状态.二阶段') ? 2 : 1;
    group.自定义地形激活({ ...this.地形选取, 起始范围: radius, 结束范围: radius, '开启预览框?': true });
  }
  override 执行技能(_load: boolean): void {
    const group = this.地形管理组 as 蓝图_效果_地形管理组 | null;
    if (group?.valid) { group.销毁结束技能释放 = true; group.持续中触发('效果.时机.主动激活'); }
    this.释放结束(false);
  }
  override 释放结束(interrupted: boolean): void { super.释放结束(interrupted); this.拥有者?.结束行动(null, ''); }
}

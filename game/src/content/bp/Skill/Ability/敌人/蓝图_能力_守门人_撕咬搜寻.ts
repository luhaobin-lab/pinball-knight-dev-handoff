/** 撕咬搜寻.txt L3715/L95: lock the player's predicted location, then apply the source leap effect. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置, structOf } from '../../../../../core/bp/structs.ts';
import type { AssetPath } from '../../../../demo/types.ts';
import { attachSourceEffect } from '../../../../../core/ability/apply.ts';

export class 蓝图_能力_守门人_撕咬搜寻 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_守门人_撕咬搜寻';
  监视范围 = 320;
  执行效果(): void {}
  // Source 跳跃到目标点 is an unused InterpToMovement experiment; the reachable execution uses 飞跃重击 below.
  override 被选中(): void {
    const owner = this.拥有者; if (!owner) return;
    函数库_工具.选择角色作为目标(this, owner); owner.更新运动数据();
    const radius = 函数库_技能.获取技能参数(this, this, 1, false, '').参数值;
    owner.切换指示箭头(true, '指定位置（固定）', Math.fround(radius), [], [], structOf('结构_地形选取配置'), null);
  }
  override 执行技能(_load: boolean): void {
    const owner = this.拥有者; if (!owner) return;
    owner.切换指示箭头(false, '指定位置（固定）', Math.fround(this.技能距离), [], [], structOf('结构_地形选取配置'), null);
    const effect = attachSourceEffect(this, owner, this, make效果配置({ 效果类: 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_飞跃重击', 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: true }));
    effect?.激活效果('');
  }
  override 释放结束(interrupted: boolean): void { super.释放结束(interrupted); this.拥有者?.结束行动(null, ''); }
  override 检查子条件(): void { this.子条件通过 = this.拥有者?.HasMatchingGameplayTag('状态.二阶段') ?? false; }
}

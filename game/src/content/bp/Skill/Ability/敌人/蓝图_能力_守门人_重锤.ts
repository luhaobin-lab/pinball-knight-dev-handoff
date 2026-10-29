/** 守门人_重锤.txt L617/L963/L31; source prepares lava .8 s after selection, expires it next round. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { structOf } from '../../../../../core/bp/structs.ts';
import type { AssetPath } from '../../../../demo/types.ts';
import type { 蓝图_效果_地形管理组 } from '../../效果/物品/蓝图_效果_地形管理组.ts';

export class 蓝图_能力_守门人_重锤 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_守门人_重锤';
  执行效果(): void {}
  override 被选中(): void {
    const owner = this.拥有者; if (!owner) return;
    if (this.技能动画[0]) this.playAnim(owner, this.技能动画[0], {});
    this.delay('L963', 0.8, () => {
      this.fx.shake('摄像机晃动_零点六', owner.K2_GetActorLocation());
      const p = owner.K2_GetActorLocation();
      owner.切换指示箭头(true, '地形区域（固定）', 0, [], [], { ...this.地形选取, 起点: [{ X: p.x - 64, Y: p.y - 32, Z: p.z }] }, null);
    });
  }
  override 执行技能(_load: boolean): void {
    const owner = this.拥有者; if (!owner) return;
    owner.疲劳了 = false; owner.更新运动数据();
    const group = this.地形管理组 as 蓝图_效果_地形管理组 | null;
    if (group?.valid) { group.销毁结束技能释放 = true; group.持续中触发('效果.时机.主动激活'); }
    owner.切换指示箭头(false, '地形区域（固定）', 60, [], [], structOf('结构_地形选取配置'), null);
    this.释放结束(false);
  }
  override 释放结束(interrupted: boolean): void { super.释放结束(interrupted); this.拥有者?.结束行动(null, ''); }
  override 检查子条件(): void { this.子条件通过 = !this.拥有者?.HasMatchingGameplayTag('状态.二阶段'); }
}

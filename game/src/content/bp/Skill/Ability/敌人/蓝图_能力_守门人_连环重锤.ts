/** 连环重锤.txt L8624/L8153/L9084: 3 curve-driven dashes, each followed by .3 s slam and .3 s recovery. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { Array_Random, RandomFloatInRange, RandomIntegerInRange } from '../../../../../core/rng/ue.ts';
import type { AssetPath, 枚举_查找地形格方式 } from '../../../../demo/types.ts';
import type { 蓝图_效果_地形管理组 } from '../../效果/物品/蓝图_效果_地形管理组.ts';
import { attachSourceEffect, terrainGroupConfig } from '../../../../../core/ability/apply.ts';

export class 蓝图_能力_守门人_连环重锤 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_守门人_连环重锤';
  所有方式: 枚举_查找地形格方式[] = ['选取范围地形格（菱形环）'];
  效果实例: 蓝图_效果 | null = null;
  ug_remaining = 0;
  override 被选中(): void { this.pickTarget(400, 6); }
  private pickTarget(distance: number, count: number): void {
    const owner = this.拥有者; if (!owner) return;
    const points = 函数库_技能.获取目标范围空地(this, owner.高度, distance, count, owner, false, false, 0).查询到的位置;
    const i = Array_Random(this.world.rng.combat, points);
    owner.目标位置 = i < 0 ? { x: 0, y: 0, z: 0 } : { ...points[i]! };
  }
  override 执行技能(_load: boolean): void {
    const owner = this.拥有者; if (!owner) return;
    owner.OwnedGameplayTags.add('状态.免疫'); this.游戏模式?.玩家角色?.开启碰撞();
    this.效果实例 = attachSourceEffect(this, owner, this, make效果配置({ 效果类: 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_碰撞伤害', 持续时间: 2, 触发间隔: 1, 持续回合: 0, 叠加层数: 1, 唯一: true }));
    if (!this.效果实例) return;
    this.效果实例.激活效果(''); this.效果实例.激活效果(''); // source L7534 double activation
    this.冲刺砸地(3);
  }
  冲刺砸地(count: number): void {
    const owner = this.拥有者; if (!owner) return;
    if (count <= 0) {
      this.释放结束(false); owner.OwnedGameplayTags.remove('状态.免疫'); owner.结束行动(null, ''); return;
    }
    this.ug_remaining = count - 1;
    this.playAnim(owner, `CatapultHero/精灵片/AnimSequences/Actor_M03_Attack01`, {});
    owner.移到目标地点('可控反弹曲线', '卡牌高度位移曲线', 2000, 0);
    this.delay('L8894', Math.fround(owner.移动所需时长), () => {
      owner.当前位置 = { ...owner.目标位置 };
      if (this.技能动画[0]) this.playAnim(owner, this.技能动画[0], {});
      this.delay('L15', 0.3, () => {
        const group = attachSourceEffect<蓝图_效果_地形管理组>(this, owner, this, terrainGroupConfig());
        if (!group) return;
        const p = owner.K2_GetActorLocation();
        const shape = this.所有方式[Array_Random(this.world.rng.combat, this.所有方式)]!;
        const end = RandomIntegerInRange(this.world.rng.combat, 3, 5);
        group.自定义地形激活({ ...this.地形选取, 选取方式: shape, 起点: [{ X: p.x, Y: p.y, Z: p.z }], 起始范围: 0, 结束范围: end, '开启预览框?': true });
        this.pickTarget(RandomFloatInRange(this.world.rng.combat, 200, 400), 8);
        this.delay('L3087', 0.3, () => this.冲刺砸地(this.ug_remaining));
      });
    });
  }
  override 检查子条件(): void { this.子条件通过 = !this.拥有者?.HasMatchingGameplayTag('状态.二阶段'); }
}

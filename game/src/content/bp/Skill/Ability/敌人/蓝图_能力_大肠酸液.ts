/**
 * 蓝图_能力_大肠酸液: 大肠 sprays acid into a terrain area (enemies-intestine; ENEMY--049 indicator type 6). 被选中 picks one
 * point 96–224 uu from the owner and shows the terrain-area indicator with it as the start point; 执行技能 plays 技能动画[0]
 * and, 0.3 s later, fires the ability's 地形管理组 with 效果.时机.主动激活 (the pools), then ends the skill.
 * Demo: CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_大肠酸液 (dump/blueprints-pseudo/…/Ability/敌人/蓝图_能力_大肠酸液.txt).
 * Parent: 蓝图_能力. Batch: core-ai.
 * SPEC-GAP: the Demo creates 地形管理组 inside the indicator actor 技能指示 (创建地形格组, opened by 切换指示箭头 type 6), which
 * the generated facade treats as presentation; until it is ported the group is missing and the spray hits nothing.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import type { AssetPath, Vec3 } from '../../../../../core/sim/types.ts';
import type { 结构_地形选取配置 } from '../../../../../content/demo/types.ts';

const NO_TERRAIN: 结构_地形选取配置 = { 选取方式: '选取范围地形格（矩形）', 避开角色: false, 起点: [], 起始范围: 0, 结束范围: 0, '开启预览框?': false, 格子类: { 效果类: null, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, '唯一？': false, '检查效果名？': false, 叠加上限: 1 } };

export class 蓝图_能力_大肠酸液 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_大肠酸液';
  选取到的格子: Vec3[] = [];
  材质实例: unknown = null;
  角度抖动 = 45.0;
  查询到的位置: Vec3[] = [];
  位置对应角度: number[] = [];

  /** Declared by the blueprint, empty. */
  执行效果(): void {}

  // L208
  override 被选中(): void {
    const owner = this.拥有者;
    if (!owner) return;
    const { 选到的点 } = 函数库_工具.范围选取点(this, owner.当前位置, 96.0, 224.0, 64.0, 1, false, 16.0);
    const cfg: 结构_地形选取配置 = { ...this.地形选取, 起点: 选到的点.map(p => ({ X: p.x, Y: p.y, Z: p.z })) };
    owner.切换指示箭头(true, '地形区域（固定）', 0.0, [], [], cfg, null);
  }

  // L686
  override 子初始化(): void {}

  // L1281 → L1243 → L687
  override 执行技能(_是读档: boolean): void {
    const owner = this.拥有者;
    if (!owner) return;
    owner.疲劳了 = false;
    owner.切换指示箭头(false, '地形区域（固定）', 60.0, [], [], NO_TERRAIN, null);
    const anim = this.技能动画[0];
    if (anim) this.playAnim(owner, anim, {}); // OnCompleted / OnCancelled: L206 / L207, empty
    this.delay('L1188', 0.3, () => { // → L15
      owner.更新运动数据();
      const group = this.地形管理组;
      if (group && this.world.isValid(group)) {
        (group as unknown as { 销毁结束技能释放?: boolean }).销毁结束技能释放 = true;
        group.持续中触发('效果.时机.主动激活');
      }
      this.释放结束(false);
      owner.结束行动(null, '');
    });
  }
}

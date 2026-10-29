/** ENEMY--086, F-WALL L4934/L3561: every third round attach the source terrain group with a 5-cell square ring. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../../core/sim/types.ts';
import { attachEliteEffect } from './蓝图_效果_偏转力场.ts';

export class 蓝图_效果_筑墙 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_筑墙';
  创建的地形: (蓝图_效果 | null)[] = []; // source never fills this legacy cleanup array
  选取到的格子: Vec3[] = [];
  触发冷却 = 3;
  override 激活后触发(_Debug: string): void { this.销毁延迟 = 0.6; }
  override 持续中触发(tag: Tag): void {
    if (tag === '效果.时机.死亡前') {
      for (const e of this.创建的地形) 函数库_工具.销毁目标和子物体(this, e);
      this.fx.ui({ op: 'update', widget: '精英筑墙', data: { actor: this.拥有者?.id, active: false } });
      return;
    }
    if (tag !== '效果.时机.新一天时') return;
    this.触发冷却--;
    if (this.触发冷却 > 0) return;
    this.触发冷却 = 3;
    const owner = this.拥有者, skill = this.来自技能;
    if (!owner || !skill) return;
    函数库_工具.选择角色作为目标(this, owner); owner.更新运动数据();
    skill.地形选取 = { ...skill.地形选取, 起点: [{ X: owner.当前位置.x, Y: owner.当前位置.y, Z: owner.当前位置.z }] };
    attachEliteEffect(this, owner, make效果配置({ 效果类: 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_地形管理组', 持续时间: -1, 持续回合: -1, 唯一: true, 叠加上限: 1 }));
  }
}

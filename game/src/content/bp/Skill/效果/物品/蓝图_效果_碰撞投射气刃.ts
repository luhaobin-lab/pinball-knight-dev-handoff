/** Source L1855/L1365/L15: each charged collision combo emits six+truncated split sword-air projectiles at1500. */
import { 蓝图_效果_蓄能碰撞XX时XX } from '../蓝图_效果_蓄能碰撞XX时XX.ts';
import { 蓝图_发射物_剑气 } from '../../发射物/蓝图_发射物_剑气.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 科学数变普通, type 科学数 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_碰撞投射气刃 extends 蓝图_效果_蓄能碰撞XX时XX {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_碰撞投射气刃';
  触发次数_0 = 0;
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const s = this.来自技能, source = s?.拥有者, hero = this.world.mode.玩家角色; if (!s || !source || !hero) return;
    this.触发次数_0 = 触发次数; hero.更新运动数据(); source.创建发射物组(this.触发次数_0, false);
    const n = (Math.trunc(科学数变普通(获取科学映射词条(source.词条, '投射分裂').输出值)) + 6) | 0;
    const points = 函数库_技能.获取目标范围空地(this, 32, 0, n, hero, false, false, 0);
    for (let i = 0; i < points.查询到的位置.length; i++) {
      const at = points.查询到的位置[i], shot = this.world.spawn(蓝图_发射物_剑气, x => {
        x.来自角色 = source; x.来自技能 = s; x.速度 = 1500; x.ActorRotation.Yaw = Math.fround(points.位置对应角度[i] ?? 0);
      }, { x: at.x, y: at.y, z: 5 });
      shot.伤害数值 = 结算数值; shot.触发次数 = this.触发次数_0; source.创建发射物(shot, this.触发次数_0, false);
    }
  }
}

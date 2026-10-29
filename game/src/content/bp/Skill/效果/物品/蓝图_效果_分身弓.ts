/** Source L15: charged collision parent ->8+split radial arrows around hero, speed2500,z5, Bleed; preserve group/shot dispatch. */
import { 蓝图_效果_蓄能碰撞XX时XX } from '../蓝图_效果_蓄能碰撞XX时XX.ts';
import { 蓝图_发射物_箭矢 } from '../../发射物/蓝图_发射物_箭矢.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { sciOf, 科学数加减, 科学数变普通, type 科学数 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_分身弓 extends 蓝图_效果_蓄能碰撞XX时XX {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_分身弓';
  特效_0: unknown = null; 角度抖动_0 = 0; 连击计数_0_0 = 0; 连击定时器柄_0 = { Handle: 0 }; 触发次数_0 = 0;
  override 激活后触发(Debug: string): void { super.激活后触发(Debug); }
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const s = this.来自技能, from = s?.拥有者, hero = this.world.mode.玩家角色; if (!s || !from || !hero) return;
    this.触发次数_0 = 触发次数; from.创建发射物组(触发次数, false);
    const n = FTrunc(科学数变普通(科学数加减(获取科学映射词条(from.词条, '投射分裂').输出值, sciOf(8, 0), false)));
    const points = 函数库_技能.获取目标范围空地(this, 18, 0, n, hero, false, false, 0);
    for (let i = 0; i < points.查询到的位置.length; i++) {
      const at = points.查询到的位置[i]!;
      const shot = this.world.spawn(蓝图_发射物_箭矢, p => {
        p.来自角色 = from; p.来自技能 = s; p.速度 = 2500;
        p.ActorRotation = { Pitch: 0, Yaw: Math.fround(points.位置对应角度[i] ?? 0), Roll: 0 };
      }, { x: at.x, y: at.y, z: 5 });
      shot.伤害数值 = 结算数值; shot.触发次数 = this.触发次数_0; shot.伤害类型 = '流血';
      from.创建发射物(shot, this.触发次数_0, false);
    }
  }
}

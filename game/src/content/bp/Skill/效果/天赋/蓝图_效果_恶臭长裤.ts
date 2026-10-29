/** Source L15/L181/L660: parent mental-state lifecycle; every.1s sample128uu movement, two yaw draws around lifetime draw, real poison projectile. */
import { 蓝图_效果_精神状态 } from '../玩家/精神状态/蓝图_效果_精神状态.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import { 蓝图_发射物_毒气 } from '../../发射物/蓝图_发射物_毒气.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_恶臭长裤 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_恶臭长裤';
  生成计时 = 0; 伤害计时 = 0; 当前位置: Vec3 = { x: 0, y: 0, z: 0 }; 上次位置: Vec3 = { x: 0, y: 0, z: 0 };
  override 激活后触发(d: string): void { super.激活后触发(d); if (this.拥有者) this.上次位置 = this.拥有者.K2_GetActorLocation(); }
  override 持续中触发(t: Tag): void { if (t === '效果.时机.新战斗层时' && this.拥有者) this.上次位置 = this.拥有者.K2_GetActorLocation(); } // source deliberately omits parent floor handler
  override ReceiveTick(dt: number): void {
    super.ReceiveTick(dt); const o = this.拥有者, s = this.来自技能; if (!this.world.mode.场上有敌人 || !o || !s) return;
    this.生成计时 += Math.fround(dt); if (this.生成计时 < .1) return; this.生成计时 = 0;
    this.当前位置 = o.K2_GetActorLocation(); const r = 函数库_工具.寻找移动创建点(this, this.当前位置, this.上次位置, 128); if (!r.有存在) return;
    this.上次位置 = { ...this.当前位置 };
    const yaw = () => {
      const angle = Math.fround(RandomFloatInRange(this.world.rng.combat, -22.5, 22.5)) * Math.PI / 180, c = Math.cos(angle), sn = Math.sin(angle);
      const x = -r.方向.x * c + r.方向.y * sn, y = -r.方向.x * sn - r.方向.y * c;
      return x === 0 && y === 0 ? 0 : Math.atan2(y, x) * 180 / Math.PI;
    };
    for (const p of r.创建点) {
      yaw(); // BeginDeferred transform, overwritten by FinishSpawning transform; preserve its random draw.
      const life = RandomFloatInRange(this.world.rng.combat, .2, 1), finishYaw = yaw();
      const projectile = this.world.spawn(蓝图_发射物_毒气, x => { x.来自角色 = o; x.来自技能 = s; x.速度 = 500; x.持续时长 = life; x.触发间隔 = .4; x.ActorRotation = { Pitch: 0, Yaw: finishYaw, Roll: 0 }; }, p);
      projectile.伤害数值 = 科学数乘除(科学数乘除(获取科学映射词条(o.词条, '基础伤害').输出值, sciOf(this.叠加层数, 0), false), sciOf(函数库_技能.获取技能参数(this, s, 0, false, '').参数值, 0), false);
      o.创建发射物(projectile, 1, false);
    }
  }
}

/** Source L2159/L1542/L15: charged collision emits split+hero poison-base cloud count, each speed500 and independent source duration draw. */
import { 蓝图_效果_蓄能碰撞XX时XX } from '../蓝图_效果_蓄能碰撞XX时XX.ts';
import { 蓝图_发射物_毒气 } from '../../发射物/蓝图_发射物_毒气.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 科学数变普通,type 科学数 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_蛛后毒囊 extends 蓝图_效果_蓄能碰撞XX时XX {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_蛛后毒囊';充能计数=0;触发次数_0=0;
 override 额外子触发(value:科学数,count:number):void{const s=this.来自技能,c=s?.拥有者,h=this.world.mode.玩家角色;if(!s||!c||!h||!this.拥有者)return;this.触发次数_0=count;this.拥有者.更新运动数据();c.创建发射物组(count,false);
  const n=Math.trunc(科学数变普通(获取科学映射词条(c.词条,'投射分裂').输出值)+h.毒气基础数),pts=函数库_技能.获取目标范围空地(this,24,0,n,h,false,false,0);
  for(let i=0;i<pts.查询到的位置.length;i++){const at=pts.查询到的位置[i],p=this.world.spawn(蓝图_发射物_毒气,x=>{x.来自角色=c;x.来自技能=s;x.速度=500;x.持续时长=h.毒气距离*RandomFloatInRange(this.world.rng.combat,.75,1);x.ActorRotation.Yaw=Math.fround(pts.位置对应角度[i]??0);},{x:at.x,y:at.y,z:5});p.伤害数值=value;p.触发次数=this.触发次数_0;c.创建发射物(p,this.触发次数_0,false);}
 }
}

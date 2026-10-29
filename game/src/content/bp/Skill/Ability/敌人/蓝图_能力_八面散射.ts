/** 八面散射 source L2469 chooses SIX rays, despite the skill name. .2 windup, .3combo timer, direct base damage. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { 蓝图_发射物 } from '../../../../../core/ability/projectile.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { structOf } from '../../../../../core/bp/structs.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Rotator,Vec3 } from '../../../../../core/sim/types.ts';
export class 蓝图_能力_八面散射 extends 蓝图_能力 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_八面散射';
 无动画=false;连击计数=0;连击定时器柄='连击';查询到的位置:Vec3[]=[];位置对应角度:number[]=[];
 override 被选中():void{const q=函数库_技能.获取目标范围空地(this,24,0,6,this.拥有者,false,true,0);this.查询到的位置=q.查询到的位置;this.位置对应角度=q.位置对应角度;}
 override 检查子条件():void{this.子条件通过=true;}
 override 子初始化():void{}
 override 执行技能(_load:boolean):void{
  const owner=this.拥有者;if(!owner)return;owner.更新运动数据();owner.疲劳了=false;
  owner.切换指示箭头(false,'多向投射',60,[],[],structOf('结构_地形选取配置'),null);
  const start=()=>{this.无动画=false;this.强制释放=false;this.连击计数=科学数变普通(获取科学映射词条(owner.词条,'连击').输出值);this.setTimer('连击',.3,true,()=>this.连击触发(),-.3);};
  if(this.无动画)start();else{this.playAnim(owner,'CatapultHero/精灵片/AnimSequences/Actor_M13_Skill',{});this.delay('L2414',.2,start);}
 }
 连击触发():void{
  const owner=this.拥有者;if(!owner)return;owner.更新运动数据();const cfg=this.发射物[0];
  for(let i=0;i<this.查询到的位置.length;i++){
   if(!cfg?.类型)continue;
   const p=this.world.spawn<蓝图_发射物&{ActorRotation:Rotator}>(cfg.类型,o=>{o.来自角色=owner;o.来自技能=this;o.速度=cfg.速度;o.持续时长=cfg.持续时长;o.触发间隔=cfg.触发间隔;o.ActorRotation={Pitch:0,Yaw:Math.fround(this.位置对应角度[i]??0),Roll:0};},this.查询到的位置[i]);
   p.伤害数值=获取科学映射词条(owner.词条,'基础伤害').输出值;owner.创建发射物(p,1,false);
  }
  this.连击计数-=1;if(this.连击计数<=0){this.clearTimer('连击');this.释放结束(false);owner.结束行动(null,'');}
 }
}

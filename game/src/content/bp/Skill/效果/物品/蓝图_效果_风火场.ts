/** Source L38/L272/L2084: inclusive0..roundcount outer loop; each combo creates one tornado+one explosion, using first/second of3points. */
import{蓝图_效果}from'../../../../../core/ability/effect.ts';import{蓝图_能力}from'../../../../../core/ability/ability.ts';import{蓝图_发射物_旋风01}from'../../发射物/蓝图_发射物_旋风01.ts';import{蓝图_效果_爆炸}from'../蓝图_效果_爆炸.ts';import{函数库_技能,函数库_工具}from'../../../../../core/bp/index.ts';import{make伤害,make效果配置}from'../../../../../core/bp/structs.ts';import{sciOf,科学数乘除,科学数变普通}from'../../../../../core/math/sci.ts';import{获取科学映射词条}from'../../../../../core/math/stats.ts';import{applyEffect}from'../蓝图_效果_可控弹射.ts';import type{AssetPath,Tag,Vec3,HitResult}from'../../../../../core/sim/types.ts';
export class 蓝图_效果_风火场 extends 蓝图_效果{
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_风火场';生成位置:Vec3={x:0,y:0,z:0};范围=0;捕获的角色:HitResult[]=[];参数值=0;
 施加中毒():void{for(let i=0;i<this.捕获的角色.length;i++){/* Source loop body contains no action. */}}
 override 持续中触发(t:Tag):void{const s=this.来自技能,o=s?.拥有者,h=this.world.mode.玩家角色,m=this.world.mode.当前任务实例;if(t!=='效果.时机.新一天时'||!s||!o||!h||!(m instanceof 蓝图_能力)||!m.类型.has('能力.类型.任务.杀敌'))return;
  for(let outer=0;outer<=this.world.mode.回合开始触发数;outer++){this.生成位置={...h.当前位置};this.K2_DetachFromActor();this.范围=s.技能距离;
   for(let i=0;i<=Math.trunc(科学数变普通(获取科学映射词条(o.词条,'连击').输出值))-1;i++){
    const pts=函数库_工具.范围选取点(this,this.生成位置,90,s.技能距离/2,45,3,false,16).选到的点,a=pts[0]??{x:0,y:0,z:0},dx=a.x-this.生成位置.x,dy=a.y-this.生成位置.y;
    const shot=this.world.spawn(蓝图_发射物_旋风01,p=>{p.来自角色=o;p.来自技能=s;p.持续时长=1.5;p.ActorRotation.Yaw=dx*dx+dy*dy>.0001?Math.fround(Math.atan2(dy,dx)*180/Math.PI):0;},a);
    const value=()=>{const p=函数库_技能.获取技能参数(this,s,0,false,'');return 科学数乘除(sciOf(p.参数值,0),获取科学映射词条(o.词条,p.词条).输出值,false);};shot.伤害数值=value();o.创建发射物(shot,1,false); // Source never adds旋风01 counter here; its child still decrements on stop.
    if(!this.world.isValid(o))continue;const cls=蓝图_效果_爆炸.path,cfg=make效果配置({效果类:cls,持续时间:2,触发间隔:1,持续回合:-1,叠加层数:1,唯一:false,检查效果名:false,叠加上限:100}),r=applyEffect(this,{cfg,owner:o,释放者:o,来自技能:s,效果名:函数库_技能.获取效果名(this,s,cls).效果名字,classOf:o});if(r.refreshed||!(r.effect instanceof 蓝图_效果_爆炸))continue;r.effect.伤害数据=make伤害({伤害来源:'装备',伤害类型:'爆炸',伤害数值:value(),所需回合:3,触发次数:1});r.effect.爆炸位置=pts[1]??{x:0,y:0,z:0};r.effect.序号=Math.imul(i,2);r.effect.激活效果('');
   }
  }
 }
}

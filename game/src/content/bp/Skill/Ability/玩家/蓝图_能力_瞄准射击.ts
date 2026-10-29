/** Source 瞄准射击 L4561/L4117/L214: selected indicator, two source scatter evaluations per projectile, .3s volleys. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 蓝图_发射物 } from '../../../../../core/ability/projectile.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { Rotator } from '../../../../../core/sim/types.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { sciOf, 科学数变普通, 科学数乘除 } from '../../../../../core/math/sci.ts';
export class 蓝图_能力_瞄准射击 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_瞄准射击';
  连击数=1;
  发射物销毁用数组:蓝图_发射物[]=[];
  指示额外长度=999;
  override 被选中():void{
    const h=this.world.mode.玩家角色,o=this.拥有者;if(!h||!o)return;
    h.当前能力=this;h.有选中主动技能=true;
    this.连击数=this.HasMatchingGameplayTag('能力.类型.无视连击')?1:科学数变普通(获取科学映射词条(o.词条,'连击').输出值);
    if(this.技能动画[0])this.playAnim(o,this.技能动画[0]);
  }
  override 检查子条件():void{this.子条件通过=!this.本技能激活中;}
  override 执行技能(_read:boolean):void{
    const o=this.拥有者,h=this.world.mode.玩家角色,ctl=this.world.mode.玩家控制器;if(!o||!h||!ctl)return;
    o.创建发射物组(1,false);h.目标位置={...ctl.目标位置缓存};
    this.setTimer('发射',.3,true,()=>this.发射(),-.3);
  }
  发射():void{
    const o=this.拥有者,h=this.world.mode.玩家角色,spec=this.发射物[0];if(!o||!h||!spec?.类型)return;
    const split=()=>Math.trunc(科学数变普通(获取科学映射词条(o.词条,'投射分裂').输出值));
    for(let i=0;i<=split();i++){
      const rotation=():Rotator=>{const p=函数库_工具.扩散命中中心(this,null,h.目标位置,this.技能距离,{x:0,y:0,z:0});
        return{Pitch:0,Roll:0,Yaw:Math.fround(Math.atan2(p.y-h.当前位置.y,p.x-h.当前位置.x)*180/Math.PI+(i-Math.max(split()-1,0)/2)*7.5)};};
      const first=rotation();
      const p=this.world.spawn<蓝图_发射物>(spec.类型,p=>{p.来自角色=h;p.来自技能=this;p.速度=spec.速度;p.持续时长=spec.持续时长;p.触发间隔=spec.触发间隔;
        (p as 蓝图_发射物&{ActorRotation:Rotator}).ActorRotation=first;}, {...h.当前位置,z:0});
      (p as 蓝图_发射物&{ActorRotation:Rotator}).ActorRotation=rotation();p.K2_SetActorLocation({...h.当前位置,z:0});
      o.创建发射物(p,1,false);
      const param=函数库_技能.获取技能参数(this,this,0,false,'');p.伤害数值=科学数乘除(获取科学映射词条(o.词条,param.词条).输出值,sciOf(param.参数值,0),false);
      if(!this.发射物销毁用数组.includes(p))this.发射物销毁用数组.push(p);
    }
    this.连击数--;if(this.连击数<=0)this.clearTimer('发射');
  }
  override 特殊结算(from:BpObject|null):void{
    if(!(from instanceof 蓝图_发射物))return;
    this.发射物销毁用数组=this.发射物销毁用数组.filter(p=>p!==from);
    if(!this.发射物销毁用数组.length&&!this.world.latent.isTimerActive(this,'发射')){this.释放结束(false);this.world.mode.玩家角色?.结束行动(null,'');}
  }
}

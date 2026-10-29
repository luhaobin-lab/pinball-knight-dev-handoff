/** Source 抓钩: hit classification chooses the pulled actor, source curve move1500, then ends the projectile. */
import { 蓝图_发射物 } from '../../../../core/ability/projectile.ts';
import { BP_ManeActor } from '../../../../core/sim/actor.ts';
import type { HitResult,Vec3 } from '../../../../core/sim/types.ts';
import { BpObject } from '../../../../core/sim/object.ts';
import { 函数库_工具 } from '../../../../core/bp/index.ts';
import { make伤害 } from '../../../../core/bp/structs.ts';
export class 蓝图_发射物_抓钩 extends 蓝图_发射物 {
  static override readonly path='CatapultHero/BP/Skill/发射物/蓝图_发射物_抓钩';
  override 安全超时秒数=30;
  GoalDestination:Vec3={x:0,y:0,z:0};DeltaTime=0;InterpSpeed=8;回归=false;
  移动的角色:BP_ManeActor|null=null;最终落点:Vec3={x:0,y:0,z:0};对方的体积=0;
  判断类型(hit:HitResult):void{
    const caster=this.来自角色,target=hit.actor;if(!caster)return;
    const surface=hit.staticSurface;
    const wall=surface?.tags.includes('环境.房间.墙壁')||surface?.classes.includes('蓝图_动态网格_C')
      ||target instanceof BpObject&&(target.HasMatchingGameplayTag('环境.房间.墙壁')||target.def.path==='CatapultHero/BP/环境/蓝图_动态网格');
    if(wall){this.移动的角色=caster;this.最终落点={...hit.location};}
    else if(target instanceof BP_ManeActor){
      if(target.HasMatchingGameplayTag('可交互.角色.AI.仇恨')&&target.高度<=caster.高度*1.5){
        this.K2_AttachToActor(target);this.移动的角色=target;
        const dx=hit.location.x-caster.当前位置.x,dy=hit.location.y-caster.当前位置.y,l=Math.hypot(dx,dy);
        this.最终落点={x:caster.当前位置.x+(l>0?dx/l:0)*target.高度,y:caster.当前位置.y+(l>0?dy/l:0)*target.高度,z:caster.当前位置.z};
      }else{this.对方的体积=target.高度;this.移动的角色=caster;this.最终落点={...hit.location};}
    }
    if(this.移动的角色)this.移动的角色.目标位置={...this.最终落点};
  }
  override BndEvt__蓝图_发射物_ProjectileMovement_K2Node_ComponentBoundEvent_0_OnProjectileStopDelegate__DelegateSignature(hit:HitResult):void{
    this.判断类型(hit);const actor=this.移动的角色;if(!actor)return;
    actor.移到目标地点('可控反弹曲线','卡牌高度位移曲线',1500,0);
    this.delay('L2028',actor.移动所需时长,()=>{this.来自技能?.释放结束(false);this.结束发射物();函数库_工具.销毁目标和子物体(this,this);});
  }
  override 激活前触发():void{
    this.最大穿透次数=1;this.fx.sound('CatapultHero/声音/TREASURE_Gold_Coins_Rattle_05_mono',this.K2_GetActorLocation(),{volume:.8,pitch:.85});this.停止特效='CatapultHero/粒子/粒子_Hit_01';
  }
  override 触发发射物敌方效果():void{
    const o=this.来自技能?.拥有者;if(!o)return;const hit=this.Sweep_Result;
    o.造成即时伤害(make伤害({伤害来源:'投射物',伤害类型:'物理',不变速:true,伤害数值:this.伤害数值,所需回合:3,触发次数:this.触发次数,
      击中点位置:hit.location,击中点法线:hit.normal,来自技能:this.来自技能,来自角色:o,来自发射物:this,目标角色:this.当前命中角色}),false,false);
  }
  override 发射物停下():void{this.回归=true;}
  override ReceiveTick(dt:number):void{
    super.ReceiveTick(dt);this.DeltaTime=dt;this.来自角色?.更新运动数据();this.GoalDestination={x:0,y:0,z:0};
    if(this.回归){const p=this.K2_GetActorLocation(),distance=Math.hypot(p.x,p.y,p.z),near=distance<=(this.来自角色?.高度??0),k=Math.min(1,Math.max(0,dt*this.InterpSpeed));
      this.K2_SetActorLocation(near?this.GoalDestination:{x:p.x*(1-k),y:p.y*(1-k),z:p.z*(1-k)});}
  }
}

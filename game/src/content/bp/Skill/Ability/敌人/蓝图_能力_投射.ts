/** 投射 L2659/L15: select player, update motion, .3s delay, shoot actual row projectile; end only on 特殊结算. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { 蓝图_发射物 } from '../../../../../core/ability/projectile.ts';
import { 函数库_技能,函数库_工具 } from '../../../../../core/bp/index.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { AssetPath,Rotator } from '../../../../../core/sim/types.ts';
export class 蓝图_能力_投射 extends 蓝图_能力 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_投射';
  override 被选中():void {函数库_工具.选择角色作为目标(this,this.拥有者);}
  override 检查子条件():void {this.子条件通过=true;}
  override 子初始化():void {}
  override 执行技能(_load:boolean):void {
    const owner=this.拥有者;if(!owner)return;owner.更新运动数据();
    if(this.技能动画[0])this.playAnim(owner,this.技能动画[0],{});
    this.delay('L15',.3,()=>{
      const cfg=this.发射物[0];if(!cfg?.类型)return;
      const target=owner.当前目标?.K2_GetActorLocation()??{x:0,y:0,z:0},p=owner.当前位置;
      const shot=this.world.spawn<蓝图_发射物&{ActorRotation:Rotator}>(cfg.类型,o=>{
        o.来自角色=owner;o.来自技能=this;o.速度=cfg.速度;o.持续时长=cfg.持续时长;o.触发间隔=cfg.触发间隔;
        o.ActorRotation={Pitch:0,Yaw:Math.atan2(target.y-p.y,target.x-p.x)*180/Math.PI,Roll:0};
      },{x:p.x,y:p.y,z:p.z+owner.高度});
      const parameter=函数库_技能.获取技能参数(this,this,0,false,'');
      shot.伤害数值=科学数乘除(获取科学映射词条(owner.词条,parameter.词条).输出值,sciOf(parameter.参数值),false);
      owner.创建发射物(shot,1,false);this.fx.vfx(this.技能配置.粒子[0]??null,owner,{attach:true});
    });
  }
  override 特殊结算(_from:BpObject|null):void {this.释放结束(false);this.拥有者?.结束行动(null,'');}
}

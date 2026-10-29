/** 闪现 L1309: intangible from intent; execution picks legal ring P1 and runs the imported .5+.5 timelines. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能,函数库_工具 } from '../../../../../core/bp/index.ts';
import { Array_Random,Array_Shuffle } from '../../../../../core/rng/ue.ts';
import type { AssetPath,Vec3 } from '../../../../../core/sim/types.ts';
export class 蓝图_能力_闪现 extends 蓝图_能力 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_闪现';
  选取到的格子:Vec3[]=[];传送位置:Vec3={x:0,y:0,z:0};ug_dissolve=1;
  闪现前触发():void {}
  override 被选中():void {
    const owner=this.拥有者;if(!owner)return;
    owner.关闭碰撞();函数库_工具.选择角色作为目标(this,owner);owner.更新运动数据();
    const cells=this.游戏模式?.当前房间实例?.可走地形格;if(cells)Array_Shuffle(this.world.rng.combat,cells);
    this.ug_dissolve=1;this.present();
  }
  override 检查子条件():void {this.子条件通过=true;}
  override 执行技能(_load:boolean):void {
    const owner=this.拥有者;if(!owner)return;
    if(this.技能动画[0])this.playAnim(owner,this.技能动画[0],{});
    const r=Math.trunc(函数库_技能.获取技能参数(this,this,1,false,'').参数值);
    this.选取到的格子=函数库_技能.选取范围地形格_菱形环(this,this.游戏模式,owner.当前位置,r,true).选取到的格子;
    const i=Array_Random(this.world.rng.combat,this.选取到的格子);this.传送位置=i<0?{x:0,y:0,z:0}:{...this.选取到的格子[i]!};
    owner.关闭碰撞();this.fx.vfx('CatapultHero/粒子/粒子_齐刘海闪现',owner,{attach:true});
    this.timeline('时间轴','PlayFromStart',{update:(_t,tracks)=>{this.ug_dissolve=Math.fround((tracks.明度??0)*20);this.present();},finished:()=>{
      this.闪现前触发();owner.K2_SetActorLocation({...this.传送位置,z:owner.高度});owner.开启碰撞();
      this.timeline('时间轴_0','PlayFromStart',{update:(_t,tracks)=>{this.ug_dissolve=Math.fround((tracks.明度??0)*20);this.present();},finished:()=>{
        this.fx.vfx('CatapultHero/粒子/粒子_齐刘海闪现',owner,{attach:true});this.释放结束(false);owner.结束行动(null,'');
      }});
    }});
  }
  private present():void {this.fx.ui({op:'update',widget:'actor.dissolve',data:{id:this.拥有者?.id,value:this.ug_dissolve}});}
}

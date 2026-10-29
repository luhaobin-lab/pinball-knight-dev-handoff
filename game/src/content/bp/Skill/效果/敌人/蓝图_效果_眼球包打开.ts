/** 眼球包打开 L1378: spawn P0 hidden eyes immediately, reveal at .7s; birth completion OR cancellation ends action. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能,函数库_工具 } from '../../../../../core/bp/index.ts';
import { SetActorHiddenInGame } from '../../../../../core/sim/engine.ts';
import type { BP_Actor_Other } from '../../../../../core/sim/other.ts';
import type { AssetPath,Tag,Vec3 } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_眼球包打开 extends 蓝图_效果 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_眼球包打开';
  召唤出来的:(BP_Actor_Other|null)[]=[];选到的点:Vec3[]=[];
  /** Blueprint ubergraph local reused by all birth delegates; source quirk ENEMIE-102. */
  ug_lastSummoned:BP_Actor_Other|null=null;
  override 激活后触发(_debug:string):void {this.销毁延迟=2;}
  override 销毁前触发():void {}
  override 持续中触发(_tag:Tag):void {
    const count=Math.trunc(函数库_技能.获取技能参数(this,this.来自技能,0,false,'').参数值-1);
    for(let i=0;i<=count;i++){
      const r=函数库_技能.召唤角色到场上(this,this.游戏模式,'CatapultHero/数据表/角色/数据表_敌人_普通','眼球',{x:0,y:0,z:0},false,true,false);
      const eye=r.召唤出来的;this.ug_lastSummoned=eye;this.召唤出来的.push(eye);if(!eye)continue;
      const done=()=>{const last=this.ug_lastSummoned;last?.结束行动(null,'');last?.更新运动数据();last?.更新朝向();};
      if(r.有出生动画&&r.出生动画)this.playAnim(eye,r.出生动画,{completed:done,cancelled:done});else done();
    }
    this.delay('L2175',.7,()=>{
      const owner=this.拥有者;if(!owner)return;owner.更新运动数据();
      this.选到的点=函数库_工具.范围选取点(this,owner.当前位置,0,200,90,this.召唤出来的.length,false,16).选到的点;
      this.召唤出来的.forEach((eye,i)=>{if(!eye)return;const p=this.选到的点[i]??{x:0,y:0,z:0};eye.K2_SetActorLocation({x:p.x,y:p.y,z:p.z+eye.高度});eye.开启碰撞();eye.当前行动力=100;SetActorHiddenInGame(eye,false);});
      函数库_工具.以目标为中心释放冲击(this,owner,200,10000,false,0,[],false,{x:0,y:0,z:0});
    });
  }
}

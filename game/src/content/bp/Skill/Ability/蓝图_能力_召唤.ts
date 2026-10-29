/** 召唤 L964: append ring5+ring7 (8 rays each), never clear the source candidate array; P0 count/word is species. */
import { 蓝图_能力 } from '../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../core/bp/index.ts';
import { Array_Shuffle } from '../../../../core/rng/ue.ts';
import type { AssetPath,Vec3 } from '../../../../core/sim/types.ts';
import type { BpObject } from '../../../../core/sim/object.ts';
export class 蓝图_能力_召唤 extends 蓝图_能力 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/蓝图_能力_召唤';
 选取到的格子:Vec3[]=[];
 override 被选中():void{}
 override 检查子条件():void{this.子条件通过=(this.游戏模式?.敌方场上.length??0)<=3;}
 override 执行技能(_load:boolean):void{
  const owner=this.拥有者,mode=this.游戏模式,task=mode?.当前任务实例 as (BpObject&{未完成?:boolean})|null;
  if(!owner||owner.死掉了||!task?.未完成)return;
  for(const r of[5,7])this.选取到的格子.push(...函数库_技能.选取范围地形格_圆形环(this,mode,owner.当前位置,r,8,true).选取到的格子);
  Array_Shuffle(this.world.rng.combat,this.选取到的格子);
  const p=函数库_技能.获取技能参数(this,this,0,false,'');
  for(let i=0;i<Math.trunc(p.参数值);i++){
   const r=函数库_技能.召唤角色到场上(this,mode,'CatapultHero/数据表/角色/数据表_敌人_普通',p.词条,this.选取到的格子[i]??{x:0,y:0,z:0},true,false,false);
   if(r.召唤出来的&&r.出生动画)this.playAnim(r.召唤出来的,r.出生动画,{});
  }
  this.释放结束(false);owner.结束行动(null,'');
 }
}

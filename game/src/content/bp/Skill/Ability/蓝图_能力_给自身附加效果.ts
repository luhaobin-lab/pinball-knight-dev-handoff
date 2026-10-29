/** 给自身附加效果 L2610 casts on selection iff P3==1; execution attaches all effects then only ends the action. */
import { 蓝图_能力 } from '../../../../core/ability/ability.ts';
import { attachSourceEffect } from '../../../../core/ability/apply.ts';
import { 函数库_技能 } from '../../../../core/bp/index.ts';
import type { AssetPath } from '../../../../core/sim/types.ts';
export class 蓝图_能力_给自身附加效果 extends 蓝图_能力 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/蓝图_能力_给自身附加效果';
 override 被选中():void{if(函数库_技能.获取技能参数(this,this,3,false,'').参数值===1)this.释放开始();}
 override 检查子条件():void{}
 override 子初始化():void{}
 override 执行技能(_load:boolean):void{
  const owner=this.拥有者;if(!owner)return;
  for(const cfg of this.效果配置)attachSourceEffect(this,owner,this,cfg)?.激活效果('');
  owner.结束行动(null,''); // source does not call 释放结束 here; the stance owns it
 }
}

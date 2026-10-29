/** Source L917/L26/L1093: usable outside enemies/loot, opens free junk offer from storedEXP; original 释放结束 override is empty. */
import{蓝图_能力}from'../../../../../core/ability/ability.ts';import{函数库_技能}from'../../../../../core/bp/index.ts';import{TagSet}from'../../../../../core/sim/tags.ts';import{科学数变普通}from'../../../../../core/math/sci.ts';import{获取科学映射词条,type 词条映射}from'../../../../../core/math/stats.ts';import type{AssetPath}from'../../../../../core/sim/types.ts';
export class 蓝图_能力_魂珠 extends 蓝图_能力{
 static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/道具/蓝图_能力_魂珠';生成品质=1;词条修正:词条映射=new Map();
 override 检查子条件():void{this.子条件通过=this.world.mode.当前环节!=='物品盒子'&&!this.world.mode.场上有敌人;}
 override 执行技能(_load:boolean):void{const o=this.拥有者;if(!o)return;const exp=科学数变普通(获取科学映射词条(o.词条,'经验').输出值);if(exp>0){this.world.cult.切换物品盒子(false,true,-1,0,this);const max=函数库_技能.获取技能参数(this,this,3,false,'').参数值;this.world.cult.刷新生成牌(false,true,false,o.品质,Math.trunc(Math.min(exp,max)),false,new TagSet(['可交互.修炼牌.废品']),new TagSet(['可交互.修炼牌.衍生物','可交互.修炼牌.附魔','可交互.修炼牌.传奇']),true,false,[],[],this.词条修正);}this.释放结束(false);}
 override 释放结束(_interrupted:boolean):void{} // L1093 is an empty source override, not parent release.
}

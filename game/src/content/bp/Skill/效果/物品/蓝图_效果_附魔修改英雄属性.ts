/** Source creation/destruction hooks empty; equip/unequip call base before applying/removing hero stat mapping. */
import{蓝图_效果}from'../../../../../core/ability/effect.ts';import{函数库_技能}from'../../../../../core/bp/index.ts';import{添加科学映射值,移除科学映射值}from'../../../../../core/math/stats.ts';import{sciOf}from'../../../../../core/math/sci.ts';
export class 蓝图_效果_附魔修改英雄属性 extends 蓝图_效果{
 static override readonly path='CatapultHero/BP/Skill/效果/物品/蓝图_效果_附魔修改英雄属性';
 override 装上时触发():void{super.装上时触发();const s=this.来自技能,o=s?.拥有者,h=this.world.mode.玩家角色;if(!s||!o||!h)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');添加科学映射值(h.词条,p.词条,`${o.唯一ID}${o.拥有的被动能力.indexOf(s)}/附魔`,sciOf(p.参数值,0),false);o.属性被修改后();h.属性被修改后();}
 override 卸下时触发():void{super.卸下时触发();const s=this.来自技能,o=s?.拥有者,h=this.world.mode.玩家角色;if(!s||!o||!h)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');移除科学映射值(h.词条,p.词条,`${o.唯一ID}${o.拥有的被动能力.indexOf(s)}/附魔`);o.属性被修改后();h.属性被修改后();}
 override 激活后触发():void{} override 销毁前触发():void{} override 持续中触发():void{}
}

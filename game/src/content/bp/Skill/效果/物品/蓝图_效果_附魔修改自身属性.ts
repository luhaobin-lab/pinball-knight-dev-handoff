/** Source L10/L692: stat source is ownerUniqueID + current passive-array index + /附魔. */
import{蓝图_效果}from'../../../../../core/ability/effect.ts';import{函数库_技能}from'../../../../../core/bp/index.ts';import{添加科学映射值,移除科学映射值}from'../../../../../core/math/stats.ts';import{sciOf}from'../../../../../core/math/sci.ts';
export class 蓝图_效果_附魔修改自身属性 extends 蓝图_效果{
 static override readonly path='CatapultHero/BP/Skill/效果/物品/蓝图_效果_附魔修改自身属性';
 override 激活后触发(_d:string):void{const s=this.来自技能,o=s?.拥有者;if(!s||!o)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');添加科学映射值(o.词条,p.词条,`${o.唯一ID}${o.拥有的被动能力.indexOf(s)}/附魔`,sciOf(p.参数值,0),false);o.属性被修改后();o.更新外观数据();}
 override 销毁前触发():void{const s=this.来自技能,o=s?.拥有者;if(!s||!o)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');移除科学映射值(o.词条,p.词条,`${o.唯一ID}${o.拥有的被动能力.indexOf(s)}/附魔`);o.属性被修改后();o.更新外观数据();}
 override 持续中触发():void{}
}

/** Source L931 sequence applies or opens replacement, then consumes the stone even while the page is open. */
import{蓝图_效果}from'../../../../../core/ability/effect.ts';import{BP_Actor_Card}from'../../../../../core/sim/card.ts';import type{Tag}from'../../../../../core/sim/types.ts';
export class 蓝图_效果_附魔悬停物品 extends 蓝图_效果{
 static override readonly path='CatapultHero/BP/Skill/效果/物品/蓝图_效果_附魔悬停物品';
 来自牌:BP_Actor_Card|null=null;目标牌:BP_Actor_Card|null=null;
 判断目标可附魔():{通过:boolean}{const t=this.目标牌,s=this.来自技能;return{通过:!!t&&this.world.isValid(t)&&!!s&&t.名字!=='祝福之灵'&&t.名字!=='空附魔石'&&!t.HasMatchingGameplayTag('忽略')&&!t.HasMatchingGameplayTag('可交互.修炼牌.附魔')&&(s.目标标签.size===0||t.OwnedGameplayTags.hasAny(s.目标标签.toArray()))};}
 override 激活后触发():void{this.来自牌=this.来自技能?.拥有者 instanceof BP_Actor_Card?this.来自技能.拥有者:null;}
 override 持续中触发(tag:Tag):void{if(tag!=='效果.时机.主动激活')return;const stone=this.来自牌,s=this.来自技能,target=this.目标牌;if(!stone||!s)return;
  if(target&&this.判断目标可附魔().通过)(this.world.sys.enchant as {applyStone(stone:BP_Actor_Card,target:BP_Actor_Card,level:number):void}).applyStone(stone,target,s.等级);
  stone.从仓库中移除();this.world.cult.分解牌(stone,true,false);
 }
}

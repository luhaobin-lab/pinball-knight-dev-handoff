/** Source L4216/L3055: no-delay charged attack releases3-hop equipment shock, owner and effectcaster are effect-owner. */
import{蓝图_效果_蓄能攻击时XX}from'../蓝图_效果_蓄能攻击时XX.ts';import{蓝图_效果_闪电链}from'../蓝图_效果_闪电链.ts';
import{函数库_技能}from'../../../../../core/bp/index.ts';import{make效果配置,make伤害}from'../../../../../core/bp/structs.ts';import{applyEffect}from'../蓝图_效果_可控弹射.ts';import type{科学数}from'../../../../../core/math/sci.ts';import type{AssetPath}from'../../../../../core/sim/types.ts';
export class 蓝图_效果_雷神匕首 extends 蓝图_效果_蓄能攻击时XX{
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_雷神匕首';
 override 激活后触发(d:string):void{super.激活后触发(d);this.无延迟连击=true;}
 override 额外子触发(value:科学数,count:number):void{const s=this.来自技能,o=this.拥有者;if(!s||!o||!this.world.isValid(o))return;const cls=蓝图_效果_闪电链.path,cfg=make效果配置({效果类:cls,持续时间:1,触发间隔:1,持续回合:-1,叠加层数:1,唯一:false,检查效果名:false,叠加上限:99}),r=applyEffect(this,{cfg,owner:o,释放者:o,来自技能:s,效果名:函数库_技能.获取效果名(this,s,cls).效果名字,classOf:o});if(r.refreshed||!(r.effect instanceof 蓝图_效果_闪电链))return;r.effect.伤害数据=make伤害({伤害来源:'装备',伤害类型:'电击',伤害数值:value,所需回合:3,触发次数:count,来自技能:s,来自角色:s.拥有者});r.effect.跳跃次数=3;r.effect.激活效果('');}
}

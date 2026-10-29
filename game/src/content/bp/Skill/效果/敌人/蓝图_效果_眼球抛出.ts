/** 眼球抛出 L5063/L4259: loss charge starts at1, strict >P0*maxHP, reset then spawn exactly one offspring. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { attachSourceEffect } from '../../../../../core/ability/apply.ts';
import { 函数库_技能,函数库_工具 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { sciOf,科学数乘除,科学数变普通 } from '../../../../../core/math/sci.ts';
import { Array_Random } from '../../../../../core/rng/ue.ts';
import type { BP_Actor_Other } from '../../../../../core/sim/other.ts';
import type { AssetPath,Tag,Vec3 } from '../../../../../core/sim/types.ts';
import { 蓝图_能力_融合弹射 } from '../../Ability/敌人/蓝图_能力_融合弹射.ts';
export class 蓝图_效果_眼球抛出 extends 蓝图_效果 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_眼球抛出';
  召唤出来的:(BP_Actor_Other|null)[]=[];选到的点:Vec3[]=[];召唤伤害充能=1;抛出血线=0;合适的点:Vec3={x:0,y:0,z:0};
  随机一个方向():{合适的点:Vec3}{
    const points=函数库_工具.范围选取点(this,this.拥有者?.K2_GetActorLocation()??{x:0,y:0,z:0},256,512,64,8,true,16).选到的点;
    const i=Array_Random(this.world.rng.combat,points);return{合适的点:i<0?{x:0,y:0,z:0}:{...points[i]!}};
  }
  override 激活后触发(_debug:string):void {this.销毁延迟=2;}
  override 销毁前触发():void {}
  override 持续中触发(tag:Tag):void {
    const owner=this.拥有者;if(!owner)return;
    if(tag==='效果.时机.失去生命后'){this.召唤伤害充能+=科学数变普通(owner.当前失去生命);return;}
    if(tag!=='效果.时机.新一天时')return;
    const p=函数库_技能.获取技能参数(this,this.来自技能,0,false,'').参数值;
    if(!(this.召唤伤害充能>p*科学数变普通(owner.当前最大生命)))return;
    this.召唤伤害充能=0;this.游戏模式?.加入回合开始(this.来自技能);
    const child=函数库_技能.召唤角色到场上(this,this.游戏模式,'CatapultHero/数据表/角色/数据表_敌人_普通','眼球_融合',owner.K2_GetActorLocation(),false,false,false).召唤出来的;
    if(!child)return;
    const fusion=child.拥有的主动能力[0];if(fusion instanceof 蓝图_能力_融合弹射)fusion.召唤者=owner;
    child.更新运动数据();child.目标位置=this.随机一个方向().合适的点;
    const leap=attachSourceEffect(this,child,this.来自技能,make效果配置({效果类:'CatapultHero/BP/Skill/效果/蓝图_效果_跳向目标位置',持续时间:-1,触发间隔:1,持续回合:-1,叠加层数:1,唯一:true}));
    if(!leap)return;leap.激活效果('');
    child.当前最大生命=科学数乘除(owner.当前最大生命,sciOf(p*.8),false);child.当前生命={...child.当前最大生命};
    this.召唤出来的.push(child);child.当前行动力=0;
  }
}

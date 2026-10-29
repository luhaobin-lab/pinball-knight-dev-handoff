/** 反弹时融合: only 结束移动后 can merge. Phase3 + living summoner + planar distance <= summoner.width. */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { make治疗 } from '../../../../core/bp/structs.ts';
import { sciOf,科学数乘除 } from '../../../../core/math/sci.ts';
import { SetActorHiddenInGame } from '../../../../core/sim/engine.ts';
import type { AssetPath,Tag } from '../../../../core/sim/types.ts';
export class 蓝图_效果_反弹时融合 extends 蓝图_效果 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/蓝图_效果_反弹时融合';
  发动融合():void {
    const owner=this.拥有者,mother=this.释放者,skill=this.来自技能;if(!owner||!mother||!skill?.拥有者)return;
    mother.获得治疗(make治疗({是暴击:false,生命护甲:false,治疗整数:科学数乘除(owner.当前生命,sciOf(.8),false),治疗百分比:sciOf(0),触发次数:1,特效位置:mother.当前位置,来自技能:skill,释放者:mother}),true,false);
    this.游戏模式?.从场上移出_碰撞(skill.拥有者);this.游戏模式?.添加到墓地(skill.拥有者);
    skill.拥有者.关闭碰撞();SetActorHiddenInGame(skill.拥有者,true);
  }
  override 激活后触发(_debug:string):void {
    this.销毁延迟=1;this.拥有者?.关闭碰撞();
    if(this.拥有者){this.fx.vfx('CatapultHero/粒子/粒子_轨迹',this.拥有者,{attach:true});this.拥有者.移到目标地点('卡牌平面位移曲线','卡牌高度位移曲线',800,0);}
  }
  override 持续中触发(tag:Tag):void {
    if(tag!=='效果.时机.结束移动后')return;
    const owner=this.拥有者,mother=this.释放者;if(!owner)return;
    const p=owner.K2_GetActorLocation(),q=mother?.K2_GetActorLocation()??{x:0,y:0,z:0};
    if(mother&&!mother.死掉了&&this.游戏模式?.当前环节==='进行战斗'&&Math.hypot(p.x-q.x,p.y-q.y)<=mother.宽度)this.发动融合();
    else owner.开启碰撞();
    this.来自技能?.释放结束(false);owner.结束行动(null,'');this.销毁效果();
  }
  override 销毁前触发():void { this.delay('L15',.75,()=>this.fx.ui({op:'close',widget:'轨迹',data:{effect:this.id}})); }
}

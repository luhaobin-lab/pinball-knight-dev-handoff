/** Source L3242/L3610: animation, qualified equipped targets, each effect activated, then .5s release. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { applyEffect } from '../../效果/蓝图_效果_可控弹射.ts';
export class 蓝图_能力_给物品附加效果 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_给物品附加效果';
  筛选后:(BP_Actor_Card|null)[]=[];
  override 执行技能(_read:boolean):void{
    const o=this.拥有者;if(!o)return;if(this.技能动画[0])this.playAnim(o,this.技能动画[0]);
    this.筛选后=函数库_技能.技能条件筛选物品(this,this.world.cult,this,-1).筛选后;
    for(const owner of this.筛选后)for(const cfg of this.效果配置){if(!owner||!this.world.isValid(owner)||owner.死掉了)continue;
      const name=函数库_技能.获取效果名(this,this,cfg.效果类).效果名字;
      const{effect}=applyEffect(this,{cfg,owner,释放者:o,来自技能:this,效果名:name,classOf:o});effect?.激活效果('');}
    this.delay('L3062',.5,()=>this.释放结束(false));
  }
  override 被选中():void{}
  override 检查子条件():void{}
  override 子初始化():void{}
}

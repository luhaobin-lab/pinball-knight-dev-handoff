import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
/** Despite its name, source space0 is equipment only; quality<=2 is set directly to3. */
export class 蓝图_能力_升级所有物品 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/奖励/蓝图_能力_升级所有物品';
  可升级:BP_Actor_Card[]=[];
  override 执行技能(_read:boolean):void {this.可升级=[];
    for(const c of 函数库_工具.筛选修炼物品(this,this.world.cult,'装备',false,new TagSet(),false,new TagSet(),-1).筛选后)if(c&&c.品质<=2&&!this.可升级.includes(c))this.可升级.push(c);
    this.子条件通过=this.可升级.length>0;if(!this.子条件通过)this.fx.headUp(this.world.mode.玩家角色??this,{ns:'literal',key:'没有可升级物品。'});
    for(const c of this.可升级){c.品质=3;c.升级此牌(false,true);}this.释放结束(false);
  }
  override 检查子条件():void {}
}

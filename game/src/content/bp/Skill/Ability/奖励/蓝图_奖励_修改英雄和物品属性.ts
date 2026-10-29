import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 添加科学映射值,科学映射原始值 } from '../../../../../core/math/stats.ts';
import { sciOf,科学数变普通 } from '../../../../../core/math/sci.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
/** Source flow stack: hero delta, optional item loop/finish, then positive gold. Empty item key skips finish. */
export class 蓝图_奖励_修改英雄和物品属性 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_修改英雄和物品属性';
  筛选后:(BP_Actor_Card|null)[]=[];
  override 执行技能(_read:boolean):void {const h=this.world.mode.玩家角色;if(!h)return;
    const hp=函数库_技能.获取技能参数(this,this,0,false,'');添加科学映射值(h.词条,hp.词条,'永久保留',sciOf(科学数变普通(科学映射原始值(h.词条,hp.词条,false))*hp.参数值),true);h.属性被修改后();
    const ip=函数库_技能.获取技能参数(this,this,1,false,'');if(ip.词条){this.筛选后=函数库_技能.技能条件筛选物品(this,this.world.cult,this,-1).筛选后;
      for(const card of this.筛选后)if(card){添加科学映射值(card.词条,ip.词条,'永久保留',sciOf(ip.参数值),true);card.属性被修改后();card.更新外观数据();}this.释放结束(false);}
    const gold=FTrunc(函数库_技能.获取技能参数(this,this,2,false,'').参数值);if(gold>0)this.world.mode.增加金币_收入(false,true,gold,null);
  }
  override 被选中():void {}
  override 检查子条件():void {}
}

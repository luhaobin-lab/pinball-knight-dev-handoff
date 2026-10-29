import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
export class 蓝图_奖励_感知精核经验 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_感知精核经验';
  override 执行技能(_read:boolean):void {this.world.mode.增加金币_收入(false,true,FTrunc(函数库_技能.获取技能参数(this,this,1,false,'').参数值),this.拥有者);
    this.world.mode.增加经验(函数库_技能.获取技能参数(this,this,2,false,'').参数值,this.拥有者);this.释放结束(false);}
  override 被选中():void {}
}

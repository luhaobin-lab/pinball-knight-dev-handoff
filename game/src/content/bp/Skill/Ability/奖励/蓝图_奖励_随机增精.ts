import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { RandomIntegerInRange } from '../../../../../core/rng/ue.ts';
/** Source UG: truncate each parameter before the inclusive meta-domain draw. */
export class 蓝图_奖励_随机增精 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_随机增精';
  NewVar_0=0;
  override 执行技能(_read:boolean):void { const hi=函数库_技能.获取技能参数(this,this,1,false,'').参数值,lo=函数库_技能.获取技能参数(this,this,0,false,'').参数值;
    this.NewVar_0=RandomIntegerInRange(this.world.rng.meta,FTrunc(lo),FTrunc(hi));this.world.mode.增加金币_收入(false,true,this.NewVar_0,null);this.释放结束(false); }
  override 被选中():void {}
  override 检查子条件():void {}
}

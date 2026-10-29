import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import { 添加科学映射值,获取科学映射词条,词条映射From } from '../../../../../core/math/stats.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
/** Source multiplies the unmodified hero configuration stat, not the current maximum. */
export class 蓝图_奖励_随机生命 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_随机生命';
  NewVar_0=0;
  override 执行技能(_read:boolean):void {const hi=函数库_技能.获取技能参数(this,this,1,false,'').参数值,lo=函数库_技能.获取技能参数(this,this,0,false,'');
    this.NewVar_0=RandomFloatInRange(this.world.rng.meta,lo.参数值,hi);const h=this.world.mode.玩家角色;if(!h)return;
    const value=获取科学映射词条(词条映射From(h.角色配置.科学词条),lo.词条).输出值;
    添加科学映射值(h.词条,lo.词条,'永久保留',科学数乘除(sciOf(this.NewVar_0),value,false),true);h.属性被修改后();this.释放结束(false);}
  override 被选中():void {}
  override 检查子条件():void {}
}

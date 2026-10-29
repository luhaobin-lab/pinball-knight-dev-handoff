import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { asPercent } from '../../../../../core/math/numfmt.ts';
/** Source effect always uses p0, while its own description selects p[level-1]. Preserve the discrepancy. */
export class 蓝图_奖励_额外经验 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_额外经验';
  override 执行技能(_read:boolean):void {添加科学映射值(this.world.mode.全局词条,'经验修正%',this.唯一ID,sciOf(函数库_技能.获取技能参数(this,this,0,false,'').参数值),false);this.释放结束(false);}
  override 子初始化():void {const values=[0,1,2].map(i=>函数库_技能.获取技能参数(this,this,i,false,'').参数值),shown=asPercent(values[this.等级-1]??0,1);
    const value=`<天赋>+${shown}</>`;this.描述={zh:this.原始描述.zh.replaceAll('{0}',value),en:this.原始描述.en.replaceAll('{0}',value)};}
  override 被选中():void {}
  override 检查子条件():void {}
}

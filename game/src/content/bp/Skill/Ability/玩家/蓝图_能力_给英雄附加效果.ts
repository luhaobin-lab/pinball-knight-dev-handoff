import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { applyEffect } from '../../效果/蓝图_效果_可控弹射.ts';
/** Source L2756 applies immediately, independently of pose completion, and ends after.5s. */
export class 蓝图_能力_给英雄附加效果 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_给英雄附加效果';
  override 执行技能(_read:boolean):void {const h=this.world.mode.玩家角色;if(!h)return;const anim=h.精灵动画序列[5];if(anim)this.playAnim(h,anim);
    for(const cfg of this.效果配置){if(h.死掉了)continue;const name=函数库_技能.获取效果名(this,this,cfg.效果类).效果名字;
      const{effect}=applyEffect(this,{cfg,owner:h,释放者:this.拥有者,来自技能:this,效果名:name,classOf:this.拥有者??this});effect?.激活效果('');}
    this.delay('L2650',.5,()=>this.释放结束(false));}
  override 被选中():void {}
  override 检查子条件():void {}
  override 子初始化():void {this.描述={zh:this.描述.zh.replaceAll('{}',''),en:this.描述.en.replaceAll('{}','')};}
}

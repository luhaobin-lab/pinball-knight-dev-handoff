import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能,函数库_工具 } from '../../../../../core/bp/index.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
export class 蓝图_能力_修改玩家属性 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/道具/蓝图_能力_修改玩家属性';
  治疗百分比=.1;
  override 执行技能(_read:boolean):void {const h=this.world.mode.玩家角色;if(!h)return;const p=函数库_技能.获取技能参数(this,this,0,false,'');
    添加科学映射值(h.词条,p.词条,'永久保留',sciOf(p.参数值),true);h.更新最大生命魔力();this.释放结束(false);}
  override 被选中():void {函数库_工具.选择角色作为目标(this,this.拥有者);}
  override 子初始化():void {}
}

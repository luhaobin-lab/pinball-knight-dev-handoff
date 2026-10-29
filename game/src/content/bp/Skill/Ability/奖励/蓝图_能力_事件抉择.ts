import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import { 主界面 } from '../../效果/玩家/蓝图_效果_升级获取天赋.ts';
/** Source L725: final choice and shop are immediate; other choices wait1.2s before the UI's own .2s delay. */
export class 蓝图_能力_事件抉择 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/奖励/蓝图_能力_事件抉择';
  指定池子:string[]=[];
  override 执行技能(_read:boolean):void {
    const open=()=>{for(const p of this.参数)if(p.词条&&!this.指定池子.includes(p.词条))this.指定池子.push(p.词条);
      主界面(this).开启多选一(this,false,this.目标标签,new TagSet(),this.指定池子,true,true,true,3,1,this.等级-1,null,null);this.释放结束(false);};
    if(this.能力名==='终结抉择'||this.world.mode.当前环节==='进入商店')open();else this.delay('L877',1.2,open);
  }
  override 被选中():void { 函数库_工具.选择角色作为目标(this,this.拥有者); }
  override 检查子条件():void {}
  override 子初始化():void {}
}

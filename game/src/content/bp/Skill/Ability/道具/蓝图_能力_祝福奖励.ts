import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 数据表_技能_奖励 } from '../../../../demo/tables.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import { Array_Random } from '../../../../../core/rng/ue.ts';
import { 主界面 } from '../../效果/玩家/蓝图_效果_升级获取天赋.ts';
import type { World } from '../../../../../core/sim/world.ts';
/** Source selects an event group on meta RNG, then passes every named option. It does not set its 已触发 field. */
export class 蓝图_能力_祝福奖励 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/道具/蓝图_能力_祝福奖励';
  已触发=false;合成奖励组:string[]=[];筛选池子:string[]=[];
  override 检查子条件():void {const c=this.world.cult;
    this.子条件通过=c.打开页面类型==='制造页'?!c.全拿未拾取牌().没拿完:!this.world.mode.场上有敌人&&c.盒子关闭了;}
  override 执行技能(_read:boolean):void {const c=this.world.cult;if(!c.盒子关闭了)c.切换物品盒子(true,true,-1,1,null);
    if(!c.制造页关闭了)(this.world.sys.craft as typeof this.world.sys.craft&{closeCraft?(w:World):boolean}).closeCraft?.(this.world);
    c.页面切换('无',true); // source ignores return; the reviewed craft close hook performs the live page transition
    for(const [name,row]of Object.entries(数据表_技能_奖励.rows))if(new TagSet(row.类型).has('能力.类型.奖励.抉择事件')&&!this.合成奖励组.includes(name))this.合成奖励组.push(name);
    const i=Array_Random(this.world.rng.meta,this.合成奖励组),name=this.合成奖励组[i],row=name?(数据表_技能_奖励.rows as Record<string,{参数:readonly {词条:string}[]}>)[name]:undefined;if(!row)return;
    for(const p of row.参数)if(p.词条&&!this.筛选池子.includes(p.词条))this.筛选池子.push(p.词条);
    this.释放结束(false);主界面(this).开启多选一(this,false,new TagSet(),new TagSet(),this.筛选池子,true,true,true,3,0,(this.拥有者?.品质??1)-1,null,null);
  }
  override 被选中():void {}
  override 子初始化():void {}
}

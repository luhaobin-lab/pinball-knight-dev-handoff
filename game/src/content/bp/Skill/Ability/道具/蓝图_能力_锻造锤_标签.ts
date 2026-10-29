/** Source L296/L10: top equipped target, original-tag-aware permanent extra mapping through shared source helper. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_能力_锻造锤_标签 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_锻造锤_标签';
  最上方:BP_Actor_Card|null=null;目标牌:(BP_Actor_Card|null)[]=[];
  override 检查子条件():void{const r=函数库_工具.筛选修炼物品(this,this.world.cult,'装备',false,new TagSet(),false,new TagSet(),-1);this.子条件通过=r.是否存在;if(r.是否存在)this.最上方=r.最上方;else this.fx.headUp(this,{ns:'literal',key:'没有可锻造物品。'});}
  override 执行技能(_loaded:boolean):void{函数库_技能.判断原始标签并修改(this,this.最上方,this,true,true);if(this.最上方)this.fx.ui({op:'update',widget:'UI_修炼牌.触发闪烁',data:{id:this.最上方.id}});this.释放结束(false);}
  override 被选中():void{}
  override 子初始化():void{const q=this.等级-1,names=['青铜','白银','黄金','钻石'];const text={zh:this.原始描述.zh.replace('{1}',`<强调>${names[q]??''}</>`),en:this.原始描述.en.replace('{1}',['Bronze','Silver','Gold','Diamond'][q]??'')};for(const n of [0,2,3]){text.zh=text.zh.replace(`{${n}}`,this.描述中参数[n]?.zh??'');text.en=text.en.replace(`{${n}}`,this.描述中参数[n]?.en??'');}text.zh=text.zh.replace('{4}','');text.en=text.en.replace('{4}','');this.描述=text;}
}

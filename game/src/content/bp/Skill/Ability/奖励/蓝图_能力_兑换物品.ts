/** Source L1895/L1453/L1785/L1187: replace top same-sized card by3 shuffled choices, inherit stats/enchant/quality, close finishes floor. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import { MakeRandomStream,Array_Shuffle } from '../../../../../core/rng/ue.ts';
import { 复制词条映射,type 词条映射 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { 修炼物品格子组 } from '../../../../../core/sim/cult-grid.ts';
import type { 结构_存档_能力 } from '../../../../demo/types.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_能力_兑换物品 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/奖励/蓝图_能力_兑换物品';
  override 品质=0;最上方:BP_Actor_Card|null=null;筛选后物品:string[]=[];品质_0=0;所在格子组:修炼物品格子组|null=null;指定名组:string[]=[];附魔存档:结构_存档_能力[]=[];词条修正:词条映射=new Map();标签合并=new TagSet();
  override 检查子条件():void{
    this.标签合并=new TagSet(this.目标标签.toArray());const r=函数库_工具.筛选修炼物品(this,this.world.cult,'装备',false,new TagSet(),false,new TagSet(),-1);this.子条件通过=r.是否存在;
    if(r.是否存在&&r.最上方){this.最上方=r.最上方;this.标签合并.add(['可交互.修炼牌.小型','可交互.修炼牌.中型','可交互.修炼牌.大型'][r.最上方.尺寸-1]);this.筛选后物品=this.world.cult.筛选物品生成(true,this.标签合并,this.排斥标签,0,-2,MakeRandomStream(0),true,false,'None').筛选后物品;this.子条件通过=this.筛选后物品.length>0;}
    if(!this.子条件通过)this.fx.headUp(this,{ns:'literal',key:'没有可兑换物品。'});
  }
  override 执行技能(loaded:boolean):void{if(loaded)return;const c=this.最上方;if(!c)return;this.所在格子组=c.所在格子组;this.品质_0=c.品质;this.附魔存档=c.附魔存档.map(x=>({...x}));this.词条修正=复制词条映射(c.词条);this.world.cult.移除物品(c);this.刷新盒子();}
  刷新盒子():void{Array_Shuffle(this.world.rng.meta,this.筛选后物品);this.指定名组=[];for(let i=0;i<=Math.min(this.筛选后物品.length-1,2);i++)if(!this.指定名组.includes(this.筛选后物品[i]))this.指定名组.push(this.筛选后物品[i]);this.world.cult.切换物品盒子(false,false,1,1,this);this.world.cult.刷新生成牌(false,true,false,this.品质_0,3,false,new TagSet(),new TagSet(),false,false,this.指定名组,this.附魔存档,this.词条修正);this.所在格子组?.更新格子信息(0);this.释放结束(false);}
  盒子关闭后():void{this.world.mode.结束当前层(true);}
  override 子初始化():void{const q=this.等级-1;const text={zh:this.原始描述.zh.replace('{1}',`<强调>${['青铜','白银','黄金','钻石'][q]??''}</>`),en:this.原始描述.en.replace('{1}',['Bronze','Silver','Gold','Diamond'][q]??'')};for(const n of [0,2,3]){text.zh=text.zh.replace(`{${n}}`,this.描述中参数[n]?.zh??'');text.en=text.en.replace(`{${n}}`,this.描述中参数[n]?.en??'');}text.zh=text.zh.replace('{4}','');text.en=text.en.replace('{4}','');this.描述=text;}
}

/** Source L898 delay1 -> linkage70: all 指定数据筛选 rownames, free box, close ends floor. No ordinary weighted draw. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { structOf } from '../../../../../core/bp/structs.ts';
import type { 词条映射 } from '../../../../../core/math/stats.ts';
import type { AssetPath,结构_层 } from '../../../../demo/types.ts';
export class 蓝图_奖励_复合奖励_新手关 extends 蓝图_能力 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_复合奖励_新手关';
  所在格层配置:结构_层=structOf('结构_层');所在格种子=0;词条修正:词条映射=new Map();筛选后战利品:string[]=[];指定名组:string[]=[];生成品质=1;
  奖励配置(layer:结构_层,seed:number):void{this.所在格层配置=layer;this.所在格种子=seed;}
  override 执行技能(_read:boolean):void{this.delay('L898',1,()=>{this.指定名组=[];for(const row of this.所在格层配置.指定数据筛选)this.指定名组.push(row.数据表行.RowName);this.world.cult.切换物品盒子(false,true,this.指定名组.length,0,this);this.world.cult.刷新生成牌(false,true,true,this.生成品质,this.指定名组.length,false,this.目标标签,this.排斥标签,false,true,this.指定名组,[],this.词条修正);this.释放结束(false);});}
  盒子关闭后():void{this.world.mode.结束当前层(true);}
  override 子初始化():void{this.额外描述=[];for(const t of this.额外原始描述){const tag=函数库_工具.获取附魔标签(this,this.所在格层配置,this.所在格种子).OutItem.slice(11);const values=[this.描述中参数[0],this.描述中参数[1],this.描述中参数[2],{zh:`<强调>${tag}</>`,en:`<强调>${tag}</>`},{zh:'',en:''}];const fill=(lang:'zh'|'en')=>t[lang].replace(/\{([0-4])\}/g,(_,i)=>values[Number(i)]?.[lang]??'');const x={zh:fill('zh'),en:fill('en')};if(!this.额外描述.some(v=>v.zh===x.zh&&v.en===x.en))this.额外描述.push(x);}}
}

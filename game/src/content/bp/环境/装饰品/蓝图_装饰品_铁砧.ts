/** Source L304/L433/L591: interactive decoration opens manufacturing; no invented cost, distance check or consumption. */
import { 蓝图_装饰品 } from './蓝图_装饰品.ts';
import type { World } from '../../../../core/sim/world.ts';
import type { AssetPath } from '../../../../core/sim/types.ts';
export class 蓝图_装饰品_铁砧 extends 蓝图_装饰品 {
  static override readonly path: AssetPath = 'CatapultHero/BP/环境/装饰品/蓝图_装饰品_铁砧';
  游戏模式 = this.world.mode; 冷却=0;伤害=0;已激活=false;已消耗=false;每回合可触发次数=3;
  玩家交互():void{(this.world.sys.craft as typeof this.world.sys.craft&{openCraft(w:World):boolean}).openCraft(this.world);}
  悬停高亮(on:boolean):void{this.fx.ui({op:'update',widget:'actor.highlight',data:{id:this.id,on}});}
  悬停提示():void{this.fx.ui({op:'open',widget:'UI_悬停提示_A',data:{title:'转化台',text:'制作物品。',width:275}});}
  新一天时():void{}
}

import { 蓝图_装饰品 } from './蓝图_装饰品.ts';
import { 蓝图_可拾取物_保护罩 } from '../../Skill/效果/可拾取物/蓝图_可拾取物_保护罩.ts';
import { attachSourceEffect } from '../../../../core/ability/apply.ts';
import { 函数库_工具 } from '../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../core/bp/structs.ts';
import type { AssetPath } from '../../../../core/sim/types.ts';
/** L4526: exact class-count gate before source range selection, attach to the stationary generator. */
export class 蓝图_装饰品_保护罩生成器 extends 蓝图_装饰品 {
  static override readonly path:AssetPath='CatapultHero/BP/环境/装饰品/蓝图_装饰品_保护罩生成器';
  保护罩数量=2;
  新一天时():void { generateShields(this,this.保护罩数量); }
}
/** Both source generator classes duplicate this graph but have the same decoration superclass. */
export function generateShields(ctx:蓝图_装饰品,count:number):void {
  const hero=ctx.world.mode.玩家角色;if(!hero)return;
  if(函数库_工具.对应类型效果数量(ctx,hero.拥有的效果,蓝图_可拾取物_保护罩.path).数量>0)return;
  const points=函数库_工具.范围选取点(ctx,{x:0,y:0,z:0},0,1000,201,count,true,200).选到的点;
  for(const p of points){
    const e=attachSourceEffect<蓝图_可拾取物_保护罩>(ctx,hero,null,make效果配置({效果类:蓝图_可拾取物_保护罩.path,持续时间:-1,触发间隔:1,持续回合:-1,叠加层数:1}));
    if(!e)continue;e.K2_DetachFromActor();e.K2_SetActorLocation(p);e.K2_AttachToActor(ctx);e.激活效果('');
  }
}

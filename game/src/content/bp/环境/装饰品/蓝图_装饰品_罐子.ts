import { 蓝图_装饰品 } from './蓝图_装饰品.ts';
import { RandomIntegerInRange } from '../../../../core/rng/ue.ts';
import type { AssetPath } from '../../../../core/sim/types.ts';
export class 蓝图_装饰品_罐子 extends 蓝图_装饰品 {
  static override readonly path:AssetPath='CatapultHero/BP/环境/装饰品/蓝图_装饰品_罐子';
  ug_variant=0;
  override ReceiveBeginPlay():void { this.ug_variant=[7,6,5,4][RandomIntegerInRange(this.world.rng.combat,0,3)]!; }
}

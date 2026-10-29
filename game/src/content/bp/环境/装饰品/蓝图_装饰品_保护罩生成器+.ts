import { 蓝图_装饰品 } from './蓝图_装饰品.ts';
import { generateShields } from './蓝图_装饰品_保护罩生成器.ts';
import type { AssetPath } from '../../../../core/sim/types.ts';
export class 蓝图_装饰品_保护罩生成器加强 extends 蓝图_装饰品 {
  static override readonly path:AssetPath='CatapultHero/BP/环境/装饰品/蓝图_装饰品_保护罩生成器+';
  保护罩数量=3;
  新一天时():void { generateShields(this,this.保护罩数量); }
}

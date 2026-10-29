import { BpObject } from '../../../../core/sim/object.ts';
import type { AssetPath } from '../../../../core/sim/types.ts';
/** Source base has only occupancy/room ownership; no invented interaction or turn behavior. */
export class 蓝图_装饰品 extends BpObject {
  static override readonly path: AssetPath = 'CatapultHero/BP/环境/装饰品/蓝图_装饰品';
  来自房间: BpObject | null = null;
}

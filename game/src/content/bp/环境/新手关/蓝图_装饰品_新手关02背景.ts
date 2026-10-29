import { 蓝图_装饰品 } from '../装饰品/蓝图_装饰品.ts';
import type { AssetPath } from '../../../../core/sim/types.ts';
import type{BpObject}from'../../../../core/sim/object.ts';
/** SPEC-GAP: authored child-airwall and backdrop exact geometry remains core-room work. Source class has no additional gameplay graph; room-plan owns existing static colliders/approved kit. */
export class 蓝图_装饰品_新手关02背景 extends 蓝图_装饰品 {
  static override readonly path:AssetPath='CatapultHero/BP/环境/新手关/蓝图_装饰品_新手关02背景';
  override ReceiveBeginPlay():void{(this.world.sys.room as {createAuthoredChildren(o:BpObject):void}).createAuthoredChildren(this);}
}

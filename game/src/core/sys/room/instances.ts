import type { BpObject } from '../../sim/object.ts';
import type { 蓝图_房间 } from '../../sim/room.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import type { RoomPlan } from './plan.ts';
/** Room-cell L14979: deferred source decoration spawn, room reference, attachment, AddUnique. */
export function populateDecorations(room:蓝图_房间,plan:RoomPlan):void {
  for(const old of room.房间装饰品)if(old?.valid)函数库_工具.销毁目标和子物体(room,old);
  room.房间装饰品=[];
  for(const p of plan.placements){
    const d=room.world.spawn<BpObject&{来自房间?:BpObject|null}>(p.cls,o=>{o.来自房间=room;},p.at);
    d.K2_AttachToActor(room);room.房间装饰品.push(d);
    if(p.cell!==null)room.所有房间格子数组[p.cell]?.拥有的装饰品.push(d);
  }
}

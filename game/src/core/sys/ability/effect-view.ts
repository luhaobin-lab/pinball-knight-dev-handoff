import type{FieldEffectView}from'../../api/view.ts';import type{World}from'../../sim/world.ts';import type{BpObject}from'../../sim/object.ts';import type{BP_ManeActor}from'../../sim/actor.ts';import type{蓝图_能力}from'../../ability/ability.ts';
type Field=BpObject&{ug_fieldVisual?:{kind:FieldEffectView['kind'];phase:FieldEffectView['phase'];startedAt:number;phaseAt:number;duration?:number;segments?:number;source?:number;end?:{x:number;y:number;z:number}}|null;拥有者?:BP_ManeActor|null;来自技能?:蓝图_能力|null;非角色释放者?:BpObject|null;当前弹跳终点?:BP_ManeActor|null;起点?:{x:number;y:number;z:number}};
/** Pure projection: visual phase callbacks and actual object positions, never fire an ability/query/RNG here. */
export function effectView(world:World):FieldEffectView[]{
 const objects=(world as World&{objects?():readonly BpObject[]}).objects?.()??[],out:FieldEffectView[]=[];
 for(const o of objects){const f=o as Field,s=f.ug_fieldVisual;if(!o.valid||!s)continue;
  if(s.kind==='lightning'){
   // SpawnSystemAttached captured this root component once. A destroyed ball must not retarget its beam to owner.
   const source=objects.find(o=>o.id===s.source);
   if(!world.isValid(source)||!s.end)continue;
   out.push({id:o.id,...s,position:source.K2_GetActorLocation(),end:{...s.end},radius:0});
  }else out.push({id:o.id,...s,position:o.K2_GetActorLocation(),radius:s.kind==='orb'?32:64,...(s.kind==='blackhole'?{range:f.来自技能?.技能距离??0,attractRange:(f.来自技能?.技能距离??0)*3}:{})});
 }
 return out;
}

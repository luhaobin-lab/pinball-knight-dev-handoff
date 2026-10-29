/** 酸液池 PaperSprite: T_White_sRGB_Sprite Box128×10×128, scale(.5,1,.5), Roll90, relativeZ8.
 * World box is 64×64×10 (half32/32/5); QueryOnly/PawnOverlap. It is not the initial damage SphereTrace radius20.
 */
import { BP_ManeActor } from '../../sim/actor.ts';
import { queryProfileEnabled } from '../../sim/collision-profile.ts';
import { makeHitResult } from '../../bp/structs.ts';
import type { BpObject } from '../../sim/object.ts';
import type { HitResult, Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { collides } from './capsule.ts';

const ACID = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_酸液池';
// 幽魂池 raw PaperSprite properties are byte-equivalent for shape/transform/query responses (source420b0311).
const POOLS=new Set([ACID,'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_幽魂池']);
type Acid = BpObject & {
  ug_acidOverlapIds?: number[];
  BndEvt__蓝图_效果_酸液池_PaperSprite_K2Node_ComponentBoundEvent_2_ComponentBeginOverlapSignature__DelegateSignature(a:unknown,b:BpObject|null,c:unknown,i:number,sweep:boolean,hit:HitResult):void;
};
const objects=(world:World):readonly BpObject[]=>(world as World&{objects?():readonly BpObject[]}).objects?.()??[];
const axes=['x','y','z'] as const;
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const at=(p:Vec3,d:Vec3,t:number):Vec3=>({x:p.x+d.x*t,y:p.y+d.y*t,z:p.z+d.z*t});
const outside2=(p:Vec3,half:Vec3):number=>axes.reduce((sum,k)=>sum+Math.max(0,Math.abs(p[k])-half[k])**2,0);
const halfFor=(actor:BP_ManeActor):Vec3=>({x:32,y:32,z:5+Math.max(actor.高度-actor.宽度,0)});
const centre=(acid:BpObject):Vec3=>{const p=acid.K2_GetActorLocation();return{x:p.x,y:p.y,z:p.z+8};};
const enabled=(a:BP_ManeActor):boolean=>a.valid&&collides(a)&&queryProfileEnabled(a)&&a.宽度>0;

/** Segment versus box expanded by upright capsule: its vertical core enlarges Z; round corners use radius. */
function entry(from:Vec3,to:Vec3,half:Vec3,radius:number):number|null{
  const d=sub(to,from),cuts=[0,1],rr=radius*radius;
  for(const k of axes)if(d[k]!==0)for(const edge of[-half[k],half[k]]){const t=(edge-from[k])/d[k];if(t>0&&t<1)cuts.push(t);}
  cuts.sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){
    const lo=cuts[i]!,hi=cuts[i+1]!,mid=at(from,d,(lo+hi)/2);
    if(outside2(at(from,d,lo),half)<=rr)return lo;
    let a=0,b=0,c=-rr;
    for(const k of axes){
      if(Math.abs(mid[k])<=half[k])continue;
      const v=from[k]-Math.sign(mid[k])*half[k];a+=d[k]*d[k];b+=2*v*d[k];c+=v*v;
    }
    if(a===0)continue;
    const disc=b*b-4*a*c;if(disc<0)continue;
    const t=(-b-Math.sqrt(disc))/(2*a);if(t>=lo&&t<=hi)return t;
  }
  return outside2(to,half)<=rr?1:null;
}

/** The component exists during the inactive warning. Seed overlaps at spawn, not again when the damage gate opens. */
export function initialiseTerrainOverlaps(world:World,object:BpObject):void{
  if(!POOLS.has(object.def.path))return;
  const acid=object as Acid;if(acid.ug_acidOverlapIds!==undefined)return;
  const c=centre(acid);
  acid.ug_acidOverlapIds=objects(world).filter((a):a is BP_ManeActor=>a instanceof BP_ManeActor&&enabled(a))
    .filter(a=>outside2(sub(a.K2_GetActorLocation(),c),halfFor(a))<=a.宽度*a.宽度).map(a=>a.id);
}

export function moveTerrainOverlaps(world:World,actor:BP_ManeActor,from:Vec3,to:Vec3):void{
  moveEnvironmentOverlaps(world,actor,from,to);
  for(const object of objects(world)){
    if(!object.valid||!POOLS.has(object.def.path))continue;
    const acid=object as Acid,ids=acid.ug_acidOverlapIds??(acid.ug_acidOverlapIds=[]),was=ids.includes(actor.id);
    if(!enabled(actor)){if(was)ids.splice(ids.indexOf(actor.id),1);continue;}
    const c=centre(acid),a=sub(from,c),b=sub(to,c),half=halfFor(actor),r=actor.宽度;
    const t=entry(a,b,half,r),inside=outside2(b,half)<=r*r;
    if(!was&&t!==null){
      ids.push(actor.id);
      const p=at(from,sub(to,from),t);
      acid.BndEvt__蓝图_效果_酸液池_PaperSprite_K2Node_ComponentBoundEvent_2_ComponentBeginOverlapSignature__DelegateSignature(
        null,actor,null,0,true,makeHitResult({actor,location:p,impactPoint:p,time:t,blockingHit:false}),
      );
    }
    if(!inside){const i=ids.indexOf(actor.id);if(i>=0)ids.splice(i,1);}
  }
}

const SPIKES='CatapultHero/BP/环境/装饰品/蓝图_装饰品_地刺';
const SHIELD='CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_保护罩';
type EnvironmentTrigger=BpObject&{ug_environmentInside?:number[];ug_boxHalf?:Vec3;ug_boxOffset?:Vec3;拾取半径?:number;开始重叠?(a:BpObject):void;玩家重叠?(a:BpObject):void};
function environmentShape(o:EnvironmentTrigger,actor:BP_ManeActor):{centre:Vec3;half:Vec3;radius:number}|null{
  const p=o.K2_GetActorLocation(),core=Math.max(actor.高度-actor.宽度,0);
  if(o.def.path.startsWith(SPIKES)&&o.ug_boxHalf&&o.ug_boxOffset){const q=o.ug_boxOffset,h=o.ug_boxHalf;return{centre:{x:p.x+q.x,y:p.y+q.y,z:p.z+q.z},half:{x:h.x,y:h.y,z:h.z+core},radius:actor.宽度};}
  // Source pickup activation component is50uu; the ward's separate160uu Sphere has empty Begin/End handlers.
  if(o.def.path===SHIELD&&actor===o.world.mode.玩家角色)return{centre:p,half:{x:0,y:0,z:core},radius:actor.宽度+(o.拾取半径??50)};
  return null;
}
export function initialiseEnvironmentOverlaps(world:World,object:BpObject):void{
  const o=object as EnvironmentTrigger;if(o.ug_environmentInside)return;o.ug_environmentInside=[];
  for(const actor of objects(world))if(actor instanceof BP_ManeActor&&enabled(actor)){
    const s=environmentShape(o,actor);if(s&&outside2(sub(actor.K2_GetActorLocation(),s.centre),s.half)<=s.radius*s.radius)o.ug_environmentInside.push(actor.id);
  }
}
function moveEnvironmentOverlaps(world:World,actor:BP_ManeActor,from:Vec3,to:Vec3):void{
  for(const object of objects(world)){
    if(!object.valid)continue;const o=object as EnvironmentTrigger,s=environmentShape(o,actor);if(!s)continue;
    const ids=o.ug_environmentInside??(o.ug_environmentInside=[]),was=ids.includes(actor.id);
    if(!enabled(actor)){if(was)ids.splice(ids.indexOf(actor.id),1);continue;}
    const a=sub(from,s.centre),b=sub(to,s.centre),t=entry(a,b,s.half,s.radius),inside=outside2(b,s.half)<=s.radius*s.radius;
    if(!was&&t!==null){ids.push(actor.id);if(o.开始重叠)o.开始重叠(actor);else o.玩家重叠?.(actor);}
    if(!inside){const i=ids.indexOf(actor.id);if(i>=0)ids.splice(i,1);}
  }
}

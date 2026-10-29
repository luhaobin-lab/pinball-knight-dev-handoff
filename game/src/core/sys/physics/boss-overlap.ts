/** Engine query overlap for 飞跃重击's Sphere. QueryOnly remains active while its owner's capsule is disabled.
 * Source effect L2795: radius owner.height*1.4, updateOverlaps=true; L15 BeginOverlap → player impulse.
 * Only actual movement segments and the explicit initial update call this; preview never does.
 */
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { makeHitResult } from '../../bp/structs.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { BpObject } from '../../sim/object.ts';
import type { HitResult, Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { collides } from './capsule.ts';
import { queryProfileEnabled } from '../../sim/collision-profile.ts';
import { moveTerrainOverlaps } from './terrain-overlap.ts';
import { pickupBoxActorMove } from './pickup-box.ts';

const LEAP = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_飞跃重击';
type Leap = 蓝图_效果 & {
  球体半径: number;
  ug_spherePlayerInside?: boolean;
  BndEvt__蓝图_效果_飞跃重击_Sphere_K2Node_ComponentBoundEvent_0_ComponentBeginOverlapSignature__DelegateSignature(a: unknown, other: BpObject | null, c: unknown, i: number, sweep: boolean, hit: HitResult): void;
};
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z });
const at = (a: Vec3, d: Vec3, t: number): Vec3 => ({ x: a.x+d.x*t, y: a.y+d.y*t, z: a.z+d.z*t });
const distance2 = (p: Vec3, core: number): number => p.x*p.x+p.y*p.y+Math.max(0,Math.abs(p.z)-core)**2;

/** Swept sphere against upright capsule: split at cap planes, solve each interval's quadratic. */
function firstTouch(from: Vec3, to: Vec3, radius: number, core: number): number | null {
  const d=sub(to,from), cuts=[0,1];
  if(d.z!==0) for(const z of[-core,core]){const t=(z-from.z)/d.z;if(t>0&&t<1)cuts.push(t);}
  cuts.sort((a,b)=>a-b);
  const rr=radius*radius;
  for(let i=0;i<cuts.length-1;i++){
    const lo=cuts[i]!,hi=cuts[i+1]!;
    if(distance2(at(from,d,lo),core)<=rr)return lo;
    const mid=at(from,d,(lo+hi)/2), cap=mid.z>core?core:mid.z< -core?-core:null;
    const z0=cap===null?0:from.z-cap,zd=cap===null?0:d.z;
    const a=d.x*d.x+d.y*d.y+zd*zd,b=2*(from.x*d.x+from.y*d.y+z0*zd),c=from.x*from.x+from.y*from.y+z0*z0-rr;
    if(a===0)continue;
    const disc=b*b-4*a*c;if(disc<0)continue;
    const t=(-b-Math.sqrt(disc))/(2*a);
    if(t>=lo&&t<=hi)return t;
  }
  return distance2(to,core)<=rr?1:null;
}

export function moveEffectOverlaps(world: World, moved: BP_ManeActor, from: Vec3, to: Vec3): void {
  moveTerrainOverlaps(world,moved,from,to);
  pickupBoxActorMove(world,moved,from,to);
  const hero=world.mode.玩家角色;
  if(!hero?.valid)return;
  const actors=[...new Set([...world.mode.场上所有,hero,moved])];
  const effects=actors.flatMap(a=>a?.拥有的效果??[]);
  for(const obj of effects){
    if(!obj?.valid||obj.def.path!==LEAP)continue;
    const e=obj as Leap,owner=e.拥有者;
    if(!owner?.valid||(moved!==owner&&moved!==hero))continue;
    if(!collides(hero)||!queryProfileEnabled(hero)){e.ug_spherePlayerInside=false;continue;}
    if(!(e.球体半径>0))continue;
    const h=hero.K2_GetActorLocation(),end=e.K2_GetActorLocation();
    const e0=moved===owner?add(end,sub(from,to)):end;
    const h0=moved===hero?from:h,h1=moved===hero?to:h;
    const a=sub(e0,h0),b=sub(end,h1),radius=e.球体半径+hero.宽度,core=Math.max(hero.高度,hero.宽度)-hero.宽度;
    const t=firstTouch(a,b,radius,core),inside=distance2(b,core)<=radius*radius;
    if(!e.ug_spherePlayerInside&&t!==null){
      // Record before callback: reentrant movement cannot emit a second begin for this entry.
      e.ug_spherePlayerInside=true;
      const point=at(e0,sub(end,e0),t);
      e.BndEvt__蓝图_效果_飞跃重击_Sphere_K2Node_ComponentBoundEvent_0_ComponentBeginOverlapSignature__DelegateSignature(
        null,hero,null,0,true,makeHitResult({actor:hero,location:point,impactPoint:point,time:t,blockingHit:false}),
      );
    }
    e.ug_spherePlayerInside=inside;
  }
}

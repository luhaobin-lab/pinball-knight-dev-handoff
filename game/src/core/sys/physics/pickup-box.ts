/** Source caltrop Box(8,8,16), mass.5, fixed Z/rotation, default material1/.4, native default damping.01.
 * Geometry is an axis-aligned BOX, never a radius8 sphere. Chaos sleep/contact offsets remain unmeasured.
 */
import { createLaunchWorld,sweepProbe } from '../../launch/index.ts';
import type { RoomPlan } from '../../api/view.ts';
import type { BpObject } from '../../sim/object.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { World } from '../../sim/world.ts';
import type { Vec3 } from '../../sim/types.ts';
import { collides } from './capsule.ts';
import { queryProfileEnabled } from '../../sim/collision-profile.ts';
const SPIKE='CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_尖刺';
type State={vx:number;vy:number;touching:number[]};
type Spike=BpObject&{ug_pickupBox?:State;玩家重叠(actor:BpObject):void};
export const pickupBoxObjectType=(actor:BpObject):'Vehicle'|undefined=>(actor as Spike).ug_pickupBox?'Vehicle':undefined;
const all=(w:World):readonly BpObject[]=>(w as World&{objects?():readonly BpObject[]}).objects?.()??[];
const validSpikes=(w:World)=>all(w).filter((o):o is Spike=>o.valid&&o.def.path===SPIKE);
export function registerPickupBox(o:BpObject):void{
 const spike=o as Spike;spike.ug_pickupBox={vx:0,vy:0,touching:[]};
 const hero=o.world.mode.玩家角色;if(hero)overlap(spike,hero,hero.K2_GetActorLocation(),hero.K2_GetActorLocation(),false);
}
export function impulsePickupBox(o:BpObject,impulse:Vec3):void{
 const s=(o as Spike).ug_pickupBox;if(!o.valid||!s)return;s.vx+=impulse.x/.5;s.vy+=impulse.y/.5;arm(o.world);
}
/** Pure boxes for source query channels: Pawn/物品 overlap, Visibility/Camera/PhysicsBody/Vehicle ignored. */
export function pickupBoxShapes(w:World,channel:string):{actor:BpObject;id:string;minX:number;minY:number;maxX:number;maxY:number;blocking:boolean}[]{
 if(['Visibility','Camera','PhysicsBody','Vehicle'].includes(channel))return[];
 return validSpikes(w).map(o=>{const p=o.K2_GetActorLocation();return{actor:o,id:`#${o.id}`,minX:p.x-8,maxX:p.x+8,minY:p.y-8,maxY:p.y+8,blocking:!['Pawn','物品','Destructible'].includes(channel)};});
}
function staticHit(room:RoomPlan,from:Vec3,to:Vec3):{time:number;point:Vec3;normal:Vec3}|null{
 const origin=room.origin??{x:0,y:0},tile=room.tile,floor=new Set(room.cells.map(c=>`${c[0]},${c[1]}`));
 const boxes:{id:string;minX:number;maxX:number;minY:number;maxY:number}[]=[];
 const x0=Math.floor((Math.min(from.x,to.x)-8-origin.x)/tile),x1=Math.floor((Math.max(from.x,to.x)+8-origin.x)/tile);
 const y0=Math.floor((Math.min(from.y,to.y)-8-origin.y)/tile),y1=Math.floor((Math.max(from.y,to.y)+8-origin.y)/tile);
 if(!room.authoredBoundary)for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)if(!floor.has(`${x},${y}`))boxes.push({id:`wall:${x}:${y}`,minX:origin.x+x*tile-8,maxX:origin.x+(x+1)*tile+8,minY:origin.y+y*tile-8,maxY:origin.y+(y+1)*tile+8});
 for(const [i,s]of room.solids.entries())if(s.kind==='box'&&s.half&&!s.angle)boxes.push({id:`box:${i}`,minX:s.at.x-s.half.x-8,maxX:s.at.x+s.half.x+8,minY:s.at.y-s.half.y-8,maxY:s.at.y+s.half.y+8});
 const hit=sweepProbe(createLaunchWorld({boxes}),from,to,{radius:0,halfHeight:0,z:from.z},new Set());
 let best=hit?{time:hit.time,point:{x:hit.location.x,y:hit.location.y,z:from.z},normal:{x:hit.normal.x,y:hit.normal.y,z:0}}:null;
 // Continuous SAT: the source fixed-axis8uu pickup square versus an authored rotated Box. No radius substitute.
 for(const s of room.solids)if(s.kind==='box'&&s.half&&s.angle){
  const c=Math.cos(s.angle),sn=Math.sin(s.angle),axes=[[1,0],[0,1],[c,sn],[-sn,c]],px=from.x-s.at.x,py=from.y-s.at.y,dx=to.x-from.x,dy=to.y-from.y;
  let enter=0,exit=1,entryNormal={x:0,y:0,z:0},penetrationNormal={x:0,y:0,z:0},depth=Infinity,inside=true,possible=true;
  for(const[nx,ny]of axes){const range=8*(Math.abs(nx!)+Math.abs(ny!))+s.half.x*Math.abs(nx!*c+ny!*sn)+s.half.y*Math.abs(-nx!*sn+ny!*c),p=px*nx!+py*ny!,v=dx*nx!+dy*ny!;
   if(Math.abs(p)>range)inside=false;const gap=range-Math.abs(p);if(gap<depth){depth=gap;penetrationNormal={x:(p<0?-1:1)*nx!,y:(p<0?-1:1)*ny!,z:0};}
   if(v===0){if(Math.abs(p)>range){possible=false;break;}continue;}
   const a=(-range-p)/v,b=(range-p)/v,lo=Math.min(a,b),hi=Math.max(a,b);if(lo>enter){enter=lo;entryNormal={x:(v>0?-1:1)*nx!,y:(v>0?-1:1)*ny!,z:0};}exit=Math.min(exit,hi);if(enter>exit){possible=false;break;}
  }
  if(possible&&exit>=0&&enter<=1&&(!best||enter<best.time))best={time:enter,point:{x:from.x+dx*enter,y:from.y+dy*enter,z:from.z},normal:inside?penetrationNormal:entryNormal};
 }
 // Circle static vs moving box: relative motion turns this into a circle swept against the fixed box.
 const inverse=createLaunchWorld({boxes:[{id:'body',minX:-8,maxX:8,minY:-8,maxY:8}]});
 for(const s of room.solids)if(s.kind==='circle'){
  const a={x:s.at.x-from.x,y:s.at.y-from.y},b={x:s.at.x-to.x,y:s.at.y-to.y};
  const h=sweepProbe(inverse,a,b,{radius:s.radius??0,halfHeight:s.radius??0,z:0},new Set());
  if(h&&(!best||h.time<best.time))best={time:h.time,point:{x:from.x+(to.x-from.x)*h.time,y:from.y+(to.y-from.y)*h.time,z:from.z},normal:{x:-h.normal.x,y:-h.normal.y,z:0}};
 }
 return best;
}
function overlap(spike:Spike,hero:BP_ManeActor,from:Vec3,to:Vec3,dispatch=true):void{
 const state=spike.ug_pickupBox;if(!state)return;
 if(!collides(hero)||!queryProfileEnabled(hero)){state.touching=[];return;}
 const p=spike.K2_GetActorLocation(),r=hero.宽度,core=Math.max(hero.高度-r,0),gap=Math.max(0,Math.abs(to.z-p.z)-core-16);
 const effective=gap<=r?Math.sqrt(r*r-gap*gap):-1;
 const inside=effective>=0&&(Math.max(0,Math.abs(to.x-p.x)-8)**2+Math.max(0,Math.abs(to.y-p.y)-8)**2<=effective*effective);
 const was=state.touching.includes(hero.id);
 const hit=effective<0?null:sweepProbe(createLaunchWorld({boxes:[{id:'spike',minX:p.x-8,maxX:p.x+8,minY:p.y-8,maxY:p.y+8}]}),from,to,{radius:effective,halfHeight:effective,z:0},new Set());
 if(!was&&hit&&dispatch)spike.玩家重叠(hero);
 state.touching=inside?[hero.id]:[];
}
export function pickupBoxActorMove(w:World,actor:BP_ManeActor,from:Vec3,to:Vec3):void{if(actor!==w.mode.玩家角色)return;for(const spike of validSpikes(w))overlap(spike,actor,from,to);}
const jobs=new WeakMap<World,{step(dt:number):void;active():boolean}>();
const moving=(o:Spike)=>!!o.ug_pickupBox&&(o.ug_pickupBox.vx!==0||o.ug_pickupBox.vy!==0);
function arm(w:World):void{
 let job=jobs.get(w);if(!job){job={active:()=>validSpikes(w).some(moving),step:dt=>{for(const spike of validSpikes(w))if(moving(spike))step(spike,dt);}};jobs.set(w,job);}w.clock.addProcess(job);
}
function step(o:Spike,dt:number):void{
 const s=o.ug_pickupBox!,room=o.world.sys.room.view?.(o.world).room;
 const drag=Math.max(0,1-Math.fround(.01)*dt);s.vx*=drag;s.vy*=drag;
 // Same bounded Coulomb floor approximation already used by the actor solver; exact Chaos sleep is still a gap.
 const speed=Math.hypot(s.vx,s.vy),k=speed?Math.max(0,speed-392*dt)/speed:0;s.vx*=k;s.vy*=k;
 let remaining=dt;
 for(let n=0;n<4&&remaining>0&&(s.vx||s.vy);n++){
  const from=o.K2_GetActorLocation(),to={x:from.x+s.vx*remaining,y:from.y+s.vy*remaining,z:from.z},hit=room?staticHit(room,from,to):null;
  const vn=hit?s.vx*hit.normal.x+s.vy*hit.normal.y:0;
  const end=hit&&!(hit.time===0&&vn>=0)?hit.point:to;o.K2_SetActorLocation(end);
  const hero=o.world.mode.玩家角色;if(hero){const hp=hero.K2_GetActorLocation();overlap(o,hero,{x:hp.x+(end.x-from.x),y:hp.y+(end.y-from.y),z:hp.z},hp);}
  if(!hit||hit.time===0&&vn>=0)return;remaining*=1-hit.time;
  if(vn<0){s.vx-=2*vn*hit.normal.x;s.vy-=2*vn*hit.normal.y;const tx=-hit.normal.y,ty=hit.normal.x,vt=s.vx*tx+s.vy*ty,jt=Math.sign(vt)*Math.min(.4*(-2*vn),Math.abs(vt));s.vx-=jt*tx;s.vy-=jt*ty;}
 }
}

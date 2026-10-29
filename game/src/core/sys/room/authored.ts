import { AUTHORED_COMPONENTS } from './authored-components.ts';
import type { SolidBoxDef } from '../../launch/world.ts';
import type { RoomPlacement } from './decorations.ts';
import type { BpObject } from '../../sim/object.ts';
const WALL='CatapultHero/BP/环境/蓝图_空气墙';
type Child={readonly name:string;readonly class:string;readonly position:readonly number[];readonly half?:readonly number[];readonly angle?:number;readonly zHalf?:number};
export function authoredChildren(cls:string):readonly Child[]{return (AUTHORED_COMPONENTS as Readonly<Record<string,{children:readonly Child[]}>>)[cls]?.children??[];}
export function authoredDecorations(placements:readonly RoomPlacement[]):RoomPlacement[]{
 return placements.flatMap(p=>authoredChildren(p.cls).filter(c=>c.class!==WALL).map(c=>({...p,cls:c.class,at:{x:p.at.x+c.position[0]!,y:p.at.y+c.position[1]!,z:p.at.z+c.position[2]!}})));
}
/** Runtime children follow the same source positions as static collision; attachment owns teardown. */
export function createAuthoredChildren(parent:BpObject):void{
 const p=parent.K2_GetActorLocation();
 for(const c of authoredChildren(parent.def.path)){
  const child=parent.world.spawn(c.class,undefined,{x:p.x+c.position[0]!,y:p.y+c.position[1]!,z:p.z+c.position[2]!});child.K2_AttachToActor(parent);
 }
}
/** Exact inherited SCS transform; no enclosing AABB substitution. ChildBox spans remain height-limited source data. */
export function authoredAirwalls(placements:readonly RoomPlacement[]):SolidBoxDef[]{
 return placements.flatMap((p,i)=>authoredChildren(p.cls).flatMap(c=>{
  if(c.class!==WALL||!c.half)return[];const x=p.at.x+c.position[0]!,y=p.at.y+c.position[1]!,hx=c.half[0]!,hy=c.half[1]!;
  return[{id:`authored:${i}:${c.name}`,minX:x-hx,maxX:x+hx,minY:y-hy,maxY:y+hy,angle:c.angle,tags:['环境.房间.有弹性','环境.房间.墙壁']}];
 }));
}
export function insideSourceBox(x:number,y:number,b:SolidBoxDef):boolean{
 const cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2,a=-(b.angle??0),dx=x-cx,dy=y-cy;
 const u=dx*Math.cos(a)-dy*Math.sin(a),v=dx*Math.sin(a)+dy*Math.cos(a);
 return Math.abs(u)<=(b.maxX-b.minX)/2&&Math.abs(v)<=(b.maxY-b.minY)/2;
}

/** Exposed source Box edges near the playable side. These are presentation anchors, not extra colliders. */
export function authoredEdges(boxes:readonly SolidBoxDef[],floor:{width:number;depth:number;cells:Uint8Array;origin:{x:number;y:number}}):[number,number,number,number][]{
 const result:[number,number,number,number][]=[];
 const point=(b:SolidBoxDef,u:number,v:number)=>{const a=b.angle??0,c=Math.cos(a),s=Math.sin(a);return{x:(b.minX+b.maxX)/2+u*c-v*s,y:(b.minY+b.maxY)/2+u*s+v*c};};
 const edges=boxes.flatMap(b=>{const x=(b.maxX-b.minX)/2,y=(b.maxY-b.minY)/2,points=[point(b,-x,-y),point(b,x,-y),point(b,x,y),point(b,-x,y)];return points.map((p,i)=>({p,q:points[(i+1)%4]!,b}));});
 const nearFloor=(x:number,y:number)=>{const cx=Math.floor((x-floor.origin.x)/64),cy=Math.floor((y-floor.origin.y)/64);return cx>=0&&cy>=0&&cx<floor.width&&cy<floor.depth&&floor.cells[cy*floor.width+cx]===1;};
 for(const e of edges){const dx=e.q.x-e.p.x,dy=e.q.y-e.p.y,length=Math.hypot(dx,dy),ts=[0,1];
  for(const other of edges){if(e.b===other.b)continue;const x=other.q.x-other.p.x,y=other.q.y-other.p.y,den=dx*y-dy*x;if(Math.abs(den)<1e-9)continue;const ox=other.p.x-e.p.x,oy=other.p.y-e.p.y,t=(ox*y-oy*x)/den,u=(ox*dy-oy*dx)/den;if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);}
  ts.sort((a,b)=>a-b);
  for(let i=0;i<ts.length-1;i++){const a=ts[i]!,b=ts[i+1]!,t=(a+b)/2,m={x:e.p.x+dx*t,y:e.p.y+dy*t};if(boxes.some(o=>o!==e.b&&insideSourceBox(m.x,m.y,o)))continue;
   const nx=dy/length,ny=-dx/length;if(![1,16,32].some(d=>nearFloor(m.x+nx*d,m.y+ny*d)))continue;
   result.push([e.p.x+dx*a,e.p.y+dy*a,e.p.x+dx*b,e.p.y+dy*b]);
  }
 }
 return result;
}

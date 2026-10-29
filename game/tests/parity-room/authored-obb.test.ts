import{describe,it,expect}from'vitest';
import{createLaunchWorld,sweepProbe,probeOverlaps}from'../../src/core/launch/world.ts';
import{AUTHORED_COMPONENTS}from'../../src/core/sys/room/authored-components.ts';
const probe={radius:56,halfHeight:56,z:56},rotate=(x:number,y:number,a:number)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
describe('authored source child airwall OBB',()=>{
 const rows=AUTHORED_COMPONENTS['CatapultHero/BP/环境/首领房/蓝图_装饰品_首领背景A'].children;
 it('contains all16 extracted source walls and preserves rotated normals/contact coordinates for face and oblique sweeps',()=>{
  expect(rows).toHaveLength(16);
  for(const b of rows){
   const[x,y]=b.position,[hx,hy]=b.half,at=(u:number,v:number)=>{const p=rotate(u,v,b.angle);return{x:x!+p.x,y:y!+p.y};};
   const w=createLaunchWorld({boxes:[{id:b.name,minX:x!-hx!,maxX:x!+hx!,minY:y!-hy!,maxY:y!+hy!,angle:b.angle}]});
   const start=at(-hx!-200,0),end=at(hx!+200,0),hit=sweepProbe(w,start,end,probe,new Set())!;
   expect(hit.time).toBeCloseTo((200-56)/(2*hx!+400));const n=rotate(-1,0,b.angle);expect(hit.normal.x).toBeCloseTo(n.x);expect(hit.normal.y).toBeCloseTo(n.y);
   const surface=at(-hx!,0);expect(hit.impactPoint.x).toBeCloseTo(surface.x);expect(hit.impactPoint.y).toBeCloseTo(surface.y);
   const angled=sweepProbe(w,at(-hx!-200,-hy!*.5),at(hx!+200,hy!*.5),probe,new Set())!;expect(angled.time).toBeGreaterThan(0);expect(angled.time).toBeLessThan(1);
   expect(Math.hypot(angled.normal.x,angled.normal.y)).toBeCloseTo(1);
  }
 });
 it('rotated corner clearance is not replaced by its large enclosing AABB',()=>{
  const a=Math.PI/4,w=createLaunchWorld({boxes:[{id:'diagonal',minX:-100,maxX:100,minY:-10,maxY:10,angle:a}]});
  expect(probeOverlaps(w,{x:70,y:-70},{...probe,radius:2,halfHeight:2,z:2},new Set())).toBe(false);
  expect(probeOverlaps(w,{x:50,y:50},{...probe,radius:2,halfHeight:2,z:2},new Set())).toBe(true);
 });
 it('initial penetration and outgoing-touch conventions rotate without changing old AABB semantics',()=>{
  const a=.7,w=createLaunchWorld({boxes:[{id:'wall',minX:-100,maxX:100,minY:-10,maxY:10,angle:a}]});
  const hit=sweepProbe(w,rotate(0,0,a),rotate(0,100,a),probe,new Set())!;expect(hit.startPenetrating).toBe(true);expect(hit.penetrationDepth).toBeCloseTo(66);
  expect(sweepProbe(w,rotate(0,66,a),rotate(0,100,a),probe,new Set())).toBe(null);
 });
 it('tutorial child ancestry uses the inherited PaperSprite rotation rather than treating localZ as world height',()=>{
  const child=AUTHORED_COMPONENTS['CatapultHero/BP/环境/新手关/蓝图_装饰品_新手关02背景'].children.find(c=>c.name==='ChildActor8')!;
  expect(child.position[0]).toBeCloseTo(136);expect(child.position[1]).toBeCloseTo(-1321);expect(child.position[2]).toBeCloseTo(-116);
 });
});

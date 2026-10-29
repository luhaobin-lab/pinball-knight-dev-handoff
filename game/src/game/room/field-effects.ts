import * as THREE from'three';import type{FieldEffectView}from'../api';import type{RoomFrame}from'./build';
import{SpriteBatch}from'../../vfx/gpu';import{AIR_BIAS}from'../../vfx/spark';import{RAMPS}from'../../procgen/architecture/palette';import{BONE_WHITE,INK}from'../../vfx/palette';
import{ProjectileRibbons,type RibbonStrip}from'./projectile-ribbon';

/** Source callback phases: orb4frames@10fps for spawn/idle/die; blackhole User.黑洞大小128, duration from effect.
 * Only the visual silhouettes are retargeted to the existing ink/gold kit. No visual radius drives gameplay.
 */
export class FieldEffects{
 readonly group=new THREE.Group();private readonly size={value:new THREE.Vector2(960,540)};
 private batch:SpriteBatch|null=null;private readonly lightning=new ProjectileRibbons();
 constructor(private readonly frame:RoomFrame,private readonly ppt:number){this.group.name='SourceFieldEffects';this.group.add(this.lightning.mesh);}
 sync(effects:readonly FieldEffectView[],time:number,width=960,height=540):void{
  this.size.value.set(width,height);const visible=effects.filter(e=>e.phase!=='hidden'),sprites=visible.filter(e=>e.kind!=='lightning');
  if(!this.batch||sprites.length>this.batch.capacity){this.batch?.mesh.removeFromParent();this.batch?.dispose();this.batch=new SpriteBatch(2**Math.ceil(Math.log2(Math.max(16,sprites.length))),{
   pars:'uniform vec3 uGold;uniform vec3 uBone;uniform vec3 uInk;',
   body:`vec2 p=vPx;float r=length(p),R=vA.y,a=atan(p.y,p.x);float frame=vA.z;float age=vA.w;
    if(vA.x<.5){
     float edge=R*(.85+.08*sin(a*5.+frame*1.57));
     bool spark=abs(sin(a*4.+frame*1.57))>.96&&r>R*.85&&r<R*1.25;
     if(r>edge&&!spark)discard;
     color=spark||r>edge-1.5?uGold:r>edge-3.?uBone:uInk;
    }else{
     if(r>R)discard;float spiral=sin(a*3.+r/R*10.-age*6.2831853);
     color=r<R*.48?uInk:spiral>.6?uBone:spiral>.2?uGold:uInk;
    }`,uniforms:{uGold:{value:new THREE.Color(RAMPS.gold[3])},uBone:{value:new THREE.Color(BONE_WHITE)},uInk:{value:new THREE.Color(INK)}}},this.size);this.group.add(this.batch.mesh);}
  this.batch.clear();const lines:RibbonStrip[]=[];
  for(const e of visible){const p=this.frame.toTiles(e.position.x,e.position.y),age=Math.max(0,time-e.phaseAt);
   if(e.kind==='lightning'){
    if(!e.end)continue;const end=this.frame.toTiles(e.end.x,e.end.y),count=Math.max(1,e.segments??1),dx=end.x-p.x,dz=end.z-p.z,l=Math.hypot(dx,dz)||1;
    // Source initializes floor(distance/20) segments; both actual endpoints remain exact while target/source move.
    // SPEC-GAP: Niagara noise VM/width not decoded. Deterministic presentation-only zigzag uses20uu segmentation.
    lines.push({points:Array.from({length:count+1},(_,i)=>{const f=i/count,off=i===0||i===count?0:Math.sin((i*13+e.id*7+Math.floor(time*30))*2.399)*8/64;
     return{x:p.x+dx*f-dz/l*off,y:(e.position.z+(e.end!.z-e.position.z)*f)/64,z:p.z+dz*f+dx/l*off,t:time};}),width:4/64,life:1,color:RAMPS.gold[4],outline:false});continue;
   }
   const frame=Math.floor(age*10+1e-6)%4;
   // Measured alpha bounds of original orb atlas:7,13,18,24px at4uu/texel; reverse on source die.
   const diam=e.kind==='orb'?(e.phase==='spawn'?[7,13,18,24][Math.min(3,frame)]!:e.phase==='closing'?[24,18,13,7][Math.min(3,frame)]!:24)*4:128;
   const R=diam/128*this.ppt,box=2*Math.ceil(R*1.25)+3;
   this.batch.add({x:p.x,y:e.position.z/64,z:p.z,bias:AIR_BIAS,w:box,h:box,depth:'card'},[e.kind==='orb'?0:1,R,frame,time-e.startedAt]);
  }
  this.batch.commit();this.lightning.update(lines,time);
  this.group.userData.visible=visible.length;this.group.userData.orbs=visible.filter(e=>e.kind==='orb').length;
  this.group.userData.blackholes=visible.filter(e=>e.kind==='blackhole').length;this.group.userData.links=lines.length;
  this.group.userData.positions=visible.map(e=>({id:e.id,kind:e.kind,position:e.position,end:e.end,phase:e.phase}));
 }
 dispose():void{this.batch?.dispose();this.lightning.dispose();this.group.removeFromParent();}
}

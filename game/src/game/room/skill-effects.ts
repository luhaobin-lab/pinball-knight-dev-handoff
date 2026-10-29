import * as THREE from'three';
import type{GameView,PresentEvent,AfterimageView}from'../api';
import type{RoomFrame}from'./build';
import {BeetleKnight}from'../../procgen/creatures/beetle-knight';
import {SpriteBatch}from'../../vfx/gpu';
import {BONE_WHITE,INK}from'../../vfx/palette';
import {AIR_BIAS}from'../../vfx/spark';
import {SKILL_HALO,skillFrame,skillPose}from'../../anim/skill';
import type{ActorView}from'../views/actors';

type Animation=Extract<PresentEvent,{kind:'actor.anim'}>;
type GhostPart={source:THREE.Mesh;mesh:THREE.InstancedMesh;alpha:THREE.InstancedBufferAttribute;material:THREE.ShaderMaterial};
/** Source skill halo and copied animations replaying at fixed positions. Core owns lifetime, mirror and height. */
export class SkillEffects{
 readonly group=new THREE.Group();
 private readonly animations=new Map<number,Animation>();
 private readonly size={value:new THREE.Vector2(960,540)};
 private readonly halo:SpriteBatch;
 private readonly template=new BeetleKnight();
 private readonly parts:GhostPart[]=[];
 private capacity=0;
 constructor(private readonly frame:RoomFrame,private readonly ppt:number){
  this.group.name='SourceSkillEffects';
  this.halo=new SpriteBatch(16,{pars:'uniform vec3 uBone;uniform vec3 uInk;',body:`
    vec2 p=vPx;float kind=vA.x;vec2 extent=max(vec2(1.),vA.yz*.5);float d=length(p/extent);
    bool on=false;
    if(kind<.5)on=d<1.&&d>.65;
    else if(kind<1.5)on=abs(p.x)/extent.x+abs(p.y)/extent.y<1.;
    else if(kind<2.5)on=abs(abs(p.x)-abs(p.y))<.9&&max(abs(p.x)/extent.x,abs(p.y)/extent.y)<1.;
    else on=abs(p.x)<.8&&abs(abs(p.y)-extent.y*.65)<.8;
    if(!on)discard;color=uBone;`,uniforms:{uBone:{value:new THREE.Color(BONE_WHITE)},uInk:{value:new THREE.Color(INK)}}},this.size);
  this.group.add(this.halo.mesh);
 }
 event(e:PresentEvent):void{
  if(e.kind==='actor.anim'){
   if(skillPose(e.sequence))this.animations.set(e.id,e);else this.animations.delete(e.id);
  }else if(e.kind==='launch.start')this.animations.delete(e.hero);
  else if(e.kind==='actor.despawn'||e.kind==='actor.die')this.animations.delete(e.id);
 }
 sync(view:GameView,camera:THREE.Camera,actor:(id:number)=>ActorView|undefined,width=960,height=540):void{
  this.size.value.set(width,height);this.halo.clear();
  for(const[id,a]of this.animations){
   const frame=skillFrame(view.time-a.t,a.seconds),v=actor(id);if(frame<0||!v){this.animations.delete(id);continue;}
   const pose=SKILL_HALO[frame]!,scale=4/64*this.ppt;
   // Source atlas halo centre is13texturepx above the helmet. The reskin has a horn, so anchor above its actual
   // projected helmet bounds; worldY alone under the oblique stand transform can bury the star behind the horn.
   const helmet=v.group?.getObjectByName('knight-helmet'),anchor=new THREE.Vector3(v.x,v.top,v.z);
   if(helmet){helmet.updateWorldMatrix(true,true);let top=-Infinity;const point=new THREE.Vector3();
    helmet.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const vertices=o.geometry.getAttribute('position');for(let i=0;i<vertices.count;i++)top=Math.max(top,point.fromBufferAttribute(vertices,i).applyMatrix4(o.matrixWorld).project(camera).y);});
    anchor.project(camera);anchor.y=top+(13*scale)*2/height;anchor.unproject(camera);
   }
   this.halo.add({x:anchor.x,y:anchor.y,z:anchor.z,bias:AIR_BIAS,w:pose.width*scale+3,h:pose.height*scale+3,depth:'card'},[pose.kind,pose.width*scale,pose.height*scale,0]);
  }
  this.halo.commit();this.syncGhosts(view.afterimages??[],camera,view.hero?.id??null);
  this.group.userData.halos=this.halo.size;
 }
 private reserve(count:number):void{
  if(count<=this.capacity)return;
  for(const p of this.parts){p.mesh.removeFromParent();p.mesh.dispose();p.mesh.geometry.dispose();p.material.dispose();}this.parts.length=0;
  this.capacity=2**Math.ceil(Math.log2(Math.max(1,count)));
  this.template.body.traverse(o=>{
   if(!(o instanceof THREE.Mesh)||!(o.material instanceof THREE.ShaderMaterial))return;
   const geometry=o.geometry.clone(),alpha=new THREE.InstancedBufferAttribute(new Float32Array(this.capacity),1);alpha.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('aGhostAlpha',alpha);
   const material=o.material.clone();material.side=THREE.DoubleSide;material.vertexShader='in float aGhostAlpha;out float vGhostAlpha;\n'+material.vertexShader.replace('void main() {','void main() {vGhostAlpha=aGhostAlpha;');
   material.fragmentShader='in float vGhostAlpha;\n'+material.fragmentShader.replace('void main() {',`void main() {
    const int M[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
    ivec2 pixel=ivec2(gl_FragCoord.xy);if(vGhostAlpha<=(float(M[(pixel.y&3)*4+(pixel.x&3)])+.5)/16.)discard;`);
   material.needsUpdate=true;
   const mesh=new THREE.InstancedMesh(geometry,material,this.capacity);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);this.parts.push({source:o,mesh,alpha,material});
  });
 }
 private syncGhosts(images:readonly AfterimageView[],camera:THREE.Camera,hero:number|null):void{
  const ghosts=images.filter(i=>i.owner===hero);this.reserve(ghosts.length);
  for(let i=0;i<ghosts.length;i++){
   const g=ghosts[i]!,p=this.frame.toTiles(g.position.x,g.position.y),pose=g.sequence?skillPose(g.sequence):null;
   this.template.position.set(p.x,p.z);this.template.setSkillPose(pose,g.sequence?skillFrame(g.animationAge,g.animationSeconds):-1);
   this.template.update(0,camera);this.template.group.updateMatrixWorld(true);
   // Source copies PaperFlipbook relative transform, not actor yaw. Mirror around this fixed image's screenX
   // anchor (UE+Y), and lift by actual actorZ above its captured ground baseline; never mirror the world origin.
   const transform=new THREE.Matrix4().makeTranslation(p.x,(g.position.z-g.ownerHeight)/64,p.z)
     .multiply(new THREE.Matrix4().makeScale(g.facing,1,1)).multiply(new THREE.Matrix4().makeTranslation(-p.x,0,-p.z));
   for(const part of this.parts){let visible=true;for(let p:THREE.Object3D|null=part.source;p;p=p.parent)if(!p.visible)visible=false;
    part.mesh.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(transform,part.source.matrixWorld));part.alpha.setX(i,visible?Math.max(0,1-g.dissolve/20):0);}
  }
  for(const p of this.parts){p.mesh.count=ghosts.length;p.mesh.instanceMatrix.needsUpdate=true;p.alpha.needsUpdate=true;}
  this.group.userData.afterimages=ghosts.length;
  // SPEC-GAP: original Mat_SpritBaseTranLit scalar-to-alpha shader is stripped; normalized source20 dissolve uses ordered dither.
 }
 dispose():void{
  this.halo.dispose();for(const p of this.parts){p.mesh.dispose();p.mesh.geometry.dispose();p.material.dispose();}
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();this.template.group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();this.parts.length=0;this.animations.clear();this.group.removeFromParent();
 }
}

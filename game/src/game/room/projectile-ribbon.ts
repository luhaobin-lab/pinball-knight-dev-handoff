import * as THREE from 'three';
import { vfxMaterial } from '../../vfx/gpu';
import { BONE_WHITE, INK } from '../../vfx/palette';
import { TRAIL_LIFT } from '../../vfx/trail';

export interface RibbonSample { readonly x:number; readonly y:number; readonly z:number; readonly t:number }
export interface RibbonStrip { readonly points:readonly RibbonSample[]; readonly width:number; readonly life:number; readonly color?:string; readonly chain?:boolean;readonly outline?:boolean }

/** One connected strip per real projectile path. Adjacent segments share the same pair of vertices: only the two
 * outer sides receive ink, never internal sample boundaries. Width is source uu converted to room tiles.
 */
export class ProjectileRibbons {
  readonly geometry=new THREE.BufferGeometry();
  readonly material=vfxMaterial({
    vertexPars:'in float aSide; in float aAlpha; in vec3 aTint; in vec2 aChain; out float vSide; out float vAlpha; out vec3 vTint; out vec2 vChain; uniform float uLift;',
    vertex:'vSide=aSide;vAlpha=aAlpha;vTint=aTint;vChain=aChain;vec4 p=modelViewMatrix*vec4(position,1.);p.z+=uLift;gl_Position=projectionMatrix*p;',
    fragmentPars:'in float vSide; in float vAlpha; in vec3 vTint; in vec2 vChain; uniform vec3 uInk;',
    fragment:`if(vAlpha<=bayer4(ivec2(gl_FragCoord.xy)))discard;
      float edge=max(fwidth(vSide),.0001);
      if(vChain.y>1.5)color=vTint;
      else if(vChain.y>.5){float u=fract(vChain.x/36.);float ring=length(vec2((u-.5)*2.,vSide));if(ring>.95||ring<.5)discard;color=ring>.8||ring<.64?uInk:vTint;}
      else color=abs(vSide)>1.-edge?uInk:abs(vSide)<edge*.7?vTint*.65:vTint;`,
    uniforms:{uLift:{value:TRAIL_LIFT},uInk:{value:new THREE.Color(INK)}},
  });
  readonly mesh=new THREE.Mesh(this.geometry,this.material);
  private capacity=0;
  constructor(){this.material.side=THREE.DoubleSide;this.mesh.frustumCulled=false;this.mesh.name='SourceArrowRibbons';}
  update(strips:readonly RibbonStrip[],now:number):number{
    const count=strips.reduce((n,s)=>n+s.points.length*2,0);
    if(count>this.capacity){
      this.capacity=2**Math.ceil(Math.log2(Math.max(16,count)));
      for(const[name,size]of[['position',3],['aSide',1],['aAlpha',1],['aTint',3],['aChain',2]]as const)this.geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(this.capacity*size),size).setUsage(THREE.DynamicDrawUsage));
      this.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(this.capacity*3),1).setUsage(THREE.DynamicDrawUsage));
    }
    if(!this.capacity){this.mesh.visible=false;return 0;}
    const pos=this.geometry.getAttribute('position'),side=this.geometry.getAttribute('aSide'),alpha=this.geometry.getAttribute('aAlpha'),index=this.geometry.getIndex()!;
    const tint=this.geometry.getAttribute('aTint'),chain=this.geometry.getAttribute('aChain');
    let vertex=0,indices=0,segments=0;
    const normal=(a:RibbonSample,b:RibbonSample)=>{const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);return l>0?{x:-dz/l,z:dx/l}:{x:0,z:0};};
    for(const strip of strips){
      const points=strip.points;if(points.length<2)continue;const base=vertex;
      const color=new THREE.Color(strip.color??BONE_WHITE);let length=0;
      for(let i=0;i<points.length;i++){
        const p=points[i]!,prev=normal(points[Math.max(0,i-1)]!,p),next=normal(p,points[Math.min(points.length-1,i+1)]!);
        if(i)length+=Math.hypot(p.x-points[i-1]!.x,p.z-points[i-1]!.z)*64;
        let nx=prev.x+next.x,nz=prev.z+next.z,l=Math.hypot(nx,nz);if(l<1e-7){nx=next.x||prev.x;nz=next.z||prev.z;l=Math.hypot(nx,nz)||1;}nx/=l;nz/=l;
        const n=i===points.length-1?prev:next,dot=Math.abs(nx*n.x+nz*n.z),half=strip.width*.5;
        // Limit the miter of an almost180° contact; shared vertices still seal the turn without an internal cap.
        const scale=half/Math.max(.25,dot);
        for(const sign of[-1,1]){pos.setXYZ(vertex,p.x+nx*scale*sign,p.y,p.z+nz*scale*sign);side.setX(vertex,sign);alpha.setX(vertex,Math.max(0,1-(now-p.t)/strip.life));tint.setXYZ(vertex,color.r,color.g,color.b);chain.setXY(vertex,length,strip.chain?1:strip.outline===false?2:0);vertex++;}
        if(i>0){const a=base+(i-1)*2,b=base+i*2;for(const n of[a,a+1,b,a+1,b+1,b])index.setX(indices++,n);segments++;}
      }
    }
    for(const attr of[pos,side,alpha,tint,chain,index] as THREE.BufferAttribute[]){attr.clearUpdateRanges();attr.addUpdateRange(0,attr===index?indices:vertex*attr.itemSize);attr.needsUpdate=true;}
    this.geometry.setDrawRange(0,indices);this.mesh.visible=indices>0;return segments;
  }
  dispose():void{this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}

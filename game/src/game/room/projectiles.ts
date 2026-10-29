import * as THREE from 'three';
import type { ProjectileView } from '../api';
import type { RoomFrame } from './build';
import { SpriteBatch, type SpriteSpec } from '../../vfx/gpu';
import { BONE_WHITE, BONE_DIM, INK } from '../../vfx/palette';
import { ProjectileRibbons, type RibbonStrip } from './projectile-ribbon';
import { RAMPS } from '../../procgen/architecture/palette';
import { AIR_BIAS } from '../../vfx/spark';

/** Source Niagara overrides: arrow User.生命=1.5, User.轨迹宽度=32; base airblade width48.
 * Tornado A/B/C SpawnScript literals .3/.6/.8, sprite sheets6/6/8. Only the silhouette is the approved bone/ink
 * procedural reskin. Exact source texture shapes/particle curves still require original runtime comparison.
 * This layer reads actual positions; it never predicts hits, moves a projectile or controls its lifetime.
 */
export const PROJECTILE_ART = { arrowLife:1.5, arrowWidth:32, bladeWidth:48, tornadoStart:.3, tornadoLoop:.6, tornadoEnd:.8 } as const;
type Sample = { x:number; y:number; z:number; t:number };
type Track = { view:ProjectileView; samples:Sample[] };
type Draw = { spec:SpriteSpec; params:number[] };

const PARS = /* glsl */ `
uniform vec3 uBone; uniform vec3 uDim; uniform vec3 uInk; uniform vec3 uSmoke; uniform vec3 uSpirit;
bool shape(vec2 p) {
  float kind=vA.x;
  float radius=vA.y, a=atan(p.y,p.x)+vA.w, r=length(p);
  if(kind>4.5) { vec2 q=vec2(cos(a),sin(a))*r; return abs(q.x)/radius+abs(q.y)/(radius*.35)<1.; }
  if(kind>3.5)return r<radius*.62||(r<radius&&r>radius*.84);
  if(kind>2.5)return r<radius*(.82+.1*sin(a*5.+vA.w)+.07*sin(a*3.-vA.w));
  if(kind<1.5) return r<radius && r>radius*.65 && abs(atan(sin(a),cos(a)))<2.5;
  // Bone-white wind bands follow the existing crescent vocabulary, stepped through the source subimages.
  float band=mod(a+6.2831853,3.14159265)/3.14159265;
  float edge=radius*(.42+.55*band);
  return r<edge && r>edge-radius*.16 && r>radius*.25;
}`;
const BODY = /* glsl */ `
  if(vA.z<=bayer4(ivec2(gl_FragCoord.xy)))discard;
  if(shape(vPx))color=vA.x>4.5?(vPx.y<0.?uDim:uBone):vA.x>3.5?mix(uSpirit,uBone,clamp(1.-length(vPx)/vA.y,0.,1.)):vA.x>2.5?mix(uSmoke*.25,uSmoke,clamp(1.-length(vPx)/vA.y,0.,1.)):abs(vPx.y)<.75?uDim:uBone;
  else if(shape(vPx+vec2(1,0))||shape(vPx-vec2(1,0))||shape(vPx+vec2(0,1))||shape(vPx-vec2(0,1)))color=uInk;
  else discard;`;

/** Instanced source projectile bodies/trails, independent of hero/enemy views. */
export class ProjectileStage {
  readonly group = new THREE.Group();
  private readonly tracks = new Map<number,Track>();
  private batch: SpriteBatch | null = null;
  private readonly ribbons=new ProjectileRibbons();
  private readonly size = { value:new THREE.Vector2(960,540) };
  constructor(private readonly frame: RoomFrame, private readonly ppt=24) { this.group.name='SourceProjectiles';this.group.add(this.ribbons.mesh); }

  sync(projectiles:readonly ProjectileView[], now:number, width=960, height=540):void {
    this.size.value.set(width,height);
    const seen=new Set<number>();
    for(const p of projectiles){
      seen.add(p.id);
      let track=this.tracks.get(p.id);
      if(!track){track={view:p,samples:[]};this.tracks.set(p.id,track);}
      track.view=p;
      const samples=track.samples,last=samples.at(-1);
      // Include the true stopping point once; never append a stationary tail on subsequent stopped frames.
      if(p.active!==false||p.stopped&&(!last||last.t<(p.stoppedAt??now))){
        const at=p.position,t=p.stoppedAt??now;
        if(!last||last.x!==at.x||last.y!==at.y||last.z!==at.z)samples.push({...at,t});
      }
      while(samples.length>1&&now-samples[1]!.t>PROJECTILE_ART.arrowLife)samples.shift();
    }
    // Source objects survive the .5s wait release plus2s destruction delay. Retirement follows the actual view.
    for(const id of this.tracks.keys())if(!seen.has(id))this.tracks.delete(id);
    const draws:Draw[]=[];
    const strips:RibbonStrip[]=[];
    const unmapped=new Set<string>();
    for(const {view:p,samples} of this.tracks.values()){
      const at=this.frame.toTiles(p.position.x,p.position.y),z=p.position.z/64;
      const arrow=/箭矢|弹跳箭/.test(p.cls),tornado=p.cls.endsWith('蓝图_发射物_旋风01');
      const blade=p.cls.endsWith('蓝图_发射物_剑气'),ray=p.cls.endsWith('蓝图_发射物_灼热射线'),poison=p.cls.endsWith('蓝图_发射物_毒气'),hook=p.cls.endsWith('蓝图_发射物_抓钩');
      const spirit=p.cls.endsWith('蓝图_发射物_齐刘海飞弹'),crystal=p.cls.endsWith('蓝图_发射物_晶刺');
      if(!arrow&&!tornado&&!blade&&!ray&&!poison&&!hook&&!spirit&&!crystal){unmapped.add(p.cls);continue;}
      if(crystal){
        // Raw source asset 粒子_轨迹_晶石碎片 uses a4x1 shard sheet, not the slash/arrow shape.
        // SPEC-GAP: NiagaraVM extent/fade/subimage timing is not decoded. This bone shard uses actual24uu radius,
        // current source position/direction and the already approved finite.4s presentation tail after source stop.
        const age=p.stoppedAt===undefined?0:now-p.stoppedAt,alpha=Math.max(0,1-age/.4),radius=(p.radius??24)/64*this.ppt;
        const v=p.velocity,dir=v&&Math.hypot(v.x,v.y)>0?v:{x:Math.cos((p.yaw??0)*Math.PI/180),y:Math.sin((p.yaw??0)*Math.PI/180)};
        const d=this.frame.directionToTiles(dir.x,dir.y),phase=-Math.atan2(-d.z*.625,d.x),box=2*Math.ceil(radius)+3;
        if(alpha>0)draws.push({spec:{x:at.x,y:z,z:at.z,bias:AIR_BIAS,w:box,h:box,depth:'card'},params:[5,radius,alpha,phase]});
        continue;
      }
      if(spirit){
        // Source is a sprite/trail mix (自愈+眩晕4-frame sheets), not an airblade. Actual movement/stop own the orb.
        // SPEC-GAP: NiagaraVM particle extent/phase curves remain unmeasured; use the actual20uu contact radius.
        const age=p.stoppedAt===undefined?0:now-p.stoppedAt,alpha=Math.max(0,1-age/.4),radius=(p.radius??20)/64*this.ppt,box=2*Math.ceil(radius)+3;
        if(alpha>0)draws.push({spec:{x:at.x,y:z,z:at.z,bias:AIR_BIAS,w:box,h:box,depth:'card'},params:[4,radius,alpha,0]});
        continue;
      }
      if(arrow||ray||hook){
        // Raw BP overrides: arrow32/1.5; hook Niagara1 24/.75; ray width64 with1.5s spawn-script lifetime.
        const life=hook ? .75 : 1.5,width=ray?64:hook?24:32;
        if(samples.length>1&&now-samples.at(-1)!.t<life)strips.push({points:samples.map(p=>{const at=this.frame.toTiles(p.x,p.y);return{x:at.x,y:p.z/64,z:at.z,t:p.t};}),width:width/64,life,...(ray?{color:RAMPS.wax[3]}:{})});
        if(hook&&p.sourcePosition){
          const source=this.frame.toTiles(p.sourcePosition.x,p.sourcePosition.y),end={x:source.x,y:(p.sourcePosition.z+2)/64,z:source.z};
          // Source hook ReceiveTick L884 sets endpoint=source position+Z2; Niagara30 segments, material tile36uu.
          // SPEC-GAP: source rope width/sag VM is not decoded; use its companion24uu ribbon width and a straight rope.
          strips.push({points:Array.from({length:31},(_,i)=>({x:at.x+(end.x-at.x)*i/30,y:z+(end.y-z)*i/30,z:at.z+(end.z-at.z)*i/30,t:now})),width:24/64,life:1,chain:true});
        }
        continue;
      }
      if(poison){
        // Raw source smoke User.生成速率=3,HitSize128; spawn life max1.5. Exact VM random scatter is a visual gap.
        const start=p.startedAt??now,stop=p.stoppedAt??now;
        for(let n=Math.max(0,Math.ceil((now-start-1.5)*3));n<=Math.floor((stop-start)*3);n++){
          const born=start+n/3,age=now-born;if(age<0||age>=1.5)continue;
          let point=samples[0]??{...p.position,t:born};for(const q of samples){if(q.t>born)break;point=q;}
          const at=this.frame.toTiles(point.x,point.y),radius=64/64*this.ppt,box=2*Math.ceil(radius)+3;
          draws.push({spec:{x:at.x,y:point.z/64,z:at.z,bias:AIR_BIAS,w:box,h:box,depth:'card'},params:[3,radius,1-age/1.5,age*2*Math.PI+n]});
        }
        continue;
      }
      const age=Math.max(0,now-(p.startedAt??now)),stoppedAge=p.stoppedAt===undefined?null:Math.max(0,now-p.stoppedAt);
      // 剑气 source Niagara User.轨迹宽度64 is a full width, independent of its gameplay sphere radius64.
      let alpha=1,phase=0,radius=(blade?32:(p.radius??24))/64*this.ppt;
      if(tornado){
        if(stoppedAge!==null){alpha=Math.max(0,1-stoppedAge/PROJECTILE_ART.tornadoEnd);phase=Math.floor(stoppedAge/PROJECTILE_ART.tornadoEnd*8)/8*Math.PI*2;}
        else if(age<PROJECTILE_ART.tornadoStart){radius*=Math.min(1,(Math.floor(age/PROJECTILE_ART.tornadoStart*6)+1)/6);phase=Math.floor(age/PROJECTILE_ART.tornadoStart*6)/6*Math.PI*2;}
        else phase=Math.floor((age-PROJECTILE_ART.tornadoStart)%PROJECTILE_ART.tornadoLoop/PROJECTILE_ART.tornadoLoop*6)/6*Math.PI*2;
      }else{
        // SPEC-GAP: exact non-arrow Niagara fade curve is not decoded; retain the approved slash's finite .4s tail.
        alpha=stoppedAge===null?1:Math.max(0,1-stoppedAge/.4);
        const v=p.velocity,dir=v&&Math.hypot(v.x,v.y)>0?v:{x:Math.cos((p.yaw??0)*Math.PI/180),y:Math.sin((p.yaw??0)*Math.PI/180)};
        const d=this.frame.directionToTiles(dir.x,dir.y);phase=-Math.atan2(d.z,d.x)+Math.PI/2; // source sprite rotation = ActorYaw+90.
      }
      if(alpha<=0)continue;
      const box=2*Math.ceil(radius)+3;
      draws.push({spec:{x:at.x,y:z,z:at.z,bias:AIR_BIAS,w:box,h:box,depth:'card'},params:[tornado?2:1,radius,alpha,phase]});
    }
    if(!this.batch||draws.length>this.batch.capacity){
      this.batch?.mesh.removeFromParent();this.batch?.dispose();
      this.batch=new SpriteBatch(2**Math.ceil(Math.log2(Math.max(16,draws.length))),{pars:PARS,body:BODY,uniforms:{uSpirit:{value:new THREE.Color(RAMPS.violetCap[3])},uSmoke:{value:new THREE.Color(RAMPS.verdigris[3])},uBone:{value:new THREE.Color(BONE_WHITE)},uDim:{value:new THREE.Color(BONE_DIM)},uInk:{value:new THREE.Color(INK)}}},this.size);
      this.group.add(this.batch.mesh);
    }
    this.batch.clear();for(const d of draws)this.batch.add(d.spec,d.params);this.batch.commit();
    const segments=this.ribbons.update(strips,now);
    this.group.userData.projectiles=this.tracks.size;this.group.userData.visibleSprites=draws.length+segments;
    this.group.userData.unmapped=[...unmapped];
  }
  dispose():void { this.ribbons.dispose();this.batch?.dispose();this.batch=null;this.tracks.clear();this.group.removeFromParent(); }
}

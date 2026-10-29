import * as THREE from 'three';
import type { PixelRenderer, PointLight } from '../../render/api';
import { buildRoom, type BuiltRoom } from '../../procgen/architecture/room';
import { layoutFromAscii } from '../../procgen/architecture/layout';
import { placeholderProp, type PlaceholderProp } from '../../procgen/placeholder/props';
import { isSharedSculptGeometry } from '../../procgen/placeholder/sculpt';
import { aimOblique, applyCryptLight, obliqueTargetAt } from './stage';
import type { GameView } from '../api';

/** Source chapter hub: central praying statue/raised altar, two lateral portals, braziers. Existing approved
 * fungal room/prop kit supplies the reskin. Footprints use statue_room screenshots; no imported sprite is shipped.
 * SPEC-GAP: original baked background contour and Niagara water/heat distortion are not reproduced by this kit.
 */
export class CampStage {
 readonly group=new THREE.Group();private room:BuiltRoom;private props:PlaceholderProp[]=[];private lights:PointLight[]=[];
 private statue:PlaceholderProp;private portals:PlaceholderProp[]=[];private altar:PlaceholderProp;
 constructor(private renderer:PixelRenderer,seed:number,private title=false){
  this.group.name='source-chapter-hub';
  this.room=buildRoom({layout:layoutFromAscii(['####################',...Array.from({length:12},()=>'#..................#'),'####################']),seed,northHeight:1.4,lowHeight:.35,dressing:.35,
   candles:[{x:2,z:2,count:4,radius:.3,lit:1},{x:17,z:2,count:4,radius:.3,lit:1}],fungi:[{x:3,z:1.5,count:4,species:'mycena',scale:.8},{x:16,z:1.5,count:4,species:'mycena',scale:.8}]});
  this.room.group.position.set(-10,0,-8);this.group.add(this.room.group);
  const prop=(kind:Parameters<typeof placeholderProp>[0],x:number,z:number)=>{const p=placeholderProp(kind,{seed});p.place(x,z);this.group.add(p.group);this.props.push(p);for(const l of p.lights)this.lights.push(renderer.addPointLight(l));return p;};
  this.statue=prop('statue',0,-296/64);this.altar=prop('altar',0,-.2);
  this.portals=[prop('portal',0,238/64),prop('portal',-447/64,-208/64),prop('portal',447/64,-208/64)];
  prop('brazier',-4,-2.7);prop('brazier',4,-2.7);prop('candles',-2,1.5);prop('candles',2,1.5);
  renderer.scene.add(this.group);applyCryptLight(renderer);
  const t=obliqueTargetAt(renderer,0,0,title?480:624,title?360:270,title?48:24);aimOblique(renderer,t.x,t.z,title?48:24);
 }
 update(v:GameView,dt:number):void{
  this.group.visible=this.title||!!v.camp&&!v.stash;this.room.update(this.renderer.time,dt);for(const p of this.props)p.update(this.renderer.time);
  this.statue.group.visible=this.title||(v.camp?.statue.unlocked??false);
  // Source damaged form retains the altar. The full praying statue appears only after the unlock.
  this.altar.group.visible=true;this.portals.forEach((p,i)=>{const source=v.camp?.portals?.[i];p.group.visible=!!source;p.body.scale.setScalar(source?.size??1);});
 }
 dispose():void{
  this.group.removeFromParent();this.room.dispose();for(const l of this.lights)this.renderer.removeLight(l);
  const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();for(const p of this.props)p.group.traverse(o=>{if(o instanceof THREE.Mesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});
  for(const g of gs)if(!isSharedSculptGeometry(g))g.dispose();for(const m of ms)m.dispose();
 }
}

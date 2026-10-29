import * as THREE from 'three';
import { createToonMaterial } from '../../render/api';
import type { TerrainView } from '../api';
import { CYCLES, RAMPS } from '../../procgen/architecture/palette';
import type { RoomFrame } from './build';

/** Runtime-only reskin of source lava cells: exact 64uu footprint, source callback state, approved blood-red ramp.
 * Reuses the deferred toon shader. Instancing keeps all warnings visible without one draw call per cell.
 */
export class TerrainStage {
  readonly group = new THREE.Group();
  private capacity = 0;
  private readonly geo = new THREE.BoxGeometry(1,1,1);
  private readonly dark = createToonMaterial({ ramp:RAMPS.vermilion.slice(0,2), outline:false, emissive:'#451010', emissiveIntensity:0 });
  private readonly red = createToonMaterial({ ramp:RAMPS.vermilion.slice(0,4), outline:false, emissive:'#8E1E1E', emissiveIntensity:.15 });
  private readonly hot = createToonMaterial({ ramp:RAMPS.vermilion, outline:false, emissive:'#FFB09A', emissiveIntensity:.65 });
  private readonly acidDark=createToonMaterial({ramp:RAMPS.mold.slice(0,3),outline:false});
  private readonly acid=createToonMaterial({ramp:CYCLES.foxfire.slice(1,6),outline:false,emissive:'#36A94A',emissiveIntensity:.3});
  private readonly acidFoam=createToonMaterial({ramp:CYCLES.foxfire.slice(3),outline:false,emissive:'#A8F59C',emissiveIntensity:.2});
  private readonly ghost=createToonMaterial({ramp:CYCLES.violet.slice(0,6),outline:false,emissive:'#8441BF',emissiveIntensity:.25});
  private readonly ghostGlow=createToonMaterial({ramp:CYCLES.violet.slice(3),outline:false,emissive:'#D3A6F6',emissiveIntensity:.3});
  private readonly spike=createToonMaterial({ramp:RAMPS.bone,outline:true});
  private readonly lightning=createToonMaterial({ramp:CYCLES.violet.slice(3),outline:false,emissive:'#F7EAFF',emissiveIntensity:.4});
  private readonly ward=createToonMaterial({ramp:RAMPS.bone,outline:false,emissive:'#BDC9DF',emissiveIntensity:.25});
  private meshes: THREE.InstancedMesh[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(private readonly frame: RoomFrame) { this.group.name='SourceTerrain'; }
  sync(terrain: readonly TerrainView[], time: number): void {
    const cells=terrain.filter(t=>(t.kind==='lava'||t.kind==='acid'||t.kind==='ghost'||t.kind==='caltrop'||t.kind==='spikes'||t.kind==='shield')&&t.state!=='hidden').flatMap(t=>t.cells.map(at=>({t,at})));
    const beams=terrain.flatMap(t=>t.kind==='beam'?t.beams??[]:[]);
    const need=Math.max(1,cells.length*36+beams.length);
    if(need>this.capacity){
      for(const mesh of this.meshes){mesh.removeFromParent();mesh.dispose();}
      this.capacity=2**Math.ceil(Math.log2(need));
      this.meshes=[this.dark,this.red,this.hot,this.acidDark,this.acid,this.acidFoam,this.ghost,this.ghostGlow,this.spike,this.lightning,this.ward].map(material=>{
        const mesh=new THREE.InstancedMesh(this.geo,material,this.capacity);mesh.frustumCulled=false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);return mesh;
      });
    }
    const counts=[0,0,0,0,0,0,0,0,0,0,0];
    const box=(m:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
      this.matrix.compose(this.p.set(x,y,z),this.q,this.scale.set(sx,sy,sz));this.meshes[m]!.setMatrixAt(counts[m]!++,this.matrix);
    };
    for(const {t,at} of cells){
      const p=this.frame.toTiles(at[0],at[1]),age=Math.max(0,time-(t.startedAt??time));
      if(t.kind==='spikes'){
        // Source64uu cells; IdleA frame1,Swpn frame2(.2s)→3,Finish3(.1)→2(.3)→1(.2)→0.
        const level=t.state==='erupting'?(age<.2?2:3):t.state==='closing'?(age<.1?3:age<.4?2:age<.6?1:0):1;
        box(0,p.x,.025,p.z,.94,.035,.94);
        for(const x of[-.25,.25])for(const z of[-.25,.25]){box(level>1?1:8,p.x+x,.05+level*.1,p.z+z,.12,.04+level*.2,.12);}
        continue;
      }
      if(t.kind==='shield'){
        // Source's visual mask expands to160+heroheight; immunity test remains source centre-distance<=160.
        const ready=t.state==='warning',r=ready?50/64:(t.visualRadius??t.radius??160)/64*(t.scale??1);
        if(r>0)for(let n=0;n<32;n++){
          const a=n/32*Math.PI*2;this.q.setFromAxisAngle(new THREE.Vector3(0,1,0),-a+Math.PI/2);
          box(10,p.x+Math.cos(a)*r,.06,p.z+Math.sin(a)*r,r*2*Math.tan(Math.PI/32),.035,.04);this.q.identity();
        }
        if(ready){box(10,p.x,.45,p.z,.22,.5,.22);box(10,p.x,.45,p.z,.5,.22,.22);}
        continue;
      }
      if(t.kind==='caltrop'){
        box(8,p.x,.08,p.z,.25,.05,.06);box(8,p.x,.08,p.z,.06,.05,.25);box(8,p.x,.18,p.z,.06,.3,.06);continue;
      }
      const closing=t.state==='closing',fade=closing?Math.max(0,1-age/(t.kind==='ghost'?2:.6)):1;
      if(fade===0)continue;
      if(t.kind==='ghost'){
        // Source ghost pool stops emission on destruction and retains its actor2s. Exact Niagara fade is a visual gap.
        box(6,p.x,.022,p.z,.94*fade,.025,.94*fade);
        box(7,p.x-.31,.05,p.z,.06*fade,.035,.7*fade);box(7,p.x+.31,.05,p.z,.06*fade,.035,.7*fade);
        box(7,p.x,.05,p.z-.31,.7*fade,.035,.06*fade);box(7,p.x,.05,p.z+.31,.7*fade,.035,.06*fade);
        continue;
      }
      if(t.kind==='acid'){
        // BG spawn is 4/10s; Die has six visible frames then a null seventh. Actor destruction stays at 1s.
        const grow=t.state==='spawning'?Math.min(1,age/.4):1,size=grow*fade;
        box(3,p.x,.018,p.z,.98*size,.025,.98*size);
        box(4,p.x,.04,p.z,.86*size,.035,.66*size);
        box(4,p.x-.05,.04,p.z,.63*size,.035,.88*size);
        // Stable procedural surface flecks; no view/read consumes the simulation RNG.
        const variation=((t.id*31)%17)/17;
        for(let i=0;i<3;i++){
          const angle=variation*6.28+i*2.1,rx=Math.cos(angle)*.27,rz=Math.sin(angle)*.27;
          const pulse=t.state==='active'?(1+Math.sin(time*4+i+t.id)*.15):1;
          box(5,p.x+rx,.065,p.z+rz,.1*size*pulse,.035,.1*size*pulse);
        }
        continue;
      }
      // Keep the approved floor visible under the warning. The source tile is a fissure, not an opaque plate.
      box(0,p.x,.016,p.z,.13,.02,.86);
      const bright=t.state==='erupting'?2:1;
      // Border is the exact source cell, with inset thickness; no gameplay expansion or decorative danger radius.
      const width=.055*fade;
      box(bright,p.x-.47,.035,p.z,width,.025,.94);box(bright,p.x+.47,.035,p.z,width,.025,.94);
      box(bright,p.x,.035,p.z-.47,.94,.025,width);box(bright,p.x,.035,p.z+.47,.94,.025,width);
      box(bright,p.x-.12,.045,p.z,.055,.025,.58);box(bright,p.x+.12,.045,p.z+.16,.055,.025,.37);
      if(t.state==='erupting'){
        // The source foreground flipbook lasts .6s. A rising corrupted spore column uses the same lifetime.
        const h=.15+1.3*Math.sin(Math.PI*Math.min(1,age/.6));
        box(1,p.x,h/2,p.z,.38,h,.38);box(2,p.x,h*.72,p.z,.17,.18,.17);
      }
    }
    for(const beam of beams){
      const a=this.frame.toTiles(beam.from.x,beam.from.y),b=this.frame.toTiles(beam.to.x,beam.to.y);
      const av=new THREE.Vector3(a.x,beam.from.z/64,a.z),bv=new THREE.Vector3(b.x,beam.to.z/64,b.z),d=bv.clone().sub(av);
      this.q.setFromUnitVectors(new THREE.Vector3(1,0,0),d.clone().normalize());
      box(9,(av.x+bv.x)/2,(av.y+bv.y)/2,(av.z+bv.z)/2,d.length(),.035,.035);this.q.identity();
    }
    this.meshes.forEach((mesh,i)=>{mesh.count=counts[i]!;mesh.instanceMatrix.needsUpdate=true;});
    this.group.userData.cells=cells.length;
    this.group.userData.erupting=cells.filter(c=>c.t.state==='erupting').length;
    this.group.userData.acid=cells.filter(c=>c.t.kind==='acid').length;
    this.group.userData.ghost=cells.filter(c=>c.t.kind==='ghost').length;
    this.group.userData.caltrops=cells.filter(c=>c.t.kind==='caltrop').length;this.group.userData.beams=beams.length;
    this.group.userData.spikes=cells.filter(c=>c.t.kind==='spikes').length;this.group.userData.shields=cells.filter(c=>c.t.kind==='shield').length;
  }
  dispose(): void {
    this.group.removeFromParent();for(const mesh of this.meshes)mesh.dispose();
    this.geo.dispose();this.dark.dispose();this.red.dispose();this.hot.dispose();this.acidDark.dispose();this.acid.dispose();this.acidFoam.dispose();this.ghost.dispose();this.ghostGlow.dispose();this.spike.dispose();this.lightning.dispose();this.ward.dispose();
  }
}

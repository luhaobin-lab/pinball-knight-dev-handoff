import * as THREE from 'three';
import type { FogView } from '../api';
import { vfxMaterial } from '../../vfx/gpu';
import type { RoomFrame } from './build';

/** Source TA2 plane (2500uu, Z200) and decoded Mat_战争迷雾 opacity=(1-RT.red)^4.
 * The source camera looks straight down, so plane height controls covering, not its XY projection. In the
 * approved oblique reskin, project XY on the floor and draw last with no depth test to preserve that relation.
 * SPEC-GAP: original Dither02 texture/stipple threshold is retargeted to the approved kit's Bayer4;
 * core sampling uses the full linear texture, never this visual stipple. No collision is added here.
 */
export class FogStage {
  private readonly values = new Float32Array(512 * 512);
  private readonly bits = new Uint32Array(this.values.buffer);
  private readonly texture = new THREE.DataTexture(this.values, 512, 512, THREE.RedFormat, THREE.FloatType);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material = vfxMaterial({
    vertexPars: 'out vec2 vFogUv;',
    vertex: 'vFogUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);',
    fragmentPars: 'in vec2 vFogUv; uniform sampler2D uFog;',
    fragment: `float revealed=clamp(texture(uFog,vFogUv).r,0.,1.);float opacity=1.-revealed;opacity*=opacity;opacity*=opacity;
      if(opacity<=bayer4(ivec2(gl_FragCoord.xy)))discard;color=vec3(.006049,.005605,.010330);`,
    uniforms: { uFog: { value: this.texture } },
  });
  readonly mesh = new THREE.Mesh(this.geometry, this.material);
  private rows: readonly string[] = [];
  constructor(frame: RoomFrame) {
    const positions: number[] = [];
    for (const [x,y] of [[-1250,-1250],[1250,-1250],[-1250,1250],[1250,1250]]) {
      const p=frame.toTiles(x!,y!);positions.push(p.x,0,p.z);
    }
    this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));
    this.geometry.setIndex([0,1,2,2,1,3]);this.material.side=THREE.DoubleSide;
    this.material.depthTest=false;
    this.texture.minFilter=THREE.LinearFilter;this.texture.magFilter=THREE.LinearFilter;
    this.texture.generateMipmaps=false;this.texture.needsUpdate=true;
    this.mesh.name='SourceExplorationFog';this.mesh.frustumCulled=false;this.mesh.renderOrder=98;
  }
  sync(fog: FogView | null | undefined): void {
    this.mesh.visible=fog?.visible??false;if(!fog)return;
    let changed=false;
    for(let y=0;y<512;y++){
      const row=fog.rows[y]??'';if(this.rows[y]===row)continue;
      changed=true;this.bits.fill(0,y*512,(y+1)*512);
      if(row)for(const run of row.split(',')){
        const [x,count,bits]=run.split('.').map(s=>parseInt(s,36));
        this.bits.fill(bits!,y*512+x!,y*512+x!+count!);
      }
    }
    this.rows=fog.rows;if(changed)this.texture.needsUpdate=true;
    this.mesh.userData={source:'TA2 fog Z200 scale25',visible:fog.visible,decodedRows:fog.rows.filter(Boolean).length};
  }
  dispose():void{this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();this.texture.dispose();}
}

import { expect,it } from 'vitest';
import * as THREE from 'three';
import { TerrainStage } from '../../src/game/room/terrain';
import type { TerrainView } from '../../src/core/api/view.ts';
it('ghost ground source is visible at its real cell and retires after its own2s lifetime without changing acid timing',()=>{
 const s=new TerrainStage({toTiles:(x:number,y:number)=>({x:y/64,z:-x/64})}as never),scene=new THREE.Scene();scene.add(s.group);
 const v:TerrainView={id:2,cls:'ghost',cells:[[32,96]],kind:'ghost',state:'active',startedAt:0};
 s.sync([v],1);expect(s.group.userData.ghost).toBe(1);expect((s.group.children[6]as THREE.InstancedMesh).count).toBe(1);
 s.sync([{...v,state:'closing'}],1);expect((s.group.children[6]as THREE.InstancedMesh).count).toBe(1);
 s.sync([{...v,state:'closing'}],2.01);expect(s.group.children.every(m=>(m as THREE.InstancedMesh).count===0)).toBe(true);s.dispose();
});

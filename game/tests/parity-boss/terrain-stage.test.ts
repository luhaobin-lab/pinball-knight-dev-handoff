import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TerrainStage } from '../../src/game/room/terrain';
import type { TerrainView } from '../../src/core/api/view';
const frame={toTiles:(x:number,y:number)=>({x:y/64,z:-x/64})};
const cell=(state:TerrainView['state']):TerrainView=>({id:1,cls:'lava',kind:'lava',cells:[[32,96]],state,startedAt:0,hostile:true});
describe('room terrain renderer lifecycle',()=>{
  it('uses actual cell centre/64uu footprint and source visibility, retires blasts and disposes geometry',()=>{
    const terrain=new TerrainStage(frame as never),scene=new THREE.Scene();scene.add(terrain.group);
    terrain.sync([cell('hidden')],0);expect(terrain.group.userData.cells).toBe(0);
    terrain.sync([cell('warning')],1);expect(terrain.group.userData.cells).toBe(1);
    const dark=terrain.group.children[0] as THREE.InstancedMesh,matrix=new THREE.Matrix4();dark.getMatrixAt(0,matrix);
    const at=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(at,q,scale);
    expect(at.x).toBeCloseTo(1.5);expect(at.z).toBeCloseTo(-.5);expect(scale.x).toBeLessThan(1);expect(scale.z).toBeLessThan(1);
    const border=terrain.group.children[1] as THREE.InstancedMesh;border.getMatrixAt(0,matrix);matrix.decompose(at,q,scale);
    expect(at.x).toBeCloseTo(1.5-.47);expect(scale.z).toBeCloseTo(.94);
    terrain.sync([cell('erupting')],.3);expect(terrain.group.userData.erupting).toBe(1);
    terrain.sync([],1);expect(terrain.group.children.every(o=>(o as THREE.InstancedMesh).count===0)).toBe(true);
    terrain.dispose();expect(terrain.group.parent).toBeNull();
  });
});

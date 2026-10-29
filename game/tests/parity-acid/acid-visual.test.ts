import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TerrainStage } from '../../src/game/room/terrain';
import type { TerrainView } from '../../src/core/api/view';
const frame={toTiles:(x:number,y:number)=>({x:y/64,z:-x/64})};
describe('source acid pool render lifecycle',()=>{
 it('draws the actual acid source cell and retires the .6s visible death frames before delayed object destruction',()=>{
  const stage=new TerrainStage(frame as never),scene=new THREE.Scene();scene.add(stage.group);
  const cell:TerrainView={id:7,cls:'acid',cells:[[32,96]],kind:'acid',state:'hidden',startedAt:0};
  stage.sync([cell],0);expect(stage.group.userData.acid).toBe(0);
  stage.sync([{...cell,state:'spawning'}],.2);expect(stage.group.userData.acid).toBe(1);
  const pool=stage.group.children[4] as THREE.InstancedMesh;expect(pool.count).toBe(2);
  const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();pool.getMatrixAt(0,m);m.decompose(p,q,scale);
  expect(p.x).toBe(1.5);expect(p.z).toBe(-.5);expect(scale.x).toBeCloseTo(.43);
  stage.sync([{...cell,state:'active'}],1);pool.getMatrixAt(0,m);m.decompose(p,q,scale);expect(scale.x).toBeCloseTo(.86);
  stage.sync([{...cell,state:'closing'}],.61);expect(stage.group.children.every(x=>(x as THREE.InstancedMesh).count===0)).toBe(true);
  stage.sync([],1);expect(stage.group.userData.acid).toBe(0);stage.dispose();expect(stage.group.parent).toBeNull();
 });
});

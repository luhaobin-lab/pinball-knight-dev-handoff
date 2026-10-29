import { it,expect } from 'vitest';
import * as THREE from 'three';
import { TerrainStage } from '../../src/game/room/terrain';
import { roomFrame } from '../../src/game/room/build';
import type { TerrainView } from '../../src/core/api/view.ts';
it('source spike cells keep positions through ready/firing/sleep and ward follows the actual timeline scale',()=>{
 const s=new TerrainStage(roomFrame({cols:5,rows:7,tile:64}as never));
 const spikes:TerrainView={id:1,cls:'spikes',kind:'spikes',state:'warning',cells:[[32,-32],[32,32],[32,96]],startedAt:0};
 s.sync([spikes],1);expect(s.group.userData.spikes).toBe(3);expect((s.group.children[8]as THREE.InstancedMesh).count).toBe(12);
 s.sync([{...spikes,state:'erupting'}],.25);expect((s.group.children[1]as THREE.InstancedMesh).count).toBe(12);
 s.sync([{...spikes,state:'closing'}],.7);expect((s.group.children[1]as THREE.InstancedMesh).count).toBe(0);expect(s.group.userData.spikes).toBe(3);
 const ward:TerrainView={id:2,cls:'ward',kind:'shield',state:'spawning',cells:[[32,32]],radius:160,visualRadius:216,scale:.5};
 s.sync([ward],0);expect(s.group.userData.shields).toBe(1);expect((s.group.children[10]as THREE.InstancedMesh).count).toBe(32);
 s.sync([{...ward,state:'closing',scale:0}],.5);expect((s.group.children[10]as THREE.InstancedMesh).count).toBe(0);s.sync([],1);expect(s.group.userData.shields).toBe(0);s.dispose();
});

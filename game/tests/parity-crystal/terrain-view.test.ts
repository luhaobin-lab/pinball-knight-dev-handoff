import { it, expect } from 'vitest';
import * as THREE from 'three';
import { TerrainStage } from '../../src/game/room/terrain';
import { roomFrame } from '../../src/game/room/build';
import { combatFixture } from '../fixtures/index.ts';
import { terrainView } from '../../src/core/sys/ability/terrain-view.ts';
import { 蓝图_可拾取物_尖刺 } from '../../src/content/bp/Skill/效果/可拾取物/蓝图_可拾取物_尖刺.ts';
import { 蓝图_效果_电网 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_电网.ts';
it('actual source links/caltrops project without mutation and draw at their world coordinates; cleanup removes them', () => {
  const f = combatFixture({ enemies: ['水母脑','水母脑'] }), [a,b] = f.enemies;
  a!.K2_SetActorLocation({ x: -100, y: 128, z: 44 }); b!.K2_SetActorLocation({ x: 100, y: 128, z: 44 });
  f.hero.K2_SetActorLocation({ x: -300, y: -300, z: 56 });
  const e = a!.拥有的效果.find(x => x instanceof 蓝图_效果_电网) as 蓝图_效果_电网;
  f.world.mode.当前层回合 = 2; e.持续中触发('效果.时机.新一天时');
  const spike = f.world.spawn(蓝图_可拾取物_尖刺, undefined, { x: 32, y: 96, z: 0 }); f.advance(.55);
  const before = f.world.digest(), v = terrainView(f.world); terrainView(f.world); expect(f.world.digest()).toBe(before);
  expect(v.find(t => t.id === spike.id)).toMatchObject({ kind: 'caltrop', cells: [[32,96]], state: 'active' });
  expect(v.find(t => t.id === e.id)?.beams?.length).toBe(1);
  const s = new TerrainStage(roomFrame({ cols:5, rows:7, tile:64 } as never)); s.sync(v,f.world.clock.now);
  expect(s.group.userData).toMatchObject({ caltrops:1, beams:1 }); // only the first brain received this source round-start event
  const mat = new THREE.Matrix4(), pos = new THREE.Vector3(); (s.group.children[8] as THREE.InstancedMesh).getMatrixAt(0,mat);pos.setFromMatrixPosition(mat);
  const expected = roomFrame({ cols:5, rows:7, tile:64 } as never).toTiles(32,96);expect(pos.x).toBeCloseTo(expected.x);expect(pos.z).toBeCloseTo(expected.z);
  f.world.destroy(spike); e.关闭特效(); for(const x of b!.拥有的效果)if(x instanceof 蓝图_效果_电网)x.关闭特效();
  s.sync(terrainView(f.world),f.world.clock.now);expect(s.group.userData).toMatchObject({ caltrops:0, beams:0 });s.dispose();
});

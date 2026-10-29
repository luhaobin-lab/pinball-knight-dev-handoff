import{it,expect}from'vitest';import * as THREE from'three';import{FieldEffects}from'../../src/game/room/field-effects';import{roomFrame}from'../../src/game/room/build';import type{FieldEffectView}from'../../src/game/api';
it('field layer has exact live positions and source visibility, and lightning reaches both actual endpoint coordinates',()=>{
 const frame=roomFrame({cols:5,rows:7,tile:64}as never),s=new FieldEffects(frame,24),orb:FieldEffectView={id:1,kind:'orb',phase:'spawn',startedAt:0,phaseAt:0,position:{x:32,y:96,z:32},radius:32};s.sync([orb],.2);expect(s.group.userData.orbs).toBe(1);
 s.sync([{...orb,phase:'hidden'}],.5);expect(s.group.userData.visible).toBe(0);
 const end={x:352,y:96,z:2};s.sync([{id:2,kind:'lightning',phase:'active',startedAt:0,phaseAt:0,position:orb.position,end,radius:0,segments:16}],.2);expect(s.group.userData.links).toBe(1);
 const mesh=s.group.getObjectByName('SourceArrowRibbons')as THREE.Mesh<THREE.BufferGeometry>,p=mesh.geometry.getAttribute('position'),a=frame.toTiles(32,96),b=frame.toTiles(352,96);
 expect((p.getX(0)+p.getX(1))/2).toBeCloseTo(a.x);expect((p.getZ(0)+p.getZ(1))/2).toBeCloseTo(a.z);expect((p.getX(32)+p.getX(33))/2).toBeCloseTo(b.x);expect((p.getZ(32)+p.getZ(33))/2).toBeCloseTo(b.z);expect(p.getY(32)).toBeCloseTo(2/64);
 s.sync([],2);expect(s.group.userData.visible).toBe(0);expect(mesh.geometry.drawRange.count).toBe(0);s.dispose();expect(s.group.parent).toBeNull();
});

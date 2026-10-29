import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { buildShape, MANUAL_MASKS, cellCodes } from '../../src/core/sys/room/shape.ts';
import { buildRoomPlan, layerOf } from '../../src/core/sys/room/plan.ts';
import { makeRand15 } from '../../src/core/rng/ue.ts';
import { roomView } from '../../src/core/sys/room/index.ts';
import { roomFrame, floorRects, roomSpec } from '../../src/game/room/build';
import { createLaunchWorld, sweepProbe } from '../../src/core/launch/index.ts';
import { buildLaunchWorld } from '../../src/core/sys/launch/native.ts';
import { currentRoomPlan } from '../../src/core/sys/room/index.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';

describe('source room shape, placement and collision recovery', () => {
  it('reads the extracted7x5 masks in source textureX/roomY outer order and uses source5x7 world axes', () => {
    expect(MANUAL_MASKS.手动房间图01).toEqual(['0000000','0111110','0111110','0111110','0000000']);
    expect(MANUAL_MASKS.手动房间图02).toEqual(['0011100','0111110','0111110','0111110','0011100']);
    for (const [name, count] of [['手动房间图01',15],['手动房间图02',21]] as const) {
      const shape = buildShape(5,7,false,false,name,makeRand15(1));
      expect(shape.mask.filter(Boolean)).toHaveLength(count);
      for (const c of shape.cells) expect(c.explored).toBe(MANUAL_MASKS[name]![c.x]![c.y] === '1');
    }
    const p=buildRoomPlan('第一层','第一层',0,layerOf('第一层',0)!,makeRand15(1));
    expect([p.floor.width,p.floor.depth,p.floor.origin]).toEqual([20,28,{x:-640,y:-896}]);
    expect(p.floor.cells.reduce((sum,c)=>sum+c,0)).toBe(144);
    expect(Math.min(...p.polygon.map(p=>p.x))).toBe(-256);
    expect(Math.max(...p.polygon.map(p=>p.x))).toBe(256);
    expect(Math.min(...p.polygon.map(p=>p.y))).toBe(-576);
    expect(Math.max(...p.polygon.map(p=>p.y))).toBe(576);
  });

  it('source random edge removal keeps nonrectangular masks and strips dead-end cells without inventing holes', () => {
    const masks = new Set<string>();
    for(let seed=1;seed<=32;seed++) {
      const a=buildShape(5,7,true,false,null,makeRand15(seed)),b=buildShape(5,7,true,false,null,makeRand15(seed));
      expect(a).toEqual(b);masks.add(a.mask.map(Number).join(''));
      expect(a.mask.filter(Boolean).length).toBeLessThan(35);
      for(const c of a.cells.filter(c=>c.explored)) {
        expect(c.edge.replaceAll('0','').length).toBeGreaterThanOrEqual(2);
        expect(c).toMatchObject(cellCodes(a.mask,5,7,c.x,c.y));
      }
    }
    expect(masks.size).toBeGreaterThan(20);
  });

  it('preserves source fixed offsets, stable counts and exactmovement primitive sizes', () => {
    const boss=buildRoomPlan('首领战斗','战斗房_首领',0,layerOf('战斗房_首领',0)!,makeRand15(1));
    expect(boss.placements.map(d=>d.at)).toEqual([{x:388,y:704,z:-5},{x:388,y:-712,z:-5},{x:0,y:0,z:-5}]);
    const p=buildRoomPlan('普通战斗','战斗房_普通',0,layerOf('战斗房_普通',0)!,makeRand15(7));
    expect(p.collision.circles.length).toBeGreaterThan(0);
    for(const c of p.collision.circles) {
      expect(c.radius).toBe(50);
      expect(p.placements.some(d=>d.at.x+5===c.x && d.at.y===c.y)).toBe(true);
    }
    for(const b of p.collision.boxes) expect([[184,116],[160,180]]).toContainEqual([b.maxX-b.minX,b.maxY-b.minY]);
    for(const d of p.placements.filter(d=>!d.fixed)) expect(d.occupiedCells.every(id=>p.shape.mask[id])).toBe(true);
  });

  it('the recovered core mask andrender layout share a reversibleUEcoordinate transform', () => {
    const p=buildRoomPlan('第一层','第一层',0,layerOf('第一层',0)!,makeRand15(7));
    const v=roomView(p), f=roomFrame(v),rects=floorRects(v);
    expect(rects).toHaveLength(v.cells.length);
    for(const [x,y]of [[0,0],[-256,400],[128,-576]]) {
      const t=f.toTiles(x!,y!);expect(f.toUu(t.x,t.z)).toEqual({x,y});
    }
    expect(f.directionToTiles(1,0)).toEqual({x:0,z:-1});
    expect(f.directionToTiles(0,1)).toEqual({x:1,z:-0});
    const spec=roomSpec(v,7);
    expect(spec.layout.cells.reduce((a,b)=>a+b,0)).toBe(v.cells.length);
    expect(spec.urns!.length+spec.pillars!.length).toBe(p.collision.circles.length);
    const before=JSON.stringify(p);
    roomView(p);roomSpec(v,7);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('rejects a source-invalid diagonal mask before exposing slots orambiguouscollision', () => {
    const w=createWorld({seed:1,content:registry});
    w.mode.当前层配置=layerOf('战斗房_普通',0)!;
    w.mode.当前层地图格配置表={DataTable:null,RowName:'普通战斗'};
    w.rng.level.state=85; // sourcealgorithm'sdeterministicdiagonal-crossingcase
    const room=w.spawn(蓝图_房间);w.mode.当前房间实例=room;
    room.激活房间(5,7);
    expect(room.创建失败).toBe(true);
    expect(currentRoomPlan(w)).toBeNull();
    expect(room.所有房间格子数组).toEqual([]);
    expect(room.地形格结构映射.size).toBe(0);
  });

  it('a real first room has maskwalls andsolidprops inboth worldtrace andtheactualnative previewworld', () => {
    const g=createGame({seed:6,content:registry,filter:'ported',debug:{skipPrologue:true}});
    for(const c of [{type:'title.newRun'},{type:'hero.start'},{type:'map.enter',cell:'r1c0'}]as const){g.runUntilInput();expect(g.send(c).ok).toBe(true);}
    g.runUntilInput();
    const p=currentRoomPlan(g.world)!,hero=g.world.mode.玩家角色!;
    expect(p.shape.mask.filter(Boolean)).toHaveLength(15);
    const h=hero.K2_GetActorLocation();
    expect(函数库_技能.查找地形格(hero,g.world.mode,h,{x:0,y:0,z:0},false,0).找到了).toBe(true);
    // The source firstroomexit iscentre+(-12,0), anditmustlandon the restoredwalkablemasktoo.
    expect(函数库_技能.查找地形格(hero,g.world.mode,{x:-12,y:0,z:0},{x:0,y:0,z:0},false,0).找到了).toBe(true);
    const probe={radius:10,halfHeight:10,z:0};
    const {launchWorld}=buildLaunchWorld(g.world,hero,false);
    for(const c of p.collision.circles) {
      const from={x:c.x-150,y:c.y,z:0},to={x:c.x+150,y:c.y,z:0};
      const isolated=createLaunchWorld({circles:[c]});
      expect(sweepProbe(isolated,from,to,probe,new Set())?.impactPoint.x).toBeCloseTo(c.x-50,6);
      expect(sweepProbe(launchWorld,from,to,probe,new Set())).not.toBeNull();
      expect(g.world.trace.sphere(from,to,10,'地形',[hero]).length).toBeGreaterThan(0);
    }
    const digest=g.digest(),rng=g.world.rng.save();
    for(let i=0;i<20;i++){g.view;g.preview({x:0,y:800});}
    expect(g.digest()).toBe(digest);expect(g.world.rng.save()).toEqual(rng);
  });
});

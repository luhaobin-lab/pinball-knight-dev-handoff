import { describe, expect, it } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { previewTerrain, terrainView, updateSkillIndicatorTarget } from '../../src/core/sys/ability/terrain-view.ts';
import { 蓝图_效果_岩浆地板 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_岩浆地板.ts';
import { 技能指示 } from '../../src/content/bp/交互/技能指示.ts';
import { 蓝图_效果_地形管理组 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_地形管理组.ts';

function setup(){
  const f=combatFixture({enemies:['守门人'],seed:4}),w=f.world,boss=f.enemies[0]!;
  w.mode.当前层配置=layerOf('第一层',0)!;
  const room=w.spawn(蓝图_房间);w.mode.当前房间实例=room;room.激活房间(5,7);
  const hammer=f.ability(boss,'首领_守门人_重锤');boss.当前能力=hammer;
  boss.K2_SetActorLocation({x:96,y:64,z:117});boss.更新运动数据();
  return{...f,w,boss,hammer};
}
describe('source terrain projection and real-time grid indicator',()=>{
  it('warning appears on source ring callback, eruption .1*ring later, hides at .6; view reads preserve digest/RNG',()=>{
    const f=setup();f.hammer.被选中();f.advance(.81);
    const group=f.hammer.地形管理组 as 蓝图_效果_地形管理组;
    const cell=group.拥有的地形.find(e=>e!.序号===2)! as 蓝图_效果_岩浆地板;
    const v=()=>terrainView(f.w).find(t=>t.id===cell.id)!;
    expect(v().state).toBe('hidden');f.advance(.21);expect(v().state).toBe('spawning');
    f.advance(.4);expect(v().state).toBe('warning');
    expect(v().cells).toEqual([[cell.所在位置.x,cell.所在位置.y]]);expect(v().hostile).toBe(true);
    const digest=f.w.digest(),rng=f.w.rng.save();for(let i=0;i<20;i++)terrainView(f.w);
    expect(f.w.digest()).toBe(digest);expect(f.w.rng.save()).toEqual(rng);
    cell.持续效果();cell.销毁效果();f.advance(.19);expect(v().state).toBe('warning');
    f.advance(.02);expect(v().state).toBe('erupting');
    f.advance(.58);expect(v().state).toBe('erupting');f.advance(.02);expect(v().state).toBe('hidden');
  });
  it('pure hover preview snaps and filters source legal cells without spawning; confirmation updates actual indicator config',()=>{
    const f=setup(),cfg={...f.hammer.地形选取,选取方式:'选取范围地形格（矩形）' as const,起始范围:1,结束范围:1};
    const before=f.w.digest(),rng=f.w.rng.save(),count=f.w.objects().length;
    const p=previewTerrain(f.w,cfg,{x:70,y:5,z:99});
    expect(p.config.起点).toEqual([{X:96,Y:32,Z:0}]);expect(p.cells).toHaveLength(9);
    expect(cfg.起点).not.toEqual(p.config.起点);
    expect(f.w.digest()).toBe(before);expect(f.w.rng.save()).toEqual(rng);expect(f.w.objects()).toHaveLength(count);
    f.hero.当前能力=f.hammer;
    f.hero.切换指示箭头(true,'地形区域（实时）',60,[],[],cfg,null);
    const indicator=f.hero.技能指示 as 技能指示;
    expect(indicator.列宽).toBe(3);expect(indicator.ug_previewGroup?.拥有的地形).toHaveLength(0);
    updateSkillIndicatorTarget(f.hero,{x:70,y:5,z:99});
    expect(indicator.地形选取配置).toEqual(p.config);expect(indicator.视觉地块位置).toEqual(p.cells);
    expect(terrainView(f.w).find(t=>t.id===indicator.id)?.cells).toHaveLength(9);
    f.hero.切换指示箭头(false,'地形区域（实时）',60,[],[],cfg,null);
    expect(indicator.valid).toBe(false);expect(terrainView(f.w).find(t=>t.id===indicator.id)).toBeUndefined();
  });
  it('fixed leap-circle remains at source selected location and retires when execution closes it',()=>{
    const f=setup(),leap=f.ability(f.boss,'首领_守门人二阶_撕咬搜寻');f.boss.当前能力=leap;
    leap.被选中();const indicator=f.boss.技能指示 as 技能指示,p=indicator.K2_GetActorLocation();
    expect(terrainView(f.w).find(t=>t.id===indicator.id)).toMatchObject({kind:'target',radius:300,cells:[[p.x,p.y]]});
    f.boss.切换指示箭头(false,'指定位置（固定）',512,[],[],leap.地形选取,null);
    expect(terrainView(f.w).find(t=>t.id===indicator.id)).toBeUndefined();
  });
  it('new visual callback timestamps are deterministic across caller frame sizes',()=>{
    const a=setup(),b=setup();for(const f of[a,b])f.hammer.被选中();
    for(let i=0;i<120;i++)a.w.clock.advance(1/60);
    for(const t of[.03,.17,.8,1])b.w.clock.advance(t);
    expect(terrainView(a.w)).toEqual(terrainView(b.w));expect(a.w.digest()).toBe(b.w.digest());
  });
});

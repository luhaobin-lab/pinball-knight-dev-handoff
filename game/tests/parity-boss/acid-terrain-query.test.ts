import { describe, expect, it } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { 函数库_技能, 函数库_工具 } from '../../src/core/bp/index.ts';
import { 蓝图_效果_地形管理组 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_地形管理组.ts';
import { 蓝图_效果_酸液池 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_酸液池.ts';
describe('filled diamond source dependency reached by the ordinary acid skill',()=>{
 function fixture(){const f=combatFixture({enemies:['大肠'],seed:4});f.world.mode.当前层配置=layerOf('第一层',0)!;const room=f.world.spawn(蓝图_房间);f.world.mode.当前房间实例=room;room.激活房间(5,7);return{...f,room};}
 it('appends inner-to-outer ring order and clips source room cells while ignoring the config avoid flag',()=>{
  const f=fixture(),w=f.world,centre={x:32,y:32,z:0},digest=w.digest();
  const cells=函数库_技能.选取范围地形格_菱形(w.mode,w.mode,centre,2).选取到的格子;
  expect(cells.map(p=>[(p.x-32)/64||0,(p.y-32)/64||0])).toEqual([[0,0],[-1,0],[1,0],[0,-1],[0,1],[-2,0],[2,0],[-1,-1],[-1,1],[1,-1],[1,1],[0,-2],[0,2]]);
  expect(w.digest()).toBe(digest);
  const s=f.ability(f.enemies[0]!,'大肠酸液'),config={...s.地形选取,避开角色:true,起点:[{X:32,Y:32,Z:0}]};
  f.hero.K2_SetActorLocation({x:32,y:32,z:56});
  const groups=函数库_工具.选择合法地形(w.mode,config,w.mode).选取到的格子;
  expect(groups[0]!.真实坐标).toContainEqual({X:32,Y:32,Z:0});
  const cell=f.room.可走地形格.find(c=>c.真实坐标.X===32&&c.真实坐标.Y===32)!;f.room.可走地形格.splice(f.room.可走地形格.indexOf(cell),1);
  expect(函数库_技能.选取范围地形格_菱形(w.mode,w.mode,centre,0).选取到的格子).toEqual([]);
 });
 it('actual acid ability creates source cells at selection and activates them after its .3 s execution delay',()=>{
  const f=fixture(),a=f.enemies[0]!,s=f.ability(a,'大肠酸液');a.当前能力=s;
  a.K2_SetActorLocation({x:0,y:0,z:a.高度});a.更新运动数据();s.被选中();
  const group=s.地形管理组 as 蓝图_效果_地形管理组;
  expect(group).toBeInstanceOf(蓝图_效果_地形管理组);
  expect(group.拥有的地形.length).toBeGreaterThan(0);
  const acid=group.拥有的地形[0] as 蓝图_效果_酸液池;expect(acid.地形激活).toBe(false);
  s.执行技能(false);f.advance(.29);expect(acid.地形激活).toBe(false);
  f.advance(.77);expect(acid.地形激活).toBe(true);
  expect(f.world.counters.report().unported['函数库_工具.选择合法地形:选取范围地形格（菱形）']).toBeUndefined();
 });
});

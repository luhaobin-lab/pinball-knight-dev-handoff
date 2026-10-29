import { it, expect } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { BpObject } from '../../src/core/sim/object.ts';
import type { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { LaunchTrajectoryLibrary } from '../../src/core/sys/launch/native.ts';

it('source readiness/audio formula and changed-only delivery preserve exact parameters without RNG',()=>{
  const {world:w,hero,events}=combatFixture(),rng=w.rng.save();
  const params=()=> (hero as BP_Actor_Player&{ug_loopSound?:{speed:number;volume:number}}).ug_loopSound;
  hero.初始化完毕=false;hero.实时检测();expect(params()).toBeUndefined();
  hero.初始化完毕=true;hero.移动当前速度=4500;hero.当前物理速度=2700;hero.实时检测();
  expect(params()).toEqual({speed:Math.fround(2400/2700),volume:Math.fround(2400/2700*.4)});
  const count=()=>events('ui').filter(e=>e.widget==='actor.loopSound').length;
  expect(count()).toBe(1);hero.实时检测();expect(count()).toBe(1);
  hero.当前物理速度=5000;hero.实时检测();expect(params()!.speed).toBe(Math.fround(4700/2700));expect(count()).toBe(2); // NormalizeToRange does not clamp.
  expect(w.rng.save()).toEqual(rng);expect(w.counters.report().unported['BP_Actor_Player.实时检测']).toBeUndefined();
});
it('updates real preview-circle interfaces in live order and leaves the native cached release intact',()=>{
  const {world:w,hero}=combatFixture(),calls:number[]=[];
  class Circle extends BpObject {static override readonly path='Test/PreviewCircle';更新碰撞预览圈(){calls.push(this.id);if(calls.length===1)hero.碰撞预览圈数组.push(b);}}
  const a=w.spawn(Circle),b=w.spawn(Circle);hero.碰撞预览圈数组.push(a);
  w.mode.当前环节='交互场牌';const preview=LaunchTrajectoryLibrary.UpdateLaunchPreview(hero,{x:300,y:200});const before=LaunchTrajectoryLibrary.PreviewCircle(hero,0),rng=w.rng.save();
  hero.实时检测();expect(calls).toEqual([a.id,b.id]);expect(LaunchTrajectoryLibrary.PreviewCircle(hero,0)).toEqual(before);
  expect(preview).not.toBeNull();expect(w.rng.save()).toEqual(rng);
});

import{it,expect}from'vitest';import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';import{waitsForAutomaticExit}from'../../src/core/sys/turn';
import type{Command}from'../../src/core/api/commands';
import trace from'./fixtures/shop-exit-seed1.json';
function replay(){const g=createGame({seed:1,content:registry,filter:'ported',debug:{skipPrologue:true}}),ids=new Map<number,number>();
 const roles:Record<number,string>={221:'任务宝箱',324:'任务祭坛',429:'锻造锤_品质青铜',424:'商人'};
 for(const e of trace.commands){while(g.view.time<e.time)g.advance(Math.min(1/60,e.time-g.view.time));let cmd=e.cmd as Command;
  // The canonical fog surface changes allocation IDs; preserve original times, actual roles and source offer order.
  if(cmd.type==='interact'){const role=roles[cmd.actor];const target=g.view.field.find(a=>a.row===role);expect(target,role).toBeDefined();cmd={...cmd,actor:target!.id};}
  else if(cmd.type==='loot.take'){const offered=g.legal().find(c=>c.type==='loot.take')!.params!.item[0];ids.set(cmd.item,Number(offered));cmd={...cmd,item:Number(offered)};}
  else if(cmd.type==='item.dismantle')cmd={...cmd,item:ids.get(cmd.item)!};
  expect(g.send(cmd)).toEqual({ok:true});}return g;}
it('actual natural sold-inventory shop route lets its direct source junction finish without buying obsolete goods',()=>{
 const g=replay();expect(g.view.phase).toBe('选择路口');expect(waitsForAutomaticExit(g.world)).toBe(true);const before=g.digest(),rng=g.world.rng.save(),gold=g.world.mode.金币,time=g.view.time;
 for(let i=0;i<20;i++)waitsForAutomaticExit(g.world);expect(g.digest()).toBe(before);expect(g.world.rng.save()).toEqual(rng);
 expect(g.runUntilInput(5)).toBe('input');expect(g.view.time).toBeGreaterThan(time);expect(g.view.screen).toBe('map');expect(g.legal().some(c=>c.type==='map.enter')).toBe(true);expect(g.world.mode.金币).toBe(gold);
});
it('event-jump direct exit matches frame progression; an actual overlay still owns input',()=>{
 const a=replay(),b=replay();a.runUntilInput(5);while(b.view.time<a.view.time)b.advance(Math.min(1/60,a.view.time-b.view.time));expect(a.digest()).toBe(b.digest());
 const c=replay();c.world.modal.open({kind:'warning',type:0,text:'source boundary',buttons:['continue','cancel']},()=>{});expect(waitsForAutomaticExit(c.world)).toBe(false);
});

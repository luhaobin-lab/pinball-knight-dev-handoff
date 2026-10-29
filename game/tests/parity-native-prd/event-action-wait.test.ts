import{it,expect}from'vitest';
import{createGame}from'../../src/core/api/game.ts';import{registry}from'../../src/content/bp/index.ts';
import{waitsForEventAction}from'../../src/core/sys/talents/choice.ts';
import{structOf}from'../../src/core/bp/structs.ts';
import trace from'./fixtures/seed19-final-choice.json';
function replay(){
 // Preserve the original d6aa25f seed19 trace unchanged. Its early actor IDs changed when all content became admitted.
 // Source boundary: the real ordinary launch is started by a legal command, then invoke the exact final-choice reward
 // creation used by 蓝图_效果_终级抉择. This isolates the event/action race from the old natural corruption accumulation.
 const g=createGame({seed:trace.seed,content:registry,filter:'ported',debug:{skipPrologue:true}});
 for(const type of['title.newRun','hero.start']as const){g.runUntilInput();expect(g.send({type})).toEqual({ok:true});}g.runUntilInput();
 expect(g.send({type:'map.enter',cell:g.view.map!.cells.find(c=>c.enterable)!.id})).toEqual({ok:true});g.runUntilInput();
 const p=g.view.hero!.position;expect(g.send({type:'aim.release',aim:{x:p.x+3000,y:p.y+2000}})).toEqual({ok:true});expect(g.world.mode.玩家角色!.释放技能中).toBe(true);
 const task={...structOf('结构_任务条'),任务等级:1,奖励等级:1,奖励类型:[{权重:100,数据表行:{DataTable:'CatapultHero/数据表/技能/数据表_技能_奖励',RowName:'终结抉择'}}]};
 const reward=g.world.mode.创建奖励(task).实例!;expect(reward.能力名).toBe('终结抉择');reward.执行技能(false);return g;
}
it('source final-choice reward during actual launch waits for its real pending action then accepts the source50gold reward',()=>{
 const g=replay();let n=0;for(;n<600&&g.view.modal?.kind!=='multiChoice';n++)g.advance(1/60);expect(n).toBeLessThan(600);
 const modal=g.view.modal;if(modal?.kind!=='multiChoice')throw Error('Source event choice did not open');
 expect(modal.source).toBe('event');expect(g.world.mode.玩家角色!.释放技能中).toBe(true);expect(waitsForEventAction(g.world)).toBe(true);
 expect(g.view.launch).not.toBeNull();expect(modal.options[0]!.row).toBe('终结选项_0');
 const before=g.digest(),rng=g.world.rng.save(),t=g.view.time;for(let i=0;i<10;i++)waitsForEventAction(g.world);expect(g.digest()).toBe(before);expect(g.world.rng.save()).toEqual(rng);
 expect(g.legal().some(c=>c.type==='modal.skip')).toBe(true); // actual player can still skip while an action is running
 expect(g.runUntilInput(10)).toBe('input');expect(g.view.time).toBeGreaterThan(t);expect(g.world.mode.玩家角色!.释放技能中).toBe(false);
 const gold=g.world.mode.金币;expect(g.send({type:'modal.pick',option:0})).toEqual({ok:true});expect(g.world.mode.金币).toBe(gold+50);const after=g.view.modal;expect(after?.kind==='multiChoice'?after.source:null).not.toBe('event');
});
it('60Hz advancement reaches the same full state as event-jump through the source choice gate',()=>{
 const a=replay(),b=replay();a.runUntilInput(10);while(b.view.time<a.view.time)b.advance(Math.min(1/60,a.view.time-b.view.time));
 expect(a.digest()).toBe(b.digest());expect(a.world.rng.save()).toEqual(b.world.rng.save());
 expect(a.send({type:'modal.pick',option:0})).toEqual({ok:true});expect(b.send({type:'modal.pick',option:0})).toEqual({ok:true});expect(a.digest()).toBe(b.digest());
});

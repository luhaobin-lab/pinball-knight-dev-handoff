import{it,expect}from'vitest';
import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';
import{主界面Of,resetTransient,开启多选一}from'../../src/core/sys/talents/choice';
import type{Command}from'../../src/core/api/commands';
/** Exact six actual-browser actions before the old pending widget outlived OpenLevel. Original full record:
 * studio/shots/parity-admission-dev02/report.json seed5. Script allocates no test-only gameplay objects.
 */
const trace:[number,Command][]=[[79/60,{type:'title.newRun'}],[127/60,{type:'hero.start'}],[232/60,{type:'map.enter',cell:'r1c0'}],[4.75,{type:'interact',actor:219}],[334/60,{type:'menu.open'}],[334/60,{type:'warning.answer',button:0}]];
function run(frames:boolean){const g=createGame({seed:5,content:registry,filter:'ported',debug:{skipPrologue:true}});
 const to=(time:number)=>{for(let n=0;n<1200&&g.view.time<time;n++)g.advance(frames?Math.min(1/60,time-g.view.time):time-g.view.time);expect(g.view.time).toBe(time);};
 for(const[t,original]of trace){to(t);const cmd=original.type==='interact'?{...original,actor:g.view.field.find(a=>a.row==='任务宝箱')!.id}:original;
  // Preserve original action times/semantic actor; the source level fog surface now consumes an actor ID.
  expect(g.send(cmd),JSON.stringify(cmd)).toEqual({ok:true});}
 to(7.5);expect(g.view.modal?.kind).not.toBe('multiChoice');expect(主界面Of(g.world).多选一选项).toEqual([]);expect(g.legal().some(c=>c.type==='modal.pick')).toBe(false);
 return g;
}
it('OpenLevel cancels the old .2s choice/display work and cannot leave dead options that accept clicks',()=>{run(false);});
it('the real six-command reset has equal full digest under frame and event advancement',()=>{expect(run(true).digest()).toBe(run(false).digest());});
it('teardown closes only its owned view and cancels a not-yet-open widget without clearing another modal',()=>{
 const g=createGame({seed:1,content:registry,debug:{skipPrologue:true}});g.runUntilInput();
 开启多选一(g.world,{目标或_且:false,目标标签:[],排除标签:[],指定池子:['力量'],不加入回合开始:true,免费:true,天赋_事件:false,选项数量:1,可刷新次数:0,额外等级:0,来自效果:null,来自能力:null});
 const other={kind:'warning' as const,type:2 as const,text:'other owner',buttons:['回忆','遗忘']as const};g.world.modal.open(other,()=>{});resetTransient(g.world);g.advance(1);expect(g.world.modal.current).toBe(other);
});

import{describe,it,expect,vi}from'vitest';
import{createGame}from'../../src/core/api/game.ts';import{registry}from'../../src/content/bp/index.ts';
import{数据表_技能_奖励 as rewards}from'../../src/content/demo/tables.ts';
import{蓝图_商店}from'../../src/content/bp/环境/商店/蓝图_商店.ts';import{蓝图_装饰品_地铺}from'../../src/content/bp/环境/装饰品/蓝图_装饰品_地铺.ts';
import{蓝图_能力}from'../../src/core/ability/ability.ts';import{BP_Mission}from'../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';
import{currentMapTile}from'../../src/core/sim/map-tile.ts';import{科学数变普通,sciOf}from'../../src/core/math/sci.ts';
const setup=()=>{const g=createGame({seed:3,content:registry,filter:'all',debug:{skipPrologue:true}});g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();g.send({type:'map.enter',cell:g.view.map!.cells.find(c=>c.enterable)!.id});g.runUntilInput();return g;};
function shopFixture(name='获取锻造_新手关'){
 const g=setup(),w=g.world,m=w.mode,h=m.玩家角色!,row=rewards.rows[name as keyof typeof rewards.rows];
 const a=w.spawn<蓝图_能力>(row.能力.能力类!,a=>{a.拥有者=h;a.技能配置=row;a.能力名=name;a.等级=1;});a.初始化();a.子初始化();currentMapTile(w)!.奖励技能实例=a;
 m.当前环节='进入商店';const mission=w.spawn(BP_Mission);m.当前任务实例=mission;mission.未完成=true;
 const s=w.spawn(蓝图_商店,undefined,{x:100,y:380,z:0});s.激活商店();m.商店=s;return{g,w,m,h,s,mission};
}
describe('source merchant and recovery paths',()=>{
 it('source tutorial creates a real bronze forge shelf priced4, refuses an unaffordable purchase and pays only after skill starts',()=>{
  const f=shopFixture(),{m,s,w,mission}=f;expect(s.商品数量).toBe(1);expect(s.商品映射.size).toBe(1);
  const [good,shelf]=[...s.商品映射][0];expect(shelf.价格).toBe(4);expect(good.等级).toBe(1);expect(good.K2_GetActorLocation()).toEqual({x:156,y:-103,z:good.高度});
  const ctl=m.玩家控制器!;ctl.当前交互角色=good;m.金币=3;ctl.交互到商品();expect(m.金币).toBe(3);expect(s.可购买数量).toBe(1);
  // The source forge ability needs an equipped item; an affordable rejected skill does not charge either.
  m.金币=20;ctl.交互到商品();expect(m.金币).toBe(20);expect(s.可购买数量).toBe(1);
  const item=w.cult.创建牌到侧栏('旧剑',1,null,[],0,new Map()).卡牌实例!;ctl.交互到商品();expect(m.金币).toBe(16);expect(s.可购买数量).toBe(0);expect(shelf.价格显示).toBe(false);expect(mission.未完成).toBe(false);
  expect(item.品质).toBe(2); // source bronze hammer selects quality1 and increments it once
  ctl.交互到商品();expect(m.金币).toBe(16);
 });
 it('ordinary forge shelves preserve actual two source parameters; merchant click leaves without buying',()=>{
  const f=shopFixture('获取锻造'),s=f.s;expect(s.商品数量).toBe(f.s.奖励技能!.参数.length);expect(s.商品数量).toBe(2);
  expect([...s.商品映射.keys()].map(x=>x.等级)).toEqual([1,2]);expect([...s.商品映射.values()].map(x=>x.价格)).toEqual([12,0]);
  const gold=f.m.金币;f.m.玩家控制器!.交互到商人();expect(f.mission.未完成).toBe(false);expect(f.m.金币).toBe(gold);
 });
 it('actual command/view exposes the source merchant and priced products, and clicking the merchant completes the room task',()=>{
  const {g,s,mission}=shopFixture();const ids=g.legal().find(c=>c.type==='interact')!.params!.actor;
  expect(ids).toContain(s.商人!.id);expect(ids).toContain([...s.商品映射.keys()][0].id);
  expect(g.view.field.find(a=>a.id===[...s.商品映射.keys()][0].id)?.shopPrice).toBe(4);
  expect(g.send({type:'interact',actor:s.商人!.id}).ok).toBe(true);expect(mission.未完成).toBe(false);
  g.world.mode.当前环节='选择路口';expect(g.legal().flatMap(c=>c.type==='interact'?c.params!.actor:[])).not.toContain(s.商人!.id);
 });
 it('source room cleanup destroys the entire shop tree and leaves no prior-floor merchant in view or legal input',()=>{
  const{g,w,m,s}=shopFixture(),merchant=s.商人!,products=[...s.商品映射.keys()],shelves=[...s.商品映射.values()];
  m.清理房间();expect([s,merchant,...products,...shelves].every(o=>!w.isValid(o))).toBe(true);
  expect(g.view.field.some(a=>a.id===merchant.id)).toBe(false);expect(g.legal().flatMap(c=>c.type==='interact'?c.params!.actor:[])).not.toContain(merchant.id);
 });
 it('rest executes the real .75+.5 timeline once, removes harmful effects and restores HP/stamina before completing its task',()=>{
  const g=setup(),w=g.world,m=w.mode,h=m.玩家角色!,r=w.spawn(蓝图_装饰品_地铺),mission=w.spawn(BP_Mission);m.当前任务实例=mission;mission.未完成=true;m.当前环节='进入商店';
  m.当前房间实例!.房间装饰品.push(r);
  h.当前生命=sciOf(20);h.生命百分比=20/科学数变普通(h.当前最大生命);h.改变体力(sciOf(-90));const remove=vi.spyOn(h,'移除减益效果');
  r.玩家交互();r.玩家交互();g.advance(.74);expect(remove).not.toHaveBeenCalled();expect(g.legal().some(c=>c.type==='interact')).toBe(false);
  g.advance(.50);expect(remove).not.toHaveBeenCalled();expect(g.view.field.some(a=>a.id===r.id)).toBe(true);
  expect(g.legal().flatMap(c=>c.type==='interact'?c.params!.actor:[])).not.toContain(r.id);
  g.advance(.02);expect(remove).toHaveBeenCalledOnce();expect(科学数变普通(h.当前生命)).toBe(科学数变普通(h.当前最大生命));expect(mission.未完成).toBe(false);
 });
});

import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { GetCustomSave } from '../../src/core/sys/save/ems';
import { UI_关卡地图页面 } from '../../src/core/bp/widgets';
import { structOf } from '../../src/core/bp/structs';
import { 科学数变普通 } from '../../src/core/math/sci';
import { 获取科学映射词条 } from '../../src/core/math/stats';
import { STASH, canPlace, initStash } from '../../src/core/sys/camp/stash';
import { 蓝图_营地格 } from '../../src/content/bp/环境/营地/蓝图_营地格';
import { CampPage, CAMP_UI } from '../../src/ui/pages/camp/page';
import { StashPage, stashHit } from '../../src/ui/pages/stash/page';
import type { TextFont } from '../../src/ui/text/font';
import { 数据表_任务条_默认 } from '../../src/content/demo/tables';

function hub() {
  const g=createGame({seed:6,content:registry,debug:{skipPrologue:true}});
  for(const type of ['title.newRun','hero.start']as const){g.runUntilInput();expect(g.send({type}).ok).toBe(true);}g.runUntilInput();
  UI_关卡地图页面.重置关卡页(g.world.mode,false);g.world.cult.切换地图页(false,false);return g;
}
function unlock(g:ReturnType<typeof createGame>){const c=g.world.cult.创建牌到侧栏('破损的神像',1,null,[],GetCustomSave(g.world).轮回次数,new Map()).卡牌实例!;expect(g.send({type:'item.use',item:c.id}).ok).toBe(true);g.advance(.5);return c;}
const damage=(g:ReturnType<typeof createGame>)=>科学数变普通(获取科学映射词条(g.world.mode.玩家角色!.词条,'基础伤害').输出值);
describe('source Eternal Statue and stash',()=>{
 it('retains the source Demo quest identity/goal in the actual title and begins its real run quest',()=>{
  const g=createGame({seed:6,content:registry,debug:{skipPrologue:true}});g.runUntilInput();expect(g.view.title?.quest).toMatchObject({title:'凝视深渊',need:60});
  expect(数据表_任务条_默认.rows['凝视深渊'].任务名.zh).toContain('凝视深渊');
  GetCustomSave(g.world).新手关中=true;expect(g.view.title?.quest).toMatchObject({title:'序幕',need:7});GetCustomSave(g.world).新手关中=false;
  expect(g.send({type:'title.newRun'}).ok).toBe(true);g.runUntilInput();expect(g.send({type:'hero.start'}).ok).toBe(true);g.runUntilInput();
  expect(g.world.mode.当前轮回任务?.valid).toBe(true);expect(g.world.mode.当前轮回任务条.任务名.zh).toBe(数据表_任务条_默认.rows['凝视深渊'].任务名.zh);
 });
 it('Demo camp cell keeps the .5+.2 depart chain, and nonbuilt/empty cells do nothing',()=>{
  const g=createGame({seed:6,content:registry,debug:{skipPrologue:true}});g.runUntilInput();const c=g.world.spawn(蓝图_营地格);
  const before=g.digest();c.玩家交互();expect(g.digest()).toBe(before);
  c.已建造=true;c.表名='传送阵';c.玩家交互();g.advance(.69);expect(g.view.screen).toBe('title');g.advance(.02);expect(g.view.screen).toBe('map');
 });
 it('chapter portal uses original index0 position and .75 reverse timeline before option changes the run',()=>{
  const g=hub();g.world.mode.通过关卡数=1;UI_关卡地图页面.重置关卡页(g.world.mode,false);
  const portal=g.view.camp!.portals![0];expect(portal.option).toBe('营地');g.advance(2.1);expect(g.view.camp!.portals![0].size).toBe(1);
  expect(g.send({type:'camp.travel',option:'营地'}).ok).toBe(true);g.advance(.74);expect(g.view.screen).toBe('map');expect(g.legal().some(c=>c.type==='camp.travel'||c.type==='map.option')).toBe(false);
  g.advance(.02);expect(g.view.screen).toBe('runEnd');
 });
 it('real camp/statue and stash close hit regions are distinct from drag-addressed cells',()=>{
  const calls:string[]=[],page=new CampPage({}as TextFont,{unlocked:true,options:['营地']},x=>calls.push(x));
  for(const p of [{x:624,y:210},{x:624,y:350}])for(const kind of ['down','up']as const)page.pointer({kind,...p,button:0});expect(calls).toEqual(['statue','营地']);
  const model={cells:[{id:5,name:'旧盾',row:0,col:0,size:2,quality:1}]};const stash=new StashPage({}as TextFont,model,()=>calls.push('close'));
  expect(stashHit(model,360,110)).toBe('item:5');expect(stashHit(model,360,200)).toBe('slot:stash:2:0');expect(stash.hit(360,200)).toBe(false);
  expect(CAMP_UI.portals).toHaveLength(3);
 });
 it('unlocks only through the source item at chapter page and excludes the prologue',()=>{
  const g=hub(),s=GetCustomSave(g.world);expect(g.legal().some(c=>c.type==='page.open'&&c.params?.page.includes('stash'))).toBe(false);
  unlock(g);expect(s.已解锁机制).toContain('永恒神像');expect(g.view.camp?.statue.unlocked).toBe(true);
  const tip=vi.fn();Object.assign(g.world.sys.tutorial,{showTip:tip});
  expect(g.send({type:'camp.statue'}).ok).toBe(true);expect(tip).toHaveBeenCalledExactlyOnceWith(g.world,12);expect(g.view.stash).toMatchObject({rows:10,cols:14});expect(g.send({type:'page.close'}).ok).toBe(true);
  s.新手关中=true;expect(g.send({type:'page.open',page:'stash'}).ok).toBe(false);
 });
 it('creates inclusive 10x14 cells, 35 source lock blocks, and unlocks in column-first 208uu order',()=>{
  const g=hub(),s=GetCustomSave(g.world);s.探索等级进度.set('总值',structOf('结构_分数',{...structOf('结构_分数'),当前解锁等级:2}));initStash(g.world);
  const locks=s.仓库牌数据.filter(c=>c.表名==='锁定格');expect(STASH.rows*STASH.cols).toBe(140);expect(locks).toHaveLength(33);
  expect(locks[0].位置).toEqual({X:-38,Y:-234,Z:312});expect(locks[3].位置).toEqual({X:378,Y:-26,Z:312});
 });
 it('stores actual cards/enchants/round in source meta, destroys temporary actors on close, and preserves them across fresh browser-core worlds',()=>{
  const g=hub(),w=g.world,s=GetCustomSave(w);unlock(g);s.探索等级进度.set('总值',structOf('结构_分数',{...structOf('结构_分数'),当前解锁等级:3}));
  const c=w.cult.创建牌到侧栏('旧剑',2,null,[],s.轮回次数,new Map()).卡牌实例!;c.添加附魔(['英雄附魔_0'],2,false,false,s.轮回次数);const equipped=damage(g);
  expect(g.send({type:'page.open',page:'stash'}).ok).toBe(true);expect(canPlace(w,c,0,0)).toBe(true);
  expect(g.send({type:'item.move',item:c.id,to:{grid:'stash',row:0,col:0}}).ok).toBe(true);expect(damage(g)).toBeLessThan(equipped);
  expect(s.仓库牌数据.filter(c=>c.表名!=='锁定格')).toHaveLength(1);const saved=s.仓库牌数据.find(c=>c.表名==='旧剑')!;expect(saved.品质).toBe(2);expect(saved.附加附魔.map(a=>a.能力名)).toEqual(['英雄附魔_0']);
  expect(g.send({type:'page.close'}).ok).toBe(true);expect(c.valid).toBe(false);expect(g.view.inventory.stash).toEqual([]);
  const fresh=createGame({seed:6,content:registry,save:JSON.parse(JSON.stringify(g.save())),debug:{skipPrologue:true}});fresh.runUntilInput();expect(fresh.send({type:'warning.answer',button:0}).ok).toBe(true);fresh.runUntilInput();fresh.advance(.6);
  expect(fresh.send({type:'page.open',page:'stash'}).ok).toBe(true);const restored=fresh.view.inventory.stash!.find(c=>c.row==='旧剑')!;
  expect(restored.quality).toBe(2);expect(restored.enchants).toEqual(['英雄附魔_0']);expect(restored.place).toEqual({grid:'stash',row:0,col:0});
  expect(fresh.send({type:'item.move',item:restored.id,to:{grid:'equip',row:8,col:0}}).ok).toBe(true);expect(damage(fresh)).toBe(equipped);
  expect(GetCustomSave(fresh.world).仓库牌数据.some(c=>c.表名==='旧剑')).toBe(false);
 });
 it('rejects occupied/locked/out-of-range and legacy/new-old-enchant deposits before mutating equipment',()=>{
  const g=hub(),s=GetCustomSave(g.world);unlock(g);s.探索等级进度.set('总值',structOf('结构_分数',{...structOf('结构_分数'),当前解锁等级:1}));
  const old=g.world.cult.创建牌到侧栏('旧剑',1,null,[],s.轮回次数-1,new Map()).卡牌实例!;expect(g.send({type:'page.open',page:'stash'}).ok).toBe(true);
  const before=g.digest();expect(g.send({type:'item.move',item:old.id,to:{grid:'stash',row:0,col:0}}).ok).toBe(false);expect(g.digest()).toBe(before);
  const c=g.world.cult.创建牌到侧栏('旧匕首',1,null,[],s.轮回次数,new Map()).卡牌实例!;
  expect(g.send({type:'item.move',item:c.id,to:{grid:'stash',row:4,col:0}}).ok).toBe(false);expect(g.send({type:'item.move',item:c.id,to:{grid:'stash',row:0,col:13}}).ok).toBe(false);
  expect(g.send({type:'item.move',item:c.id,to:{grid:'stash',row:0,col:0}}).ok).toBe(true);
 });
});

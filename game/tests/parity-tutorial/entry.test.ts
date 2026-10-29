import { describe,expect,it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { scriptedPolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';
import type { BotGame } from '../../src/bot/api.ts';
import type { Command } from '../../src/core/api/commands.ts';
import { tutorialSave } from '../../src/core/sys/tutorial/tips.ts';
import { UI_关卡地图页面 } from '../../src/core/bp/widgets.ts';
import { GetCustomSave } from '../../src/core/sys/save/ems.ts';
import { bindingFor } from '../../src/game/bind/pages.ts';

describe('ordinary fresh prologue entry and actual seven floors',()=>{
 it('immediate title click cannot be overwritten by the pending old camp room callback',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported'});g.runUntilInput();expect(g.send({type:'title.prologue'}).ok).toBe(true);g.runUntilInput();expect(g.view.tutorial?.name).toBe('前进地图');expect(g.view.phase).toBe('选择地图');expect(g.legal().map(c=>c.type)).toEqual(['tutorial.continue','tutorial.close']);
  expect(g.send({type:'tutorial.continue'}).ok).toBe(true);expect(g.view.map!.cells.filter(c=>c.enterable).map(c=>c.tile)).toEqual(['新手关01']);expect(g.send({type:'map.enter',cell:'r1c1'}).ok).toBe(true);g.runUntilInput();expect(g.view.room?.layout).toBe('新手关01');expect(g.view.phase).toBe('交互场牌');g.advance(2);expect(g.view.phase).toBe('交互场牌');expect(g.view.field.some(a=>a.row==='任务宝箱')).toBe(true);
 });
 it('real source route grants tutorial potion/enchant, first150EXP levelup, gated tips once, and reaches source shop',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported'}),p=scriptedPolicy(),rng=botRng(1,0),tips:string[]=[],loots:string[]=[],floors=new Set<number>();let start=false;
  for(let step=0;step<70;step++){expect(g.runUntilInput(60)).not.toBe('timeout');const v=g.view;if(v.run)floors.add(v.run.floor);if(v.modal?.kind==='loot')loots.push(...v.modal.cells.map(c=>c.row));if(v.run?.floor===5)break;let c:Command|null;
   if(v.tutorial){tips.push(v.tutorial.name);c={type:'tutorial.continue'};}else if(v.screen==='title'&&!start){c={type:'title.prologue'};start=true;}else c=p.choose({game:g as unknown as BotGame,legal:g.legal(),rng,step})as Command|null;
   expect(c).not.toBeNull();expect(g.send(c!).ok).toBe(true);
  }
  expect([...floors]).toEqual([0,1,2,3,4,5]);expect(loots).toEqual(expect.arrayContaining(['旧剑','生命药剂_新手关','伤害附魔A']));expect(g.view.run!.英雄等级).toBeGreaterThanOrEqual(2);
  expect(tips).toEqual(['前进地图','拾取物品','启动弹射','充能说明','敌人攻击','使用物品','英雄升级','进行附魔']);expect(new Set(tips).size).toBe(tips.length);expect(g.coverage.stubs).toEqual({});
 });
 it('actual seven-floor route buys the four-coin hammer, grants500/1000 once, and unlocks ordinary new adventure',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported'}),p=scriptedPolicy(),rng=botRng(1,0),floors=new Set<string>(),loots:string[]=[],tips:string[]=[];let started=false,finished=false,paid=false,scored=false;
  // Floors3/6 deliberately reuse source fixed-location geometry新手关01; the selected map row identifies the floor.
  const observe=()=>{if(g.view.screen==='room')floors.add(g.world.mode.当前层地图格配置表.RowName);};
  const ambient=new Set(['menu.open','page.open','page.close','title.settings','title.quit','map.backpack','item.move','item.use','item.dismantle','item.enchant','item.extract','item.combine','item.modify']);
  for(let step=0;step<150;step++){
   let n=0;for(;n<3600&&!g.legal().some(c=>!ambient.has(c.type));n++){g.advance(1/60);observe();}expect(n).toBeLessThan(3600);
   for(let i=0;i<15;i++){g.advance(1/60);observe();}const v=g.view,l=g.legal();if(v.modal?.kind==='loot')loots.push(...v.modal.cells.map(c=>c.row));
   if(v.modal?.kind==='runEnd'){
    expect(g.world.mode.轮回战斗统计.get('接受指引')).toBe(1);expect(g.world.mode.轮回战斗统计.get('完成探险')).toBe(1);
    expect(v.modal.lines).toContainEqual({label:'接受指引',value:'500 × 1'});expect(v.modal.lines).toContainEqual({label:'完成探险',value:'1000 × 1'});scored=true;
   }
   if(v.screen==='title'&&started){finished=true;break;}
   let c:Command|null;
   if(v.tutorial){tips.push(v.tutorial.name);c={type:'tutorial.continue'};}
   else if(v.screen==='title'){c={type:'title.prologue'};started=true;}
   else if(v.phase==='进入商店'&&!paid){
    const ids=l.find(x=>x.type==='interact')?.params?.actor??[],hammer=v.field.find(a=>a.row==='锻造锤_品质青铜'&&ids.includes(a.id));expect(hammer).toBeDefined();
    const sword=v.inventory.equip.find(a=>a.row==='旧剑');expect(sword?.quality).toBe(1);const before=g.world.mode.金币;
    expect(g.send({type:'interact',actor:hammer!.id}).ok).toBe(true);expect(g.world.mode.金币).toBe(before-4);expect(g.view.inventory.equip.find(a=>a.row==='旧剑')?.quality).toBe(2);paid=true;continue;
   }else c=p.choose({game:g as unknown as BotGame,legal:l,rng,step})as Command|null;
   expect(c,JSON.stringify({screen:v.screen,phase:v.phase,floor:v.run?.floor,legal:l})).not.toBeNull();expect(g.send(c!).ok).toBe(true);
  }
  expect(finished).toBe(true);expect(paid).toBe(true);expect([...floors]).toEqual(expect.arrayContaining(['新手关01','新手关02','新手关03','新手关04','新手关05','新手关06','新手关07']));
  expect(loots).toEqual(expect.arrayContaining(['旧剑','生命药剂_新手关','伤害附魔A','旧盾','灼热眼珠']));expect(tips).toContain('进行合成');
  expect(scored).toBe(true);
  expect(g.save().meta['新手关过？']).toBe(true);expect(tutorialSave(g.world).新手关中).toBe(false);expect(g.view.title?.newRun).toBe(true);
  expect(g.coverage.stubs).toEqual({});
  // Continue with the actual completed-prologue save and ordinary defaults. This next part is a declared camp
  // source boundary: enter its chapter UI and acquire the real unlock item, rather than fabricate completion flags.
  const resumed=createGame({seed:1,content:registry,filter:'ported',save:JSON.parse(JSON.stringify(g.save()))});resumed.runUntilInput();
  if(resumed.view.modal?.kind==='warning'){expect(resumed.send({type:'warning.answer',button:0}).ok).toBe(true);resumed.runUntilInput();}
  expect(resumed.send({type:'title.newRun'}).ok).toBe(true);resumed.runUntilInput();expect(resumed.send({type:'hero.start'}).ok).toBe(true);resumed.runUntilInput();
  UI_关卡地图页面.重置关卡页(resumed.world.mode,false);resumed.world.cult.切换地图页(false,false);
  const s=GetCustomSave(resumed.world);expect(s.新手关过).toBe(true);expect(s.新手关中).toBe(false);
  const broken=resumed.world.cult.创建牌到侧栏('破损的神像',1,null,[],s.轮回次数,new Map()).卡牌实例!;expect(resumed.send({type:'item.use',item:broken.id}).ok).toBe(true);resumed.advance(.5);expect(s.已解锁机制).toContain('永恒神像');
  const shield=resumed.world.cult.创建牌到侧栏('旧盾',1,null,[],s.轮回次数,new Map()).卡牌实例!;expect(resumed.send({type:'camp.statue'}).ok).toBe(true);
  expect(resumed.view.tutorial?.tip).toBe(12);expect(resumed.view.stash).not.toBeNull();expect(bindingFor(resumed.view)?.id).toBe('tutorial');expect(resumed.legal().map(c=>c.type)).toEqual(['tutorial.continue','tutorial.close']);
  const before=resumed.digest();expect(resumed.send({type:'item.move',item:shield.id,to:{grid:'stash',row:0,col:0}}).ok).toBe(false);expect(resumed.digest()).toBe(before);
  expect(resumed.send({type:'tutorial.continue'}).ok).toBe(true);expect(bindingFor(resumed.view)?.id).toBe('stash');expect(resumed.legal().some(c=>c.type==='item.move'&&c.params?.item.includes(shield.id))).toBe(true);
  expect(resumed.send({type:'item.move',item:shield.id,to:{grid:'stash',row:0,col:0}}).ok).toBe(true);expect(resumed.view.inventory.stash?.find(c=>c.id===shield.id)?.place).toEqual({grid:'stash',row:0,col:0});expect(s.仓库牌数据.some(c=>c.表名==='旧盾')).toBe(true);
  expect(resumed.send({type:'page.close'}).ok).toBe(true);expect(resumed.send({type:'camp.statue'}).ok).toBe(true);expect(resumed.view.tutorial).toBeNull();expect(s.已触发新手提示.filter(n=>n==='永恒之盒')).toHaveLength(1);
 });
 it('explicit debug skipPrologue also skips tutorial overlays without changing ordinary default',()=>{const g=createGame({seed:1,content:registry,filter:'ported',debug:{skipPrologue:true}});g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();expect(g.view.tutorial).toBeNull();});
});

import { describe,it,expect } from 'vitest';
import { randomPolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';
import type { BotGame,BotSpec } from '../../src/bot/api.ts';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import type { Command } from '../../src/core/api/commands.ts';
const spec:BotSpec={type:'item.move',params:{item:[1,2],'to.grid':['equip','backpack'],'to.row':[0,1,2,3,4,5,6,7,8,9],'to.col':[0]}};
describe('bot inventory selection is a pure conservative placement strategy',()=>{
 it('never selects a too-tall, locked, occupied or unchanged span from Cartesian values',()=>{
  const view={screen:'room',time:0,inventory:{equip:[{id:1,size:[1,3],place:{row:0,col:0}}],backpack:[{id:2,size:[1,2],place:{row:8,col:0}}],lockedRows:[3,5,7]}};
  const game={view}as unknown as BotGame,policy=randomPolicy(),rng=botRng(3);
  for(let i=0;i<100;i++){
   const c=policy.choose({game,legal:[spec],rng,step:i})as {type:string;item:number;to:{grid:'equip'|'backpack';row:number;col:number}};
   const size=c.item===1?3:2;expect(c.to.row+size).toBeLessThanOrEqual(10);expect(c.to.col).toBe(0);
   const occupied=new Set(c.to.grid==='equip'?[3,5,7]:[]);for(const old of view.inventory[c.to.grid])if(old.id!==c.item)for(let n=0;n<old.size[1]!;n++)occupied.add(old.place.row+n);
   for(let n=0;n<size;n++)expect(occupied.has(c.to.row+n)).toBe(false);
  }
 });
 it('full locked inventory contributes no invalid move, and fake fixtures without inventory retain their declared command',()=>{
  const policy=randomPolicy(),rng=botRng(9),card={id:1,size:[1,10],place:{row:0,col:0}};
  const game={view:{screen:'room',time:0,inventory:{equip:[card],backpack:[{...card,id:2}],lockedRows:[]}}}as unknown as BotGame;
  expect(policy.choose({game,legal:[spec],rng,step:0})).toBeNull();
  const fake={view:{screen:'room',time:0}}as BotGame;
  expect(policy.choose({game:fake,legal:[{type:'item.move',params:{item:[1],'to.grid':['equip'],'to.row':[9],'to.col':[0]}}],rng,step:0})).toEqual({type:'item.move',item:1,to:{grid:'equip',row:9,col:0}});
 });
 it('real mixed-size inventory accepts every chosen movement without changing the player placement rules',()=>{
  const g=createGame({seed:3,content:registry,filter:'ported',debug:{skipPrologue:true}});g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();
  for(const row of['旧盔甲','旧剑','旧法杖','旧盾'])expect(g.world.cult.创建牌到侧栏(row,1,null,[],0,new Map()).卡牌实例).toBeTruthy();
  const policy=randomPolicy(),rng=botRng(3);let moves=0;
  for(let i=0;i<60;i++){
   const digest=g.digest(),c=policy.choose({game:g,legal:g.legal().filter(s=>s.type==='item.move'),rng,step:i});expect(g.digest()).toBe(digest);
   if(!c)break;expect(g.send(c as Command),JSON.stringify(c)).toEqual({ok:true});moves++;
  }
  expect(moves).toBe(60);
 });
});

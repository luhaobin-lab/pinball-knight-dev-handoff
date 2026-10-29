import {describe,expect,it,vi} from 'vitest';
import {fixture} from '../parity-items/fixture.ts';
import {createGame} from '../../src/core/api/game.ts';
import {routeCommand} from '../../src/core/api/compose.ts';
import {registry} from '../../src/content/bp/index.ts';

describe('source dismantle from player commands',()=>{
 it('normal first-chest item dismantles once at its current refund price, removes actual grid inventory and rejects repeat input',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported',debug:{skipPrologue:true}});
  for(const type of ['title.newRun','hero.start'] as const){g.runUntilInput();expect(g.send({type}).ok).toBe(true);}g.runUntilInput();
  const tile=g.view.map!.cells.find(c=>c.enterable&&c.reward==='初始奖励B')!;g.send({type:'map.enter',cell:tile.id});g.advance(2);
  const chest=g.world.mode.场上所有.find(a=>a?.名字==='任务宝箱')!;g.send({type:'interact',actor:chest.id});g.advance(3);
  const c=g.world.cult.未拾取牌[0]!;expect(g.send({type:'loot.take',item:c.id}).ok).toBe(true);g.runUntilInput();
  const gold=g.world.mode.金币,price=c.当前价格,id=c.id;
  expect(g.legal().some(x=>x.type==='item.dismantle'&&x.params?.item.includes(id))).toBe(true);
  expect(g.send({type:'item.dismantle',item:id})).toEqual({ok:true});expect(g.world.mode.金币).toBe(gold+price);
  expect([...g.view.inventory.equip,...g.view.inventory.backpack].some(x=>x.id===id)).toBe(false);
  expect(g.world.mode.轮回战斗统计.get('分解物品')).toBe(1);expect(g.send({type:'item.dismantle',item:id}).ok).toBe(false);expect(g.world.mode.金币).toBe(gold+price);
 });
 it('real acquired 活脑 enters its own dismantle effect via the command and grants source EXP before destruction',()=>{
  const f=fixture(),brain=f.item('活脑',2),add=vi.spyOn(f.w.mode,'增加经验');f.w.mode.场上有敌人=false;
  expect(routeCommand(f.w,{type:'item.dismantle',item:brain.id}).ok).toBe(true);
  expect(add.mock.calls.some(c=>c[0]===100&&c[1]===brain)).toBe(true);expect(brain.valid).toBe(false);
 });
 it('source current nonzero price is refunded once after unloading, without replacing it with dust or recomputing the price',()=>{
  const f=fixture(),sword=f.item('旧剑');f.w.mode.场上有敌人=false;sword.更新价格(false);
  const price=sword.当前价格,gold=f.w.mode.金币;expect(price).toBeGreaterThan(0);
  expect(routeCommand(f.w,{type:'item.dismantle',item:sword.id}).ok).toBe(true);expect(f.w.mode.金币).toBe(gold+price);
  expect(routeCommand(f.w,{type:'item.dismantle',item:sword.id}).ok).toBe(false);expect(f.w.mode.金币).toBe(gold+price);
 });
 it('source enchant consumption skips refund, morale, dismantle stats and tagged dismantle effects',()=>{
  const f=fixture(),brain=f.item('活脑',2),gold=f.w.mode.金币,add=vi.spyOn(f.w.mode,'增加经验');
  f.w.cult.分解牌(brain,true,false);expect(brain.valid).toBe(false);expect(f.w.mode.金币).toBe(gold);expect(add).not.toHaveBeenCalled();expect(f.w.mode.轮回战斗统计.get('分解物品')??0).toBe(0);
 });
 it('unpaid source offers refuse normal dismantling; disarm does not suppress owned-item dismantle',()=>{
  const f=fixture(),sword=f.item('旧剑'),gold=f.w.mode.金币;f.w.cult.未拾取牌.push(sword);
  f.w.cult.分解牌(sword,false,false);expect(sword.valid).toBe(true);expect(f.w.mode.金币).toBe(gold);
  f.w.cult.未拾取牌.splice(f.w.cult.未拾取牌.indexOf(sword),1);f.hero.OwnedGameplayTags.add('状态.缴械');
  f.w.mode.场上有敌人=true;expect(routeCommand(f.w,{type:'item.dismantle',item:sword.id}).ok).toBe(false);expect(sword.valid).toBe(true);
  f.w.mode.场上有敌人=false;
  expect(routeCommand(f.w,{type:'item.dismantle',item:sword.id}).ok).toBe(true);expect(sword.valid).toBe(false);
 });
});

import { describe, expect, it } from 'vitest';
import { fixture } from '../parity-items/fixture.ts';
import { openCraft, craftView, selectRecipe, manufacture, takeCraftItem, closeCraft, changeQuality } from '../../src/core/sys/craft/page.ts';
import { recipePrice, recipeGroups, craftSave } from '../../src/core/sys/craft/recipes.ts';
import { routeCommand } from '../../src/core/api/compose.ts';

describe('actual source manufacture page boundaries',()=>{
 it('改造旧剑 lists source item recipes; real insertion consumes old sword+ore, pays exact price once and creates revealed free晶核剑',()=>{
  const f=fixture(),sword=f.item('旧剑'),ore=f.item('精矿');f.w.mode.场上有敌人=false;f.w.mode.当前总层数=99;f.w.mode.金币=100;
  expect(routeCommand(f.w,{type:'item.modify',item:sword.id}).ok).toBe(true);expect(craftView(f.w)!.groups.flatMap(g=>g.rows.map(r=>r.row))).toContain('晶核剑');expect(selectRecipe(f.w,'晶核剑')).toBe(true);
  expect(routeCommand(f.w,{type:'craft.put',item:sword.id}).ok).toBe(true);expect(routeCommand(f.w,{type:'craft.put',item:ore.id}).ok).toBe(true);expect(f.w.cult.修炼物品格_已装备!.拥有的物品).not.toContain(sword);
  const before=f.w.digest(),rng=f.w.rng.save(),v=craftView(f.w)!;expect(v.outputQuality).toBe(1);expect(v.canCraft).toBe(true);for(let i=0;i<10;i++){craftView(f.w);f.w.sys.craft.legal!(f.w);}expect(f.w.digest()).toBe(before);expect(f.w.rng.save()).toEqual(rng);
  expect(manufacture(f.w,'晶核剑',1)).toBe(true);expect(sword.valid).toBe(false);expect(ore.valid).toBe(false);expect(f.w.mode.金币).toBe(100-recipePrice('晶核剑',1));expect(manufacture(f.w,'晶核剑',1)).toBe(false);
  const output=f.w.cult.未拾取牌.find(c=>c?.名字==='晶核剑')!;expect(output.当前价格).toBe(0);expect(output.已揭示).toBe(true);expect(takeCraftItem(f.w,output.id)).toBe(true);expect(craftSave(f.w).已解锁配方).toContain('晶核剑');expect(closeCraft(f.w)).toBe(true);
 });
 it('material-only recipe quality multiplier pays4x materials and exact gold, grants sourcequality3祝福 and makesquality3 output',()=>{
  const f=fixture();f.w.mode.场上有敌人=false;f.w.mode.当前总层数=99;f.w.mode.金币=1000;f.w.mode.材料包.set('灌草',100);craftSave(f.w).已解锁配方.push('精矿');expect(openCraft(f.w)).toBe(true);expect(selectRecipe(f.w,'精矿')).toBe(true);
  expect(changeQuality(f.w,1)).toBe(true);expect(changeQuality(f.w,1)).toBe(true);const v=craftView(f.w)!;expect(v.outputQuality).toBe(3);expect(v.materials.find(m=>m.row==='灌草')!.need).toBe(20);expect(v.canCraft).toBe(true);expect(manufacture(f.w,'精矿',1)).toBe(true);expect(f.w.mode.材料包.get('灌草')).toBe(80);expect(f.w.mode.金币).toBe(1000-recipePrice('精矿',3));
  expect(f.w.cult.未拾取牌.find(c=>c?.名字==='精矿')!.品质).toBe(3);expect([...f.w.cult.已装备牌,...f.w.cult.背包里牌,...f.w.cult.未拾取牌].filter(c=>c?.名字==='祝福之灵').map(c=>c!.品质)).toEqual([3]);
 });
 it('locked recipe cannot be selected/manufactured and item input quality is inherited without offering quality buttons',()=>{
  const f=fixture(),bottle=f.item('空瓶',2);f.w.mode.场上有敌人=false;f.w.mode.当前总层数=99;f.w.mode.金币=1000;expect(openCraft(f.w,bottle)).toBe(true);expect(selectRecipe(f.w,'生命药剂')).toBe(true);expect(routeCommand(f.w,{type:'craft.put',item:bottle.id}).ok).toBe(true);const v=craftView(f.w)!;expect(v.outputQuality).toBe(2);expect(v.canIncrease).toBe(false);expect(v.canDecrease).toBe(false);
  expect(manufacture(f.w,'生命药剂',1)).toBe(true);const potion=f.w.cult.未拾取牌.find(c=>c?.名字==='生命药剂')!;expect(potion.品质).toBe(2);expect(closeCraft(f.w)).toBe(true);expect(f.w.cult.已装备牌).toContain(potion);
 });
 it('recipe switch returns incompatible ingredients through actual pickup and supports material page without stage-list mutation',()=>{
  const f=fixture(),sword=f.item('旧剑');f.w.mode.场上有敌人=false;f.w.mode.当前总层数=99;expect(openCraft(f.w,sword)).toBe(true);expect(selectRecipe(f.w,'晶核剑')).toBe(true);expect(routeCommand(f.w,{type:'craft.put',item:sword.id}).ok).toBe(true);expect(closeCraft(f.w)).toBe(true);expect(f.w.cult.已装备牌).toContain(sword);
  const count=recipeGroups(f.w,null).flatMap(g=>g.rows).length;expect(count).toBeGreaterThan(10);expect(routeCommand(f.w,{type:'page.open',page:'materials'}).ok).toBe(true);expect(f.w.cult.材料页关闭了).toBe(false);
 });
 it('source one-input count-only quirk permits paying again to recraft an unclaimed output and keeps its quality',()=>{
  const f=fixture(),bottle=f.item('空瓶',2);f.w.mode.场上有敌人=false;f.w.mode.当前总层数=99;f.w.mode.金币=50;openCraft(f.w,bottle);selectRecipe(f.w,'生命药剂');routeCommand(f.w,{type:'craft.put',item:bottle.id});expect(manufacture(f.w,'生命药剂',1)).toBe(true);const first=f.w.cult.未拾取牌[0]!;
  expect(craftView(f.w)!.canCraft).toBe(true);expect(craftView(f.w)!.outputQuality).toBe(2);expect(manufacture(f.w,'生命药剂',1)).toBe(true);expect(first.valid).toBe(false);expect(f.w.cult.未拾取牌).toHaveLength(1);expect(f.w.cult.未拾取牌[0]!.品质).toBe(2);expect(f.w.mode.金币).toBe(50-2*recipePrice('生命药剂',2));
 });
 it('full actual grids prevent closing from discarding an ingredient; after making room the same card can be recovered',()=>{
  const f=fixture(),bottle=f.item('空瓶');f.w.mode.场上有敌人=false;f.w.mode.当前总层数=99;openCraft(f.w,bottle);selectRecipe(f.w,'生命药剂');routeCommand(f.w,{type:'craft.put',item:bottle.id});
  const filled=[];for(let n=0;n<20;n++){const c=f.w.cult.创建牌到侧栏('旧匕首',1,null,[],0,new Map()).卡牌实例;if(c)filled.push(c);}expect(closeCraft(f.w)).toBe(false);expect(bottle.valid).toBe(true);expect(f.w.cult.未拾取牌).toContain(bottle);expect(f.w.cult.制造页关闭了).toBe(false);
  filled[0].被抓起(true);f.w.cult.移除物品(filled[0]);expect(closeCraft(f.w)).toBe(true);expect([...f.w.cult.已装备牌,...f.w.cult.背包里牌]).toContain(bottle);
 });
});
